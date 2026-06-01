from app.api.client import client_bp
from flask import jsonify, request, current_app
from app.api.utils import normalize_order_status, get_product_by_id, OPEN_CART_STATUSES, client_required
from app.models.orders import Order
from app.models.carts import Cart
from app.models.cart_items import CartItem
from app.models.order_items import OrderItem
from app.models.products import Product
from app.models import db
from app.models.status_enums import CartStatus, OrderStatus


@client_bp.route('/orders', methods=['GET'])
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
def client_get_order(order_id):
    client, error, status = client_required()
    if error:
        return error, status

    order = Order.query.get(order_id)
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
        'items': [{
            'product': item.product.name if item.product else None,
            'description': item.product.description if item.product else None,
            'image_url': item.product.photo_path if item.product else None,
            'quantity': item.quantity,
            'unit_price': float(item.unit_price) if item.unit_price is not None else (float(item.product.price) if item.product and getattr(item.product, 'price', None) is not None else 0),
            'subtotal': float(item.unit_price if item.unit_price is not None else (item.product.price if item.product else 0)) * (item.quantity or 0)
        } for item in order.items]
    })


@client_bp.route('/orders/<int:order_id>/status', methods=['PATCH'])
def client_update_order_status(order_id):
    client, error, status = client_required()
    if error:
        return error, status

    order = Order.query.get(order_id)
    if not order or order.client_id != client.id:
        return jsonify({'error': 'Pedido não encontrado'}), 404

    data = request.get_json() or {}
    action = data.get('action')
    if not action:
        return jsonify({'error': 'ação é obrigatória'}), 400

    action = action.lower()
    if action not in {'cancel', 'cancelled', 'canceled'}:
        return jsonify({'error': 'Ação não suportada'}), 400

    current_status = normalize_order_status(order.status)
    if current_status != OrderStatus.PENDING.value:
        return jsonify({'error': 'Pedido só pode ser cancelado quando estiver pendente'}), 400

    new_status = OrderStatus.CANCELLED.value
    order.status = new_status
    db.session.commit()
    return jsonify({'id': order.id, 'status': order.status})


@client_bp.route('/orders', methods=['POST'])
def client_create_order():
    client, error, status = client_required()
    if error:
        return error, status

    data = request.get_json() or {}
    items = data.get('items')
    if not items or not isinstance(items, list):
        return jsonify({'error': 'lista de itens é obrigatória'}), 400

    total = 0.0
    cart = Cart(client=client, status=CartStatus.CLOSED.value)
    db.session.add(cart)
    db.session.flush()

    order = Order(client=client, cart=cart, status=OrderStatus.PENDING.value, total=0)
    db.session.add(order)
    db.session.flush()

    try:
        for it in items:
            product_id = it.get('product_id') or it.get('id')
            qty = int(it.get('quantity', 0) or 0)
            if not product_id or qty <= 0:
                db.session.rollback()
                return jsonify({'error': 'Cada item requer product_id e quantidade positiva'}), 400

            product = get_product_by_id(product_id)
            if not product:
                db.session.rollback()
                return jsonify({'error': f'Produto {product_id} não encontrado'}), 404

            stock_quantity = product.stock.quantity if product.stock else 0
            if qty > stock_quantity:
                db.session.rollback()
                return jsonify({
                    'error': f'Quantidade solicitada excede o estoque disponível for product {product_id}',
                    'product_id': product_id,
                    'stock': stock_quantity,
                    'requested_quantity': qty
                }), 400

            unit_price = product.price or 0
            cart_item = CartItem(cart=cart, product=product, quantity=qty)
            order_item = OrderItem(order=order, product=product, quantity=qty, unit_price=unit_price)
            db.session.add(cart_item)
            db.session.add(order_item)
            total += float(unit_price) * qty

            if product.stock:
                try:
                    current_app.logger.info(f"[OrderCreate] order_id={order.id} item product_id={product_id} qty={qty} (no stock change at creation)")
                except Exception:
                    pass

        order.total = total
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Falha ao criar pedido', 'details': str(e)}), 500

    return jsonify({'order_id': order.id, 'cart_id': cart.id, 'total': float(order.total), 'status': order.status}), 201
