import secrets
from flask import request, jsonify, current_app
from app.api import api_bp
from app.models.clients import Client
from app.models.users import User
from app.models.rules import Rule
from app.models.client_rules import ClientRule
from app.models import db


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


@api_bp.route('/login', methods=['POST'])
def unified_login():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')
    if not email or not password:
        return jsonify({'error': 'email and password are required'}), 400

    # Try client authentication first
    client = Client.query.filter_by(email=email).first()
    if client and client.check_password(password):
        if not getattr(client, 'active', True):
            return jsonify({'error': 'Client account is inactive'}), 403
        client.auth_token = secrets.token_hex(32)
        db.session.commit()
        return jsonify({'token': client.auth_token, 'role': 'client'})

    # Try admin user by email
    user = User.query.filter_by(email=email).first()
    if user and user.check_password(password):
        user.auth_token = secrets.token_hex(32)
        db.session.commit()
        return jsonify({'token': user.auth_token, 'role': 'admin'})

    return jsonify({'error': 'Invalid email or password'}), 401


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
    db.session.flush()

    # vincular cliente à regra 'client' caso exista
    try:
        client_rule = Rule.query.filter_by(name='client').first()
        if client_rule:
            assoc = ClientRule(client_id=client.id, rule_id=client_rule.id)
            db.session.add(assoc)
    except Exception:
        pass

    db.session.commit()
    return jsonify({'token': client.auth_token, 'id': client.id}), 201


@api_bp.route('/client/logout', methods=['POST'])
def client_logout():
    from app.api.utils import get_auth_token
    from app.models.clients import Client as ClientModel
    token = get_auth_token()
    if not token:
        return jsonify({'error': 'Authorization token required'}), 401
    client = ClientModel.query.filter_by(auth_token=token).first()
    if not client:
        return jsonify({'error': 'Invalid client token'}), 401
    client.auth_token = None
    db.session.commit()
    return jsonify({'message': 'Client logged out successfully'})


@api_bp.route('/admin/logout', methods=['POST'])
def admin_logout():
    from app.api.utils import get_auth_token
    from app.models.users import User as UserModel
    token = get_auth_token()
    if not token:
        return jsonify({'error': 'Authorization token required'}), 401
    user = UserModel.query.filter_by(auth_token=token).first()
    if not user:
        return jsonify({'error': 'Invalid admin token'}), 401
    user.auth_token = None
    db.session.commit()
    return jsonify({'message': 'Admin logged out successfully'})
