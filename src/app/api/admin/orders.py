from app.api.admin import admin_bp
from flask import jsonify, request, current_app
from app.api.utils import normalize_order_status, get_product_by_id, admin_required, permission_required
from app.models.orders import Order
from app.models.stock import Stock
from app.models.stock_moves import StockMove
from app.models.order_items import OrderItem
from app.models import db
from app.models.status_enums import OrderStatus


@admin_bp.route('/orders', methods=['GET'])
@permission_required('admin.orders.list')
def admin_list_orders():
    user, error, status = admin_required('admin.orders.list')
    if error:
        return error, status

    orders = Order.query.all()
    result = []
    for order in orders:
        total_value = None
        try:
            total_value = float(order.total) if order.total is not None else None
        except Exception:
            total_value = None

        if not total_value:
            total_value = 0.0
            for item in order.items or []:
                unit_price = item.unit_price if item.unit_price is not None else (item.product.price if item.product else 0)
                try:
                    total_value += float(unit_price or 0) * (item.quantity or 0)
                except Exception:
                    continue

        result.append({
            'id': order.id,
            'client': order.client.name if order.client else None,
            'status': order.status,
            'total': float(total_value),
            'reason': order.reason,
            'product_summary': ', '.join([item.product.name for item in order.items if item.product]) or None,
            'quantity_total': sum([item.quantity for item in order.items]) if order.items else 0,
            'cart_id': order.cart_id,
            'created_at': order.created_at.isoformat() if order.created_at else None
        })

    return jsonify(result)


@admin_bp.route('/orders/<int:order_id>', methods=['GET'])
@permission_required('admin.orders.list')
def admin_get_order(order_id):
    user, error, status = admin_required()
    if error:
        return error, status

    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Pedido não encontrado'}), 404
    total_value = None
    try:
        total_value = float(order.total) if order.total is not None else None
    except Exception:
        total_value = None

    if not total_value:
        total_value = 0.0
        for item in order.items or []:
            unit_price = item.unit_price if item.unit_price is not None else (item.product.price if item.product else 0)
            try:
                total_value += float(unit_price or 0) * (item.quantity or 0)
            except Exception:
                continue

    return jsonify({
        'id': order.id,
        'client': order.client.name if order.client else None,
        'status': order.status,
        'total': float(total_value),
        'reason': order.reason,
        'created_at': order.created_at.isoformat() if order.created_at else None,
        'items': [{
            'product': item.product.name if item.product else None,
            'description': item.product.description if item.product else None,
            'image_url': item.product.photo_path if item.product else None,
            'quantity': item.quantity,
            'unit_price': float(item.unit_price) if item.unit_price is not None else (float(item.product.price) if item.product and getattr(item.product, 'price', None) is not None else 0),
            'subtotal': float(item.unit_price if item.unit_price is not None else (item.product.price if item.product else 0)) * (item.quantity or 0)
        } for item in order.items]
    })


@admin_bp.route('/orders/<int:order_id>/status', methods=['PATCH'])
def admin_update_order_status(order_id):
    user, error, status = admin_required()
    if error:
        return error, status

    data = request.get_json() or {}
    action = data.get('action')
    if not action:
        return jsonify({'error': 'Ação é obrigatória'}), 400
    action_permission_map = {
        'approve': 'admin.orders.approve',
        'approved': 'admin.orders.approve',
        'reject': 'admin.orders.reject',
        'rejected': 'admin.orders.reject',
        'cancel': 'admin.orders.cancel',
        'cancelled': 'admin.orders.cancel',
        'canceled': 'admin.orders.cancel',
        'finish': 'admin.orders.approve',
        'finished': 'admin.orders.approve',
        'picked_up': 'admin.orders.approve',
    }
    required_permission = action_permission_map.get(action)
    if required_permission and not user.has_permission(required_permission):
        return jsonify({'error': 'Permissão insuficiente'}), 403

    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Pedido não encontrado'}), 404

    data = request.get_json() or {}
    requested_status = data.get('status')
    action = data.get('action')
    action_status_map = {
        'approve': OrderStatus.APPROVED.value,
        'approved': OrderStatus.APPROVED.value,
        'reject': OrderStatus.REJECTED.value,
        'rejected': OrderStatus.REJECTED.value,
        'cancel': OrderStatus.CANCELLED.value,
        'cancelled': OrderStatus.CANCELLED.value,
        'canceled': OrderStatus.CANCELLED.value,
        'finish': OrderStatus.FINISHED.value,
        'finished': OrderStatus.FINISHED.value,
        'picked_up': OrderStatus.FINISHED.value,
    }
    new_status = action_status_map.get(action, requested_status)
    allowed_statuses = {status.value for status in OrderStatus}
    if new_status not in allowed_statuses:
        return jsonify({'error': 'Status de pedido inválido'}), 400

    current_status = normalize_order_status(order.status)
    allowed_transitions = {
        OrderStatus.PENDING.value: {OrderStatus.APPROVED.value, OrderStatus.REJECTED.value, OrderStatus.CANCELLED.value},
        OrderStatus.APPROVED.value: {OrderStatus.FINISHED.value, OrderStatus.CANCELLED.value},
        OrderStatus.FINISHED.value: set(),
        OrderStatus.REJECTED.value: set(),
        OrderStatus.CANCELLED.value: set(),
    }
    if new_status != current_status and new_status not in allowed_transitions.get(current_status, set()):
        return jsonify({'error': 'Transição de status inválida'}), 400

    # If transition to 'finished', apply stock changes and create StockMoves
    if new_status == OrderStatus.FINISHED.value and new_status != current_status:
        try:
            for item in order.items or []:
                product = item.product
                if not product:
                    continue

                stock = product.stock
                if not stock:
                    stock = Stock(product_id=product.id, quantity=0)
                    db.session.add(stock)
                    db.session.flush()

                qty = int(item.quantity or 0)
                quantity_change_int = -qty
                old_qty = stock.quantity or 0
                stock.quantity = max((stock.quantity or 0) + quantity_change_int, 0)
                try:
                    current_app.logger.info(f"[StockChange] order_finish order_id={order.id} stock_id={stock.id} product_id={product.id} {old_qty} -> {stock.quantity} change={quantity_change_int}")
                except Exception:
                    pass

                move_type = 'entrada' if quantity_change_int > 0 else 'saida'
                client_name = (order.client.name if getattr(order, 'client', None) and getattr(order.client, 'name', None) else 'Desconhecido')
                reason = f'Solicitação de retirada #{order.id}, Cliente #{order.client_id} - {client_name}'
                move = StockMove(stock=stock, quantity_change=quantity_change_int, reason=reason, move_type=move_type)
                db.session.add(move)
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': 'Falha ao aplicar alterações de estoque', 'details': str(e)}), 500

    order.status = new_status
    db.session.commit()
    return jsonify({'id': order.id, 'status': order.status})
