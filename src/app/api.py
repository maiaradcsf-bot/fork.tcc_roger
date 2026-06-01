import secrets
import os
from werkzeug.utils import secure_filename
from flask import current_app
from app.api import api_bp
from app.models import db

# --- Upload Config ---

from app.api.utils import UPLOAD_FOLDER, allowed_file

# --- Helpers ---

def get_auth_token():
    auth = request.headers.get('Authorization', '')
    if auth.startswith('Bearer '):
        return auth[7:]
    return None


def client_required():
    token = get_auth_token()
    if not token:
        return None, jsonify({'error': 'Token de autorização é obrigatório'}), 401
    client = Client.query.filter_by(auth_token=token).first()
    if not client:
        return None, jsonify({'error': 'Token de cliente inválido'}), 401
    if not client.active:
        return None, jsonify({'error': 'Conta de cliente está inativa'}), 403
    return client, None, None


def admin_required():
    token = get_auth_token()
    if not token:
        return None, jsonify({'error': 'Token de autorização é obrigatório'}), 401
    user = User.query.filter_by(auth_token=token).first()
    if not user:
        return None, jsonify({'error': 'Token de administrador inválido'}), 401
    if not any(rule.name == 'administrator' for rule in user.rules):
        return None, jsonify({'error': 'Privilégios de administrador são necessários'}), 403
    return user, None, None

# Authentication routes moved to app.api.auth

# --- File Upload ---

@api_bp.route('/admin/upload', methods=['POST'])
def admin_upload():
    user, error, status = admin_required()
    if error:
        return error, status
    
    if 'file' not in request.files:
        return jsonify({'error': 'Nenhum arquivo enviado'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Nenhum arquivo selecionado'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'Tipo de arquivo não permitido. Use: png, jpg, jpeg, gif, webp'}), 400
    
    # Create uploads folder if doesn't exist
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    
    # Generate secure filename
    filename = secure_filename(file.filename)
    filename = f"{secrets.token_hex(8)}_{filename}"
    
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    
    # Return relative path for web access
    return jsonify({'url': f'/static/uploads/{filename}'}), 201




@api_bp.route('/client/summary', methods=['GET'])
def client_summary():
    client, error, status = client_required()
    if error:
        return error, status

    orders = client.orders or []
    total_orders = len(orders)
    pending_count = sum(1 for o in orders if normalize_order_status(o.status) == OrderStatus.PENDING.value)
    approved_count = sum(1 for o in orders if normalize_order_status(o.status) == OrderStatus.APPROVED.value)
    finished_count = sum(1 for o in orders if normalize_order_status(o.status) == OrderStatus.FINISHED.value)
    total_quantity = sum(sum((item.quantity or 0) for item in (o.items or [])) for o in orders)
    total_product_lines = sum(len(o.items or []) for o in orders)
    total_value = sum(float(o.total or 0) for o in orders)
    products_count = Product.query.filter(Product.deleted_at.is_(None)).count()

    return jsonify({
        'total_orders': total_orders,
        'pending_orders': pending_count,
        'approved_orders': approved_count,
        'finished_orders': finished_count,
        'total_quantity': total_quantity,
        'total_product_lines': total_product_lines,
        'total_value': total_value,
        'products_count': products_count
    })


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
            'quantity': item.quantity,
            'unit_price': float(item.product.price) if item.product and item.product.price is not None else 0,
            'stock': item.product.stock.quantity if item.product and item.product.stock else 0,
            'subtotal': float(item.product.price or 0) * item.quantity if item.product else 0
        } for item in cart.items]
    } for cart in client.carts])


@api_bp.route('/client/carts', methods=['POST'])
def create_client_cart():
    client, error, status = client_required()
    if error:
        return error, status

    cart = Cart(client=client, status=CartStatus.OPEN.value)
    db.session.add(cart)
    db.session.commit()
    return jsonify({'id': cart.id, 'status': cart.status}), 201


@api_bp.route('/client/carts/<int:cart_id>/items', methods=['POST'])
def add_cart_item(cart_id):
    client, error, status = client_required()
    if error:
        return error, status

    cart = Cart.query.filter_by(id=cart_id, client_id=client.id).first()
    if not cart or cart.status not in OPEN_CART_STATUSES:
        return jsonify({'error': 'Carrinho não encontrado ou não está aberto'}), 404

    data = request.get_json() or {}
    product_id = data.get('product_id')
    try:
        quantity = int(data.get('quantity', 1))
    except (TypeError, ValueError):
        return jsonify({'error': 'product_id e quantidade positiva são obrigatórios'}), 400
    if not product_id or quantity < 1:
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


@api_bp.route('/client/carts/<int:cart_id>/items/<int:item_id>', methods=['PUT'])
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

    data = request.get_json() or {}
    try:
        quantity = int(data.get('quantity', 0))
    except (TypeError, ValueError):
        return jsonify({'error': 'quantidade positiva é obrigatória'}), 400

    if quantity < 1:
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


@api_bp.route('/client/carts/<int:cart_id>/items/<int:item_id>', methods=['DELETE'])
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


@api_bp.route('/client/carts/<int:cart_id>/checkout', methods=['POST'])
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

    total = 0
    order = Order(client=client, cart=cart, status=OrderStatus.PENDING.value, total=0)
    db.session.add(order)
    db.session.flush()

    for item in cart.items:
        order_item = OrderItem(order=order, product=item.product, quantity=item.quantity, unit_price=item.product.price)
        db.session.add(order_item)
        total += float(item.product.price or 0) * item.quantity
        try:
            current_app.logger.info(f"[Checkout] order_id={getattr(order,'id',None)} item product_id={getattr(item.product,'id',None)} qty={item.quantity} (no stock change at checkout)")
        except Exception:
            pass

    cart.status = CartStatus.CLOSED.value
    order.total = total
    db.session.commit()

    return jsonify({'order_id': order.id, 'total': float(order.total), 'status': order.status}), 201



# --- Admin endpoints ---

# Admin product endpoints moved to app.api.admin.products


# Admin category endpoints moved to app.api.admin.categories


# Admin stock moves endpoints moved to app.api.admin.stock_moves


# Admin client endpoints moved to app.api.admin.clients


# Admin users, permissions and rules moved to app.api.admin.users, permissions, rules


# Admin stock endpoints moved to app.api.admin.stock


# Admin order endpoints moved to app.api.admin.orders
