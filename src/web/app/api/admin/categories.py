from app.api.admin import admin_bp
from flask import jsonify
from app.api.utils import admin_required, permission_required, json_body, text_field, optional_id_field, ValidationError
from app.models.categories import Category
from app.models import db


@admin_bp.route('/categories', methods=['GET'])
@permission_required('admin.categories.list')
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


def _ensure_name_free(name, exclude_id=None):
    query = Category.query.filter(Category.name == name)
    if exclude_id is not None:
        query = query.filter(Category.id != exclude_id)
    if query.first():
        raise ValidationError('Já existe uma categoria com esse nome', 409)


def _ensure_parent(parent_id, category_id=None):
    if parent_id is None:
        return
    parent = db.session.get(Category, parent_id)
    if not parent:
        raise ValidationError('Categoria pai não encontrada')
    # Walk up from the new parent: reaching the category itself would create a cycle
    seen = set()
    while parent is not None and parent.id not in seen:
        if category_id is not None and parent.id == category_id:
            raise ValidationError('Categoria não pode ser pai de si mesma nem de uma categoria acima dela')
        seen.add(parent.id)
        parent = parent.parent


@admin_bp.route('/categories', methods=['POST'])
@permission_required('admin.categories.create')
def admin_create_category():
    user, error, status = admin_required('admin.categories.create')
    if error:
        return error, status
    data = json_body()
    name = text_field(data, 'name', 'nome', 120, required=True)
    description = text_field(data, 'description', 'descrição', 5000)
    parent_id = optional_id_field(data, 'parent_id', 'parent_id')
    _ensure_parent(parent_id)
    _ensure_name_free(name)
    category = Category(name=name, description=description, parent_id=parent_id)
    db.session.add(category)
    db.session.commit()
    return jsonify({'id': category.id}), 201


@admin_bp.route('/categories/<int:category_id>', methods=['PUT'])
@permission_required('admin.categories.edit')
def admin_update_category(category_id):
    user, error, status = admin_required('admin.categories.edit')
    if error:
        return error, status
    category = db.session.get(Category, category_id)
    if not category:
        return jsonify({'error': 'Categoria não encontrada'}), 404
    data = json_body()
    name = text_field(data, 'name', 'nome', 120, required=True) if 'name' in data else category.name
    description = text_field(data, 'description', 'descrição', 5000) if 'description' in data else category.description
    parent_id = optional_id_field(data, 'parent_id', 'parent_id') if 'parent_id' in data else category.parent_id
    _ensure_parent(parent_id, category_id)
    _ensure_name_free(name, exclude_id=category_id)
    category.name = name
    category.description = description
    category.parent_id = parent_id
    db.session.commit()
    return jsonify({'message': 'Categoria atualizada'})


@admin_bp.route('/categories/<int:category_id>', methods=['DELETE'])
@permission_required('admin.categories.delete')
def admin_delete_category(category_id):
    user, error, status = admin_required('admin.categories.delete')
    if error:
        return error, status
    category = db.session.get(Category, category_id)
    if not category:
        return jsonify({'error': 'Categoria não encontrada'}), 404
    # Subcategories become top-level categories; product links are removed with the category
    for child in list(category.children):
        child.parent_id = None
    db.session.delete(category)
    db.session.commit()
    return jsonify({'message': 'Categoria excluída'})
