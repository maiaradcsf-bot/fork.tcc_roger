from app.api.admin import admin_bp
from flask import jsonify, request, current_app
from app.api.utils import admin_required, permission_required, get_product_by_id
from app.models.stock_moves import StockMove
from app.models.stock import Stock
from app.models import db
from datetime import datetime, timedelta
from sqlalchemy import and_


@admin_bp.route('/stock/moves', methods=['GET'])
@permission_required('admin.stock.moves.list')
def admin_list_stock_moves():
    user, error, status = admin_required()
    if error:
        return error, status
    # optional filters: start_date, end_date (YYYY-MM-DD or ISO), product_id
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    product_id = request.args.get('product_id')

    query = StockMove.query
    if product_id:
        # join to stock to filter by product
        query = query.join(Stock).filter(Stock.product_id == int(product_id))

    try:
        if start_date:
            start_dt = datetime.fromisoformat(start_date)
            query = query.filter(StockMove.created_at >= start_dt)
        if end_date:
            # include end date whole day by adding one day and using <
            end_dt = datetime.fromisoformat(end_date) + timedelta(days=1)
            query = query.filter(StockMove.created_at < end_dt)
    except ValueError:
        return jsonify({'error': 'Formato de data inválido. Use YYYY-MM-DD ou ISO.'}), 400

    stock_moves = query.order_by(StockMove.created_at.desc()).all()
    return jsonify([{
        'id': move.id,
        'stock_id': move.stock_id,
        'product_id': move.stock.product_id if move.stock else None,
        'product_name': move.stock.product.name if move.stock and move.stock.product else 'Produto desconhecido',
        'quantity_change': move.quantity_change,
        'reason': move.reason,
        'user_id': move.user_id,
        'created_at': move.created_at.isoformat(),
        'is_reversal': move.is_reversal,
        'original_move_id': move.original_move_id,
        'reverted_at': move.reverted_at.isoformat() if move.reverted_at else None,
        'order_id': move.order_id
    } for move in stock_moves])


@admin_bp.route('/stock/moves', methods=['POST'])
@permission_required('admin.stock.moves.create')
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
        return jsonify({'error': 'quantity_change é obrigatório'}), 400
    
    # If product_id is provided, find or create stock
    if product_id and not stock_id:
        stock = Stock.query.filter_by(product_id=product_id).first()
        if not stock:
            product = get_product_by_id(product_id)
            if not product:
                return jsonify({'error': 'Produto não encontrado'}), 404
            stock = Stock(product_id=product_id, quantity=0)
            db.session.add(stock)
            db.session.commit()
        stock_id = stock.id
    elif not stock_id:
        return jsonify({'error': 'stock_id ou product_id é obrigatório'}), 400
    
    stock = Stock.query.get(stock_id)
    if not stock:
        return jsonify({'error': 'Estoque não encontrado'}), 404
    
    quantity_change_int = int(quantity_change)
    old_qty = stock.quantity
    if quantity_change_int > 0 and stock.product and stock.product.max_stock is not None:
        max_stock = stock.product.max_stock or 0
        if stock.quantity + quantity_change_int > max_stock:
            return jsonify({'error': 'Quantidade de entrada excede o estoque máximo permitido'}), 400
    stock.quantity = max(stock.quantity + quantity_change_int, 0)
    try:
        current_app.logger.info(f"[StockChange] admin_create_stock_move stock_id={stock.id} product_id={stock.product_id} {old_qty} -> {stock.quantity} change={quantity_change_int}")
    except Exception:
        pass
    
    # Determine move_type automatically
    move_type = 'entrada' if quantity_change_int > 0 else 'saida'
    
    move = StockMove(stock=stock, quantity_change=quantity_change_int, reason=reason, move_type=move_type, user_id=user.id)
    db.session.add(move)
    db.session.commit()
    return jsonify({'id': move.id}), 201


@admin_bp.route('/stock/moves/<int:move_id>/revert', methods=['POST'])
@permission_required('admin.stock.moves.delete')
def admin_revert_stock_move(move_id):
    user, error, status = admin_required()
    if error:
        return error, status

    move = StockMove.query.filter_by(id=move_id).with_for_update().first()
    if not move:
        return jsonify({'error': 'Movimentação não encontrada'}), 404
    if move.is_reversal:
        return jsonify({'error': 'Não é possível reverter uma movimentação de estorno'}), 400
    if move.reverted_at:
        return jsonify({'error': 'Esta movimentação já foi revertida'}), 400
    if move.order_id:
        return jsonify({'error': f'Esta movimentação pertence ao pedido #{move.order_id}. Cancele o pedido para devolver o estoque.'}), 400

    stock = Stock.query.filter_by(id=move.stock_id).with_for_update().populate_existing().first()
    if not stock:
        return jsonify({'error': 'Estoque não encontrado para esta movimentação'}), 404
    if (stock.quantity or 0) - move.quantity_change < 0:
        return jsonify({
            'error': f'Estoque insuficiente para estornar esta entrada (disponível: {stock.quantity or 0}).',
            'available': stock.quantity or 0,
        }), 409

    data = request.get_json(silent=True) or {}
    reason = data.get('reason') or f'Estorno da movimentação #{move.id}'

    reversal = move.revert(user.id, reason)
    db.session.add(reversal)
    db.session.commit()
    return jsonify({'id': reversal.id, 'stock_id': stock.id, 'quantity': stock.quantity}), 201
