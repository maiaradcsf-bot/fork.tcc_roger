from app.api.admin import admin_bp
from flask import jsonify, request
from app.api.utils import admin_required, permission_required
from app.models.permissions import Permission
from app.models import db


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
        'description': p.description
    } for p in permissions])


@admin_bp.route('/permissions', methods=['POST'])
@permission_required('admin.settings.permissions.manage')
def admin_create_permission():
    user, error, status = admin_required('admin.settings.permissions.manage')
    if error:
        return error, status
    data = request.get_json() or {}
    name = data.get('name')
    if not name:
        return jsonify({'error': 'nome é obrigatório'}), 400
    if Permission.query.filter_by(name=name).first():
        return jsonify({'error': 'Permissão já existe'}), 409
    permission = Permission(name=name, description=data.get('description'))
    db.session.add(permission)
    db.session.commit()
    return jsonify({'id': permission.id}), 201


@admin_bp.route('/permissions/<int:permission_id>', methods=['PUT'])
@permission_required('admin.settings.permissions.manage')
def admin_update_permission(permission_id):
    user, error, status = admin_required('admin.settings.permissions.manage')
    if error:
        return error, status
    permission = Permission.query.get(permission_id)
    if not permission:
        return jsonify({'error': 'Permissão não encontrada'}), 404
    data = request.get_json() or {}
    name = data.get('name', permission.name)
    if name != permission.name and Permission.query.filter_by(name=name).filter(Permission.id != permission_id).first():
        return jsonify({'error': 'Permissão já existe'}), 409
    permission.name = name
    permission.description = data.get('description', permission.description)
    db.session.commit()
    return jsonify({'message': 'Permissão atualizada'})


@admin_bp.route('/permissions/<int:permission_id>', methods=['DELETE'])
@permission_required('admin.settings.permissions.manage')
def admin_delete_permission(permission_id):
    user, error, status = admin_required('admin.settings.permissions.manage')
    if error:
        return error, status
    permission = Permission.query.get(permission_id)
    if not permission:
        return jsonify({'error': 'Permissão não encontrada'}), 404
    db.session.delete(permission)
    db.session.commit()
    return jsonify({'message': 'Permissão excluída'})
