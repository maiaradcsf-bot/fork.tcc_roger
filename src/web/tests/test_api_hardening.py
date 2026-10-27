"""Security and regression tests for the Etapa 4 fixes (SQLite in memory)."""
import io
import os
import re

import pytest
from werkzeug.security import generate_password_hash

from app.models import db
from app.models.carts import Cart
from app.models.categories import Category
from app.models.clients import Client
from app.models.order_items import OrderItem
from app.models.orders import Order
from app.models.permissions import Permission
from app.models.products import Product
from app.models.rules import Rule
from app.models.stock import Stock
from app.models.stock_moves import StockMove
from app.models.user_rules import UserRule
from app.models.users import User
from app.permissions_catalog import SYSTEM_PERMISSIONS

PNG_BYTES = b'\x89PNG\r\n\x1a\n' + b'\x00' * 64


@pytest.fixture
def world(app):
    perms = {name: Permission(name=name, description=desc) for name, desc in SYSTEM_PERMISSIONS}
    db.session.add_all(perms.values())
    admin_rule = Rule(name='administrator', permissions=list(perms.values()))  # like the seed: every permission
    client_rule = Rule(name='cliente', permissions=[p for n, p in perms.items() if n.startswith('clients.')])
    users_rule = Rule(name='gestor usuarios', permissions=[perms['admin.settings.users.manage']])
    profiles_rule = Rule(name='gestor perfis', permissions=[perms['admin.settings.profiles.manage']])
    db.session.add_all([admin_rule, client_rule, users_rule, profiles_rule])

    def user(name, rules):
        u = User(username=name, email=f'{name}@t.com', auth_token=f'tok-{name}', rules=rules)
        u.set_password('Senha123')
        db.session.add(u)
        return u

    admin = user('admin', [admin_rule])
    user('usersmgr', [users_rule])
    user('profilesmgr', [profiles_rule])
    for name in ('cli-a', 'cli-b'):
        c = Client(name=name, email=f'{name}@t.com', auth_token=f'tok-{name}', rules=[client_rule])
        c.set_password('Senha123')
        db.session.add(c)
    product = Product(name='Caneta', price=2, barcode='B-1')
    db.session.add(product)
    db.session.flush()
    stock = Stock(product_id=product.id, quantity=10)
    db.session.add(stock)
    db.session.flush()
    db.session.add(StockMove(stock=stock, quantity_change=10, move_type='entrada', reason='inicial'))
    db.session.commit()
    return {'admin_id': admin.id, 'product_id': product.id, 'admin_rule_id': admin_rule.id,
            'client_rule_id': client_rule.id, 'users_rule_id': users_rule.id, 'profiles_rule_id': profiles_rule.id,
            'perm_ids': {n: p.id for n, p in perms.items()}}


def call(client, method, path, token=None, **kw):
    headers = {'Authorization': f'Bearer {token}'} if token else {}
    return client.open(path, method=method, headers=headers, **kw)


def uid(name):
    return User.query.filter_by(username=name).one().id


# --- Escalada de privilégios -------------------------------------------------------------------

def test_users_manager_cannot_grant_admin_profile(client, world):
    r = call(client, 'POST', '/api/admin/users', 'tok-usersmgr',
             json={'username': 'novo', 'email': 'novo@t.com', 'password': 'Senha123', 'rule_ids': [world['admin_rule_id']]})
    assert r.status_code == 403
    assert User.query.filter_by(username='novo').count() == 0


def test_users_manager_cannot_promote_itself(client, world):
    r = call(client, 'PUT', f"/api/admin/users/{uid('usersmgr')}", 'tok-usersmgr', json={'rule_ids': [world['admin_rule_id']]})
    assert r.status_code == 403
    db.session.expire_all()
    assert not db.session.get(User, uid('usersmgr')).has_permission('admin.stock.moves.delete')


def test_users_manager_cannot_take_over_or_delete_admin(client, world):
    r = call(client, 'PUT', f"/api/admin/users/{world['admin_id']}", 'tok-usersmgr', json={'password': 'Invasor123'})
    assert r.status_code == 403
    assert call(client, 'POST', '/api/admin/login', json={'username': 'admin', 'password': 'Senha123'}).status_code == 200
    assert call(client, 'DELETE', f"/api/admin/users/{world['admin_id']}", 'tok-usersmgr').status_code == 403


def test_users_manager_can_grant_what_it_has(client, world):
    r = call(client, 'POST', '/api/admin/users', 'tok-usersmgr',
             json={'username': 'colega', 'email': 'colega@t.com', 'password': 'Senha123', 'rule_ids': [world['users_rule_id']]})
    assert r.status_code == 201


def test_profiles_manager_cannot_extend_own_or_admin_profile(client, world):
    all_ids = list(world['perm_ids'].values())
    r = call(client, 'PUT', f"/api/admin/rules/{world['profiles_rule_id']}", 'tok-profilesmgr', json={'permission_ids': all_ids})
    assert r.status_code == 403
    r = call(client, 'PUT', f"/api/admin/rules/{world['admin_rule_id']}", 'tok-profilesmgr', json={'permission_ids': []})
    assert r.status_code == 403
    r = call(client, 'POST', '/api/admin/rules', 'tok-profilesmgr', json={'name': 'super', 'permission_ids': all_ids})
    assert r.status_code == 403
    db.session.expire_all()
    assert len(db.session.get(Rule, world['admin_rule_id']).permissions) > 1


def test_system_permissions_and_profiles_are_protected(client, world):
    approve = world['perm_ids']['admin.orders.approve']
    assert call(client, 'PUT', f'/api/admin/permissions/{approve}', 'tok-admin', json={'name': 'outra'}).status_code == 409
    assert call(client, 'DELETE', f'/api/admin/permissions/{approve}', 'tok-admin').status_code == 409
    assert call(client, 'PUT', f'/api/admin/permissions/{approve}', 'tok-admin', json={'description': 'nova'}).status_code == 200
    assert call(client, 'DELETE', f"/api/admin/rules/{world['admin_rule_id']}", 'tok-admin').status_code == 409
    assert call(client, 'DELETE', f"/api/admin/rules/{world['client_rule_id']}", 'tok-admin').status_code == 409
    assert call(client, 'PUT', f"/api/admin/rules/{world['client_rule_id']}", 'tok-admin', json={'name': 'clientes'}).status_code == 409


# --- Exclusões (relacionamentos duplicados) -------------------------------------------------

def test_delete_user_with_profile_and_no_history(client, world):
    target = uid('profilesmgr')
    assert call(client, 'DELETE', f'/api/admin/users/{target}', 'tok-admin').status_code == 200
    assert UserRule.query.filter_by(user_id=target).count() == 0


def test_delete_user_with_history_is_conflict_not_500(client, world):
    stock = Stock.query.one()
    db.session.add(StockMove(stock=stock, quantity_change=0, move_type='entrada', user_id=uid('usersmgr')))
    db.session.commit()
    assert call(client, 'DELETE', f"/api/admin/users/{uid('usersmgr')}", 'tok-admin').status_code == 409


def test_cannot_delete_own_account(client, world):
    assert call(client, 'DELETE', f"/api/admin/users/{world['admin_id']}", 'tok-admin').status_code == 400


def test_delete_custom_profile_and_permission_in_use(client, world):
    perm = call(client, 'POST', '/api/admin/permissions', 'tok-admin', json={'name': 'custom.x'}).get_json()['id']
    rule = call(client, 'POST', '/api/admin/rules', 'tok-admin', json={'name': 'custom', 'permission_ids': [perm]}).get_json()['id']
    call(client, 'PUT', f"/api/admin/users/{uid('usersmgr')}", 'tok-admin', json={'rule_ids': [world['users_rule_id'], rule]})
    assert call(client, 'DELETE', f'/api/admin/permissions/{perm}', 'tok-admin').status_code == 200
    assert call(client, 'DELETE', f'/api/admin/rules/{rule}', 'tok-admin').status_code == 200
    db.session.expire_all()
    assert [r.name for r in db.session.get(User, uid('usersmgr')).rules] == ['gestor usuarios']


def test_delete_category_with_products_and_children(client, world):
    parent = call(client, 'POST', '/api/admin/categories', 'tok-admin', json={'name': 'Pai'}).get_json()['id']
    child = call(client, 'POST', '/api/admin/categories', 'tok-admin', json={'name': 'Filha', 'parent_id': parent}).get_json()['id']
    call(client, 'PUT', f"/api/admin/products/{world['product_id']}", 'tok-admin', json={'category_ids': [parent]})
    assert call(client, 'DELETE', f'/api/admin/categories/{parent}', 'tok-admin').status_code == 200
    db.session.expire_all()
    assert db.session.get(Category, child).parent_id is None
    assert db.session.get(Product, world['product_id']).categories == []


# --- Corpos JSON inválidos em todas as rotas -------------------------------------------------

def test_no_route_returns_500_for_non_object_json(app, client, world):
    failures = []
    for rule in app.url_map.iter_rules():
        if not rule.rule.startswith('/api') or 'upload' in rule.rule:
            continue
        path = re.sub(r'<import_id>', 'x', re.sub(r'<int:\w+>', '1', rule.rule))
        token = 'tok-cli-a' if rule.rule.startswith('/api/client') else 'tok-admin'
        for method in sorted(rule.methods & {'POST', 'PUT', 'PATCH'}):
            for payload in ('"texto"', '[1, 2]', '123', '{"a": '):
                r = call(client, method, path, token, data=payload, content_type='application/json')
                if r.status_code >= 500:
                    failures.append(f'{method} {path} {payload} -> {r.status_code}')
    assert failures == []


@pytest.mark.parametrize('method,path,body', [
    ('POST', '/api/client/register', {'name': {'a': 1}, 'email': 'x@t.com', 'password': 'Senha123'}),
    ('POST', '/api/client/register', {'name': 'X', 'email': 'nao-email', 'password': 'Senha123'}),
    ('POST', '/api/client/register', {'name': 'X', 'email': 'x@t.com', 'password': '1'}),
    ('POST', '/api/client/register', {'name': 'X' * 151, 'email': 'x@t.com', 'password': 'Senha123'}),
    ('POST', '/api/client/register', {'name': 'X', 'email': 'x@t.com', 'password': 'á' * 40}),
    ('POST', '/api/client/login', {'email': ['a'], 'password': 'x'}),
    ('POST', '/api/login', {'email': 'a@t.com', 'password': 5}),
    ('POST', '/api/admin/users', {'username': 'r', 'email': 'r@t.com', 'password': 'Senha123', 'rule_ids': 'abc'}),
    ('POST', '/api/admin/users', {'username': 'u' * 81, 'email': 'r@t.com', 'password': 'Senha123'}),
    ('POST', '/api/admin/rules', {'name': 'p', 'permission_ids': 'abc'}),
    ('POST', '/api/admin/rules', {'name': 'p', 'permission_ids': [999]}),
    ('POST', '/api/admin/categories', {'name': None}),
    ('POST', '/api/admin/categories', {'name': 'X', 'parent_id': 'abc'}),
    ('POST', '/api/admin/products', {'description': 'sem nome'}),
    ('POST', '/api/admin/products', {'name': 'P', 'price': 'abc'}),
    ('POST', '/api/admin/products', {'name': 'P', 'price': -1}),
    ('POST', '/api/admin/products', {'name': 'P', 'price': 'inf'}),
    ('POST', '/api/admin/products', {'name': 'P', 'price': 1, 'category_ids': 5}),
    ('POST', '/api/admin/products', {'name': 'P', 'price': 1, 'min_stock': 5, 'max_stock': 2}),
])
def test_invalid_input_is_400(client, world, method, path, body):
    token = 'tok-admin' if path.startswith('/api/admin/') and 'login' not in path else None
    assert call(client, method, path, token, json=body).status_code == 400


def test_duplicate_registration_and_names_are_409(client, world):
    assert call(client, 'POST', '/api/client/register', json={'name': 'A', 'email': 'cli-a@t.com', 'password': 'Senha123'}).status_code == 409
    assert call(client, 'POST', '/api/admin/categories', 'tok-admin', json={'name': 'Cat'}).status_code == 201
    assert call(client, 'POST', '/api/admin/categories', 'tok-admin', json={'name': 'Cat'}).status_code == 409
    assert call(client, 'POST', '/api/admin/users', 'tok-admin', json={'username': 'admin', 'email': 'z@t.com', 'password': 'Senha123'}).status_code == 409


def test_category_cycle_is_rejected(client, world):
    a = call(client, 'POST', '/api/admin/categories', 'tok-admin', json={'name': 'A'}).get_json()['id']
    b = call(client, 'POST', '/api/admin/categories', 'tok-admin', json={'name': 'B', 'parent_id': a}).get_json()['id']
    assert call(client, 'PUT', f'/api/admin/categories/{a}', 'tok-admin', json={'parent_id': b}).status_code == 400
    assert call(client, 'PUT', f'/api/admin/categories/{a}', 'tok-admin', json={'parent_id': a}).status_code == 400
    assert call(client, 'PUT', f'/api/admin/categories/{b}', 'tok-admin', json={'name': None}).status_code == 400


# --- Produtos -----------------------------------------------------------------------------

def test_partial_product_update_keeps_other_fields(client, world):
    pid = world['product_id']
    assert call(client, 'PUT', f'/api/admin/products/{pid}', 'tok-admin', json={'price': 7}).status_code == 200
    db.session.expire_all()
    product = db.session.get(Product, pid)
    assert product.barcode == 'B-1' and float(product.price) == 7.0 and product.name == 'Caneta'
    assert call(client, 'PUT', f'/api/admin/products/{pid}', 'tok-admin', json={'name': None}).status_code == 400


def test_barcode_rules(client, world):
    first = call(client, 'POST', '/api/admin/products', 'tok-admin', json={'name': 'A', 'price': 1, 'barcode': ''})
    second = call(client, 'POST', '/api/admin/products', 'tok-admin', json={'name': 'B', 'price': 1, 'barcode': ''})
    assert first.status_code == second.status_code == 201
    numeric = call(client, 'POST', '/api/admin/products', 'tok-admin', json={'name': 'C', 'price': 1, 'barcode': 789})
    assert numeric.status_code == 201
    assert db.session.get(Product, numeric.get_json()['id']).barcode == '789'
    assert call(client, 'POST', '/api/admin/products', 'tok-admin', json={'name': 'D', 'price': 1, 'barcode': 'B-1'}).status_code == 409
    call(client, 'DELETE', f"/api/admin/products/{world['product_id']}", 'tok-admin')
    r = call(client, 'POST', '/api/admin/products', 'tok-admin', json={'name': 'E', 'price': 1, 'barcode': 'B-1'})
    assert r.status_code == 409 and 'excluído' in r.get_json()['error']


def test_product_detail_endpoints(client, world):
    pid = world['product_id']
    assert call(client, 'GET', f'/api/admin/products/{pid}', 'tok-admin').get_json()['barcode'] == 'B-1'
    assert call(client, 'GET', f'/api/client/products/{pid}', 'tok-cli-a').get_json()['stock'] == 10
    assert call(client, 'GET', '/api/admin/products/999', 'tok-admin').status_code == 404
    call(client, 'DELETE', f'/api/admin/products/{pid}', 'tok-admin')
    assert call(client, 'GET', f'/api/client/products/{pid}', 'tok-cli-a').status_code == 404


def test_upload_validates_content_size_and_sends_nosniff(app, client, world):
    fake = call(client, 'POST', '/api/admin/upload', 'tok-admin', data={'file': (io.BytesIO(b'<html>'), 'x.png')},
                content_type='multipart/form-data')
    assert fake.status_code == 400
    real = call(client, 'POST', '/api/client/upload', 'tok-cli-a', data={'file': (io.BytesIO(PNG_BYTES), 'foto.png')},
                content_type='multipart/form-data')
    assert real.status_code == 201
    os.remove(os.path.join(app.root_path, real.get_json()['url'].lstrip('/')))
    big = call(client, 'POST', '/api/admin/upload', 'tok-admin',
               data={'file': (io.BytesIO(PNG_BYTES + b'0' * (6 * 1024 * 1024)), 'grande.png')}, content_type='multipart/form-data')
    assert big.status_code == 413 and big.is_json
    assert fake.headers.get('X-Content-Type-Options') == 'nosniff'


# --- Clientes -----------------------------------------------------------------------------

def test_client_profile_rules(client, world):
    assert call(client, 'PUT', '/api/client/profile', 'tok-cli-a', json={'email': 'cli-b@t.com'}).status_code == 409
    assert call(client, 'PUT', '/api/client/profile', 'tok-cli-a', json={'email': None}).status_code == 400
    assert call(client, 'PUT', '/api/client/profile', 'tok-cli-a', json={'password': 'NovaSenha1'}).status_code == 403
    assert call(client, 'PUT', '/api/client/profile', 'tok-cli-a', json={'password': 'NovaSenha1', 'current_password': 'errada'}).status_code == 403
    assert call(client, 'PUT', '/api/client/profile', 'tok-cli-a', json={'password': 'NovaSenha1', 'current_password': 'Senha123'}).status_code == 200
    assert call(client, 'POST', '/api/client/login', json={'email': 'cli-a@t.com', 'password': 'NovaSenha1'}).status_code == 200


def test_client_status_requires_boolean(client, world):
    cid = Client.query.filter_by(name='cli-a').one().id
    for value in (None, 'false', 0):
        assert call(client, 'PATCH', f'/api/admin/clients/{cid}/status', 'tok-admin', json={'active': value}).status_code == 400
    db.session.expire_all()
    assert db.session.get(Client, cid).active is True
    assert call(client, 'PATCH', f'/api/admin/clients/{cid}/status', 'tok-admin', json={'active': False}).status_code == 200


def test_order_items_validation_and_merging(client, world):
    pid = world['product_id']
    for items in ([5], [{'product_id': pid, 'quantity': 'abc'}], [{'product_id': {'x': 1}, 'quantity': 1}], []):
        r = call(client, 'POST', '/api/client/orders', 'tok-cli-a', json={'items': items})
        assert r.status_code == 400 and 'details' not in r.get_json()
    over = call(client, 'POST', '/api/client/orders', 'tok-cli-a', json={'items': [{'product_id': pid, 'quantity': 6}, {'product_id': pid, 'quantity': 6}]})
    assert over.status_code == 400
    ok = call(client, 'POST', '/api/client/orders', 'tok-cli-a', json={'items': [{'product_id': pid, 'quantity': 2}, {'product_id': pid, 'quantity': 3}]})
    assert ok.status_code == 201
    items = OrderItem.query.filter_by(order_id=ok.get_json()['order_id']).all()
    assert [(i.product_id, i.quantity) for i in items] == [(pid, 5)]


def test_client_order_responses_hide_admin_identity(client, world):
    order_id = call(client, 'POST', '/api/client/orders', 'tok-cli-a', json={'items': [{'product_id': world['product_id'], 'quantity': 1}]}).get_json()['order_id']
    assert call(client, 'PATCH', f'/api/admin/orders/{order_id}/status', 'tok-admin', json={'action': 'approve'}).status_code == 200
    for body in (call(client, 'GET', '/api/client/orders', 'tok-cli-a').get_json()[0],
                 call(client, 'GET', f'/api/client/orders/{order_id}', 'tok-cli-a').get_json()):
        assert body['approved_at'] is not None
        assert 'admin' not in str(body)
        assert not any(key.endswith('_user_id') for key in body)


def test_cart_and_stock_filter_validation(client, world):
    cart = call(client, 'POST', '/api/client/carts', 'tok-cli-a').get_json()['id']
    assert call(client, 'POST', f'/api/client/carts/{cart}/items', 'tok-cli-a', json={'product_id': {'x': 1}}).status_code == 400
    assert call(client, 'POST', f'/api/client/carts/{cart}/items', 'tok-cli-a', json={'product_id': world['product_id'], 'quantity': True}).status_code == 400
    assert call(client, 'GET', '/api/admin/stock/moves?product_id=abc', 'tok-admin').status_code == 400


# --- bcrypt e transição de senhas -----------------------------------------------------------------

def test_new_passwords_use_bcrypt(client, world):
    call(client, 'POST', '/api/client/register', json={'name': 'Novo', 'email': 'novo@t.com', 'password': 'Senha123'})
    assert Client.query.filter_by(email='novo@t.com').one().password.startswith('$2b$')
    assert User.query.filter_by(username='admin').one().password.startswith('$2b$')


@pytest.mark.parametrize('kind', ['user', 'client'])
def test_legacy_hash_still_logs_in_and_is_upgraded(client, world, kind):
    legacy = generate_password_hash('Antiga123')
    if kind == 'user':
        account = User(username='legado', email='legado@t.com', password=legacy, rules=[db.session.get(Rule, world['admin_rule_id'])])
        login = ('/api/admin/login', {'username': 'legado'})
    else:
        account = Client(name='Legado', email='legado@t.com', password=legacy)
        login = ('/api/client/login', {'email': 'legado@t.com'})
    db.session.add(account)
    db.session.commit()
    model = type(account)

    assert call(client, 'POST', login[0], json={**login[1], 'password': 'errada'}).status_code == 401
    db.session.expire_all()
    assert model.query.filter_by(email='legado@t.com').one().password == legacy   # wrong password changes nothing
    assert call(client, 'POST', login[0], json={**login[1], 'password': 'Antiga123'}).status_code == 200
    db.session.expire_all()
    upgraded = model.query.filter_by(email='legado@t.com').one().password
    assert upgraded.startswith('$2b$')
    assert call(client, 'POST', login[0], json={**login[1], 'password': 'Antiga123'}).status_code == 200


def test_legacy_password_longer_than_bcrypt_limit_keeps_working(client, world):
    long_password = 'x' * 80
    db.session.add(Client(name='Longo', email='longo@t.com', password=generate_password_hash(long_password)))
    db.session.commit()
    assert call(client, 'POST', '/api/client/login', json={'email': 'longo@t.com', 'password': long_password}).status_code == 200
    db.session.expire_all()
    assert not Client.query.filter_by(email='longo@t.com').one().password.startswith('$2b$')


# --- Seed idempotente -----------------------------------------------------------------------------

def test_seed_is_idempotent_and_keeps_existing_admin(app, monkeypatch):
    import seeds.seed_data as seed_module
    monkeypatch.setattr(seed_module, 'create_app', lambda: app)
    seed_module.seed_data()
    admin = User.query.filter_by(username='admin').one()
    admin.set_password('TrocadaPeloUsuario1')
    db.session.commit()
    counts = [Product.query.count(), Stock.query.count(), StockMove.query.count(), Permission.query.count(), Rule.query.count()]
    stock_levels = {s.id: s.quantity for s in Stock.query.all()}

    seed_module.seed_data()
    db.session.expire_all()
    assert [Product.query.count(), Stock.query.count(), StockMove.query.count(), Permission.query.count(), Rule.query.count()] == counts
    assert {s.id: s.quantity for s in Stock.query.all()} == stock_levels
    assert User.query.filter_by(username='admin').one().check_password('TrocadaPeloUsuario1')
    for stock in Stock.query.all():
        assert stock.quantity == sum(m.quantity_change for m in StockMove.query.filter_by(stock_id=stock.id))
