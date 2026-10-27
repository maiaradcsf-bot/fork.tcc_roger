from app.api.client import client_bp
from flask import jsonify
from app.api.utils import (client_required, client_permission_required, OPEN_CART_STATUSES, get_product_by_id,
                           json_body, parse_int, text_field, MAX_STOCK_QUANTITY)
from app.models.carts import Cart
from app.models.cart_items import CartItem
from app.models.order_items import OrderItem
from app.models.orders import Order
from app.models.status_enums import CartStatus, OrderStatus
from app.models import db


@client_bp.route('/carts', methods=['GET'])
@client_permission_required('clients.cart.manage')
def client_carts():
    client, error, status = client_required()
    if error:
        return error, status

    return jsonify([{
        'id': cart.id,
        'status': cart.status,
        'created_at': cart.created_at.isoformat(),
        'updated_at': cart.updated_at.isoformat() if cart.updated_at else None,
        'items': [{
            'id': item.id,
            'product_id': item.product_id,
            'product_name': item.product.name if item.product else None,
            'quantity': item.quantity,
            'unit_price': float(item.product.price) if item.product and item.product.price is not None else 0,
            'stock': item.product.stock.quantity if item.product and item.product.stock else 0,
            'subtotal': float(item.product.price or 0) * item.quantity if item.product else 0
        } for item in cart.items]
    } for cart in client.carts])


@client_bp.route('/carts', methods=['POST'])
@client_permission_required('clients.cart.manage')
def create_client_cart():
    client, error, status = client_required()
    if error:
        return error, status

    cart = Cart(client=client, status=CartStatus.OPEN.value)
    db.session.add(cart)
    db.session.commit()
    return jsonify({'id': cart.id, 'status': cart.status}), 201


@client_bp.route('/carts/<int:cart_id>/items', methods=['POST'])
@client_permission_required('clients.cart.manage')
def add_cart_item(cart_id):
    client, error, status = client_required()
    if error:
        return error, status

    cart = Cart.query.filter_by(id=cart_id, client_id=client.id).first()
    if not cart or cart.status not in OPEN_CART_STATUSES:
        return jsonify({'error': 'Carrinho não encontrado ou não está aberto'}), 404

    data = json_body()
    product_id = parse_int(data.get('product_id'))
    quantity = parse_int(data.get('quantity', 1))
    if product_id is None or product_id <= 0 or quantity is None or quantity < 1 or quantity > MAX_STOCK_QUANTITY:
        return jsonify({'error': 'product_id e quantidade positiva são obrigatórios'}), 400

    product = get_product_by_id(product_id)
    if not product:
        return jsonify({'error': 'Produto não encontrado'}), 404

    stock_quantity = product.stock.quantity if product.stock else 0
    item = CartItem.query.filter_by(cart_id=cart.id, product_id=product.id).first()
    current_quantity = item.quantity if item else 0
    if current_quantity + quantity > stock_quantity:
        return jsonify({
            'error': 'Quantidade solicitada excede o estoque disponível',
            'stock': stock_quantity,
            'current_quantity': current_quantity,
            'available_quantity': max(stock_quantity - current_quantity, 0)
        }), 400

    if item:
        item.quantity += quantity
    else:
        item = CartItem(cart=cart, product=product, quantity=quantity)
        db.session.add(item)

    db.session.commit()
    return jsonify({'id': item.id, 'product_id': product.id, 'quantity': item.quantity}), 201


@client_bp.route('/carts/<int:cart_id>/items/<int:item_id>', methods=['PUT'])
@client_permission_required('clients.cart.manage')
def update_cart_item(cart_id, item_id):
    client, error, status = client_required()
    if error:
        return error, status

    cart = Cart.query.filter_by(id=cart_id, client_id=client.id).first()
    if not cart or cart.status not in OPEN_CART_STATUSES:
        return jsonify({'error': 'Carrinho não encontrado ou não está aberto'}), 404

    item = CartItem.query.filter_by(id=item_id, cart_id=cart.id).first()
    if not item:
        return jsonify({'error': 'Item do carrinho não encontrado'}), 404

    data = json_body()
    quantity = parse_int(data.get('quantity'))
    if quantity is None or quantity < 1 or quantity > MAX_STOCK_QUANTITY:
        return jsonify({'error': 'quantidade positiva é obrigatória'}), 400

    stock_quantity = item.product.stock.quantity if item.product and item.product.stock else 0
    if quantity > stock_quantity:
        return jsonify({
            'error': 'Quantidade solicitada excede o estoque disponível',
            'stock': stock_quantity,
            'requested_quantity': quantity
        }), 400

    item.quantity = quantity
    db.session.commit()
    return jsonify({'id': item.id, 'product_id': item.product_id, 'quantity': item.quantity})


@client_bp.route('/carts/<int:cart_id>/items/<int:item_id>', methods=['DELETE'])
@client_permission_required('clients.cart.manage')
def delete_cart_item(cart_id, item_id):
    client, error, status = client_required()
    if error:
        return error, status

    cart = Cart.query.filter_by(id=cart_id, client_id=client.id).first()
    if not cart or cart.status not in OPEN_CART_STATUSES:
        return jsonify({'error': 'Carrinho não encontrado ou não está aberto'}), 404

    item = CartItem.query.filter_by(id=item_id, cart_id=cart.id).first()
    if not item:
        return jsonify({'error': 'Item do carrinho não encontrado'}), 404

    db.session.delete(item)
    db.session.commit()
    return jsonify({'message': 'Item do carrinho removido'})


@client_bp.route('/carts/<int:cart_id>/checkout', methods=['POST'])
@client_permission_required('clients.cart.manage')
def checkout_cart(cart_id):
    client, error, status = client_required()
    if error:
        return error, status

    cart = Cart.query.filter_by(id=cart_id, client_id=client.id).first()
    if not cart or cart.status not in OPEN_CART_STATUSES:
        return jsonify({'error': 'Carrinho não encontrado ou não está aberto'}), 404

    if not cart.items:
        return jsonify({'error': 'Carrinho está vazio'}), 400

    for item in cart.items:
        stock_quantity = item.product.stock.quantity if item.product and item.product.stock else 0
        if item.quantity > stock_quantity:
            return jsonify({
                'error': f'Estoque insuficiente para {item.product.name if item.product else "product"}',
                'product_id': item.product_id,
                'stock': stock_quantity,
                'requested_quantity': item.quantity
            }), 400

    reason = text_field(json_body(), 'reason', 'motivo', 2000) or None

    total = 0
    order = Order(client=client, cart=cart, status=OrderStatus.PENDING.value, total=0, reason=reason)
    db.session.add(order)
    db.session.flush()

    for item in cart.items:
        order_item = OrderItem(order=order, product=item.product, quantity=item.quantity, unit_price=item.product.price)
        db.session.add(order_item)
        total += float(item.product.price or 0) * item.quantity

    cart.status = CartStatus.CLOSED.value
    order.total = total
    db.session.commit()

    return jsonify({'order_id': order.id, 'total': float(order.total), 'status': order.status}), 201
