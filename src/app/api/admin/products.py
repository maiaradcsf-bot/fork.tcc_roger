import os
import secrets
from app.api.admin import admin_bp
from flask import jsonify, request
from app.api.utils import admin_required, get_active_products, get_product_by_id, UPLOAD_FOLDER, allowed_file
from werkzeug.utils import secure_filename
from app.models.products import Product
from app.models.categories import Category
from app.models import db


def _serialize_product_categories(product):
    categories = []
    for category in product.categories:
        categories.append({
            'id': category.id,
            'name': category.name,
            'parent_id': category.parent_id,
            'parent_name': category.parent.name if category.parent else None,
            'path': f"{category.parent.name} / {category.name}" if category.parent else category.name,
        })
    return categories


@admin_bp.route('/products', methods=['GET'])
def admin_list_products():
    user, error, status = admin_required()
    if error:
        return error, status
    products = get_active_products()
    return jsonify([{
        'id': product.id,
        'name': product.name,
        'description': product.description,
        'price': float(product.price) if product.price else 0.0,
        'photo_path': product.photo_path,
        'stock': product.stock.quantity if product.stock else 0,
        'category_ids': [category.id for category in product.categories],
        'categories': _serialize_product_categories(product)
    } for product in products])


@admin_bp.route('/products', methods=['POST'])
def admin_create_product():
    user, error, status = admin_required()
    if error:
        return error, status
    data = request.get_json() or {}
    category_ids = data.get('category_ids', []) or []
    categories = []
    if category_ids:
        categories = Category.query.filter(Category.id.in_(category_ids)).all()
        if len(categories) != len(set(category_ids)):
            return jsonify({'error': 'IDs de categoria inválidos'}), 400

    product = Product(
        name=data.get('name'),
        description=data.get('description'),
        price=data.get('price', 0),
        photo_path=data.get('photo_path')
    )
    product.categories = categories
    db.session.add(product)
    db.session.commit()
    return jsonify({'id': product.id}), 201


@admin_bp.route('/upload', methods=['POST'])
def admin_upload():
    user, error, status = admin_required()
    if error:
        return error, status
    
    if 'file' not in request.files:
        return jsonify({'error': 'Nenhum arquivo enviado'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Nenhum arquivo selecionado'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'Tipo de arquivo não permitido. Use: png, jpg, jpeg, gif, webp'}), 400
    
    # Create uploads folder if doesn't exist
    import os
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    
    # Generate secure filename
    filename = secure_filename(file.filename)
    filename = f"{secrets.token_hex(8)}_{filename}"
    
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    
    # Return relative path for web access
    return jsonify({'url': f'/static/uploads/{filename}'}), 201


@admin_bp.route('/products/<int:product_id>', methods=['PUT'])
def admin_update_product(product_id):
    user, error, status = admin_required()
    if error:
        return error, status
    product = get_product_by_id(product_id)
    if not product:
        return jsonify({'error': 'Produto não encontrado'}), 404

    data = request.get_json() or {}
    category_ids = data.get('category_ids')
    if category_ids is not None:
        categories = Category.query.filter(Category.id.in_(category_ids)).all() if category_ids else []
        if len(categories) != len(set(category_ids)):
            return jsonify({'error': 'IDs de categoria inválidos'}), 400
        product.categories = categories

    product.name = data.get('name', product.name)
    product.description = data.get('description', product.description)
    product.price = data.get('price', product.price)
    product.photo_path = data.get('photo_path', product.photo_path)
    db.session.commit()
    return jsonify({'message': 'Produto atualizado'})


@admin_bp.route('/products/<int:product_id>', methods=['DELETE'])
def admin_delete_product(product_id):
    user, error, status = admin_required()
    if error:
        return error, status
    product = get_product_by_id(product_id)
    if not product:
        return jsonify({'error': 'Produto não encontrado'}), 404
    product.soft_delete()
    db.session.commit()
    return jsonify({'message': 'Produto excluído'})
