import secrets
from flask import Blueprint, jsonify, request
from app.models.products import Product
from app.models.categories import Category
from app.models.orders import Order
from app.models.order_items import OrderItem
from app.models.clients import Client
from app.models.users import User
from app.models.stock import Stock
from app.models.stock_moves import StockMove
from app.models.carts import Cart
from app.models.cart_items import CartItem
from app.models import db

api_bp = Blueprint('api', __name__, url_prefix='/api')

# --- Helpers ---

def get_auth_token():
    auth = request.headers.get('Authorization', '')
    if auth.startswith('Bearer '):
        return auth[7:]
    return None


def client_required():
    token = get_auth_token()
    if not token:
        return None, jsonify({'error': 'Authorization token required'}), 401
    client = Client.query.filter_by(auth_token=token).first()
    if not client:
        return None, jsonify({'error': 'Invalid client token'}), 401
    return client, None, None


def admin_required():
    token = get_auth_token()
    if not token:
        return None, jsonify({'error': 'Authorization token required'}), 401
    user = User.query.filter_by(auth_token=token).first()
    if not user:
        return None, jsonify({'error': 'Invalid admin token'}), 401
    if not any(rule.name == 'administrator' for rule in user.rules):
        return None, jsonify({'error': 'Admin privileges required'}), 403
    return user, None, None

# --- Authentication ---

@api_bp.route('/client/login', methods=['POST'])
def client_login():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')
    if not email or not password:
        return jsonify({'error': 'email and password are required'}), 400

    client = Client.query.filter_by(email=email).first()
    if not client or not client.check_password(password):
        return jsonify({'error': 'Invalid email or password'}), 401

    client.auth_token = secrets.token_hex(32)
    db.session.commit()
    return jsonify({'token': client.auth_token})


@api_bp.route('/admin/login', methods=['POST'])
def admin_login():
    data = request.get_json() or {}
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({'error': 'username and password are required'}), 400

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid username or password'}), 401

    user.auth_token = secrets.token_hex(32)
    db.session.commit()
    return jsonify({'token': user.auth_token})


@api_bp.route('/client/register', methods=['POST'])
def client_register():
    data = request.get_json() or {}
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    phone = data.get('phone')
    if not name or not email or not password:
        return jsonify({'error': 'name, email and password are required'}), 400

    if Client.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 409

    client = Client(name=name, email=email, phone=phone)
    client.set_password(password)
    client.auth_token = secrets.token_hex(32)
    db.session.add(client)
    db.session.commit()
    return jsonify({'token': client.auth_token, 'id': client.id}), 201


@api_bp.route('/client/logout', methods=['POST'])
def client_logout():
    client, error, status = client_required()
    if error:
        return error, status
    client.auth_token = None
    db.session.commit()
    return jsonify({'message': 'Client logged out successfully'})


@api_bp.route('/admin/logout', methods=['POST'])
def admin_logout():
    user, error, status = admin_required()
    if error:
        return error, status
    user.auth_token = None
    db.session.commit()
    return jsonify({'message': 'Admin logged out successfully'})

# --- Client endpoints ---

@api_bp.route('/client/profile', methods=['GET'])
def client_profile():
    client, error, status = client_required()
    if error:
        return error, status
    return jsonify({
        'id': client.id,
        'name': client.name,
        'email': client.email,
        'phone': client.phone,
        'addresses': [{
            'id': address.id,
            'street': address.street,
            'city': address.city,
            'state': address.state,
            'zipcode': address.zipcode,
            'country': address.country,
            'type': address.address_type
        } for address in client.addresses]
    })


@api_bp.route('/client/profile', methods=['PUT'])
def update_client_profile():
    client, error, status = client_required()
    if error:
        return error, status

    data = request.get_json() or {}
    client.name = data.get('name', client.name)
    client.email = data.get('email', client.email)
    client.phone = data.get('phone', client.phone)
    if 'password' in data:
        client.set_password(data['password'])
    db.session.commit()
    return jsonify({'message': 'Profile updated successfully'})


@api_bp.route('/client/orders', methods=['GET'])
def client_orders():
    client, error, status = client_required()
    if error:
        return error, status

    return jsonify([{
        'id': order.id,
        'status': order.status,
        'total': float(order.total),
        'created_at': order.created_at.isoformat(),
        'items': [{
            'product': item.product.name if item.product else None,
            'quantity': item.quantity,
            'unit_price': float(item.unit_price)
        } for item in order.items]
    } for order in client.orders])


@api_bp.route('/client/carts', methods=['GET'])
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
            'quantity': item.quantity
        } for item in cart.items]
    } for cart in client.carts])


@api_bp.route('/client/carts', methods=['POST'])
def create_client_cart():
    client, error, status = client_required()
    if error:
        return error, status

    cart = Cart(client=client, status='active')
    db.session.add(cart)
    db.session.commit()
    return jsonify({'id': cart.id, 'status': cart.status}), 201


@api_bp.route('/client/carts/<int:cart_id>/items', methods=['POST'])
def add_cart_item(cart_id):
    client, error, status = client_required()
    if error:
        return error, status

    cart = Cart.query.filter_by(id=cart_id, client_id=client.id).first()
    if not cart or cart.status != 'active':
        return jsonify({'error': 'Cart not found or not active'}), 404

    data = request.get_json() or {}
    product_id = data.get('product_id')
    quantity = int(data.get('quantity', 1))
    if not product_id or quantity < 1:
        return jsonify({'error': 'product_id and positive quantity are required'}), 400

    product = Product.query.get(product_id)
    if not product:
        return jsonify({'error': 'Product not found'}), 404

    item = CartItem.query.filter_by(cart_id=cart.id, product_id=product.id).first()
    if item:
        item.quantity += quantity
    else:
        item = CartItem(cart=cart, product=product, quantity=quantity)
        db.session.add(item)

    db.session.commit()
    return jsonify({'id': item.id, 'product_id': product.id, 'quantity': item.quantity}), 201


@api_bp.route('/client/carts/<int:cart_id>/checkout', methods=['POST'])
def checkout_cart(cart_id):
    client, error, status = client_required()
    if error:
        return error, status

    cart = Cart.query.filter_by(id=cart_id, client_id=client.id).first()
    if not cart or cart.status != 'active':
        return jsonify({'error': 'Cart not found or not active'}), 404

    if not cart.items:
        return jsonify({'error': 'Cart is empty'}), 400

    total = 0
    order = Order(client=client, cart=cart, status='pending', total=0)
    db.session.add(order)

    for item in cart.items:
        order_item = OrderItem(order=order, product=item.product, quantity=item.quantity, unit_price=item.product.price)
        db.session.add(order_item)
        total += float(item.product.price or 0) * item.quantity

        if item.product.stock:
            item.product.stock.quantity = max(item.product.stock.quantity - item.quantity, 0)

    cart.status = 'checked_out'
    order.total = total
    db.session.commit()

    return jsonify({'order_id': order.id, 'total': float(order.total), 'status': order.status}), 201

# --- Public endpoints ---

@api_bp.route('/products', methods=['GET'])
def list_products():
    products = Product.query.all()
    return jsonify([{
        'id': product.id,
        'name': product.name,
        'description': product.description,
        'price': float(product.price) if product.price else 0.0,
        'stock': product.stock.quantity if product.stock else 0,
        'categories': [category.name for category in product.categories]
    } for product in products])


@api_bp.route('/categories/<int:category_id>/subcategories', methods=['GET'])
def list_subcategories(category_id):
    category = Category.query.get(category_id)
    if not category:
        return jsonify({'error': 'Category not found'}), 404
    return jsonify([{
        'id': child.id,
        'name': child.name,
        'description': child.description
    } for child in category.children])


@api_bp.route('/categories', methods=['GET'])
def list_categories():
    categories = Category.query.filter_by(parent_id=None).all()
    return jsonify([{
        'id': category.id,
        'name': category.name,
        'description': category.description,
        'subcategories': [{'id': child.id, 'name': child.name} for child in category.children]
    } for category in categories])

# --- Admin endpoints ---

@api_bp.route('/admin/products', methods=['GET'])
def admin_list_products():
    user, error, status = admin_required()
    if error:
        return error, status
    products = Product.query.all()
    return jsonify([{
        'id': product.id,
        'name': product.name,
        'description': product.description,
        'price': float(product.price) if product.price else 0.0,
        'stock': product.stock.quantity if product.stock else 0
    } for product in products])


@api_bp.route('/admin/products', methods=['POST'])
def admin_create_product():
    user, error, status = admin_required()
    if error:
        return error, status
    data = request.get_json() or {}
    product = Product(
        name=data.get('name'),
        description=data.get('description'),
        price=data.get('price', 0),
        photo_path=data.get('photo_path')
    )
    db.session.add(product)
    db.session.commit()
    return jsonify({'id': product.id}), 201


@api_bp.route('/admin/products/<int:product_id>', methods=['PUT'])
def admin_update_product(product_id):
    user, error, status = admin_required()
    if error:
        return error, status
    product = Product.query.get(product_id)
    if not product:
        return jsonify({'error': 'Product not found'}), 404

    data = request.get_json() or {}
    product.name = data.get('name', product.name)
    product.description = data.get('description', product.description)
    product.price = data.get('price', product.price)
    product.photo_path = data.get('photo_path', product.photo_path)
    db.session.commit()
    return jsonify({'message': 'Product updated'})


@api_bp.route('/admin/products/<int:product_id>', methods=['DELETE'])
def admin_delete_product(product_id):
    user, error, status = admin_required()
    if error:
        return error, status
    product = Product.query.get(product_id)
    if not product:
        return jsonify({'error': 'Product not found'}), 404
    db.session.delete(product)
    db.session.commit()
    return jsonify({'message': 'Product deleted'})


@api_bp.route('/admin/categories', methods=['GET'])
def admin_list_categories():
    user, error, status = admin_required()
    if error:
        return error, status
    categories = Category.query.all()
    return jsonify([{
        'id': category.id,
        'name': category.name,
        'description': category.description,
        'parent_id': category.parent_id,
        'subcategories': [{'id': child.id, 'name': child.name} for child in category.children]
    } for category in categories])


@api_bp.route('/admin/categories', methods=['POST'])
def admin_create_category():
    user, error, status = admin_required()
    if error:
        return error, status
    data = request.get_json() or {}
    name = data.get('name')
    if not name:
        return jsonify({'error': 'name is required'}), 400
    parent_id = data.get('parent_id')
    if parent_id is not None and not Category.query.get(parent_id):
        return jsonify({'error': 'Parent category not found'}), 400
    category = Category(
        name=name,
        description=data.get('description'),
        parent_id=parent_id
    )
    db.session.add(category)
    db.session.commit()
    return jsonify({'id': category.id}), 201


@api_bp.route('/admin/categories/<int:category_id>', methods=['PUT'])
def admin_update_category(category_id):
    user, error, status = admin_required()
    if error:
        return error, status
    category = Category.query.get(category_id)
    if not category:
        return jsonify({'error': 'Category not found'}), 404
    data = request.get_json() or {}
    parent_id = data.get('parent_id', category.parent_id)
    if parent_id is not None and parent_id != category.id and not Category.query.get(parent_id):
        return jsonify({'error': 'Parent category not found'}), 400
    if parent_id == category.id:
        return jsonify({'error': 'Category cannot be its own parent'}), 400
    category.name = data.get('name', category.name)
    category.description = data.get('description', category.description)
    category.parent_id = parent_id
    db.session.commit()
    return jsonify({'message': 'Category updated'})


@api_bp.route('/admin/categories/<int:category_id>', methods=['DELETE'])
def admin_delete_category(category_id):
    user, error, status = admin_required()
    if error:
        return error, status
    category = Category.query.get(category_id)
    if not category:
        return jsonify({'error': 'Category not found'}), 404
    db.session.delete(category)
    db.session.commit()
    return jsonify({'message': 'Category deleted'})


@api_bp.route('/admin/stock/moves', methods=['GET'])
def admin_list_stock_moves():
    user, error, status = admin_required()
    if error:
        return error, status
    stock_moves = StockMove.query.order_by(StockMove.created_at.desc()).all()
    return jsonify([{
        'id': move.id,
        'stock_id': move.stock_id,
        'product_id': move.stock.product_id if move.stock else None,
        'quantity_change': move.quantity_change,
        'reason': move.reason,
        'created_at': move.created_at.isoformat()
    } for move in stock_moves])


@api_bp.route('/admin/stock/moves', methods=['POST'])
def admin_create_stock_move():
    user, error, status = admin_required()
    if error:
        return error, status
    data = request.get_json() or {}
    stock_id = data.get('stock_id')
    quantity_change = data.get('quantity_change')
    reason = data.get('reason')
    if not stock_id or quantity_change is None:
        return jsonify({'error': 'stock_id and quantity_change are required'}), 400
    stock = Stock.query.get(stock_id)
    if not stock:
        return jsonify({'error': 'Stock not found'}), 404
    stock.quantity = max(stock.quantity + int(quantity_change), 0)
    move = StockMove(stock=stock, quantity_change=int(quantity_change), reason=reason)
    db.session.add(move)
    db.session.commit()
    return jsonify({'id': move.id}), 201


@api_bp.route('/admin/clients', methods=['GET'])
def admin_list_clients():
    user, error, status = admin_required()
    if error:
        return error, status
    clients = Client.query.all()
    return jsonify([{
        'id': client.id,
        'name': client.name,
        'email': client.email,
        'phone': client.phone
    } for client in clients])


@api_bp.route('/admin/stock', methods=['GET'])
def admin_list_stock():
    user, error, status = admin_required()
    if error:
        return error, status
    stock_items = Stock.query.all()
    return jsonify([{
        'id': stock.id,
        'product_id': stock.product_id,
        'product_name': stock.product.name if stock.product else None,
        'quantity': stock.quantity
    } for stock in stock_items])


@api_bp.route('/admin/orders', methods=['GET'])
def admin_list_orders():
    user, error, status = admin_required()
    if error:
        return error, status
    orders = Order.query.all()
    return jsonify([{
        'id': order.id,
        'client': order.client.name if order.client else None,
        'status': order.status,
        'total': float(order.total),
        'cart_id': order.cart_id,
        'created_at': order.created_at.isoformat()
    } for order in orders])
