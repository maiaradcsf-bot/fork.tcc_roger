from app.api.admin import admin_bp
from flask import jsonify, request
from app.api.utils import normalize_order_status, get_product_by_id, admin_required, permission_required
from app.models.orders import Order
from app.models.stock import Stock
from app.models.stock_moves import StockMove
from app.models.order_items import OrderItem
from app.models import db
from app.models.status_enums import OrderStatus
from datetime import datetime
from sqlalchemy.orm import joinedload


def _get_or_create_locked_stock(product):
    stock = Stock.query.filter_by(product_id=product.id).with_for_update().populate_existing().first()
    if not stock:
        stock = Stock(product_id=product.id, quantity=0)
        db.session.add(stock)
        db.session.flush()
    return stock


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
            'created_at': order.created_at.isoformat() if order.created_at else None,
            'approved_user_id': order.approved_user_id,
            'approved_at': order.approved_at.isoformat() if order.approved_at else None,
            'approved_by_name': order.approved_by.username if order.approved_by else None,
            'refused_user_id': order.refused_user_id,
            'refused_at': order.refused_at.isoformat() if order.refused_at else None,
            'refused_by_name': order.refused_by.username if order.refused_by else None,
            'finished_user_id': order.finished_user_id,
            'finished_at': order.finished_at.isoformat() if order.finished_at else None,
            'finished_by_name': order.finished_by.username if order.finished_by else None,
            'canceled_user_id': order.canceled_user_id,
            'canceled_client_id': order.canceled_client_id,
            'canceled_at': order.canceled_at.isoformat() if order.canceled_at else None,
            'canceled_by_name': order.canceled_by.username if order.canceled_by else (order.canceled_by_client.name if order.canceled_by_client else None)
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
        'approved_user_id': order.approved_user_id,
        'approved_at': order.approved_at.isoformat() if order.approved_at else None,
        'approved_by_name': order.approved_by.username if order.approved_by else None,
        'refused_user_id': order.refused_user_id,
        'refused_at': order.refused_at.isoformat() if order.refused_at else None,
        'refused_by_name': order.refused_by.username if order.refused_by else None,
        'finished_user_id': order.finished_user_id,
        'finished_at': order.finished_at.isoformat() if order.finished_at else None,
        'finished_by_name': order.finished_by.username if order.finished_by else None,
        'canceled_user_id': order.canceled_user_id,
        'canceled_client_id': order.canceled_client_id,
        'canceled_at': order.canceled_at.isoformat() if order.canceled_at else None,
        'canceled_by_name': order.canceled_by.username if order.canceled_by else (order.canceled_by_client.name if order.canceled_by_client else None),
        'items': [{
            'product': item.product.name if item.product else None,
            'description': item.product.description if item.product else None,
            'image_url': item.product.photo_path if item.product else None,
            'barcode': item.product.barcode if item.product else None,
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

    order = Order.query.options(
        joinedload(Order.items).joinedload(OrderItem.product)
    ).filter(Order.id == order_id).with_for_update().one_or_none()
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
        OrderStatus.FINISHED.value: {OrderStatus.CANCELLED.value},
        OrderStatus.REJECTED.value: set(),
        OrderStatus.CANCELLED.value: set(),
    }
    if new_status != current_status and new_status not in allowed_transitions.get(current_status, set()):
        return jsonify({'error': 'Transição de status inválida'}), 400

    current_time = datetime.utcnow()

    client_name = (order.client.name if getattr(order, 'client', None) and getattr(order.client, 'name', None) else 'Desconhecido')

    # Finishing withdraws the items from stock; if stock is short the request is refused
    # unless the admin explicitly accepts withdrawing only what is available (allow_partial)
    if new_status == OrderStatus.FINISHED.value and new_status != current_status:
        requested_by_product = {}
        for item in order.items or []:
            if not item.product:
                continue
            entry = requested_by_product.setdefault(item.product.id, {'product': item.product, 'requested': 0})
            entry['requested'] += int(item.quantity or 0)

        withdrawals = []
        shortages = []
        for entry in requested_by_product.values():
            product = entry['product']
            stock = _get_or_create_locked_stock(product)
            available = max(stock.quantity or 0, 0)
            requested = entry['requested']
            if requested > available:
                shortages.append({
                    'product_id': product.id,
                    'product_name': product.name,
                    'requested': requested,
                    'available': available,
                })
            withdrawals.append((stock, min(requested, available)))

        if shortages and not data.get('allow_partial'):
            db.session.rollback()
            return jsonify({
                'error': 'Estoque insuficiente para concluir a retirada',
                'code': 'insufficient_stock',
                'shortages': shortages,
            }), 409

        reason = f'Solicitação de retirada #{order.id}, Cliente #{order.client_id} - {client_name}'
        for stock, quantity in withdrawals:
            if quantity <= 0:
                continue
            stock.quantity = (stock.quantity or 0) - quantity
            db.session.add(StockMove(
                stock=stock, quantity_change=-quantity, reason=reason,
                move_type='saida', user_id=user.id, order_id=order.id,
            ))

    # Cancelling a finished order returns exactly what its withdrawals took out of stock
    if new_status == OrderStatus.CANCELLED.value and current_status == OrderStatus.FINISHED.value:
        withdrawals = StockMove.query.filter(
            StockMove.order_id == order.id,
            StockMove.is_reversal.is_(False),
            StockMove.reverted_at.is_(None),
        ).with_for_update().all()
        reason = f'Estorno de estoque - pedido #{order.id} cancelado após retirada, Cliente #{order.client_id} - {client_name}'
        for move in withdrawals:
            Stock.query.filter_by(id=move.stock_id).with_for_update().populate_existing().first()
            db.session.add(move.revert(user.id, reason))

    if new_status == OrderStatus.APPROVED.value and new_status != current_status:
        order.approved_user_id = user.id
        order.approved_at = current_time
    elif new_status == OrderStatus.REJECTED.value and new_status != current_status:
        order.refused_user_id = user.id
        order.refused_at = current_time
    elif new_status == OrderStatus.CANCELLED.value and new_status != current_status:
        order.canceled_user_id = user.id
        order.canceled_at = current_time
    elif new_status == OrderStatus.FINISHED.value and new_status != current_status:
        order.finished_user_id = user.id
        order.finished_at = current_time

    order.status = new_status
    db.session.commit()
    return jsonify({'id': order.id, 'status': order.status})
