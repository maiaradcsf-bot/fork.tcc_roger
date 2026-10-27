from app.api.admin import admin_bp
from flask import jsonify
from app.api.utils import (admin_required, permission_required, json_body, text_field, email_field, password_field,
                           id_list_field, permission_names_of, ensure_can_grant, ValidationError)
from app.models.users import User
from app.models.rules import Rule
from app.models.orders import Order
from app.models.stock_moves import StockMove
from app.models import db


@admin_bp.route('/me', methods=['GET'])
def admin_me():
    user, error, status = admin_required()
    if error:
        return error, status
    return jsonify({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'rules': [{'id': r.id, 'name': r.name} for r in user.rules],
        'permissions': user.get_permission_names(),
    })


@admin_bp.route('/users', methods=['GET'])
@permission_required('admin.settings.users.manage')
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


def _rules_from_ids(rule_ids):
    rules = Rule.query.filter(Rule.id.in_(rule_ids)).all() if rule_ids else []
    if len(rules) != len(rule_ids):
        raise ValidationError('Um ou mais perfis informados não existem')
    return rules


def _ensure_can_manage(actor, target):
    # Editing or deleting an account with permissions the actor lacks (e.g. resetting an
    # administrator's password) would be a privilege escalation
    ensure_can_grant(actor, permission_names_of(target.rules))


def _ensure_unique(username, email, exclude_id=None):
    query = User.query.filter((User.username == username) | (User.email == email))
    if exclude_id is not None:
        query = query.filter(User.id != exclude_id)
    if query.first():
        raise ValidationError('Nome de usuário ou email já está em uso', 409)


@admin_bp.route('/users', methods=['POST'])
@permission_required('admin.settings.users.manage')
def admin_create_user():
    user, error, status = admin_required('admin.settings.users.manage')
    if error:
        return error, status
    data = json_body()
    username = text_field(data, 'username', 'nome de usuário', 80, required=True)
    email = email_field(data, required=True)
    password = password_field(data, required=True)
    rules = _rules_from_ids(id_list_field(data, 'rule_ids', 'rule_ids'))
    ensure_can_grant(user, permission_names_of(rules))
    _ensure_unique(username, email)

    user_obj = User(username=username, email=email)
    user_obj.set_password(password)
    user_obj.rules = rules
    db.session.add(user_obj)
    db.session.commit()
    return jsonify({'id': user_obj.id}), 201


@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@permission_required('admin.settings.users.manage')
def admin_update_user(user_id):
    user, error, status = admin_required('admin.settings.users.manage')
    if error:
        return error, status
    user_obj = db.session.get(User, user_id)
    if not user_obj:
        return jsonify({'error': 'Usuário não encontrado'}), 404
    data = json_body()
    _ensure_can_manage(user, user_obj)

    username = text_field(data, 'username', 'nome de usuário', 80, required=True) if 'username' in data else user_obj.username
    email = email_field(data, required=True) if 'email' in data else user_obj.email
    password = password_field(data)
    rules = _rules_from_ids(id_list_field(data, 'rule_ids', 'rule_ids')) if 'rule_ids' in data else None
    if rules is not None:
        ensure_can_grant(user, permission_names_of(rules))
    _ensure_unique(username, email, exclude_id=user_id)

    user_obj.username = username
    user_obj.email = email
    if password:
        user_obj.set_password(password)
    if rules is not None:
        user_obj.rules = rules
    db.session.commit()
    return jsonify({'message': 'Usuário atualizado'})


@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@permission_required('admin.settings.users.manage')
def admin_delete_user(user_id):
    user, error, status = admin_required('admin.settings.users.manage')
    if error:
        return error, status
    user_obj = db.session.get(User, user_id)
    if not user_obj:
        return jsonify({'error': 'Usuário não encontrado'}), 404
    if user_obj.id == user.id:
        return jsonify({'error': 'Você não pode excluir a própria conta'}), 400
    _ensure_can_manage(user, user_obj)

    # Orders and stock moves keep who did what; such accounts cannot disappear
    has_history = db.session.query(Order.id).filter(
        (Order.approved_user_id == user_id) | (Order.refused_user_id == user_id)
        | (Order.finished_user_id == user_id) | (Order.canceled_user_id == user_id)
    ).first() or db.session.query(StockMove.id).filter(
        (StockMove.user_id == user_id) | (StockMove.reverted_by_user_id == user_id)
    ).first()
    if has_history:
        return jsonify({'error': 'Usuário possui histórico de pedidos ou movimentações e não pode ser excluído. Remova os perfis dele para bloquear o acesso.'}), 409

    db.session.delete(user_obj)
    db.session.commit()
    return jsonify({'message': 'Usuário excluído'})
