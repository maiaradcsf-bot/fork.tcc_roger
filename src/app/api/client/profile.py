from app.api.client import client_bp
from flask import jsonify, request
from app.api.utils import client_required, get_active_products, normalize_order_status
from app.models.products import Product
from app.models.status_enums import OrderStatus


@client_bp.route('/profile', methods=['GET'])
def client_profile():
    client, error, status = client_required()
    if error:
        return error, status
    return jsonify({
        'id': client.id,
        'name': client.name,
        'email': client.email,
        'phone': client.phone,
        'addresses': [{
            'id': address.id,
            'street': address.street,
            'city': address.city,
            'state': address.state,
            'zipcode': address.zipcode,
            'country': address.country,
            'type': address.address_type
        } for address in client.addresses]
    })


@client_bp.route('/profile', methods=['PUT'])
def update_client_profile():
    client, error, status = client_required()
    if error:
        return error, status

    data = request.get_json() or {}
    client.name = data.get('name', client.name)
    client.email = data.get('email', client.email)
    client.phone = data.get('phone', client.phone)
    if 'password' in data:
        client.set_password(data['password'])
    from app.models import db
    db.session.commit()
    return jsonify({'message': 'Profile updated successfully'})


@client_bp.route('/summary', methods=['GET'])
def client_summary():
    client, error, status = client_required()
    if error:
        return error, status

    orders = client.orders or []
    total_orders = len(orders)
    pending_count = sum(1 for o in orders if normalize_order_status(o.status) == OrderStatus.PENDING.value)
    approved_count = sum(1 for o in orders if normalize_order_status(o.status) == OrderStatus.APPROVED.value)
    finished_count = sum(1 for o in orders if normalize_order_status(o.status) == OrderStatus.FINISHED.value)
    total_quantity = sum(sum((item.quantity or 0) for item in (o.items or [])) for o in orders)
    total_product_lines = sum(len(o.items or []) for o in orders)
    total_value = sum(float(o.total or 0) for o in orders)
    products_count = Product.query.filter(Product.deleted_at.is_(None)).count()

    return jsonify({
        'total_orders': total_orders,
        'pending_orders': pending_count,
        'approved_orders': approved_count,
        'finished_orders': finished_count,
        'total_quantity': total_quantity,
        'total_product_lines': total_product_lines,
        'total_value': total_value,
        'products_count': products_count
    })
