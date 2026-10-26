import io

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

ADMIN_PERMISSIONS = [
    'admin.orders.list', 'admin.orders.approve', 'admin.orders.reject', 'admin.orders.cancel',
    'admin.stock.moves.list', 'admin.stock.moves.create', 'admin.stock.moves.delete',
    'admin.products.import',
]


@pytest.fixture
def env(app):
    perms = {name: Permission(name=name) for name in ADMIN_PERMISSIONS + ['clients.orders.cancel']}
    db.session.add_all(perms.values())
    admin_rule = Rule(name='administrator', permissions=[perms[p] for p in ADMIN_PERMISSIONS])
    client_rule = Rule(name='cliente', permissions=[perms['clients.orders.cancel']])
    admin = User(username='admin', email='admin@test', password='x', auth_token='admin-token', rules=[admin_rule])
    customer = Client(name='Cliente', email='c@test', password='x', auth_token='client-token', rules=[client_rule])
    other_customer = Client(name='Outro', email='o@test', password='x', auth_token='other-token', rules=[client_rule])
    db.session.add_all([admin, customer, other_customer])
    db.session.commit()

    def product(name, quantity=None, max_stock=None):
        prod = Product(name=name, price=1, max_stock=max_stock)
        db.session.add(prod)
        db.session.flush()
        if quantity is not None:
            stock = Stock(product_id=prod.id, quantity=quantity)
            db.session.add(stock)
            db.session.flush()
            if quantity:
                db.session.add(StockMove(stock=stock, quantity_change=quantity, move_type='entrada', reason='inicial'))
        db.session.commit()
        return prod.id

    def order(items, status='pending', owner=None):
        cart = Cart(client=owner or customer, status='closed')
        new_order = Order(client=owner or customer, cart=cart, status=status, total=0)
        db.session.add(new_order)
        db.session.flush()
        for product_id, quantity in items:
            db.session.add(OrderItem(order_id=new_order.id, product_id=product_id, quantity=quantity, unit_price=1))
        db.session.commit()
        return new_order.id

    return {'product': product, 'order': order, 'admin_id': admin.id, 'other_customer': other_customer}


def admin_patch(client, order_id, body):
    return client.patch(f'/api/admin/orders/{order_id}/status', json=body, headers={'Authorization': 'Bearer admin-token'})


def admin_post(client, path, body=None, **kwargs):
    if body is not None:
        kwargs['json'] = body
    return client.post(f'/api/admin{path}', headers={'Authorization': 'Bearer admin-token'}, **kwargs)


def client_cancel(client, order_id, token='client-token'):
    return client.patch(f'/api/client/orders/{order_id}/status', json={'action': 'cancel'}, headers={'Authorization': f'Bearer {token}'})


def qty(product_id):
    db.session.expire_all()
    stock = Stock.query.filter_by(product_id=product_id).one_or_none()
    return stock.quantity if stock else None


def order_status(order_id):
    db.session.expire_all()
    return db.session.get(Order, order_id).status


def moves_for(order_id):
    db.session.expire_all()
    return StockMove.query.filter_by(order_id=order_id).order_by(StockMove.id).all()


def assert_ledger_consistent():
    """Every stock balance must equal the sum of its recorded movements."""
    db.session.expire_all()
    for stock in Stock.query.all():
        total = sum(move.quantity_change for move in StockMove.query.filter_by(stock_id=stock.id))
        assert stock.quantity == total, f'stock {stock.id}: saldo {stock.quantity} != movimentações {total}'
        assert stock.quantity >= 0


# --- Estoque insuficiente ---------------------------------------------------------------

def test_finish_with_insufficient_stock_changes_nothing(client, env):
    p = env['product']('A', 2)
    o = env['order']([(p, 5)], 'approved')
    resp = admin_patch(client, o, {'action': 'finish'})
    assert resp.status_code == 409
    assert resp.get_json()['code'] == 'insufficient_stock'
    assert resp.get_json()['shortages'] == [{'product_id': p, 'product_name': 'A', 'requested': 5, 'available': 2}]
    assert order_status(o) == 'approved'
    assert qty(p) == 2 and moves_for(o) == []
    assert_ledger_consistent()


def test_manual_exit_beyond_balance_is_refused(client, env):
    p = env['product']('A', 5)
    stock_id = Stock.query.filter_by(product_id=p).one().id
    resp = admin_post(client, '/stock/moves', {'stock_id': stock_id, 'quantity_change': -8})
    assert resp.status_code == 409
    assert resp.get_json()['code'] == 'insufficient_stock'
    assert resp.get_json()['available'] == 5
    assert qty(p) == 5
    assert StockMove.query.filter_by(stock_id=stock_id).count() == 1
    assert_ledger_consistent()


def test_manual_exit_down_to_zero_is_allowed(client, env):
    p = env['product']('A', 5)
    stock_id = Stock.query.filter_by(product_id=p).one().id
    resp = admin_post(client, '/stock/moves', {'stock_id': str(stock_id), 'quantity_change': '-5'})
    assert resp.status_code == 201
    assert qty(p) == 0
    assert_ledger_consistent()


def test_approve_beyond_free_stock_is_refused(client, env):
    p = env['product']('A', 10)
    env['order']([(p, 8)], 'approved')
    o = env['order']([(p, 5)])
    resp = admin_patch(client, o, {'action': 'approve'})
    assert resp.status_code == 409
    body = resp.get_json()
    assert body['code'] == 'insufficient_committed_stock'
    assert body['shortages'][0] == {'product_id': p, 'product_name': 'A', 'requested': 5, 'available': 10, 'committed': 8, 'free': 2}
    db.session.expire_all()
    pending = db.session.get(Order, o)
    assert pending.status == 'pending' and pending.approved_user_id is None


def test_approve_within_free_stock_is_allowed(client, env):
    p = env['product']('A', 10)
    env['order']([(p, 5)], 'approved')
    o = env['order']([(p, 5)])
    assert admin_patch(client, o, {'action': 'approve'}).status_code == 200
    assert order_status(o) == 'approved'
    assert qty(p) == 10  # approval does not move stock


def test_approve_ignores_pending_finished_and_cancelled_orders(client, env):
    p = env['product']('A', 4)
    env['order']([(p, 4)])               # pending: not committed
    env['order']([(p, 4)], 'finished')   # already withdrawn: not committed
    env['order']([(p, 4)], 'cancelled')
    env['order']([(p, 4)], 'rejected')
    o = env['order']([(p, 4)])
    assert admin_patch(client, o, {'action': 'approve'}).status_code == 200


def test_approve_counts_legacy_approved_status(client, env):
    p = env['product']('A', 4)
    env['order']([(p, 3)], 'aprovado')
    o = env['order']([(p, 2)])
    assert admin_patch(client, o, {'action': 'approve'}).status_code == 409


def test_approve_without_stock_row_is_refused(client, env):
    p = env['product']('Sem estoque')
    o = env['order']([(p, 1)])
    resp = admin_patch(client, o, {'action': 'approve'})
    assert resp.status_code == 409
    assert resp.get_json()['shortages'][0]['available'] == 0


def test_cancelling_an_approved_order_releases_its_commitment(client, env):
    p = env['product']('A', 5)
    first = env['order']([(p, 5)], 'approved')
    second = env['order']([(p, 5)])
    assert admin_patch(client, second, {'action': 'approve'}).status_code == 409
    assert admin_patch(client, first, {'action': 'cancel'}).status_code == 200
    assert admin_patch(client, second, {'action': 'approve'}).status_code == 200


def test_approval_has_no_override_flag(client, env):
    p = env['product']('A', 1)
    o = env['order']([(p, 5)])
    for flag in ({'allow_partial': True}, {'force': True}, {'allow_overcommit': True}):
        resp = admin_patch(client, o, {'action': 'approve', **flag})
        assert resp.status_code == 409
    assert order_status(o) == 'pending'


def test_negative_balance_is_reported_not_hidden(client, env):
    p = env['product']('A', 0)
    Stock.query.filter_by(product_id=p).one().quantity = -2
    db.session.commit()
    o = env['order']([(p, 1)], 'approved')
    resp = admin_patch(client, o, {'action': 'finish', 'allow_partial': True})
    assert resp.status_code == 409
    assert resp.get_json()['code'] == 'inconsistent_stock'
    assert order_status(o) == 'approved' and qty(p) == -2


# --- Entrega parcial ---------------------------------------------------------------------

def test_partial_withdrawal_takes_only_what_is_available(client, env):
    a = env['product']('A', 2)
    b = env['product']('B', 10)
    o = env['order']([(a, 5), (b, 3)], 'approved')
    resp = admin_patch(client, o, {'action': 'finish', 'allow_partial': True})
    assert resp.status_code == 200
    body = resp.get_json()
    assert body['status'] == 'finished' and body['partial'] is True
    assert body['withdrawn'] == [
        {'product_id': a, 'product_name': 'A', 'requested': 5, 'withdrawn': 2},
        {'product_id': b, 'product_name': 'B', 'requested': 3, 'withdrawn': 3},
    ]
    assert qty(a) == 0 and qty(b) == 7
    assert sorted(m.quantity_change for m in moves_for(o)) == [-3, -2]
    assert_ledger_consistent()


@pytest.mark.parametrize('flag', ['true', 'false', 1, 'yes', [True], None])
def test_partial_requires_boolean_true(client, env, flag):
    p = env['product']('A', 2)
    o = env['order']([(p, 5)], 'approved')
    resp = admin_patch(client, o, {'action': 'finish', 'allow_partial': flag})
    assert resp.status_code == 409
    assert resp.get_json()['code'] == 'insufficient_stock'
    assert order_status(o) == 'approved' and qty(p) == 2


def test_partial_with_nothing_available_is_refused(client, env):
    a = env['product']('A', 0)
    b = env['product']('B')
    o = env['order']([(a, 2), (b, 1)], 'approved')
    resp = admin_patch(client, o, {'action': 'finish', 'allow_partial': True})
    assert resp.status_code == 409
    assert resp.get_json()['code'] == 'no_stock_available'
    assert order_status(o) == 'approved' and moves_for(o) == []
    assert Stock.query.filter_by(product_id=b).count() == 0


# --- Finalização --------------------------------------------------------------------------

def test_finish_withdraws_requested_quantities(client, env):
    a = env['product']('A', 10)
    b = env['product']('B', 4)
    o = env['order']([(a, 3), (b, 4), (a, 2)], 'approved')
    resp = admin_patch(client, o, {'action': 'finish'})
    assert resp.status_code == 200
    assert resp.get_json()['partial'] is False
    assert qty(a) == 5 and qty(b) == 0
    moves = moves_for(o)
    assert sorted((m.stock.product_id, m.quantity_change) for m in moves) == sorted([(a, -5), (b, -4)])
    assert all(m.user_id == env['admin_id'] and m.move_type == 'saida' for m in moves)
    db.session.expire_all()
    assert db.session.get(Order, o).finished_user_id == env['admin_id']
    assert_ledger_consistent()


def test_finish_twice_does_not_withdraw_twice(client, env):
    p = env['product']('A', 10)
    o = env['order']([(p, 3)], 'approved')
    assert admin_patch(client, o, {'action': 'finish'}).status_code == 200
    assert admin_patch(client, o, {'action': 'finish'}).status_code == 400
    assert qty(p) == 7 and len(moves_for(o)) == 1


# --- Cancelamento ------------------------------------------------------------------------

def test_cancel_finished_returns_exactly_what_was_withdrawn(client, env):
    a = env['product']('A', 10)
    b = env['product']('B', 1)
    o = env['order']([(a, 4), (b, 3)], 'approved')
    assert admin_patch(client, o, {'action': 'finish', 'allow_partial': True}).status_code == 200
    assert qty(a) == 6 and qty(b) == 0
    assert admin_patch(client, o, {'action': 'cancel'}).status_code == 200
    assert qty(a) == 10 and qty(b) == 1
    moves = moves_for(o)
    withdrawals = [m for m in moves if not m.is_reversal]
    reversals = [m for m in moves if m.is_reversal]
    assert len(reversals) == len(withdrawals) == 2
    assert all(m.reverted_at is not None for m in withdrawals)
    assert sorted(r.original_move_id for r in reversals) == sorted(w.id for w in withdrawals)
    assert_ledger_consistent()


def test_second_cancel_does_not_return_stock_again(client, env):
    p = env['product']('A', 10)
    o = env['order']([(p, 4)], 'approved')
    admin_patch(client, o, {'action': 'finish'})
    assert admin_patch(client, o, {'action': 'cancel'}).status_code == 200
    assert admin_patch(client, o, {'action': 'cancel'}).status_code == 400
    assert qty(p) == 10
    assert len([m for m in moves_for(o) if m.is_reversal]) == 1
    assert_ledger_consistent()


def test_order_withdrawal_cannot_be_reverted_manually(client, env):
    p = env['product']('A', 10)
    o = env['order']([(p, 4)], 'approved')
    admin_patch(client, o, {'action': 'finish'})
    move = moves_for(o)[0]
    resp = admin_post(client, f'/stock/moves/{move.id}/revert')
    assert resp.status_code == 400
    assert qty(p) == 6


def test_manual_move_revert_only_once(client, env):
    p = env['product']('A', 5)
    stock_id = Stock.query.filter_by(product_id=p).one().id
    move_id = admin_post(client, '/stock/moves', {'stock_id': stock_id, 'quantity_change': 3}).get_json()['id']
    assert admin_post(client, f'/stock/moves/{move_id}/revert').status_code == 201
    assert admin_post(client, f'/stock/moves/{move_id}/revert').status_code == 400
    assert qty(p) == 5
    assert_ledger_consistent()


def test_client_cancels_own_pending_order(client, env):
    p = env['product']('A', 5)
    o = env['order']([(p, 2)])
    resp = client_cancel(client, o)
    assert resp.status_code == 200
    db.session.expire_all()
    order = db.session.get(Order, o)
    assert order.status == 'cancelled' and order.canceled_client_id is not None and order.canceled_user_id is None


@pytest.mark.parametrize('status', ['approved', 'finished', 'rejected', 'cancelled'])
def test_client_cannot_cancel_after_pending(client, env, status):
    p = env['product']('A', 5)
    o = env['order']([(p, 2)], status)
    assert client_cancel(client, o).status_code == 400
    assert order_status(o) == status


def test_client_cannot_cancel_someone_elses_order(client, env):
    p = env['product']('A', 5)
    o = env['order']([(p, 2)])
    assert client_cancel(client, o, token='other-token').status_code == 404
    assert order_status(o) == 'pending'


# --- Validação de entrada ------------------------------------------------------------------

@pytest.mark.parametrize('body', [
    {'quantity_change': 'abc'},
    {'quantity_change': 1.5},
    {'quantity_change': 0},
    {'quantity_change': True},
    {'quantity_change': [1]},
    {'quantity_change': 1, 'stock_id': 'x'},
    {'quantity_change': 1, 'product_id': {'id': 1}},
    {'quantity_change': 1},
    {'quantity_change': 1, 'reason': 'x' * 256},
    {'quantity_change': 1, 'reason': 123},
])
def test_manual_move_invalid_input_is_400(client, env, body):
    p = env['product']('A', 5)
    body = dict(body)
    if 'stock_id' not in body and 'product_id' not in body and body != {'quantity_change': 1}:
        body['stock_id'] = Stock.query.filter_by(product_id=p).one().id
    resp = admin_post(client, '/stock/moves', body)
    assert resp.status_code == 400
    assert qty(p) == 5


def test_manual_move_without_json_body_is_400(client, env):
    resp = admin_post(client, '/stock/moves', data='nope', content_type='application/json')
    assert resp.status_code == 400


def test_manual_move_unknown_stock_is_404(client, env):
    assert admin_post(client, '/stock/moves', {'stock_id': 999, 'quantity_change': 1}).status_code == 404


def test_manual_move_by_product_creates_stock_in_same_transaction(client, env):
    p = env['product']('Novo')
    assert admin_post(client, '/stock/moves', {'product_id': p, 'quantity_change': -1}).status_code == 409
    assert Stock.query.filter_by(product_id=p).count() == 0
    assert admin_post(client, '/stock/moves', {'product_id': p, 'quantity_change': 4}).status_code == 201
    assert qty(p) == 4
    assert_ledger_consistent()


def test_manual_entry_respects_max_stock(client, env):
    p = env['product']('A', 5, max_stock=6)
    stock_id = Stock.query.filter_by(product_id=p).one().id
    assert admin_post(client, '/stock/moves', {'stock_id': stock_id, 'quantity_change': 2}).status_code == 400
    assert qty(p) == 5


@pytest.mark.parametrize('body,expected', [
    ({}, 400),
    ({'product_id': 'abc'}, 400),
    ({'product_id': 'P', 'quantity': -1}, 400),
    ({'product_id': 'P', 'quantity': 'x'}, 400),
    ({'product_id': 999}, 404),
    ({'product_id': 'P'}, 201),
    ({'product_id': 'P', 'quantity': 0}, 201),
])
def test_create_stock_validation(client, env, body, expected):
    p = env['product']('Sem estoque')
    body = {k: (p if v == 'P' else v) for k, v in body.items()}
    resp = admin_post(client, '/stock', body)
    assert resp.status_code == expected
    assert Stock.query.filter_by(product_id=p).count() == (1 if expected == 201 else 0)


def test_create_stock_twice_is_refused(client, env):
    p = env['product']('A', 5)
    assert admin_post(client, '/stock', {'product_id': p}).status_code == 400
    assert Stock.query.filter_by(product_id=p).count() == 1


def test_duplicate_stock_row_is_blocked_by_unique_constraint(app, env):
    p = env['product']('A', 5)
    db.session.add(Stock(product_id=p, quantity=1))
    with pytest.raises(Exception):
        db.session.commit()
    db.session.rollback()


# --- Importação CSV ---------------------------------------------------------------------------

def _import(client, csv_text):
    upload = admin_post(client, '/products/import/upload',
                        data={'file': (io.BytesIO(csv_text.encode()), 'produtos.csv')},
                        content_type='multipart/form-data')
    assert upload.status_code == 201
    mapping = {'name': 'nome', 'price': 'preco', 'barcode': 'codigo', 'stock_quantity': 'estoque'}
    return admin_post(client, '/products/import/commit', {'import_id': upload.get_json()['import_id'], 'mapping': mapping})


def test_import_sets_quantity_and_records_difference(client, env):
    p = env['product']('A', 5)
    db.session.get(Product, p).barcode = '111'
    db.session.commit()
    resp = _import(client, 'nome,preco,codigo,estoque\nA,1,111,8\nB,2,222,3\n')
    assert resp.status_code == 200
    assert resp.get_json()['updated'] == 1 and resp.get_json()['created'] == 1
    assert qty(p) == 8
    assert_ledger_consistent()


def test_import_rejects_negative_quantity(client, env):
    p = env['product']('A', 5)
    db.session.get(Product, p).barcode = '111'
    db.session.commit()
    resp = _import(client, 'nome,preco,codigo,estoque\nA,1,111,-3\n')
    assert resp.status_code == 200
    assert resp.get_json()['skipped'] == 1
    assert qty(p) == 5


# --- Classificação de conflitos de concorrência ------------------------------------------------

class _FakeDriverError(Exception):
    pass


@pytest.mark.parametrize('exc_type,args,expected', [
    ('operational', (1213, 'Deadlock found when trying to get lock'), True),
    ('operational', (1205, 'Lock wait timeout exceeded'), True),
    ('operational', (2006, 'MySQL server has gone away'), False),
    ('integrity', (1062, "Duplicate entry '5' for key 'stock.uq_stock_product_id'"), True),
    ('integrity', (1062, "Duplicate entry '789' for key 'products.barcode'"), False),
    ('integrity', (1452, 'Cannot add or update a child row: a foreign key constraint fails'), False),
    ('integrity', ('UNIQUE constraint failed: stock.product_id',), True),
    ('integrity', ('UNIQUE constraint failed: products.barcode',), False),
])
def test_only_lock_conflicts_and_duplicate_stock_rows_become_409(exc_type, args, expected):
    from sqlalchemy.exc import IntegrityError, OperationalError
    from app.api.utils import _is_concurrency_conflict
    cls = OperationalError if exc_type == 'operational' else IntegrityError
    assert _is_concurrency_conflict(cls('stmt', {}, _FakeDriverError(*args))) is expected


# --- Limites de quantidade (coluna INT do MySQL) ---------------------------------------------

@pytest.mark.parametrize('change', [99_999_999_999, -99_999_999_999, '2147483648'])
def test_manual_move_out_of_range_is_400(client, env, change):
    p = env['product']('A', 5)
    stock_id = Stock.query.filter_by(product_id=p).one().id
    assert admin_post(client, '/stock/moves', {'stock_id': stock_id, 'quantity_change': change}).status_code == 400
    assert qty(p) == 5


def test_manual_entry_that_would_overflow_balance_is_400(client, env):
    p = env['product']('A', 2_147_483_000)
    stock_id = Stock.query.filter_by(product_id=p).one().id
    assert admin_post(client, '/stock/moves', {'stock_id': stock_id, 'quantity_change': 1000}).status_code == 400
    assert qty(p) == 2_147_483_000


def test_create_stock_out_of_range_is_400(client, env):
    p = env['product']('Sem estoque')
    assert admin_post(client, '/stock', {'product_id': p, 'quantity': 2_147_483_648}).status_code == 400
    assert Stock.query.filter_by(product_id=p).count() == 0


def test_import_out_of_range_quantity_is_invalid_row(client, env):
    p = env['product']('A', 5)
    db.session.get(Product, p).barcode = '111'
    db.session.commit()
    resp = _import(client, 'nome,preco,codigo,estoque\nA,1,111,99999999999\n')
    assert resp.status_code == 200
    assert resp.get_json()['skipped'] == 1
    assert qty(p) == 5


def test_import_unparseable_quantity_is_ignored_without_500(client, env):
    # '1e999' overflows to infinity; like any non-numeric text the quantity is left untouched
    p = env['product']('A', 5)
    db.session.get(Product, p).barcode = '111'
    db.session.commit()
    resp = _import(client, 'nome,preco,codigo,estoque\nA,1,111,1e999\n')
    assert resp.status_code == 200
    assert resp.get_json()['updated'] == 1
    assert qty(p) == 5
