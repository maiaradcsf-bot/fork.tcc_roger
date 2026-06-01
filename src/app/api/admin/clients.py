from app.api.admin import admin_bp
from flask import jsonify, request
from app.api.utils import admin_required
from app.models.clients import Client
from app.models.orders import Order
from app.models import db


@admin_bp.route('/clients', methods=['GET'])
def admin_list_clients():
    user, error, status = admin_required()
    if error:
        return error, status
    clients = Client.query.all()
    return jsonify([{
        'id': client.id,
        'name': client.name,
        'email': client.email,
        'phone': client.phone,
        'active': bool(client.active)
    } for client in clients])


@admin_bp.route('/clients/<int:client_id>/status', methods=['PATCH'])
def admin_update_client_status(client_id):
    user, error, status = admin_required()
    if error:
        return error, status

    client = Client.query.get(client_id)
    if not client:
        return jsonify({'error': 'Client not found'}), 404

    data = request.get_json() or {}
    if 'active' not in data:
        return jsonify({'error': 'active status is required'}), 400

    active_value = data.get('active')
    if isinstance(active_value, str):
        active = active_value.strip().lower() in ('1', 'true', 'yes', 'on')
    else:
        active = bool(active_value)

    client.active = active
    if not client.active:
        client.auth_token = None
    db.session.commit()

    return jsonify({
        'id': client.id,
        'active': client.active,
        'message': 'Client status updated successfully'
    })


@admin_bp.route('/clients/summary', methods=['GET'])
def admin_clients_summary():
    user, error, status = admin_required()
    if error:
        return error, status

    total_orders = 0
    total_quantity = 0
    total_product_lines = 0

    orders = Order.query.order_by(Order.created_at.desc(), Order.id.desc()).all()
    for order in orders:
        total_orders += 1
        if order.items:
            total_product_lines += len(order.items)
            total_quantity += sum(item.quantity for item in order.items)

    return jsonify({
        'total_orders': total_orders,
        'total_quantity': total_quantity,
        'total_product_lines': total_product_lines
    })


@admin_bp.route('/clients/<int:client_id>/details', methods=['GET'])
def admin_client_details(client_id):
    user, error, status = admin_required()
    if error:
        return error, status

    client = Client.query.get(client_id)
    if not client:
        return jsonify({'error': 'Cliente não encontrado'}), 404

    orders = []
    total_orders = 0
    total_quantity = 0
    total_product_lines = 0

    for order in client.orders:
        order_items = []
        order_quantity = 0
        for item in order.items:
            order_items.append({
                'product_name': item.product.name if item.product else None,
                'quantity': item.quantity,
                'unit_price': float(item.unit_price)
            })
            order_quantity += item.quantity

        orders.append({
            'id': order.id,
            'status': order.status,
            'total': float(order.total),
            'created_at': order.created_at.isoformat() if order.created_at else None,
            'items': order_items,
            'quantity': order_quantity,
            'product_lines': len(order_items)
        })

        total_orders += 1
        total_product_lines += len(order_items)
        total_quantity += order_quantity

    return jsonify({
        'id': client.id,
        'name': client.name,
        'email': client.email,
        'phone': client.phone,
        'created_at': client.created_at.isoformat() if client.created_at else None,
        'order_count': total_orders,
        'total_quantity': total_quantity,
        'total_product_lines': total_product_lines,
        'orders': orders
    })
