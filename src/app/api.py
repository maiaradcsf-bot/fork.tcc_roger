from flask import Blueprint, jsonify
from app.models.product import Product  # Importa o modelo específico

api_bp = Blueprint('api', __name__, url_prefix='/api')

@api_bp.route('/users', methods=['GET'])
def listusers():
    data = {"users": ["admin", "cavalo"]}
    return jsonify(data)

@api_bp.route('/products', methods=['GET'])
def listproducts():
    products_from_db = Product.query.all()
    
    products_list = []
    for product in products_from_db:
        products_list.append({
            "id": product.id,
            "nome": product.name,
            "photo_path": product.photo_path,
            "descricao": product.description,
            "price": float(product.price) if product.price else 0.00
        })
    
    return jsonify(products_list)