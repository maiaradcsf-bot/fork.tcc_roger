from app.api.client import client_bp
from flask import jsonify
from app.api.utils import client_required, get_active_products


@client_bp.route('/products', methods=['GET'])
def client_list_products():
    client, error, status = client_required()
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
        'categories': [category.name for category in product.categories]
    } for product in products])
