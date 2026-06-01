from app.api.admin import admin_bp
from flask import jsonify, request
from app.api.utils import admin_required
from app.models.users import User
from app.models.rules import Rule
from app.models import db


@admin_bp.route('/users', methods=['GET'])
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


@admin_bp.route('/users', methods=['POST'])
def admin_create_user():
    user, error, status = admin_required()
    if error:
        return error, status
    data = request.get_json() or {}
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    if not username or not email or not password:
        return jsonify({'error': 'nome de usuário, email e senha são obrigatórios'}), 400
    if User.query.filter((User.username == username) | (User.email == email)).first():
        return jsonify({'error': 'Nome de usuário ou email já está em uso'}), 409
    user_obj = User(username=username, email=email)
    user_obj.set_password(password)
    rule_ids = data.get('rule_ids') or []
    if rule_ids:
        rules = Rule.query.filter(Rule.id.in_(rule_ids)).all()
        user_obj.rules = rules
    db.session.add(user_obj)
    db.session.commit()
    return jsonify({'id': user_obj.id}), 201


@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
def admin_update_user(user_id):
    user, error, status = admin_required()
    if error:
        return error, status
    user_obj = User.query.get(user_id)
    if not user_obj:
        return jsonify({'error': 'Usuário não encontrado'}), 404
    data = request.get_json() or {}
    new_username = data.get('username', user_obj.username)
    new_email = data.get('email', user_obj.email)
    if (new_username != user_obj.username and User.query.filter(User.username == new_username).filter(User.id != user_id).first()) or (
        new_email != user_obj.email and User.query.filter(User.email == new_email).filter(User.id != user_id).first()):
        return jsonify({'error': 'Nome de usuário ou email já está em uso'}), 409
    user_obj.username = new_username
    user_obj.email = new_email
    if 'password' in data and data['password']:
        user_obj.set_password(data['password'])
    if 'rule_ids' in data:
        rule_ids = data.get('rule_ids') or []
        user_obj.rules = Rule.query.filter(Rule.id.in_(rule_ids)).all() if rule_ids else []
    db.session.commit()
    return jsonify({'message': 'Usuário atualizado'})


@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
def admin_delete_user(user_id):
    user, error, status = admin_required()
    if error:
        return error, status
    user_obj = User.query.get(user_id)
    if not user_obj:
        return jsonify({'error': 'Usuário não encontrado'}), 404
    db.session.delete(user_obj)
    db.session.commit()
    return jsonify({'message': 'Usuário excluído'})
