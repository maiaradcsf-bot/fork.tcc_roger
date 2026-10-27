from datetime import datetime
from app.api.admin import admin_bp
from flask import jsonify, request
from app.api.utils import (admin_required, permission_required, get_active_products, get_product_by_id, json_body,
                           text_field, id_list_field, price_field, stock_limit_field, save_uploaded_image,
                           ValidationError)
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


def _serialize_product(product):
    return {
        'id': product.id,
        'name': product.name,
        'description': product.description,
        'price': float(product.price) if product.price else 0.0,
        'barcode': product.barcode,
        'min_stock': product.min_stock,
        'max_stock': product.max_stock,
        'photo_path': product.photo_path,
        'stock': product.stock.quantity if product.stock else 0,
        'category_ids': [category.id for category in product.categories],
        'categories': _serialize_product_categories(product)
    }


@admin_bp.route('/products', methods=['GET'])
@permission_required('admin.products.list')
def admin_list_products():
    user, error, status = admin_required()
    if error:
        return error, status
    return jsonify([_serialize_product(product) for product in get_active_products()])


@admin_bp.route('/products/<int:product_id>', methods=['GET'])
@permission_required('admin.products.list')
def admin_get_product(product_id):
    user, error, status = admin_required()
    if error:
        return error, status
    product = get_product_by_id(product_id)
    if not product:
        return jsonify({'error': 'Produto não encontrado'}), 404
    return jsonify(_serialize_product(product))


def _categories_field(data):
    category_ids = id_list_field(data, 'category_ids', 'category_ids')
    categories = Category.query.filter(Category.id.in_(category_ids)).all() if category_ids else []
    if len(categories) != len(category_ids):
        raise ValidationError('IDs de categoria inválidos')
    return categories


def _barcode_field(data, product_id=None):
    value = data.get('barcode')
    if isinstance(value, int) and not isinstance(value, bool):
        value = str(value)
    barcode = text_field({'barcode': value}, 'barcode', 'código de barras', 64) or None
    if barcode:
        query = Product.query.filter(Product.barcode == barcode)
        if product_id is not None:
            query = query.filter(Product.id != product_id)
        existing = query.first()
        if existing:
            if existing.deleted_at is not None:
                raise ValidationError('Código de barras pertence a um produto excluído', 409)
            raise ValidationError('Código de barras já existe', 409)
    return barcode


def _check_stock_limits(min_stock, max_stock):
    if min_stock is not None and max_stock is not None and max_stock < min_stock:
        raise ValidationError('max_stock não pode ser menor que min_stock')


@admin_bp.route('/products', methods=['POST'])
@permission_required('admin.products.create')
def admin_create_product():
    user, error, status = admin_required()
    if error:
        return error, status
    data = json_body()
    name = text_field(data, 'name', 'nome', 150, required=True)
    description = text_field(data, 'description', 'descrição', 5000)
    price = price_field(data)
    photo_path = text_field(data, 'photo_path', 'photo_path', 255) or None
    categories = _categories_field(data)
    barcode = _barcode_field(data)
    min_stock = stock_limit_field(data, 'min_stock', 'min_stock')
    max_stock = stock_limit_field(data, 'max_stock', 'max_stock')
    _check_stock_limits(min_stock, max_stock)

    product = Product(
        name=name,
        description=description,
        price=price if price is not None else 0,
        photo_path=photo_path,
        barcode=barcode,
        min_stock=min_stock,
        max_stock=max_stock
    )
    product.categories = categories
    db.session.add(product)
    db.session.commit()
    return jsonify({'id': product.id}), 201


@admin_bp.route('/upload', methods=['POST'])
@permission_required('admin.products.edit')
def admin_upload():
    user, error, status = admin_required()
    if error:
        return error, status
    return jsonify({'url': save_uploaded_image(request.files.get('file'))}), 201


@admin_bp.route('/products/<int:product_id>', methods=['PUT'])
@permission_required('admin.products.edit')
def admin_update_product(product_id):
    user, error, status = admin_required()
    if error:
        return error, status
    product = get_product_by_id(product_id)
    if not product:
        return jsonify({'error': 'Produto não encontrado'}), 404

    data = json_body()
    # Only the fields sent are changed (a partial update must not clear the others)
    if 'name' in data:
        product.name = text_field(data, 'name', 'nome', 150, required=True)
    if 'description' in data:
        product.description = text_field(data, 'description', 'descrição', 5000)
    if 'price' in data:
        price = price_field(data, required=True)
        product.price = price
    if 'photo_path' in data:
        product.photo_path = text_field(data, 'photo_path', 'photo_path', 255) or None
    if 'barcode' in data:
        product.barcode = _barcode_field(data, product_id)
    if 'category_ids' in data:
        product.categories = _categories_field(data)
    min_stock = stock_limit_field(data, 'min_stock', 'min_stock') if 'min_stock' in data else product.min_stock
    max_stock = stock_limit_field(data, 'max_stock', 'max_stock') if 'max_stock' in data else product.max_stock
    _check_stock_limits(min_stock, max_stock)
    product.min_stock = min_stock
    product.max_stock = max_stock
    db.session.commit()
    return jsonify({'message': 'Produto atualizado'})


@admin_bp.route('/products/<int:product_id>', methods=['DELETE'])
@permission_required('admin.products.delete')
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


@admin_bp.route('/products/delete-all', methods=['DELETE'])
@permission_required('admin.products.delete')
def admin_delete_all_products():
    user, error, status = admin_required()
    if error:
        return error, status

    product_ids = [product.id for product in get_active_products()]

    # Soft delete only: stock rows, stock move history and order items keep pointing at the products
    if product_ids:
        Product.query.filter(Product.id.in_(product_ids)).update(
            {Product.deleted_at: datetime.utcnow()}, synchronize_session=False
        )

    db.session.commit()
    return jsonify({'message': 'Todos os produtos foram excluídos. O histórico de estoque foi preservado.', 'deleted_count': len(product_ids)})
