import secrets
import os
from werkzeug.utils import secure_filename
from flask import Blueprint, jsonify, request, current_app
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
from app.models.permissions import Permission
from app.models.rules import Rule
from app.models import db

api_bp = Blueprint('api', __name__, url_prefix='/api')

# --- Upload Config ---

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_active_products():
    """Return only non-deleted products"""
    return Product.query.filter(Product.deleted_at.is_(None)).all()

def get_product_by_id(product_id):
    """Get product by id if not deleted"""
    return Product.query.filter(Product.id == product_id, Product.deleted_at.is_(None)).first()

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
    if not client.active:
        return None, jsonify({'error': 'Client account is inactive'}), 403
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
    if not client.active:
        return jsonify({'error': 'Client account is inactive'}), 403

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


# --- File Upload ---

@api_bp.route('/admin/upload', methods=['POST'])
def admin_upload():
    user, error, status = admin_required()
    if error:
        return error, status
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed. Use: png, jpg, jpeg, gif, webp'}), 400
    
    # Create uploads folder if doesn't exist
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    
    # Generate secure filename
    filename = secure_filename(file.filename)
    filename = f"{secrets.token_hex(8)}_{filename}"
    
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    
    # Return relative path for web access
    return jsonify({'url': f'/static/uploads/{filename}'}), 201

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
    orders_list = []
    for order in client.orders:
        # calcular total a partir do campo ou dos itens como fallback
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
            'created_at': order.created_at.isoformat() if order.created_at else None,
            'items': [{
                'product': item.product.name if item.product else None,
                'quantity': item.quantity,
                'unit_price': float(item.unit_price) if item.unit_price is not None else (float(item.product.price) if item.product and getattr(item.product, 'price', None) is not None else 0)
            } for item in order.items]
        })

    return jsonify(orders_list)


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

    product = get_product_by_id(product_id)
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
    products = get_active_products()
    return jsonify([{
        'id': product.id,
        'name': product.name,
        'description': product.description,
        'price': float(product.price) if product.price else 0.0,
        'photo_path': product.photo_path,
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
    products = get_active_products()
    return jsonify([{
        'id': product.id,
        'name': product.name,
        'description': product.description,
        'price': float(product.price) if product.price else 0.0,
        'photo_path': product.photo_path,
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
    product = get_product_by_id(product_id)
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
    product = get_product_by_id(product_id)
    if not product:
        return jsonify({'error': 'Product not found'}), 404
    product.soft_delete()
    db.session.commit()
    return jsonify({'message': 'Product deleted'})


@api_bp.route('/admin/categories', methods=['GET'])
def admin_list_categories():
    user, error, status = admin_required()
    if error:
        return error, status
    categories = Category.query.order_by(Category.parent_id, Category.name).all()
    return jsonify([{
        'id': category.id,
        'name': category.name,
        'description': category.description,
        'parent_id': category.parent_id,
        'parent_name': category.parent.name if category.parent else None,
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
        'product_name': move.stock.product.name if move.stock and move.stock.product else 'Produto desconhecido',
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
    product_id = data.get('product_id')
    quantity_change = data.get('quantity_change')
    reason = data.get('reason')
    
    if quantity_change is None:
        return jsonify({'error': 'quantity_change is required'}), 400
    
    # If product_id is provided, find or create stock
    if product_id and not stock_id:
        stock = Stock.query.filter_by(product_id=product_id).first()
        if not stock:
            product = get_product_by_id(product_id)
            if not product:
                return jsonify({'error': 'Product not found'}), 404
            stock = Stock(product_id=product_id, quantity=0)
            db.session.add(stock)
            db.session.commit()
        stock_id = stock.id
    elif not stock_id:
        return jsonify({'error': 'stock_id or product_id is required'}), 400
    
    stock = Stock.query.get(stock_id)
    if not stock:
        return jsonify({'error': 'Stock not found'}), 404
    
    quantity_change_int = int(quantity_change)
    stock.quantity = max(stock.quantity + quantity_change_int, 0)
    
    # Determine move_type automatically
    move_type = 'entrada' if quantity_change_int > 0 else 'saida'
    
    move = StockMove(stock=stock, quantity_change=quantity_change_int, reason=reason, move_type=move_type)
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
        'phone': client.phone,
        'active': bool(client.active)
    } for client in clients])


@api_bp.route('/admin/clients/<int:client_id>/status', methods=['PATCH'])
def admin_update_client_status(client_id):
    user, error, status = admin_required()
    if error:
        return error, status

    client = Client.query.get(client_id)
    if not client:
        return jsonify({'error': 'Client not found'}), 404

    data = request.get_json() or {}
    if 'active' not in data:
        return jsonify({'error': 'active status is required'}), 400

    active_value = data.get('active')
    if isinstance(active_value, str):
        active = active_value.strip().lower() in ('1', 'true', 'yes', 'on')
    else:
        active = bool(active_value)

    client.active = active
    if not client.active:
        client.auth_token = None
    db.session.commit()

    return jsonify({
        'id': client.id,
        'active': client.active,
        'message': 'Client status updated successfully'
    })


@api_bp.route('/admin/clients/summary', methods=['GET'])
def admin_clients_summary():
    user, error, status = admin_required()
    if error:
        return error, status

    total_orders = 0
    total_quantity = 0
    total_product_lines = 0

    orders = Order.query.all()
    for order in orders:
        total_orders += 1
        if order.items:
            total_product_lines += len(order.items)
            total_quantity += sum(item.quantity for item in order.items)

    return jsonify({
        'total_orders': total_orders,
        'total_quantity': total_quantity,
        'total_product_lines': total_product_lines
    })


@api_bp.route('/admin/clients/<int:client_id>/details', methods=['GET'])
def admin_client_details(client_id):
    user, error, status = admin_required()
    if error:
        return error, status

    client = Client.query.get(client_id)
    if not client:
        return jsonify({'error': 'Cliente não encontrado'}), 404

    orders = []
    total_orders = 0
    total_quantity = 0
    total_product_lines = 0

    for order in client.orders:
        order_items = []
        order_quantity = 0
        for item in order.items:
            order_items.append({
                'product_name': item.product.name if item.product else None,
                'quantity': item.quantity,
                'unit_price': float(item.unit_price)
            })
            order_quantity += item.quantity

        orders.append({
            'id': order.id,
            'status': order.status,
            'total': float(order.total),
            'created_at': order.created_at.isoformat() if order.created_at else None,
            'items': order_items,
            'quantity': order_quantity,
            'product_lines': len(order_items)
        })

        total_orders += 1
        total_product_lines += len(order_items)
        total_quantity += order_quantity

    return jsonify({
        'id': client.id,
        'name': client.name,
        'email': client.email,
        'phone': client.phone,
        'created_at': client.created_at.isoformat() if client.created_at else None,
        'order_count': total_orders,
        'total_quantity': total_quantity,
        'total_product_lines': total_product_lines,
        'orders': orders
    })


@api_bp.route('/admin/users', methods=['GET'])
def admin_list_users():
    user, error, status = admin_required()
    if error:
        return error, status
    users = User.query.all()
    return jsonify([{
        'id': u.id,
        'username': u.username,
        'email': u.email,
        'created_at': u.created_at.isoformat() if u.created_at else None,
        'rules': [{'id': r.id, 'name': r.name} for r in u.rules]
    } for u in users])


@api_bp.route('/admin/users', methods=['POST'])
def admin_create_user():
    user, error, status = admin_required()
    if error:
        return error, status
    data = request.get_json() or {}
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    if not username or not email or not password:
        return jsonify({'error': 'username, email and password are required'}), 400
    if User.query.filter((User.username == username) | (User.email == email)).first():
        return jsonify({'error': 'Username or email already in use'}), 409
    user_obj = User(username=username, email=email)
    user_obj.set_password(password)
    rule_ids = data.get('rule_ids') or []
    if rule_ids:
        rules = Rule.query.filter(Rule.id.in_(rule_ids)).all()
        user_obj.rules = rules
    db.session.add(user_obj)
    db.session.commit()
    return jsonify({'id': user_obj.id}), 201


@api_bp.route('/admin/users/<int:user_id>', methods=['PUT'])
def admin_update_user(user_id):
    user, error, status = admin_required()
    if error:
        return error, status
    user_obj = User.query.get(user_id)
    if not user_obj:
        return jsonify({'error': 'User not found'}), 404
    data = request.get_json() or {}
    new_username = data.get('username', user_obj.username)
    new_email = data.get('email', user_obj.email)
    if (new_username != user_obj.username and User.query.filter(User.username == new_username).filter(User.id != user_id).first()) or (
        new_email != user_obj.email and User.query.filter(User.email == new_email).filter(User.id != user_id).first()):
        return jsonify({'error': 'Username or email already in use'}), 409
    user_obj.username = new_username
    user_obj.email = new_email
    if 'password' in data and data['password']:
        user_obj.set_password(data['password'])
    if 'rule_ids' in data:
        rule_ids = data.get('rule_ids') or []
        user_obj.rules = Rule.query.filter(Rule.id.in_(rule_ids)).all() if rule_ids else []
    db.session.commit()
    return jsonify({'message': 'User updated'})


@api_bp.route('/admin/users/<int:user_id>', methods=['DELETE'])
def admin_delete_user(user_id):
    user, error, status = admin_required()
    if error:
        return error, status
    user_obj = User.query.get(user_id)
    if not user_obj:
        return jsonify({'error': 'User not found'}), 404
    db.session.delete(user_obj)
    db.session.commit()
    return jsonify({'message': 'User deleted'})


@api_bp.route('/admin/permissions', methods=['GET'])
def admin_list_permissions():
    user, error, status = admin_required()
    if error:
        return error, status
    permissions = Permission.query.all()
    return jsonify([{
        'id': p.id,
        'name': p.name,
        'description': p.description
    } for p in permissions])


@api_bp.route('/admin/permissions', methods=['POST'])
def admin_create_permission():
    user, error, status = admin_required()
    if error:
        return error, status
    data = request.get_json() or {}
    name = data.get('name')
    if not name:
        return jsonify({'error': 'name is required'}), 400
    if Permission.query.filter_by(name=name).first():
        return jsonify({'error': 'Permission already exists'}), 409
    permission = Permission(name=name, description=data.get('description'))
    db.session.add(permission)
    db.session.commit()
    return jsonify({'id': permission.id}), 201


@api_bp.route('/admin/permissions/<int:permission_id>', methods=['PUT'])
def admin_update_permission(permission_id):
    user, error, status = admin_required()
    if error:
        return error, status
    permission = Permission.query.get(permission_id)
    if not permission:
        return jsonify({'error': 'Permission not found'}), 404
    data = request.get_json() or {}
    name = data.get('name', permission.name)
    if name != permission.name and Permission.query.filter_by(name=name).filter(Permission.id != permission_id).first():
        return jsonify({'error': 'Permission already exists'}), 409
    permission.name = name
    permission.description = data.get('description', permission.description)
    db.session.commit()
    return jsonify({'message': 'Permission updated'})


@api_bp.route('/admin/permissions/<int:permission_id>', methods=['DELETE'])
def admin_delete_permission(permission_id):
    user, error, status = admin_required()
    if error:
        return error, status
    permission = Permission.query.get(permission_id)
    if not permission:
        return jsonify({'error': 'Permission not found'}), 404
    db.session.delete(permission)
    db.session.commit()
    return jsonify({'message': 'Permission deleted'})


@api_bp.route('/admin/rules', methods=['GET'])
def admin_list_rules():
    user, error, status = admin_required()
    if error:
        return error, status
    rules = Rule.query.all()
    return jsonify([{
        'id': r.id,
        'name': r.name,
        'description': r.description,
        'permission_ids': [p.id for p in r.permissions],
        'permissions': [{'id': p.id, 'name': p.name} for p in r.permissions]
    } for r in rules])


@api_bp.route('/admin/rules', methods=['POST'])
def admin_create_rule():
    user, error, status = admin_required()
    if error:
        return error, status
    data = request.get_json() or {}
    name = data.get('name')
    if not name:
        return jsonify({'error': 'name is required'}), 400
    if Rule.query.filter_by(name=name).first():
        return jsonify({'error': 'Rule already exists'}), 409
    rule = Rule(name=name, description=data.get('description'))
    permission_ids = data.get('permission_ids') or []
    if permission_ids:
        rule.permissions = Permission.query.filter(Permission.id.in_(permission_ids)).all()
    db.session.add(rule)
    db.session.commit()
    return jsonify({'id': rule.id}), 201


@api_bp.route('/admin/rules/<int:rule_id>', methods=['PUT'])
def admin_update_rule(rule_id):
    user, error, status = admin_required()
    if error:
        return error, status
    rule = Rule.query.get(rule_id)
    if not rule:
        return jsonify({'error': 'Rule not found'}), 404
    data = request.get_json() or {}
    name = data.get('name', rule.name)
    if name != rule.name and Rule.query.filter_by(name=name).filter(Rule.id != rule_id).first():
        return jsonify({'error': 'Rule already exists'}), 409
    rule.name = name
    rule.description = data.get('description', rule.description)
    if 'permission_ids' in data:
        permission_ids = data.get('permission_ids') or []
        rule.permissions = Permission.query.filter(Permission.id.in_(permission_ids)).all() if permission_ids else []
    db.session.commit()
    return jsonify({'message': 'Rule updated'})


@api_bp.route('/admin/rules/<int:rule_id>', methods=['DELETE'])
def admin_delete_rule(rule_id):
    user, error, status = admin_required()
    if error:
        return error, status
    rule = Rule.query.get(rule_id)
    if not rule:
        return jsonify({'error': 'Rule not found'}), 404
    db.session.delete(rule)
    db.session.commit()
    return jsonify({'message': 'Rule deleted'})


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


@api_bp.route('/admin/stock', methods=['POST'])
def admin_create_stock():
    user, error, status = admin_required()
    if error:
        return error, status
    data = request.get_json() or {}
    product_id = data.get('product_id')
    quantity = data.get('quantity', 0)
    
    if not product_id:
        return jsonify({'error': 'product_id is required'}), 400
    
    product = get_product_by_id(product_id)
    if not product:
        return jsonify({'error': 'Product not found'}), 404
    
    existing_stock = Stock.query.filter_by(product_id=product_id).first()
    if existing_stock:
        return jsonify({'error': 'Stock already exists for this product'}), 400
    
    stock = Stock(product_id=product_id, quantity=quantity)
    db.session.add(stock)
    db.session.commit()
    return jsonify({'id': stock.id, 'product_id': stock.product_id, 'quantity': stock.quantity}), 201


@api_bp.route('/admin/orders', methods=['GET'])
def admin_list_orders():
    user, error, status = admin_required()
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
            'product_summary': ', '.join([item.product.name for item in order.items if item.product]) or None,
            'quantity_total': sum([item.quantity for item in order.items]) if order.items else 0,
            'cart_id': order.cart_id,
            'created_at': order.created_at.isoformat() if order.created_at else None
        })

    return jsonify(result)


@api_bp.route('/admin/orders/<int:order_id>', methods=['GET'])
def admin_get_order(order_id):
    user, error, status = admin_required()
    if error:
        return error, status
    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    # calcular total a partir do campo ou dos itens como fallback
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
