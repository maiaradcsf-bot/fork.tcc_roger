from app.api.admin import admin_bp
from flask import jsonify
from app.api.utils import (admin_required, permission_required, json_body, text_field, id_list_field,
                           ensure_can_grant, ValidationError)
from app.models.rules import Rule
from app.models.permissions import Permission
from app.models import db
from app.permissions_catalog import PROTECTED_RULE_NAMES


@admin_bp.route('/rules', methods=['GET'])
@permission_required('admin.settings.profiles.manage')
def admin_list_rules():
    user, error, status = admin_required('admin.settings.profiles.manage')
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


def _permissions_from_ids(permission_ids):
    permissions = Permission.query.filter(Permission.id.in_(permission_ids)).all() if permission_ids else []
    if len(permissions) != len(permission_ids):
        raise ValidationError('Uma ou mais permissões informadas não existem')
    return permissions


def _ensure_name_free(name, exclude_id=None):
    query = Rule.query.filter(Rule.name == name)
    if exclude_id is not None:
        query = query.filter(Rule.id != exclude_id)
    if query.first():
        raise ValidationError('Regra já existe', 409)


@admin_bp.route('/rules', methods=['POST'])
@permission_required('admin.settings.profiles.manage')
def admin_create_rule():
    user, error, status = admin_required('admin.settings.profiles.manage')
    if error:
        return error, status
    data = json_body()
    name = text_field(data, 'name', 'nome', 120, required=True)
    description = text_field(data, 'description', 'descrição', 2000)
    permissions = _permissions_from_ids(id_list_field(data, 'permission_ids', 'permission_ids'))
    ensure_can_grant(user, [p.name for p in permissions])
    _ensure_name_free(name)

    rule = Rule(name=name, description=description, permissions=permissions)
    db.session.add(rule)
    db.session.commit()
    return jsonify({'id': rule.id}), 201


@admin_bp.route('/rules/<int:rule_id>', methods=['PUT'])
@permission_required('admin.settings.profiles.manage')
def admin_update_rule(rule_id):
    user, error, status = admin_required('admin.settings.profiles.manage')
    if error:
        return error, status
    rule = db.session.get(Rule, rule_id)
    if not rule:
        return jsonify({'error': 'Regra não encontrada'}), 404
    data = json_body()
    # A profile holding permissions the actor lacks cannot be edited by them
    ensure_can_grant(user, [p.name for p in rule.permissions])

    name = text_field(data, 'name', 'nome', 120, required=True) if 'name' in data else rule.name
    if name != rule.name and rule.name in PROTECTED_RULE_NAMES:
        return jsonify({'error': f'O perfil "{rule.name}" é usado pelo sistema e não pode ser renomeado'}), 409
    description = text_field(data, 'description', 'descrição', 2000) if 'description' in data else rule.description
    permissions = _permissions_from_ids(id_list_field(data, 'permission_ids', 'permission_ids')) if 'permission_ids' in data else None
    if permissions is not None:
        ensure_can_grant(user, [p.name for p in permissions])
    _ensure_name_free(name, exclude_id=rule_id)

    rule.name = name
    rule.description = description
    if permissions is not None:
        rule.permissions = permissions
    db.session.commit()
    return jsonify({'message': 'Regra atualizada'})


@admin_bp.route('/rules/<int:rule_id>', methods=['DELETE'])
@permission_required('admin.settings.profiles.manage')
def admin_delete_rule(rule_id):
    user, error, status = admin_required('admin.settings.profiles.manage')
    if error:
        return error, status
    rule = db.session.get(Rule, rule_id)
    if not rule:
        return jsonify({'error': 'Regra não encontrada'}), 404
    if rule.name in PROTECTED_RULE_NAMES:
        return jsonify({'error': f'O perfil "{rule.name}" é usado pelo sistema e não pode ser excluído'}), 409
    ensure_can_grant(user, [p.name for p in rule.permissions])
    db.session.delete(rule)
    db.session.commit()
    return jsonify({'message': 'Regra excluída'})
