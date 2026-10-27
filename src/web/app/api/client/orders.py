from app.api.client import client_bp
from flask import jsonify, request
from app.api.utils import (normalize_order_status, get_product_by_id, client_required, client_permission_required,
                           stock_transaction, json_body, parse_int, ValidationError, MAX_STOCK_QUANTITY)
from app.models.orders import Order
from app.models.carts import Cart
from app.models.cart_items import CartItem
from app.models.order_items import OrderItem
from app.models import db
from app.models.status_enums import CartStatus, OrderStatus
from datetime import datetime


@client_bp.route('/orders', methods=['GET'])
@client_permission_required('clients.orders.list')
def client_orders():
    client, error, status = client_required()
    if error:
        return error, status

    orders_list = []
    orders = Order.query.filter_by(client_id=client.id).order_by(Order.created_at.desc(), Order.id.desc()).all()
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

        orders_list.append({
            'id': order.id,
            'status': order.status,
            'total': float(total_value),
            'reason': order.reason,
            'product_summary': ', '.join([item.product.name for item in order.items if item.product]) or None,
            'quantity_total': sum([item.quantity for item in order.items]) if order.items else 0,
            'cart_id': order.cart_id,
            'created_at': order.created_at.isoformat() if order.created_at else None,
            'approved_at': order.approved_at.isoformat() if order.approved_at else None,
            'refused_at': order.refused_at.isoformat() if order.refused_at else None,
            'finished_at': order.finished_at.isoformat() if order.finished_at else None,
            'canceled_client_id': order.canceled_client_id,
            'canceled_at': order.canceled_at.isoformat() if order.canceled_at else None,
            'canceled_by_name': order.canceled_by_client.name if order.canceled_by_client else None,
            'items': [{
                'product': item.product.name if item.product else None,
                'product_name': item.product.name if item.product else None,
                'quantity': item.quantity,
                'unit_price': float(item.unit_price) if item.unit_price is not None else (float(item.product.price) if item.product and getattr(item.product, 'price', None) is not None else 0),
                'subtotal': float(item.unit_price if item.unit_price is not None else (item.product.price if item.product else 0)) * (item.quantity or 0)
            } for item in order.items]
        })

    return jsonify(orders_list)


@client_bp.route('/orders/<int:order_id>', methods=['GET'])
@client_permission_required('clients.orders.view')
def client_get_order(order_id):
    client, error, status = client_required()
    if error:
        return error, status

    order = db.session.get(Order, order_id)
    if not order or order.client_id != client.id:
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
        'approved_at': order.approved_at.isoformat() if order.approved_at else None,
        'refused_at': order.refused_at.isoformat() if order.refused_at else None,
        'finished_at': order.finished_at.isoformat() if order.finished_at else None,
        'canceled_client_id': order.canceled_client_id,
        'canceled_at': order.canceled_at.isoformat() if order.canceled_at else None,
        'canceled_by_name': order.canceled_by_client.name if order.canceled_by_client else None,
        'items': [{
            'product': item.product.name if item.product else None,
            'product_name': item.product.name if item.product else None,
            'description': item.product.description if item.product else None,
            'image_url': item.product.photo_path if item.product else None,
            'barcode': item.product.barcode if item.product else None,
            'quantity': item.quantity,
            'unit_price': float(item.unit_price) if item.unit_price is not None else (float(item.product.price) if item.product and getattr(item.product, 'price', None) is not None else 0),
            'subtotal': float(item.unit_price if item.unit_price is not None else (item.product.price if item.product else 0)) * (item.quantity or 0)
        } for item in order.items]
    })


@client_bp.route('/orders/<int:order_id>/status', methods=['PATCH'])
@stock_transaction
@client_permission_required('clients.orders.cancel')
def client_update_order_status(order_id):
    client, error, status = client_required()
    if error:
        return error, status

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Corpo da requisição inválido'}), 400
    action = data.get('action')
    if not isinstance(action, str) or not action.strip():
        return jsonify({'error': 'ação é obrigatória'}), 400

    action = action.strip().lower()
    if action not in {'cancel', 'cancelled', 'canceled'}:
        return jsonify({'error': 'Ação não suportada'}), 400

    # Lock the order so an admin approving/finishing it at the same time either finishes
    # first (and this cancel is refused) or waits and then sees it cancelled
    order = Order.query.filter(Order.id == order_id).with_for_update().populate_existing().one_or_none()
    if not order or order.client_id != client.id:
        db.session.rollback()
        return jsonify({'error': 'Pedido não encontrado'}), 404

    current_status = normalize_order_status(order.status)
    if current_status != OrderStatus.PENDING.value:
        db.session.rollback()
        return jsonify({'error': 'Pedido só pode ser cancelado quando estiver pendente'}), 400

    new_status = OrderStatus.CANCELLED.value
    order.status = new_status
    order.canceled_client_id = client.id
    order.canceled_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'id': order.id, 'status': order.status})


MAX_ORDER_LINES = 100


def _order_items(data):
    """Validated order lines merged per product: {product_id: quantity}."""
    items = data.get('items')
    if not isinstance(items, list) or not items:
        raise ValidationError('lista de itens é obrigatória')
    if len(items) > MAX_ORDER_LINES:
        raise ValidationError(f'O pedido pode ter no máximo {MAX_ORDER_LINES} itens')
    quantities = {}
    for item in items:
        if not isinstance(item, dict):
            raise ValidationError('Cada item deve ser um objeto com product_id e quantity')
        product_id = parse_int(item.get('product_id') if item.get('product_id') is not None else item.get('id'))
        quantity = parse_int(item.get('quantity'))
        if product_id is None or product_id <= 0 or quantity is None or quantity <= 0 or quantity > MAX_STOCK_QUANTITY:
            raise ValidationError('Cada item requer product_id e quantidade inteira positiva')
        quantities[product_id] = quantities.get(product_id, 0) + quantity
    return quantities


@client_bp.route('/orders', methods=['POST'])
@client_permission_required('clients.products.request')
def client_create_order():
    client, error, status = client_required()
    if error:
        return error, status

    quantities = _order_items(json_body())
    products = {}
    for product_id, qty in quantities.items():
        product = get_product_by_id(product_id)
        if not product:
            return jsonify({'error': f'Produto {product_id} não encontrado'}), 404
        # Repeated lines of the same product are added up before comparing with the stock
        stock_quantity = product.stock.quantity if product.stock else 0
        if qty > stock_quantity:
            return jsonify({
                'error': f'Quantidade solicitada excede o estoque disponível do produto {product_id}',
                'product_id': product_id,
                'stock': stock_quantity,
                'requested_quantity': qty
            }), 400
        products[product_id] = product

    cart = Cart(client=client, status=CartStatus.CLOSED.value)
    order = Order(client=client, cart=cart, status=OrderStatus.PENDING.value, total=0)
    db.session.add_all([cart, order])
    total = 0.0
    for product_id, qty in quantities.items():
        product = products[product_id]
        unit_price = product.price or 0
        db.session.add(CartItem(cart=cart, product=product, quantity=qty))
        db.session.add(OrderItem(order=order, product=product, quantity=qty, unit_price=unit_price))
        total += float(unit_price) * qty
    order.total = total
    db.session.commit()
    return jsonify({'order_id': order.id, 'cart_id': cart.id, 'total': float(order.total), 'status': order.status}), 201
