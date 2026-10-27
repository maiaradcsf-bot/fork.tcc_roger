from app.api.admin import admin_bp
from flask import jsonify, current_app, request
from app.api.utils import admin_required, permission_required, get_product_by_id, parse_int, stock_transaction, MAX_STOCK_QUANTITY
from app.models.stock import Stock
from app.models.stock_moves import StockMove
from app.models import db


@admin_bp.route('/stock', methods=['GET'])
@permission_required('admin.stock.moves.list')
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
@stock_transaction
@permission_required('admin.stock.moves.create')
def admin_create_stock():
    user, error, status = admin_required()
    if error:
        return error, status
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Corpo da requisição inválido'}), 400

    if data.get('product_id') in (None, ''):
        return jsonify({'error': 'product_id é obrigatório'}), 400
    product_id = parse_int(data.get('product_id'))
    if product_id is None:
        return jsonify({'error': 'product_id deve ser um número inteiro'}), 400
    quantity = parse_int(data.get('quantity', 0))
    if quantity is None or quantity < 0 or quantity > MAX_STOCK_QUANTITY:
        return jsonify({'error': 'quantity deve ser um número inteiro maior ou igual a zero'}), 400
    
    product = get_product_by_id(product_id)
    if not product:
        return jsonify({'error': 'Produto não encontrado'}), 404
    
    existing_stock = Stock.query.filter_by(product_id=product_id).first()
    if existing_stock:
        return jsonify({'error': 'Estoque já existe para este produto'}), 400

    # Same limit the manual entry route applies
    if quantity > 0 and product.max_stock is not None and quantity > (product.max_stock or 0):
        return jsonify({'error': 'Quantidade de entrada excede o estoque máximo permitido'}), 400

    # An initial quantity is recorded as an entry move in this same transaction, so the
    # balance always matches the movement history
    stock = Stock(product_id=product_id, quantity=quantity)
    db.session.add(stock)
    if quantity > 0:
        db.session.add(StockMove(
            stock=stock, quantity_change=quantity, reason='Estoque inicial',
            move_type='entrada', user_id=user.id,
        ))
    db.session.commit()
    return jsonify({'id': stock.id, 'product_id': stock.product_id, 'quantity': stock.quantity}), 201


@admin_bp.route('/stock', methods=['DELETE'])
@permission_required('admin.stock.moves.delete')
def admin_delete_all_stock():
    """Apaga todos os registros de stock e stock_moves.

    Protegido por permissão e checagem de admin.
    """
    user, error, status = admin_required()
    if error:
        return error, status

    try:
        # Apaga movimentos primeiro para evitar violação de FK; estornos apontam para a
        # movimentação original, então o vínculo é desfeito antes
        db.session.query(StockMove).update({StockMove.original_move_id: None}, synchronize_session=False)
        deleted_moves = db.session.query(StockMove).delete(synchronize_session=False)
        deleted_stocks = db.session.query(Stock).delete(synchronize_session=False)
        db.session.commit()

        current_app.logger.info(
            f"Usuário {getattr(user, 'id', None)} removeu todos os estoques ({deleted_stocks} stocks, {deleted_moves} moves)"
        )
        return jsonify({'deleted': True, 'stocks_deleted': deleted_stocks, 'moves_deleted': deleted_moves}), 200
    except Exception:
        db.session.rollback()
        current_app.logger.exception('Erro ao apagar todos os estoques')
        return jsonify({'error': 'Erro ao apagar todos os estoques'}), 500
