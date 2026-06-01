from app.api.admin import admin_bp
from flask import jsonify, request, current_app
from app.api.utils import admin_required, get_product_by_id
from app.models.stock_moves import StockMove
from app.models.stock import Stock
from app.models import db


@admin_bp.route('/stock/moves', methods=['GET'])
def admin_list_stock_moves():
    user, error, status = admin_required()
    if error:
        return error, status
    stock_moves = StockMove.query.order_by(StockMove.created_at.desc()).all()
    return jsonify([{
        'id': move.id,
        'stock_id': move.stock_id,
        'product_id': move.stock.product_id if move.stock else None,
        'product_name': move.stock.product.name if move.stock and move.stock.product else 'Produto desconhecido',
        'quantity_change': move.quantity_change,
        'reason': move.reason,
        'created_at': move.created_at.isoformat()
    } for move in stock_moves])


@admin_bp.route('/stock/moves', methods=['POST'])
def admin_create_stock_move():
    user, error, status = admin_required()
    if error:
        return error, status
    data = request.get_json() or {}
    stock_id = data.get('stock_id')
    product_id = data.get('product_id')
    quantity_change = data.get('quantity_change')
    reason = data.get('reason')
    
    if quantity_change is None:
        return jsonify({'error': 'quantity_change is required'}), 400
    
    # If product_id is provided, find or create stock
    if product_id and not stock_id:
        stock = Stock.query.filter_by(product_id=product_id).first()
        if not stock:
            product = get_product_by_id(product_id)
            if not product:
                return jsonify({'error': 'Product not found'}), 404
            stock = Stock(product_id=product_id, quantity=0)
            db.session.add(stock)
            db.session.commit()
        stock_id = stock.id
    elif not stock_id:
        return jsonify({'error': 'stock_id or product_id is required'}), 400
    
    stock = Stock.query.get(stock_id)
    if not stock:
        return jsonify({'error': 'Stock not found'}), 404
    
    quantity_change_int = int(quantity_change)
    old_qty = stock.quantity
    stock.quantity = max(stock.quantity + quantity_change_int, 0)
    try:
        current_app.logger.info(f"[StockChange] admin_create_stock_move stock_id={stock.id} product_id={stock.product_id} {old_qty} -> {stock.quantity} change={quantity_change_int}")
    except Exception:
        pass
    
    # Determine move_type automatically
    move_type = 'entrada' if quantity_change_int > 0 else 'saida'
    
    move = StockMove(stock=stock, quantity_change=quantity_change_int, reason=reason, move_type=move_type)
    db.session.add(move)
    db.session.commit()
    return jsonify({'id': move.id}), 201
