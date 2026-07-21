import os
from functools import wraps
from flask import request, jsonify
from app.models import db
from app.models.products import Product
from app.models.status_enums import CartStatus, OrderStatus
from app.models.clients import Client
from app.models.users import User
from app.models.rules import Rule

UPLOAD_FOLDER = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'static', 'uploads'))
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

# Pasta temporária (fora de static/) usada pelo wizard de importação de produtos via CSV
IMPORT_TMP_FOLDER = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'tmp_imports'))

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


OPEN_CART_STATUSES = {CartStatus.OPEN.value}


def normalize_order_status(status):
    normalized = (status or '').lower()
    if normalized in {'initial', 'inicial', 'pendent', 'pendente'}:
        return OrderStatus.PENDING.value
    if normalized in {'aprovado'}:
        return OrderStatus.APPROVED.value
    if normalized in {'rejected', 'rejeitado', 'rejeitada'}:
        return OrderStatus.REJECTED.value
    if normalized in {'cancelled', 'cancelado', 'canceled'}:
        return OrderStatus.CANCELLED.value
    if normalized in {'completed', 'concluido', 'concluído', 'retirado', 'picked_up', 'withdrawn', 'checked_out'}:
        return OrderStatus.FINISHED.value
    return normalized


def get_active_products():
    return Product.query.filter(Product.deleted_at.is_(None)).all()


def get_product_by_id(product_id):
    return Product.query.filter(Product.id == product_id, Product.deleted_at.is_(None)).first()


def json_error(message, code=400):
    return jsonify({'error': message}), code


def get_auth_token():
    auth = request.headers.get('Authorization', '')
    if auth.startswith('Bearer '):
        return auth[7:]
    return None


def get_client_user():
    token = get_auth_token()
    if not token:
        return None, jsonify({'error': 'Token de autorização é obrigatório'}), 401
    client = Client.query.filter_by(auth_token=token).first()
    if not client:
        return None, jsonify({'error': 'Token de cliente inválido'}), 401
    if not client.active:
        return None, jsonify({'error': 'Conta de cliente está inativa'}), 403
    return client, None, None


def client_required(permission_name=None):
    client, error, status = get_client_user()
    if error:
        return None, error, status
    if permission_name and not client.has_permission(permission_name):
        return None, jsonify({'error': 'Permissão insuficiente'}), 403
    return client, None, None


def get_admin_user():
    token = get_auth_token()
    if not token:
        return None, jsonify({'error': 'Token de autorização é obrigatório'}), 401
    user = User.query.filter_by(auth_token=token).first()
    if not user:
        return None, jsonify({'error': 'Token de administrador inválido'}), 401
    if not getattr(user, 'rules', []):
        return None, jsonify({'error': 'Privilégios de administrador são necessários'}), 403
    return user, None, None


def admin_required(permission_name=None):
    user, error, status = get_admin_user()
    if error:
        return None, error, status
    if permission_name and not user.has_permission(permission_name):
        return None, jsonify({'error': 'Permissão insuficiente'}), 403
    return user, None, None


def permission_required(permission_name):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user, error, status = admin_required(permission_name)
            if error:
                return error, status
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def client_permission_required(permission_name):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            client, error, status = client_required(permission_name)
            if error:
                return error, status
            return fn(*args, **kwargs)
        return wrapper
    return decorator
