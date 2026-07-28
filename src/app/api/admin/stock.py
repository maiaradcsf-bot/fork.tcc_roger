from app.api.admin import admin_bp
from flask import jsonify, current_app
from app.api.utils import admin_required, permission_required, get_product_by_id
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
@permission_required('admin.stock.moves.create')
def admin_create_stock():
    user, error, status = admin_required()
    if error:
        return error, status
    data = request.get_json() or {}
    product_id = data.get('product_id')
    quantity = data.get('quantity', 0)
    
    if not product_id:
        return jsonify({'error': 'product_id é obrigatório'}), 400
    
    product = get_product_by_id(product_id)
    if not product:
        return jsonify({'error': 'Produto não encontrado'}), 404
    
    existing_stock = Stock.query.filter_by(product_id=product_id).first()
    if existing_stock:
        return jsonify({'error': 'Estoque já existe para este produto'}), 400
    
    stock = Stock(product_id=product_id, quantity=quantity)
    db.session.add(stock)
    db.session.commit()
    return jsonify({'id': stock.id, 'product_id': stock.product_id, 'quantity': stock.quantity}), 201


@admin_bp.route('/stock', methods=['DELETE'])
@permission_required('admin.stock.delete')
def admin_delete_all_stock():
    """Apaga todos os registros de stock e stock_moves.

    Protegido por permissão e checagem de admin.
    """
    user, error, status = admin_required()
    if error:
        return error, status

    try:
        # Apaga movimentos primeiro para evitar violação de FK
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
