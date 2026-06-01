from app.api.admin import admin_bp
from flask import jsonify, request
from app.api.utils import admin_required
from app.models.categories import Category
from app.models import db


@admin_bp.route('/categories', methods=['GET'])
def admin_list_categories():
    user, error, status = admin_required()
    if error:
        return error, status
    categories = Category.query.order_by(Category.parent_id, Category.name).all()
    return jsonify([{
        'id': category.id,
        'name': category.name,
        'description': category.description,
        'parent_id': category.parent_id,
        'parent_name': category.parent.name if category.parent else None,
        'subcategories': [{'id': child.id, 'name': child.name} for child in category.children]
    } for category in categories])


@admin_bp.route('/categories', methods=['POST'])
def admin_create_category():
    user, error, status = admin_required()
    if error:
        return error, status
    data = request.get_json() or {}
    name = data.get('name')
    if not name:
        return jsonify({'error': 'nome é obrigatório'}), 400
    parent_id = data.get('parent_id')
    if parent_id is not None and not Category.query.get(parent_id):
        return jsonify({'error': 'Categoria pai não encontrada'}), 400
    category = Category(
        name=name,
        description=data.get('description'),
        parent_id=parent_id
    )
    db.session.add(category)
    db.session.commit()
    return jsonify({'id': category.id}), 201


@admin_bp.route('/categories/<int:category_id>', methods=['PUT'])
def admin_update_category(category_id):
    user, error, status = admin_required()
    if error:
        return error, status
    category = Category.query.get(category_id)
    if not category:
        return jsonify({'error': 'Categoria não encontrada'}), 404
    data = request.get_json() or {}
    parent_id = data.get('parent_id', category.parent_id)
    if parent_id is not None and parent_id != category.id and not Category.query.get(parent_id):
        return jsonify({'error': 'Categoria pai não encontrada'}), 400
    if parent_id == category.id:
        return jsonify({'error': 'Categoria não pode ser sua própria categoria pai'}), 400
    category.name = data.get('name', category.name)
    category.description = data.get('description', category.description)
    category.parent_id = parent_id
    db.session.commit()
    return jsonify({'message': 'Categoria atualizada'})


@admin_bp.route('/categories/<int:category_id>', methods=['DELETE'])
def admin_delete_category(category_id):
    user, error, status = admin_required()
    if error:
        return error, status
    category = Category.query.get(category_id)
    if not category:
        return jsonify({'error': 'Categoria não encontrada'}), 404
    db.session.delete(category)
    db.session.commit()
    return jsonify({'message': 'Categoria excluída'})
