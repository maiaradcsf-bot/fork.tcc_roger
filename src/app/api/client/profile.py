from app.api.client import client_bp
from flask import jsonify, request
from app.api.utils import (client_required, client_permission_required, normalize_order_status, json_body, text_field,
                           email_field, password_field, save_uploaded_image)
from app.models import db
from app.models.clients import Client
from app.models.products import Product
from app.models.status_enums import OrderStatus


@client_bp.route('/profile', methods=['GET'])
@client_permission_required('clients.profile.view')
def client_profile():
    client, error, status = client_required()
    if error:
        return error, status
    return jsonify({
        'id': client.id,
        'name': client.name,
        'email': client.email,
        'phone': client.phone,
        'photo_path': client.photo_path,
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


@client_bp.route('/me', methods=['GET'])
def client_me():
    client, error, status = client_required()
    if error:
        return error, status
    return jsonify({
        'id': client.id,
        'name': client.name,
        'email': client.email,
        'rules': [{'id': rule.id, 'name': rule.name} for rule in client.rules],
        'permissions': client.get_permission_names(),
    })


@client_bp.route('/upload', methods=['POST'])
@client_permission_required('clients.profile.edit')
def client_upload():
    client, error, status = client_required()
    if error:
        return error, status
    return jsonify({'url': save_uploaded_image(request.files.get('file'))}), 201


@client_bp.route('/profile', methods=['PUT'])
@client_permission_required('clients.profile.edit')
def update_client_profile():
    client, error, status = client_required()
    if error:
        return error, status

    data = json_body()
    if 'name' in data:
        client.name = text_field(data, 'name', 'nome', 150, required=True)
    if 'email' in data:
        email = email_field(data, required=True)
        if email != client.email and Client.query.filter(Client.email == email, Client.id != client.id).first():
            return jsonify({'error': 'Email já cadastrado'}), 409
        client.email = email
    if 'phone' in data:
        client.phone = text_field(data, 'phone', 'telefone', 50) or None
    if 'photo_path' in data:
        client.photo_path = text_field(data, 'photo_path', 'photo_path', 255) or None
    password = password_field(data)
    if password:
        # A stolen session must not be enough to take over the account
        current = data.get('current_password')
        if not isinstance(current, str) or not client.check_password(current):
            return jsonify({'error': 'Senha atual incorreta'}), 403
        client.set_password(password)
    db.session.commit()
    return jsonify({'message': 'Perfil atualizado com sucesso'})


@client_bp.route('/summary', methods=['GET'])
@client_permission_required('clients.orders.list')
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
