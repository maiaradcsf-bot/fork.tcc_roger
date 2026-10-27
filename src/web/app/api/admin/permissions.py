from app.api.admin import admin_bp
from flask import jsonify
from app.api.utils import admin_required, permission_required, json_body, text_field, ValidationError
from app.models.permissions import Permission
from app.models import db
from app.permissions_catalog import SYSTEM_PERMISSION_NAMES


@admin_bp.route('/permissions', methods=['GET'])
@permission_required('admin.settings.permissions.manage')
def admin_list_permissions():
    user, error, status = admin_required()
    if error:
        return error, status
    permissions = Permission.query.all()
    return jsonify([{
        'id': p.id,
        'name': p.name,
        'description': p.description,
        'system': p.name in SYSTEM_PERMISSION_NAMES,
    } for p in permissions])


def _ensure_name_free(name, exclude_id=None):
    query = Permission.query.filter(Permission.name == name)
    if exclude_id is not None:
        query = query.filter(Permission.id != exclude_id)
    if query.first():
        raise ValidationError('Permissão já existe', 409)


@admin_bp.route('/permissions', methods=['POST'])
@permission_required('admin.settings.permissions.manage')
def admin_create_permission():
    user, error, status = admin_required('admin.settings.permissions.manage')
    if error:
        return error, status
    data = json_body()
    name = text_field(data, 'name', 'nome', 120, required=True)
    description = text_field(data, 'description', 'descrição', 2000)
    _ensure_name_free(name)
    permission = Permission(name=name, description=description)
    db.session.add(permission)
    db.session.commit()
    return jsonify({'id': permission.id}), 201


@admin_bp.route('/permissions/<int:permission_id>', methods=['PUT'])
@permission_required('admin.settings.permissions.manage')
def admin_update_permission(permission_id):
    user, error, status = admin_required('admin.settings.permissions.manage')
    if error:
        return error, status
    permission = db.session.get(Permission, permission_id)
    if not permission:
        return jsonify({'error': 'Permissão não encontrada'}), 404
    data = json_body()
    name = text_field(data, 'name', 'nome', 120, required=True) if 'name' in data else permission.name
    # The routes check permissions by name: renaming a system one would break authorization
    if name != permission.name and permission.name in SYSTEM_PERMISSION_NAMES:
        return jsonify({'error': 'Permissões do sistema não podem ser renomeadas'}), 409
    description = text_field(data, 'description', 'descrição', 2000) if 'description' in data else permission.description
    _ensure_name_free(name, exclude_id=permission_id)
    permission.name = name
    permission.description = description
    db.session.commit()
    return jsonify({'message': 'Permissão atualizada'})


@admin_bp.route('/permissions/<int:permission_id>', methods=['DELETE'])
@permission_required('admin.settings.permissions.manage')
def admin_delete_permission(permission_id):
    user, error, status = admin_required('admin.settings.permissions.manage')
    if error:
        return error, status
    permission = db.session.get(Permission, permission_id)
    if not permission:
        return jsonify({'error': 'Permissão não encontrada'}), 404
    if permission.name in SYSTEM_PERMISSION_NAMES:
        return jsonify({'error': 'Permissões do sistema não podem ser excluídas'}), 409
    db.session.delete(permission)
    db.session.commit()
    return jsonify({'message': 'Permissão excluída'})
