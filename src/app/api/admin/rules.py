from app.api.admin import admin_bp
from flask import jsonify, request
from app.api.utils import admin_required
from app.models.rules import Rule
from app.models.permissions import Permission
from app.models import db


@admin_bp.route('/rules', methods=['GET'])
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


@admin_bp.route('/rules', methods=['POST'])
def admin_create_rule():
    user, error, status = admin_required()
    if error:
        return error, status
    data = request.get_json() or {}
    name = data.get('name')
    if not name:
        return jsonify({'error': 'nome é obrigatório'}), 400
    if Rule.query.filter_by(name=name).first():
        return jsonify({'error': 'Regra já existe'}), 409
    rule = Rule(name=name, description=data.get('description'))
    permission_ids = data.get('permission_ids') or []
    if permission_ids:
        rule.permissions = Permission.query.filter(Permission.id.in_(permission_ids)).all()
    db.session.add(rule)
    db.session.commit()
    return jsonify({'id': rule.id}), 201


@admin_bp.route('/rules/<int:rule_id>', methods=['PUT'])
def admin_update_rule(rule_id):
    user, error, status = admin_required()
    if error:
        return error, status
    rule = Rule.query.get(rule_id)
    if not rule:
        return jsonify({'error': 'Regra não encontrada'}), 404
    data = request.get_json() or {}
    name = data.get('name', rule.name)
    if name != rule.name and Rule.query.filter_by(name=name).filter(Rule.id != rule_id).first():
        return jsonify({'error': 'Regra já existe'}), 409
    rule.name = name
    rule.description = data.get('description', rule.description)
    if 'permission_ids' in data:
        permission_ids = data.get('permission_ids') or []
        rule.permissions = Permission.query.filter(Permission.id.in_(permission_ids)).all() if permission_ids else []
    db.session.commit()
    return jsonify({'message': 'Regra atualizada'})


@admin_bp.route('/rules/<int:rule_id>', methods=['DELETE'])
def admin_delete_rule(rule_id):
    user, error, status = admin_required()
    if error:
        return error, status
    rule = Rule.query.get(rule_id)
    if not rule:
        return jsonify({'error': 'Regra não encontrada'}), 404
    db.session.delete(rule)
    db.session.commit()
    return jsonify({'message': 'Regra excluída'})
