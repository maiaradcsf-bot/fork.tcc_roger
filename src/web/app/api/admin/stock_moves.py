from app.api.admin import admin_bp
from flask import jsonify, request, current_app
from app.api.utils import admin_required, permission_required, get_product_by_id, parse_int, lock_stocks, stock_transaction, MAX_STOCK_QUANTITY
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
        product_id_int = parse_int(product_id)
        if product_id_int is None:
            return jsonify({'error': 'product_id deve ser um número inteiro'}), 400
        # join to stock to filter by product
        query = query.join(Stock).filter(Stock.product_id == product_id_int)

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
@stock_transaction
@permission_required('admin.stock.moves.create')
def admin_create_stock_move():
    user, error, status = admin_required()
    if error:
        return error, status
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Corpo da requisição inválido'}), 400

    raw_stock_id = data.get('stock_id')
    raw_product_id = data.get('product_id')
    raw_quantity_change = data.get('quantity_change')
    reason = data.get('reason')

    if raw_quantity_change is None:
        return jsonify({'error': 'quantity_change é obrigatório'}), 400
    quantity_change_int = parse_int(raw_quantity_change)
    if quantity_change_int is None or quantity_change_int == 0 or abs(quantity_change_int) > MAX_STOCK_QUANTITY:
        return jsonify({'error': 'quantity_change deve ser um número inteiro diferente de zero'}), 400
    if reason is not None and (not isinstance(reason, str) or len(reason) > 255):
        return jsonify({'error': 'reason deve ser um texto de até 255 caracteres'}), 400

    stock_id = parse_int(raw_stock_id) if raw_stock_id not in (None, '') else None
    product_id = parse_int(raw_product_id) if raw_product_id not in (None, '') else None
    if (raw_stock_id not in (None, '') and stock_id is None) or (raw_product_id not in (None, '') and product_id is None):
        return jsonify({'error': 'stock_id e product_id devem ser números inteiros'}), 400

    if stock_id is None and product_id is None:
        return jsonify({'error': 'stock_id ou product_id é obrigatório'}), 400

    if stock_id is None:
        # If product_id is provided, find or create stock (in this same transaction)
        stock = lock_stocks([product_id]).get(product_id)
        if not stock:
            product = get_product_by_id(product_id)
            if not product:
                return jsonify({'error': 'Produto não encontrado'}), 404
            stock = Stock(product_id=product_id, quantity=0)
            db.session.add(stock)
            db.session.flush()
    else:
        stock_product_id = db.session.query(Stock.product_id).filter(Stock.id == stock_id).scalar()
        stock = lock_stocks([stock_product_id]).get(stock_product_id) if stock_product_id is not None else None
        if not stock:
            return jsonify({'error': 'Estoque não encontrado'}), 404

    # The balance is read under the row lock, so concurrent withdrawals cannot be overwritten
    old_qty = stock.quantity or 0
    new_qty = old_qty + quantity_change_int
    if new_qty < 0:
        db.session.rollback()
        return jsonify({
            'error': f'Estoque insuficiente para esta saída (disponível: {old_qty}).',
            'code': 'insufficient_stock',
            'available': old_qty,
        }), 409
    if new_qty > MAX_STOCK_QUANTITY:
        db.session.rollback()
        return jsonify({'error': 'Quantidade de entrada excede o limite do estoque'}), 400
    if quantity_change_int > 0 and stock.product and stock.product.max_stock is not None:
        max_stock = stock.product.max_stock or 0
        if new_qty > max_stock:
            db.session.rollback()
            return jsonify({'error': 'Quantidade de entrada excede o estoque máximo permitido'}), 400
    stock.quantity = new_qty
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
@stock_transaction
@permission_required('admin.stock.moves.delete')
def admin_revert_stock_move(move_id):
    user, error, status = admin_required()
    if error:
        return error, status

    # Lock order: stock row first, then the move (same order as the order routes)
    stock_id = db.session.query(StockMove.stock_id).filter(StockMove.id == move_id).scalar()
    if stock_id is None:
        return jsonify({'error': 'Movimentação não encontrada'}), 404
    stock = Stock.query.filter_by(id=stock_id).with_for_update().populate_existing().first()
    if not stock:
        return jsonify({'error': 'Estoque não encontrado para esta movimentação'}), 404

    move = StockMove.query.filter_by(id=move_id).with_for_update().populate_existing().first()
    if not move:
        return jsonify({'error': 'Movimentação não encontrada'}), 404
    if move.is_reversal:
        return jsonify({'error': 'Não é possível reverter uma movimentação de estorno'}), 400
    if move.reverted_at:
        return jsonify({'error': 'Esta movimentação já foi revertida'}), 400
    if move.order_id:
        return jsonify({'error': f'Esta movimentação pertence ao pedido #{move.order_id}. Cancele o pedido para devolver o estoque.'}), 400

    if (stock.quantity or 0) - move.quantity_change < 0:
        return jsonify({
            'error': f'Estoque insuficiente para estornar esta entrada (disponível: {stock.quantity or 0}).',
            'available': stock.quantity or 0,
        }), 409

    data = request.get_json(silent=True)
    data = data if isinstance(data, dict) else {}
    reason = data.get('reason')
    if reason is not None and (not isinstance(reason, str) or len(reason) > 255):
        db.session.rollback()
        return jsonify({'error': 'reason deve ser um texto de até 255 caracteres'}), 400
    reason = reason or f'Estorno da movimentação #{move.id}'

    reversal = move.revert(user.id, reason)
    db.session.add(reversal)
    db.session.commit()
    return jsonify({'id': reversal.id, 'stock_id': stock.id, 'quantity': stock.quantity}), 201
