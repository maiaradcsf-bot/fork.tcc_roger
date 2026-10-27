import pytest

from app.models import db
from app.models.carts import Cart
from app.models.clients import Client
from app.models.order_items import OrderItem
from app.models.orders import Order
from app.models.permissions import Permission
from app.models.products import Product
from app.models.rules import Rule
from app.models.stock import Stock
from app.models.stock_moves import StockMove
from app.models.users import User

ORDER_PERMISSIONS = [
    'admin.orders.list',
    'admin.orders.approve',
    'admin.orders.reject',
    'admin.orders.cancel',
]

# profile name -> permissions granted to its rule
PROFILES = {
    'full': ORDER_PERMISSIONS,
    'approver': ['admin.orders.list', 'admin.orders.approve'],
    'rejecter': ['admin.orders.list', 'admin.orders.reject'],
    'canceler': ['admin.orders.list', 'admin.orders.cancel'],
    'viewer': ['admin.orders.list'],
}


@pytest.fixture
def setup(app):
    permissions = {name: Permission(name=name) for name in ORDER_PERMISSIONS}
    db.session.add_all(permissions.values())

    tokens = {}
    for profile, perm_names in PROFILES.items():
        rule = Rule(name=profile, permissions=[permissions[p] for p in perm_names])
        user = User(username=profile, email=f'{profile}@test', password='x', auth_token=f'token-{profile}', rules=[rule])
        db.session.add(user)
        tokens[profile] = user.auth_token
    db.session.add(User(username='norules', email='norules@test', password='x', auth_token='token-norules'))
    tokens['norules'] = 'token-norules'

    customer = Client(name='Cliente Teste', email='cliente@test', password='x')
    product = Product(name='Caneta', price=2)
    db.session.add_all([customer, product])
    db.session.flush()
    db.session.add(Stock(product_id=product.id, quantity=10))
    db.session.commit()

    def make_order(status='pending', quantity=3):
        cart = Cart(client=customer, status='closed')
        order = Order(client=customer, cart=cart, status=status, total=0)
        db.session.add(order)
        db.session.flush()
        db.session.add(OrderItem(order_id=order.id, product_id=product.id, quantity=quantity, unit_price=2))
        db.session.commit()
        return order.id

    def user_id(profile):
        return User.query.filter_by(username=profile).one().id

    return {'tokens': tokens, 'make_order': make_order, 'product': product, 'user_id': user_id}


def patch(client, setup, order_id, profile, body):
    headers = {'Authorization': f"Bearer {setup['tokens'][profile]}"} if profile else {}
    return client.patch(f'/api/admin/orders/{order_id}/status', json=body, headers=headers)


def reload(order_id):
    db.session.expire_all()
    return db.session.get(Order, order_id)


def stock_quantity(setup):
    db.session.expire_all()
    return Stock.query.filter_by(product_id=setup['product'].id).one().quantity


# --- Users with permission --------------------------------------------------

@pytest.mark.parametrize('profile', ['full', 'approver'])
def test_approve_with_permission_records_approver(client, setup, profile):
    order_id = setup['make_order']()
    resp = patch(client, setup, order_id, profile, {'action': 'approve'})
    assert resp.status_code == 200
    order = reload(order_id)
    assert order.status == 'approved'
    assert order.approved_user_id == setup['user_id'](profile)
    assert order.approved_at is not None


@pytest.mark.parametrize('profile', ['full', 'rejecter'])
def test_reject_with_permission_records_rejecter(client, setup, profile):
    order_id = setup['make_order']()
    resp = patch(client, setup, order_id, profile, {'action': 'reject'})
    assert resp.status_code == 200
    order = reload(order_id)
    assert order.status == 'rejected'
    assert order.refused_user_id == setup['user_id'](profile)
    assert order.refused_at is not None


@pytest.mark.parametrize('profile', ['full', 'approver'])
def test_finish_with_permission_withdraws_stock_and_records_user(client, setup, profile):
    order_id = setup['make_order']('approved', quantity=3)
    resp = patch(client, setup, order_id, profile, {'action': 'finish'})
    assert resp.status_code == 200
    order = reload(order_id)
    assert order.status == 'finished'
    assert order.finished_user_id == setup['user_id'](profile)
    assert stock_quantity(setup) == 7
    move = StockMove.query.filter_by(order_id=order_id).one()
    assert move.quantity_change == -3 and move.user_id == setup['user_id'](profile)


@pytest.mark.parametrize('profile', ['full', 'canceler'])
@pytest.mark.parametrize('initial', ['pending', 'approved'])
def test_cancel_with_permission_records_canceler(client, setup, profile, initial):
    order_id = setup['make_order'](initial)
    resp = patch(client, setup, order_id, profile, {'action': 'cancel'})
    assert resp.status_code == 200
    order = reload(order_id)
    assert order.status == 'cancelled'
    assert order.canceled_user_id == setup['user_id'](profile)
    assert order.canceled_client_id is None


def test_cancel_finished_order_returns_stock(client, setup):
    order_id = setup['make_order']('approved', quantity=4)
    assert patch(client, setup, order_id, 'approver', {'action': 'finish'}).status_code == 200
    assert stock_quantity(setup) == 6
    resp = patch(client, setup, order_id, 'canceler', {'action': 'cancel'})
    assert resp.status_code == 200
    order = reload(order_id)
    assert order.status == 'cancelled'
    assert order.finished_user_id == setup['user_id']('approver')
    assert order.canceled_user_id == setup['user_id']('canceler')
    assert stock_quantity(setup) == 10


def test_full_flow_keeps_each_actor(client, setup):
    order_id = setup['make_order']()
    assert patch(client, setup, order_id, 'approver', {'action': 'approve'}).status_code == 200
    assert patch(client, setup, order_id, 'full', {'action': 'finish'}).status_code == 200
    order = reload(order_id)
    assert order.approved_user_id == setup['user_id']('approver')
    assert order.finished_user_id == setup['user_id']('full')


@pytest.mark.parametrize('action,initial,expected', [
    ('Approve', 'pending', 'approved'),
    (' APPROVE ', 'pending', 'approved'),
    ('approved', 'pending', 'approved'),
    ('rejected', 'pending', 'rejected'),
    ('picked_up', 'approved', 'finished'),
    ('finished', 'approved', 'finished'),
    ('canceled', 'pending', 'cancelled'),
    ('cancelled', 'pending', 'cancelled'),
])
def test_aliases_and_case_are_normalized(client, setup, action, initial, expected):
    order_id = setup['make_order'](initial)
    resp = patch(client, setup, order_id, 'full', {'action': action})
    assert resp.status_code == 200
    assert reload(order_id).status == expected


def test_matching_status_field_is_accepted(client, setup):
    order_id = setup['make_order']()
    resp = patch(client, setup, order_id, 'approver', {'action': 'approve', 'status': 'approved'})
    assert resp.status_code == 200
    assert reload(order_id).status == 'approved'


# --- Users without permission -------------------------------------------------

@pytest.mark.parametrize('profile,action,initial', [
    ('viewer', 'approve', 'pending'),
    ('viewer', 'reject', 'pending'),
    ('viewer', 'finish', 'approved'),
    ('viewer', 'cancel', 'pending'),
    ('rejecter', 'approve', 'pending'),
    ('canceler', 'approve', 'pending'),
    ('approver', 'reject', 'pending'),
    ('canceler', 'reject', 'pending'),
    ('rejecter', 'finish', 'approved'),
    ('canceler', 'finish', 'approved'),
    ('approver', 'cancel', 'pending'),
    ('rejecter', 'cancel', 'approved'),
])
def test_action_without_permission_is_forbidden(client, setup, profile, action, initial):
    order_id = setup['make_order'](initial)
    resp = patch(client, setup, order_id, profile, {'action': action})
    assert resp.status_code == 403
    order = reload(order_id)
    assert order.status == initial
    assert order.approved_user_id is None and order.refused_user_id is None
    assert order.finished_user_id is None and order.canceled_user_id is None
    assert stock_quantity(setup) == 10


@pytest.mark.parametrize('profile,action', [
    ('viewer', 'APPROVED'),
    ('rejecter', 'picked_up'),
    ('approver', 'canceled'),
    ('canceler', ' Reject '),
])
def test_aliases_require_the_same_permission(client, setup, profile, action):
    initial = 'approved' if action == 'picked_up' else 'pending'
    order_id = setup['make_order'](initial)
    resp = patch(client, setup, order_id, profile, {'action': action})
    assert resp.status_code == 403
    assert reload(order_id).status == initial


def test_missing_token_is_unauthorized(client, setup):
    order_id = setup['make_order']()
    resp = patch(client, setup, order_id, None, {'action': 'approve'})
    assert resp.status_code == 401
    assert reload(order_id).status == 'pending'


def test_user_without_rules_is_forbidden(client, setup):
    order_id = setup['make_order']()
    resp = patch(client, setup, order_id, 'norules', {'action': 'approve'})
    assert resp.status_code == 403
    assert reload(order_id).status == 'pending'


def test_client_token_cannot_use_admin_route(client, setup):
    order_id = setup['make_order']()
    customer = Client.query.one()
    customer.auth_token = 'client-token'
    db.session.commit()
    resp = client.patch(f'/api/admin/orders/{order_id}/status', json={'action': 'cancel'},
                        headers={'Authorization': 'Bearer client-token'})
    assert resp.status_code == 401
    assert reload(order_id).status == 'pending'


# --- Bypass attempts ------------------------------------------------------------

@pytest.mark.parametrize('profile', ['viewer', 'full'])
@pytest.mark.parametrize('body', [
    {'action': 'x', 'status': 'approved'},
    {'action': 'update', 'status': 'finished'},
    {'action': 'set_status', 'status': 'cancelled'},
    {'action': 'pending', 'status': 'approved'},
    {'action': 'approve_order', 'status': 'approved'},
    {'action': 'aprovar'},
    {'status': 'approved'},
    {'action': '', 'status': 'approved'},
    {'action': '   ', 'status': 'approved'},
    {'action': None, 'status': 'approved'},
    {'action': ['approve'], 'status': 'approved'},
    {'action': {'name': 'approve'}, 'status': 'approved'},
    {'action': 1, 'status': 'approved'},
])
def test_status_cannot_be_set_without_a_known_action(client, setup, profile, body):
    order_id = setup['make_order']()
    resp = patch(client, setup, order_id, profile, body)
    assert resp.status_code == 400
    order = reload(order_id)
    assert order.status == 'pending'
    assert order.approved_user_id is None


@pytest.mark.parametrize('profile,body,initial', [
    # permission for the action, but the status points somewhere else
    ('approver', {'action': 'approve', 'status': 'finished'}, 'pending'),
    ('approver', {'action': 'approve', 'status': 'cancelled'}, 'pending'),
    ('canceler', {'action': 'cancel', 'status': 'approved'}, 'pending'),
    ('rejecter', {'action': 'reject', 'status': 'approved'}, 'pending'),
    ('approver', {'action': 'finish', 'status': 'cancelled'}, 'approved'),
    ('full', {'action': 'approve', 'status': 'pending'}, 'pending'),
    ('full', {'action': 'approve', 'status': 'qualquer'}, 'pending'),
    ('full', {'action': 'approve', 'status': None}, 'pending'),
    ('full', {'action': 'approve', 'status': ['approved']}, 'pending'),
])
def test_conflicting_action_and_status_are_rejected(client, setup, profile, body, initial):
    order_id = setup['make_order'](initial)
    resp = patch(client, setup, order_id, profile, body)
    assert resp.status_code == 400
    assert reload(order_id).status == initial
    assert stock_quantity(setup) == 10


def test_permission_is_checked_before_status_field(client, setup):
    order_id = setup['make_order']()
    resp = patch(client, setup, order_id, 'viewer', {'action': 'approve', 'status': 'approved'})
    assert resp.status_code == 403
    assert reload(order_id).status == 'pending'


@pytest.mark.parametrize('body', [b'not json', b'[]', b'"approve"', b'null'])
def test_invalid_body_is_rejected(client, setup, body):
    order_id = setup['make_order']()
    resp = client.patch(f'/api/admin/orders/{order_id}/status', data=body, content_type='application/json',
                        headers={'Authorization': f"Bearer {setup['tokens']['full']}"})
    assert resp.status_code == 400
    assert reload(order_id).status == 'pending'


# --- Flow rules (valid transitions per action) --------------------------------------

@pytest.mark.parametrize('action,initial', [
    ('approve', 'approved'),
    ('approve', 'finished'),
    ('approve', 'rejected'),
    ('approve', 'cancelled'),
    ('reject', 'approved'),
    ('reject', 'finished'),
    ('reject', 'rejected'),
    ('reject', 'cancelled'),
    ('finish', 'pending'),
    ('finish', 'finished'),
    ('finish', 'rejected'),
    ('finish', 'cancelled'),
    ('cancel', 'rejected'),
    ('cancel', 'cancelled'),
])
def test_invalid_transitions_are_rejected(client, setup, action, initial):
    order_id = setup['make_order'](initial)
    resp = patch(client, setup, order_id, 'full', {'action': action})
    assert resp.status_code == 400
    order = reload(order_id)
    assert order.status == initial
    assert order.approved_user_id is None and order.refused_user_id is None
    assert order.finished_user_id is None and order.canceled_user_id is None
    assert stock_quantity(setup) == 10


def test_repeating_approve_does_not_overwrite_approver(client, setup):
    order_id = setup['make_order']()
    assert patch(client, setup, order_id, 'approver', {'action': 'approve'}).status_code == 200
    first = reload(order_id)
    approved_at = first.approved_at
    resp = patch(client, setup, order_id, 'full', {'action': 'approve'})
    assert resp.status_code == 400
    order = reload(order_id)
    assert order.approved_user_id == setup['user_id']('approver')
    assert order.approved_at == approved_at


def test_unknown_order_returns_404(client, setup):
    resp = patch(client, setup, 9999, 'full', {'action': 'approve'})
    assert resp.status_code == 404


def test_unknown_order_without_permission_returns_403(client, setup):
    resp = patch(client, setup, 9999, 'viewer', {'action': 'approve'})
    assert resp.status_code == 403
