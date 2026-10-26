from app.api.admin import admin_bp
from flask import jsonify, request
from app.api.utils import normalize_order_status, admin_required, permission_required, lock_stocks, stock_transaction
from app.models.orders import Order
from app.models.stock import Stock
from app.models.stock_moves import StockMove
from app.models.order_items import OrderItem
from app.models import db
from app.models.status_enums import OrderStatus
from datetime import datetime


# Raw status values that normalize to 'approved' (older rows may still use the Portuguese one)
APPROVED_STATUS_VALUES = [OrderStatus.APPROVED.value, 'aprovado']


def _requested_by_product(order):
    requested = {}
    for item in order.items or []:
        if not item.product:
            continue
        entry = requested.setdefault(item.product.id, {'product': item.product, 'requested': 0})
        entry['requested'] += int(item.quantity or 0)
    return requested


def _committed_by_product(product_ids, exclude_order_id):
    """Quantities of each product held by approved orders that were not picked up yet."""
    rows = db.session.query(OrderItem.product_id, db.func.sum(OrderItem.quantity)).join(
        Order, Order.id == OrderItem.order_id
    ).filter(
        Order.status.in_(APPROVED_STATUS_VALUES),
        Order.id != exclude_order_id,
        OrderItem.product_id.in_(list(product_ids)),
    ).group_by(OrderItem.product_id).all()
    return {product_id: int(total or 0) for product_id, total in rows}


def _negative_stock_response(product, quantity):
    return jsonify({
        'error': f'Saldo de estoque inconsistente para {product.name} ({quantity}). Corrija o estoque antes de continuar.',
        'code': 'inconsistent_stock',
        'product_id': product.id,
    }), 409


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


# Single source of truth for admin order actions: the target status is always derived
# from the action, and each action requires its own permission. Finishing (pick-up)
# has no dedicated permission in the system and reuses admin.orders.approve.
# locks_stock: the action reads or changes stock, so the order's stock rows are locked first.
ORDER_ACTIONS = {
    'approve': {
        'status': OrderStatus.APPROVED.value,
        'permission': 'admin.orders.approve',
        'from': {OrderStatus.PENDING.value},
        'locks_stock': True,
    },
    'reject': {
        'status': OrderStatus.REJECTED.value,
        'permission': 'admin.orders.reject',
        'from': {OrderStatus.PENDING.value},
        'locks_stock': False,
    },
    'finish': {
        'status': OrderStatus.FINISHED.value,
        'permission': 'admin.orders.approve',
        'from': {OrderStatus.APPROVED.value},
        'locks_stock': True,
    },
    'cancel': {
        'status': OrderStatus.CANCELLED.value,
        'permission': 'admin.orders.cancel',
        'from': {OrderStatus.PENDING.value, OrderStatus.APPROVED.value, OrderStatus.FINISHED.value},
        'locks_stock': True,
    },
}

ORDER_ACTION_ALIASES = {
    'approved': 'approve',
    'rejected': 'reject',
    'finished': 'finish',
    'picked_up': 'finish',
    'cancelled': 'cancel',
    'canceled': 'cancel',
}


@admin_bp.route('/orders/<int:order_id>/status', methods=['PATCH'])
@stock_transaction
def admin_update_order_status(order_id):
    user, error, status = admin_required()
    if error:
        return error, status

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Corpo da requisição inválido'}), 400

    action = data.get('action')
    if not isinstance(action, str) or not action.strip():
        return jsonify({'error': 'Ação é obrigatória'}), 400
    action = action.strip().lower()
    action = ORDER_ACTION_ALIASES.get(action, action)
    action_config = ORDER_ACTIONS.get(action)
    if not action_config:
        return jsonify({'error': 'Ação não suportada'}), 400

    if not user.has_permission(action_config['permission']):
        return jsonify({'error': 'Permissão insuficiente'}), 403

    new_status = action_config['status']

    # 'status' is not an alternative way to choose the target; if sent, it must agree with the action
    if 'status' in data:
        requested_status = data.get('status')
        if not isinstance(requested_status, str) or normalize_order_status(requested_status.strip()) != new_status:
            return jsonify({'error': 'Status informado não corresponde à ação'}), 400

    # Items never change after the order is created, so their products can be read before
    # locking. Stock rows are locked first (ascending product_id), then the order row, then
    # stock moves: the same order every stock route follows, which prevents deadlocks.
    product_ids = [product_id for (product_id,) in db.session.query(OrderItem.product_id).filter(OrderItem.order_id == order_id).all()]
    stocks = lock_stocks(product_ids) if action_config['locks_stock'] else {}

    order = Order.query.filter(Order.id == order_id).with_for_update().populate_existing().one_or_none()
    if not order:
        db.session.rollback()
        return jsonify({'error': 'Pedido não encontrado'}), 404

    current_status = normalize_order_status(order.status)
    if current_status not in action_config['from']:
        db.session.rollback()
        return jsonify({'error': 'Transição de status inválida'}), 400

    current_time = datetime.utcnow()

    client_name = (order.client.name if getattr(order, 'client', None) and getattr(order.client, 'name', None) else 'Desconhecido')
    response = {}

    # Approving commits stock to the order: the free quantity (stock minus what other approved,
    # not yet picked-up orders hold) must cover it. There is no override for this check.
    if new_status == OrderStatus.APPROVED.value:
        requested_by_product = _requested_by_product(order)
        committed = _committed_by_product(requested_by_product.keys(), order.id)
        shortages = []
        for product_id, entry in sorted(requested_by_product.items()):
            product = entry['product']
            stock = stocks.get(product_id)
            available = stock.quantity if stock and stock.quantity is not None else 0
            if available < 0:
                db.session.rollback()
                return _negative_stock_response(product, available)
            free = available - committed.get(product_id, 0)
            if entry['requested'] > free:
                shortages.append({
                    'product_id': product_id,
                    'product_name': product.name,
                    'requested': entry['requested'],
                    'available': available,
                    'committed': committed.get(product_id, 0),
                    'free': free,
                })
        if shortages:
            db.session.rollback()
            return jsonify({
                'error': 'Estoque livre insuficiente para aprovar o pedido (considerando outros pedidos aprovados e não retirados)',
                'code': 'insufficient_committed_stock',
                'shortages': shortages,
            }), 409

    # Finishing withdraws the items from stock; if stock is short the request is refused
    # unless the admin explicitly accepts withdrawing only what is available (allow_partial)
    if new_status == OrderStatus.FINISHED.value:
        requested_by_product = _requested_by_product(order)
        withdrawals = []
        shortages = []
        for product_id, entry in sorted(requested_by_product.items()):
            product = entry['product']
            stock = stocks.get(product_id)
            available = stock.quantity if stock and stock.quantity is not None else 0
            if available < 0:
                db.session.rollback()
                return _negative_stock_response(product, available)
            requested = entry['requested']
            if requested > available:
                shortages.append({
                    'product_id': product_id,
                    'product_name': product.name,
                    'requested': requested,
                    'available': available,
                })
            withdrawals.append((product, stock, requested, min(requested, available)))

        if shortages and data.get('allow_partial') is not True:
            db.session.rollback()
            return jsonify({
                'error': 'Estoque insuficiente para concluir a retirada',
                'code': 'insufficient_stock',
                'shortages': shortages,
            }), 409

        if sum(quantity for _, _, _, quantity in withdrawals) <= 0:
            db.session.rollback()
            return jsonify({
                'error': 'Nenhum item do pedido tem estoque disponível para retirada',
                'code': 'no_stock_available',
                'shortages': shortages,
            }), 409

        reason = f'Solicitação de retirada #{order.id}, Cliente #{order.client_id} - {client_name}'
        delivered = []
        for product, stock, requested, quantity in withdrawals:
            delivered.append({'product_id': product.id, 'product_name': product.name, 'requested': requested, 'withdrawn': quantity})
            if quantity <= 0:
                continue
            stock.quantity = stock.quantity - quantity
            db.session.add(StockMove(
                stock=stock, quantity_change=-quantity, reason=reason,
                move_type='saida', user_id=user.id, order_id=order.id,
            ))
        response['withdrawn'] = delivered
        response['partial'] = bool(shortages)

    # Cancelling a finished order returns exactly what its withdrawals took out of stock.
    # Already reverted moves are skipped, and a cancelled order accepts no further action,
    # so the return can never happen twice.
    if new_status == OrderStatus.CANCELLED.value and current_status == OrderStatus.FINISHED.value:
        withdrawals = StockMove.query.filter(
            StockMove.order_id == order.id,
            StockMove.is_reversal.is_(False),
            StockMove.reverted_at.is_(None),
        ).order_by(StockMove.id).with_for_update().all()
        reason = f'Estorno de estoque - pedido #{order.id} cancelado após retirada, Cliente #{order.client_id} - {client_name}'
        locked_stock_ids = {stock.id for stock in stocks.values()}
        for move in withdrawals:
            if move.stock_id not in locked_stock_ids:
                Stock.query.filter_by(id=move.stock_id).with_for_update().populate_existing().first()
            db.session.add(move.revert(user.id, reason))

    if new_status == OrderStatus.APPROVED.value:
        order.approved_user_id = user.id
        order.approved_at = current_time
    elif new_status == OrderStatus.REJECTED.value:
        order.refused_user_id = user.id
        order.refused_at = current_time
    elif new_status == OrderStatus.CANCELLED.value:
        order.canceled_user_id = user.id
        order.canceled_at = current_time
    elif new_status == OrderStatus.FINISHED.value:
        order.finished_user_id = user.id
        order.finished_at = current_time

    order.status = new_status
    db.session.commit()
    return jsonify({'id': order.id, 'status': order.status, **response})
