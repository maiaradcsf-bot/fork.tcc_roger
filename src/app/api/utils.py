import os
from flask import request, jsonify
from app.models import db
from app.models.products import Product
from app.models.status_enums import CartStatus, OrderStatus
from app.models.clients import Client
from app.models.users import User
from app.models.rules import Rule

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

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
    if not any(getattr(rule, 'name', None) == 'administrator' for rule in getattr(user, 'rules', []) ):
        return None, jsonify({'error': 'Admin privileges required'}), 403
    return user, None, None
