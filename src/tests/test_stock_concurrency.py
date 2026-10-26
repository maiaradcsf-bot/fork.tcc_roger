"""Concurrency tests against a real MySQL database (row locks cannot be reproduced on SQLite).

They run only against the dedicated database named in TEST_DB_NAME, built from the project's
migrations, and are skipped when MySQL is not reachable. Every destructive statement first
checks that the connection is really using that database.

Each scenario forces a specific interleaving: an engine hook pauses one thread right after a
chosen SQL statement (for example, right after it locked a stock row) while the other thread
runs, so the race happens on every run instead of by chance.
"""
import io
import os
import threading
import time
from contextlib import contextmanager

import pytest
from flask_migrate import downgrade, upgrade
from sqlalchemy import event, inspect, text
from sqlalchemy.engine import URL
from sqlalchemy.exc import IntegrityError, OperationalError

import app.api.admin.orders as orders_module
import app.api.admin.products_import as import_module
import app.api.admin.stock_moves as stock_moves_module
import app.api.utils as utils_module

from app import create_app
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
from config import Config

TEST_DB_NAME = 'tcc_test'
MIGRATIONS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'migrations'))
PREVIOUS_REVISION = 'b7c8d9e0f1a2'

ADMIN_PERMISSIONS = [
    'admin.orders.list', 'admin.orders.approve', 'admin.orders.reject', 'admin.orders.cancel',
    'admin.stock.moves.list', 'admin.stock.moves.create', 'admin.stock.moves.delete',
    'admin.products.import',
]


def _test_db_url():
    user, host = os.environ.get('DB_USER'), os.environ.get('DB_HOST')
    if not user or not host:
        return None
    return URL.create('mysql+pymysql', username=user, password=os.environ.get('DB_PASSWORD'),
                      host=host, port=int(os.environ.get('DB_PORT') or 3306), database=TEST_DB_NAME)


def _assert_test_database(conn):
    current = conn.execute(text('SELECT DATABASE()')).scalar()
    if current != TEST_DB_NAME:
        pytest.fail(f'Recusando operação destrutiva: conectado a {current!r}, esperado {TEST_DB_NAME!r}')


def _drop_all_tables():
    with db.engine.begin() as conn:
        _assert_test_database(conn)
        conn.execute(text('SET FOREIGN_KEY_CHECKS = 0'))
        for table in inspect(conn).get_table_names():
            conn.execute(text(f'DROP TABLE `{table}`'))
        conn.execute(text('SET FOREIGN_KEY_CHECKS = 1'))


def _truncate_data():
    with db.engine.begin() as conn:
        _assert_test_database(conn)
        conn.execute(text('SET FOREIGN_KEY_CHECKS = 0'))
        for table in inspect(conn).get_table_names():
            if table != 'alembic_version':
                conn.execute(text(f'TRUNCATE TABLE `{table}`'))
        conn.execute(text('SET FOREIGN_KEY_CHECKS = 1'))


@pytest.fixture(scope='module')
def mysql_app():
    url = _test_db_url()
    if url is None:
        pytest.skip('Variáveis DB_USER/DB_HOST não configuradas: testes de concorrência ignorados')
    assert url.database == TEST_DB_NAME

    class MySQLTestConfig(Config):
        TESTING = True
        SQLALCHEMY_DATABASE_URI = url.render_as_string(hide_password=False)
        SQLALCHEMY_ENGINE_OPTIONS = {'pool_size': 10, 'max_overflow': 10}

    app = create_app(MySQLTestConfig)
    with app.app_context():
        try:
            with db.engine.connect() as conn:
                _assert_test_database(conn)
        except OperationalError as exc:
            pytest.skip(f'MySQL de teste indisponível: {exc.orig}')
        # Build the schema from the migrations, which also exercises the new unique-index migration
        _drop_all_tables()
        upgrade(directory=MIGRATIONS_DIR)
    yield app


@pytest.fixture
def env(mysql_app):
    with mysql_app.app_context():
        _truncate_data()
        perms = {name: Permission(name=name) for name in ADMIN_PERMISSIONS + ['clients.orders.cancel']}
        db.session.add_all(perms.values())
        admin = User(username='admin', email='admin@test', password='x', auth_token='admin-token',
                     rules=[Rule(name='administrator', permissions=[perms[p] for p in ADMIN_PERMISSIONS])])
        customer = Client(name='Cliente', email='c@test', password='x', auth_token='client-token',
                          rules=[Rule(name='cliente', permissions=[perms['clients.orders.cancel']])])
        db.session.add_all([admin, customer])
        db.session.commit()
        customer_id = customer.id
        db.session.remove()

    def product(name, quantity=None):
        with mysql_app.app_context():
            prod = Product(name=name, price=1)
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

    def order(items, status='pending'):
        with mysql_app.app_context():
            cart = Cart(client_id=customer_id, status='closed')
            db.session.add(cart)
            db.session.flush()
            new_order = Order(client_id=customer_id, cart_id=cart.id, status=status, total=0)
            db.session.add(new_order)
            db.session.flush()
            for product_id, quantity in items:
                db.session.add(OrderItem(order_id=new_order.id, product_id=product_id, quantity=quantity, unit_price=1))
            db.session.commit()
            return new_order.id

    def read(fn):
        with mysql_app.app_context():
            try:
                return fn()
            finally:
                db.session.remove()

    return {'app': mysql_app, 'product': product, 'order': order, 'read': read}


# --- helpers --------------------------------------------------------------------------------

def is_locked_stock_read(statement):
    return 'FROM stock' in statement and 'stock.quantity' in statement


def is_order_row_read(statement):
    return 'FROM orders' in statement and 'orders.status' in statement


@contextmanager
def pause_after(app, rules):
    """rules: {thread_name: (predicate(statement) -> bool, seconds)}; pauses once per thread."""
    fired = set()

    def listener(conn, cursor, statement, parameters, context, executemany):
        name = threading.current_thread().name
        rule = rules.get(name)
        if rule and name not in fired and rule[0](statement):
            fired.add(name)
            time.sleep(rule[1])

    with app.app_context():
        engine = db.engine
    event.listen(engine, 'after_cursor_execute', listener)
    try:
        yield
    finally:
        event.remove(engine, 'after_cursor_execute', listener)


def run_parallel(app, calls):
    """calls: {thread_name: (start_delay, fn(test_client) -> response or list of responses)}."""
    results = {}

    def worker(name, delay, fn):
        time.sleep(delay)
        try:
            out = fn(app.test_client())
            responses = out if isinstance(out, list) else [out]
            results[name] = [(r.status_code, r.get_json()) for r in responses]
        except Exception as exc:  # surfaced in the assertion message
            results[name] = exc

    threads = [threading.Thread(target=worker, name=name, args=(name, delay, fn)) for name, (delay, fn) in calls.items()]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=60)
        assert not thread.is_alive(), f'{thread.name} não terminou (possível travamento)'
    for name, result in results.items():
        assert not isinstance(result, Exception), f'{name}: {result!r}'
    return results


def admin(client, method, path, body=None):
    return client.open(f'/api/admin{path}', method=method, json=body, headers={'Authorization': 'Bearer admin-token'})


def finish(order_id, **extra):
    return lambda c: admin(c, 'PATCH', f'/orders/{order_id}/status', {'action': 'finish', **extra})


def cancel(order_id):
    return lambda c: admin(c, 'PATCH', f'/orders/{order_id}/status', {'action': 'cancel'})


def approve(order_id):
    return lambda c: admin(c, 'PATCH', f'/orders/{order_id}/status', {'action': 'approve'})


def status_codes(results, *names):
    return sorted(results[name][0][0] for name in names)


def stock_qty(env, product_id):
    return env['read'](lambda: Stock.query.filter_by(product_id=product_id).one().quantity)


def assert_ledger_consistent(env):
    def check():
        for stock in Stock.query.all():
            total = sum(m.quantity_change for m in StockMove.query.filter_by(stock_id=stock.id))
            assert stock.quantity == total, f'stock {stock.id}: saldo {stock.quantity} != movimentações {total}'
            assert stock.quantity >= 0, f'stock {stock.id} negativo: {stock.quantity}'
    env['read'](check)


# --- scenarios ------------------------------------------------------------------------------

def test_two_finishes_competing_for_the_same_units(env):
    p = env['product']('A', 5)
    first = env['order']([(p, 5)], 'approved')
    second = env['order']([(p, 5)], 'approved')
    with pause_after(env['app'], {'first': (is_locked_stock_read, 0.6)}):
        results = run_parallel(env['app'], {'first': (0, finish(first)), 'second': (0.15, finish(second))})
    assert results['first'][0][0] == 200
    assert results['second'][0][0] == 409
    assert results['second'][0][1]['code'] == 'insufficient_stock'
    assert stock_qty(env, p) == 0
    assert_ledger_consistent(env)


def test_concurrent_approvals_do_not_commit_the_same_units(env):
    p = env['product']('A', 5)
    first = env['order']([(p, 5)])
    second = env['order']([(p, 5)])
    # 'first' holds the stock lock while 'second' tries to approve; 'second' must then see
    # the first approval (READ COMMITTED) and refuse
    with pause_after(env['app'], {'first': (is_order_row_read, 0.6)}):
        results = run_parallel(env['app'], {'first': (0, approve(first)), 'second': (0.15, approve(second))})
    assert results['first'][0][0] == 200
    assert results['second'][0][0] == 409
    assert results['second'][0][1]['code'] == 'insufficient_committed_stock'
    statuses = env['read'](lambda: sorted(o.status for o in Order.query.all()))
    assert statuses == ['approved', 'pending']


def test_client_cancel_racing_admin_approve_and_finish(env):
    p = env['product']('A', 5)
    o = env['order']([(p, 3)])

    def client_cancel(c):
        return c.patch(f'/api/client/orders/{o}/status', json={'action': 'cancel'}, headers={'Authorization': 'Bearer client-token'})

    def admin_flow(c):
        return [approve(o)(c), finish(o)(c)]

    with pause_after(env['app'], {'client': (is_order_row_read, 1.0)}):
        results = run_parallel(env['app'], {'client': (0, client_cancel), 'admin': (0.2, admin_flow)})

    final = env['read'](lambda: (db.session.get(Order, o).status,
                                 StockMove.query.filter_by(order_id=o, is_reversal=False, reverted_at=None).count()))
    status, open_withdrawals = final
    if status == 'cancelled':
        assert open_withdrawals == 0 and stock_qty(env, p) == 5, 'pedido cancelado com estoque retirado e não devolvido'
    else:
        assert status == 'finished' and stock_qty(env, p) == 2
    assert results['client'][0][0] == 200
    assert [code for code, _ in results['admin']] == [400, 400]
    assert status == 'cancelled'
    assert_ledger_consistent(env)


def test_manual_entry_racing_order_withdrawal(env):
    p = env['product']('A', 10)
    o = env['order']([(p, 3)], 'approved')
    stock_id = env['read'](lambda: Stock.query.filter_by(product_id=p).one().id)

    def manual_entry(c):
        return admin(c, 'POST', '/stock/moves', {'stock_id': stock_id, 'quantity_change': 5})

    with pause_after(env['app'], {'manual': (is_locked_stock_read, 0.6)}):
        results = run_parallel(env['app'], {'manual': (0, manual_entry), 'finish': (0.15, finish(o))})
    assert results['manual'][0][0] == 201
    assert results['finish'][0][0] == 200
    assert stock_qty(env, p) == 12
    assert_ledger_consistent(env)


def test_two_manual_exits_cannot_overdraw(env):
    p = env['product']('A', 5)
    stock_id = env['read'](lambda: Stock.query.filter_by(product_id=p).one().id)

    def exit_four(c):
        return admin(c, 'POST', '/stock/moves', {'stock_id': stock_id, 'quantity_change': -4})

    with pause_after(env['app'], {'first': (is_locked_stock_read, 0.6)}):
        results = run_parallel(env['app'], {'first': (0, exit_four), 'second': (0.15, exit_four)})
    assert status_codes(results, 'first', 'second') == [201, 409]
    assert stock_qty(env, p) == 1
    assert_ledger_consistent(env)


def test_orders_with_products_in_opposite_order_do_not_deadlock(env):
    a = env['product']('A', 10)
    b = env['product']('B', 10)
    first = env['order']([(a, 1), (b, 1)], 'approved')
    second = env['order']([(b, 2), (a, 2)], 'approved')
    rules = {'first': (is_locked_stock_read, 0.6), 'second': (is_locked_stock_read, 0.6)}
    with pause_after(env['app'], rules):
        results = run_parallel(env['app'], {'first': (0, finish(first)), 'second': (0, finish(second))})
    assert status_codes(results, 'first', 'second') == [200, 200], results
    assert stock_qty(env, a) == 7 and stock_qty(env, b) == 7
    assert_ledger_consistent(env)


def test_concurrent_cancels_return_stock_only_once(env):
    p = env['product']('A', 10)
    o = env['order']([(p, 4)], 'approved')
    assert run_parallel(env['app'], {'setup': (0, finish(o))})['setup'][0][0] == 200
    with pause_after(env['app'], {'first': (is_order_row_read, 0.6)}):
        results = run_parallel(env['app'], {'first': (0, cancel(o)), 'second': (0.15, cancel(o))})
    assert status_codes(results, 'first', 'second') == [200, 400]
    assert stock_qty(env, p) == 10
    reversals = env['read'](lambda: StockMove.query.filter_by(order_id=o, is_reversal=True).count())
    assert reversals == 1
    assert_ledger_consistent(env)


def test_concurrent_stock_creation_keeps_a_single_row(env):
    p = env['product']('Novo')

    def is_existing_check(statement):
        return 'FROM stock' in statement and 'FOR UPDATE' not in statement and 'stock.product_id =' in statement

    def create(c):
        return admin(c, 'POST', '/stock', {'product_id': p, 'quantity': 0})

    rules = {'first': (is_existing_check, 0.5), 'second': (is_existing_check, 0.5)}
    with pause_after(env['app'], rules):
        results = run_parallel(env['app'], {'first': (0, create), 'second': (0.05, create)})
    assert status_codes(results, 'first', 'second') == [201, 409], results
    loser = results['first'] if results['first'][0][0] == 409 else results['second']
    assert loser[0][1]['code'] == 'concurrent_update'
    assert env['read'](lambda: Stock.query.filter_by(product_id=p).count()) == 1


# --- migration --------------------------------------------------------------------------------

def _unique_index_present():
    rows = db.session.execute(text("SHOW INDEX FROM stock WHERE Key_name = 'uq_stock_product_id'")).fetchall()
    db.session.remove()
    return bool(rows)


def test_unique_stock_migration_downgrade_upgrade_and_duplicate_guard(env):
    app = env['app']
    p = env['product']('A', 1)
    with app.app_context():
        assert _unique_index_present()
        downgrade(directory=MIGRATIONS_DIR, revision=PREVIOUS_REVISION)
        assert not _unique_index_present()
        assert db.session.execute(text('SELECT version_num FROM alembic_version')).scalar() == PREVIOUS_REVISION
        db.session.remove()

        with db.engine.begin() as conn:
            _assert_test_database(conn)
            conn.execute(text('INSERT INTO stock (product_id, quantity) VALUES (:p, 0)'), {'p': p})
        # flask_migrate logs the migration's RuntimeError and exits
        with pytest.raises(SystemExit):
            upgrade(directory=MIGRATIONS_DIR)
        assert not _unique_index_present()

        with db.engine.begin() as conn:
            _assert_test_database(conn)
            conn.execute(text('DELETE FROM stock WHERE product_id = :p AND quantity = 0'), {'p': p})
        upgrade(directory=MIGRATIONS_DIR)
        assert _unique_index_present()
        assert db.session.execute(text('SELECT version_num FROM alembic_version')).scalar() == 'e1f2a3b4c5d6'
        db.session.remove()


# --- P6: deadlock entre pedidos A/B e B/A --------------------------------------------------------

def _lock_in_given_order(product_ids):
    """The pre-fix behaviour: stock rows locked in the order the items come back (unsorted)."""
    stocks = {}
    for product_id in product_ids:
        stock = Stock.query.filter_by(product_id=product_id).with_for_update().populate_existing().one_or_none()
        if stock:
            stocks[product_id] = stock
    return stocks


def test_unsorted_locking_deadlocks_and_is_rolled_back_as_409(env, monkeypatch):
    """Control: with item-order locking, A/B vs B/A deadlocks on every run. The victim must get
    409 (not 500) and none of its changes may survive."""
    a = env['product']('A', 10)
    b = env['product']('B', 10)
    first = env['order']([(a, 1), (b, 1)], 'approved')
    second = env['order']([(b, 2), (a, 2)], 'approved')
    monkeypatch.setattr(orders_module, 'lock_stocks', _lock_in_given_order)
    rules = {'first': (is_locked_stock_read, 0.6), 'second': (is_locked_stock_read, 0.6)}
    with pause_after(env['app'], rules):
        results = run_parallel(env['app'], {'first': (0, finish(first)), 'second': (0, finish(second))})

    assert status_codes(results, 'first', 'second') == [200, 409], results
    winner, loser = (first, second) if results['first'][0][0] == 200 else (second, first)
    loser_result = results['first'] if loser == first else results['second']
    assert loser_result[0][1]['code'] == 'concurrent_update'
    taken = 1 if winner == first else 2
    assert stock_qty(env, a) == 10 - taken and stock_qty(env, b) == 10 - taken
    state = env['read'](lambda: (db.session.get(Order, loser).status, StockMove.query.filter_by(order_id=loser).count()))
    assert state == ('approved', 0)
    assert_ledger_consistent(env)


def test_lock_wait_timeout_is_rolled_back_as_409(env):
    """Another connection holds the stock row; with a 1 s lock wait timeout the finish gives up.
    MySQL only undoes the failed statement on timeout, so stock_transaction must roll back the rest."""
    p = env['product']('A', 10)
    o = env['order']([(p, 3)], 'approved')
    stock_id = env['read'](lambda: Stock.query.filter_by(product_id=p).one().id)
    with env['app'].app_context():
        engine = db.engine

    def short_timeout(dbapi_conn, record, proxy):
        cursor = dbapi_conn.cursor()
        cursor.execute('SET SESSION innodb_lock_wait_timeout = 1')
        cursor.close()

    holder = engine.connect()
    try:
        tx = holder.begin()
        holder.execute(text('SELECT id FROM stock WHERE id = :id FOR UPDATE'), {'id': stock_id})
        event.listen(engine, 'checkout', short_timeout)
        try:
            resp = finish(o)(env['app'].test_client())
        finally:
            event.remove(engine, 'checkout', short_timeout)
        tx.rollback()
    finally:
        holder.close()
        engine.dispose()  # drop pooled connections that kept the short timeout

    assert resp.status_code == 409 and resp.get_json()['code'] == 'concurrent_update'
    assert env['read'](lambda: db.session.get(Order, o).status) == 'approved'
    assert stock_qty(env, p) == 10
    assert_ledger_consistent(env)


# --- P4: aprovações concorrentes --------------------------------------------------------------

def test_three_concurrent_approvals_commit_at_most_the_stock(env):
    p = env['product']('A', 5)
    orders = [env['order']([(p, 2)]) for _ in range(3)]
    with pause_after(env['app'], {'o0': (is_order_row_read, 0.5)}):
        results = run_parallel(env['app'], {
            'o0': (0, approve(orders[0])), 'o1': (0.1, approve(orders[1])), 'o2': (0.2, approve(orders[2])),
        })
    assert status_codes(results, 'o0', 'o1', 'o2') == [200, 200, 409]
    approved_units = env['read'](lambda: sum(
        i.quantity for o in Order.query.filter_by(status='approved') for i in o.items))
    assert approved_units == 4


def test_approval_waits_for_manual_exit_and_sees_new_balance(env):
    p = env['product']('A', 5)
    o = env['order']([(p, 5)])
    stock_id = env['read'](lambda: Stock.query.filter_by(product_id=p).one().id)

    def manual_exit(c):
        return admin(c, 'POST', '/stock/moves', {'stock_id': stock_id, 'quantity_change': -3})

    with pause_after(env['app'], {'manual': (is_locked_stock_read, 0.6)}):
        results = run_parallel(env['app'], {'manual': (0, manual_exit), 'approve': (0.15, approve(o))})
    assert results['manual'][0][0] == 201
    assert results['approve'][0][0] == 409
    assert results['approve'][0][1]['shortages'][0]['available'] == 2


def test_approval_waits_for_cancel_that_releases_units(env):
    p = env['product']('A', 5)
    holder = env['order']([(p, 5)], 'approved')
    o = env['order']([(p, 5)])
    with pause_after(env['app'], {'cancel': (is_order_row_read, 0.6)}):
        results = run_parallel(env['app'], {'cancel': (0, cancel(holder)), 'approve': (0.15, approve(o))})
    assert results['cancel'][0][0] == 200
    assert results['approve'][0][0] == 200


def test_control_repeatable_read_would_let_both_approvals_through(env, monkeypatch):
    """Control: without READ COMMITTED, the second approval reads the committed total from the
    snapshot taken before it waited for the lock and approves the same units again. This is
    why the lock alone is not enough and stock_transaction switches the isolation level."""
    monkeypatch.setattr(utils_module, 'STOCK_TRANSACTION_ISOLATION', None)
    p = env['product']('A', 5)
    first = env['order']([(p, 5)])
    second = env['order']([(p, 5)])
    with pause_after(env['app'], {'first': (is_order_row_read, 0.6)}):
        results = run_parallel(env['app'], {'first': (0, approve(first)), 'second': (0.15, approve(second))})
    assert status_codes(results, 'first', 'second') == [200, 200]


# --- Banco usado pelos testes --------------------------------------------------------------------

def test_requests_run_against_the_test_database(env):
    seen = set()
    with env['app'].app_context():
        engine = db.engine

    def listener(conn, cursor, statement, parameters, context, executemany):
        # separate cursor: reusing the request's cursor would discard its pending results
        probe = cursor.connection.cursor()
        probe.execute('SELECT DATABASE()')
        seen.add(probe.fetchone()[0])
        probe.close()

    p = env['product']('A', 5)
    o = env['order']([(p, 1)])
    event.listen(engine, 'after_cursor_execute', listener)
    try:
        assert approve(o)(env['app'].test_client()).status_code == 200
    finally:
        event.remove(engine, 'after_cursor_execute', listener)
    assert seen == {TEST_DB_NAME}


# --- Atomicidade: falha no meio da operação não deixa nada pela metade ---------------------------

def _failing_after(real, allowed_calls):
    calls = {'n': 0}

    def factory(*args, **kwargs):
        calls['n'] += 1
        if calls['n'] > allowed_calls:
            raise RuntimeError('falha simulada')
        return real(*args, **kwargs)
    return factory


@pytest.mark.parametrize('partial', [False, True])
def test_failure_during_finish_leaves_no_partial_withdrawal(env, monkeypatch, partial):
    a = env['product']('A', 10)
    b = env['product']('B', 1 if partial else 10)
    o = env['order']([(a, 3), (b, 2)], 'approved')
    monkeypatch.setattr(orders_module, 'StockMove', _failing_after(StockMove, 1))
    with pytest.raises(RuntimeError, match='falha simulada'):
        finish(o, **({'allow_partial': True} if partial else {}))(env['app'].test_client())
    assert stock_qty(env, a) == 10 and stock_qty(env, b) == (1 if partial else 10)
    assert env['read'](lambda: (db.session.get(Order, o).status, StockMove.query.filter_by(order_id=o).count())) == ('approved', 0)
    assert_ledger_consistent(env)


def test_failure_during_cancel_leaves_no_partial_return(env, monkeypatch):
    a = env['product']('A', 10)
    b = env['product']('B', 10)
    o = env['order']([(a, 3), (b, 2)], 'approved')
    assert finish(o)(env['app'].test_client()).status_code == 200
    monkeypatch.setattr(StockMove, 'revert', _failing_after(StockMove.revert, 1))
    with pytest.raises(RuntimeError, match='falha simulada'):
        cancel(o)(env['app'].test_client())
    assert stock_qty(env, a) == 7 and stock_qty(env, b) == 8
    state = env['read'](lambda: (
        db.session.get(Order, o).status,
        StockMove.query.filter_by(order_id=o, is_reversal=True).count(),
        StockMove.query.filter(StockMove.order_id == o, StockMove.reverted_at.isnot(None)).count(),
    ))
    assert state == ('finished', 0, 0)
    monkeypatch.undo()
    assert cancel(o)(env['app'].test_client()).status_code == 200
    assert stock_qty(env, a) == 10 and stock_qty(env, b) == 10
    assert_ledger_consistent(env)


def test_failure_during_manual_move_keeps_balance_and_creates_no_stock(env, monkeypatch):
    p = env['product']('A', 5)
    new_product = env['product']('Novo')
    stock_id = env['read'](lambda: Stock.query.filter_by(product_id=p).one().id)
    monkeypatch.setattr(stock_moves_module, 'StockMove', _failing_after(StockMove, 0))
    client = env['app'].test_client()
    with pytest.raises(RuntimeError, match='falha simulada'):
        admin(client, 'POST', '/stock/moves', {'stock_id': stock_id, 'quantity_change': -2})
    with pytest.raises(RuntimeError, match='falha simulada'):
        admin(client, 'POST', '/stock/moves', {'product_id': new_product, 'quantity_change': 4})
    assert stock_qty(env, p) == 5
    assert env['read'](lambda: Stock.query.filter_by(product_id=new_product).count()) == 0
    assert_ledger_consistent(env)


def test_failure_during_initial_entry_creates_no_stock(env, monkeypatch):
    import app.api.admin.stock as stock_module
    p = env['product']('Novo')
    monkeypatch.setattr(stock_module, 'StockMove', _failing_after(StockMove, 0))
    with pytest.raises(RuntimeError, match='falha simulada'):
        admin(env['app'].test_client(), 'POST', '/stock', {'product_id': p, 'quantity': 5})
    assert env['read'](lambda: Stock.query.filter_by(product_id=p).count()) == 0
    assert_ledger_consistent(env)


def _upload_and_commit(client, csv_text):
    upload = client.post('/api/admin/products/import/upload', headers={'Authorization': 'Bearer admin-token'},
                         data={'file': (io.BytesIO(csv_text.encode()), 'produtos.csv')}, content_type='multipart/form-data')
    assert upload.status_code == 201
    mapping = {'name': 'nome', 'price': 'preco', 'barcode': 'codigo', 'stock_quantity': 'estoque'}
    return admin(client, 'POST', '/products/import/commit', {'import_id': upload.get_json()['import_id'], 'mapping': mapping})


def _set_barcode(env, product_id, barcode, deleted=False):
    def apply():
        product = db.session.get(Product, product_id)
        product.barcode = barcode
        if deleted:
            product.soft_delete()
        db.session.commit()
    env['read'](apply)


def test_failure_during_import_rolls_back_every_row(env, monkeypatch):
    p = env['product']('A', 5)
    _set_barcode(env, p, '111')
    monkeypatch.setattr(import_module, 'StockMove', _failing_after(StockMove, 1))
    with pytest.raises(RuntimeError, match='falha simulada'):
        _upload_and_commit(env['app'].test_client(), 'nome,preco,codigo,estoque\nA,1,111,9\nNovo,2,222,3\n')
    assert stock_qty(env, p) == 5
    assert env['read'](lambda: Product.query.filter_by(barcode='222').count()) == 0
    assert_ledger_consistent(env)


def test_unrelated_integrity_error_is_not_reported_as_stock_conflict(env):
    """A barcode that belongs to a soft-deleted product makes the import insert a duplicate
    barcode: a real data error. It must propagate (500 in production), not become a 409
    'try again', and the rows before it must be rolled back."""
    p = env['product']('A', 5)
    _set_barcode(env, p, '111')
    deleted = env['product']('Antigo', 0)
    _set_barcode(env, deleted, '999', deleted=True)
    with pytest.raises(IntegrityError) as excinfo:
        _upload_and_commit(env['app'].test_client(), 'nome,preco,codigo,estoque\nA,1,111,9\nNovo,2,999,3\n')
    assert excinfo.value.orig.args[0] == 1062 and 'barcode' in str(excinfo.value.orig)
    assert stock_qty(env, p) == 5
    assert_ledger_consistent(env)
