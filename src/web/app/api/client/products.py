from app.api.client import client_bp
from flask import jsonify
from app.api.utils import client_required, client_permission_required, get_active_products, get_product_by_id


@client_bp.route('/products', methods=['GET'])
@client_permission_required('clients.products.list')
def client_list_products():
    client, error, status = client_required()
    if error:
        return error, status

    return jsonify([_serialize(product) for product in get_active_products()])


def _serialize(product):
    return {
        'id': product.id,
        'name': product.name,
        'description': product.description,
        'price': float(product.price) if product.price else 0.0,
        'photo_path': product.photo_path,
        'stock': product.stock.quantity if product.stock else 0,
        'categories': [category.name for category in product.categories]
    }


@client_bp.route('/products/<int:product_id>', methods=['GET'])
@client_permission_required('clients.products.view')
def client_get_product(product_id):
    client, error, status = client_required()
    if error:
        return error, status
    product = get_product_by_id(product_id)
    if not product:
        return jsonify({'error': 'Produto não encontrado'}), 404
    return jsonify(_serialize(product))
