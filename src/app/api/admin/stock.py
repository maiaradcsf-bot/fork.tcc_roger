from app.api.admin import admin_bp
from flask import jsonify, request, current_app
from app.api.utils import admin_required, get_product_by_id
from app.models.stock import Stock
from app.models import db


@admin_bp.route('/stock', methods=['GET'])
def admin_list_stock():
    user, error, status = admin_required()
    if error:
        return error, status
    stock_items = Stock.query.all()
    return jsonify([{
        'id': stock.id,
        'product_id': stock.product_id,
        'product_name': stock.product.name if stock.product else None,
        'quantity': stock.quantity
    } for stock in stock_items])


@admin_bp.route('/stock', methods=['POST'])
def admin_create_stock():
    user, error, status = admin_required()
    if error:
        return error, status
    data = request.get_json() or {}
    product_id = data.get('product_id')
    quantity = data.get('quantity', 0)
    
    if not product_id:
        return jsonify({'error': 'product_id is required'}), 400
    
    product = get_product_by_id(product_id)
    if not product:
        return jsonify({'error': 'Product not found'}), 404
    
    existing_stock = Stock.query.filter_by(product_id=product_id).first()
    if existing_stock:
        return jsonify({'error': 'Stock already exists for this product'}), 400
    
    stock = Stock(product_id=product_id, quantity=quantity)
    db.session.add(stock)
    db.session.commit()
    return jsonify({'id': stock.id, 'product_id': stock.product_id, 'quantity': stock.quantity}), 201
