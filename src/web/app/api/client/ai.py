from flask import jsonify

from app.ai import assistant, groq
from app.ai.groq import AIError
from app.api.client import client_bp
from app.api.utils import OPEN_CART_STATUSES, client_permission_required, client_required, json_body, optional_id_field, text_field
from app.models.carts import Cart


@client_bp.route('/ai/status', methods=['GET'])
@client_permission_required('clients.products.list')
def client_ai_status():
    return jsonify({'enabled': groq.is_configured()})


@client_bp.route('/ai/chat', methods=['POST'])
@client_permission_required('clients.products.list')
def client_ai_chat():
    client, error, status = client_required()
    if error:
        return error, status
    try:
        return jsonify(assistant.chat(client, json_body().get('messages'), 'client'))
    except AIError as exc:
        return jsonify({'error': exc.message, 'code': exc.code}), exc.status


@client_bp.route('/ai/reason', methods=['POST'])
@client_permission_required('clients.cart.manage')
def client_ai_reason():
    client, error, status = client_required()
    if error:
        return error, status
    data = json_body()
    context = text_field(data, 'context', 'contexto', 500)
    cart_id = optional_id_field(data, 'cart_id', 'cart_id')
    query = Cart.query.filter(Cart.client_id == client.id, Cart.status.in_(OPEN_CART_STATUSES))
    if cart_id:
        query = query.filter(Cart.id == cart_id)
    cart = query.order_by(Cart.id.desc()).first()
    if not cart or not cart.items:
        return jsonify({'error': 'O carrinho está vazio'}), 400
    try:
        return jsonify({'reason': assistant.suggest_reason(cart.items, context)})
    except AIError as exc:
        return jsonify({'error': exc.message, 'code': exc.code}), exc.status
