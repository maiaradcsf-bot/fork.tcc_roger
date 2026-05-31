import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app
from app.models import db
from app.models.users import User
from app.models.rules import Rule
from app.models.permissions import Permission
from app.models.categories import Category
from app.models.products import Product
from app.models.stock import Stock
from app.models.stock_moves import StockMove
from app.models.clients import Client
from app.models.addresses import Address
from app.models.carts import Cart
from app.models.cart_items import CartItem
from app.models.orders import Order
from app.models.order_items import OrderItem
from app.models.client_rules import ClientRule
from app.models.status_enums import CartStatus, OrderStatus


def seed_data():
    app = create_app()
    with app.app_context():
        db.create_all()

        def get_or_create(model, defaults=None, **kwargs):
            instance = model.query.filter_by(**kwargs).first()
            if instance:
                return instance, False
            params = dict(**kwargs)
            if defaults:
                params.update(defaults)
            instance = model(**params)
            db.session.add(instance)
            db.session.flush()
            return instance, True

        admin_permission, _ = get_or_create(Permission, name='admin_access', defaults={'description': 'Acesso administrativo completo'})
        manage_products, _ = get_or_create(Permission, name='manage_products', defaults={'description': 'Gerenciar produtos e estoque'})
        manage_orders, _ = get_or_create(Permission, name='manage_orders', defaults={'description': 'Gerenciar pedidos'})
        manage_clients, _ = get_or_create(Permission, name='manage_clients', defaults={'description': 'Gerenciar clientes e endereços'})

        administrator, created_admin_rule = get_or_create(Rule, name='administrator', defaults={'description': 'Regra de administrador completo'})
        if created_admin_rule:
            administrator.permissions = [admin_permission, manage_products, manage_orders, manage_clients]

        admin_user = User.query.filter_by(username='admin').first()
        if not admin_user:
            admin_user = User(username='admin', email='admin@example.com')
            admin_user.set_password('admin123')
            admin_user.rules = [administrator]
            db.session.add(admin_user)
            db.session.flush()

        category_food, _ = get_or_create(Category, name='Foods', defaults={'description': 'Food products'})
        category_electronics, _ = get_or_create(Category, name='Electronics', defaults={'description': 'Electronic items'})

        product_1, _ = get_or_create(Product, name='Coffee Beans', defaults={'description': '1kg specialty coffee', 'price': 39.90})
        product_2, _ = get_or_create(Product, name='Wireless Headphones', defaults={'description': 'Noise-cancelling headphones', 'price': 199.90})

        # ensure categories relationship
        if category_food not in product_1.categories:
            product_1.categories.append(category_food)
        if category_electronics not in product_2.categories:
            product_2.categories.append(category_electronics)

        # Perfil e permissões para clientes
        client_access, _ = get_or_create(Permission, name='client_access', defaults={'description': 'Acesso ao dashboard do cliente'})
        create_requests, _ = get_or_create(Permission, name='create_requests', defaults={'description': 'Permite criar solicitações de retirada'})
        view_products, _ = get_or_create(Permission, name='view_products', defaults={'description': 'Permite visualizar produtos'})

        client_rule, created_client_rule = get_or_create(Rule, name='client', defaults={'description': 'Regra de cliente'})
        if created_client_rule:
            client_rule.permissions = [client_access, create_requests, view_products]

        client, created_client = get_or_create(Client, email='client@example.com', defaults={'name': 'Customer Example', 'phone': '(11) 99999-0000'})
        if created_client:
            client.set_password('client123')
        address_shipping = Address(street='Rua Principal, 100', city='São Paulo', state='SP', zipcode='01000-000', country='Brasil', address_type='shipping')
        address_billing = Address(street='Rua Secundária, 200', city='São Paulo', state='SP', zipcode='01000-001', country='Brasil', address_type='billing')
        client.addresses = [address_shipping, address_billing]

        # ensure basic objects are flushed/committed
        db.session.flush()

        stock_1 = Stock.query.filter_by(product_id=product_1.id).first()
        if not stock_1:
            stock_1 = Stock(product_id=product_1.id, quantity=50)
            db.session.add(stock_1)
        stock_2 = Stock.query.filter_by(product_id=product_2.id).first()
        if not stock_2:
            stock_2 = Stock(product_id=product_2.id, quantity=30)
            db.session.add(stock_2)
        db.session.flush()

        StockMove(stock=stock_1, quantity_change=50, reason='Initial inventory')
        StockMove(stock=stock_2, quantity_change=30, reason='Initial inventory')

        # create a sample cart and order only if not present for this client
        existing_order = Order.query.filter_by(client_id=client.id).first()
        if not existing_order:
            cart = Cart(client=client, status=CartStatus.CLOSED.value)
            db.session.add(cart)
            db.session.flush()

            item_1 = CartItem(cart=cart, product=product_1, quantity=2)
            item_2 = CartItem(cart=cart, product=product_2, quantity=1)
            db.session.add_all([item_1, item_2])
            db.session.flush()

            order = Order(client=client, cart=cart, status=OrderStatus.FINISHED.value, total=round(2 * float(product_1.price) + 1 * float(product_2.price), 2))
            db.session.add(order)
            db.session.flush()

            order_item_1 = OrderItem(order=order, product=product_1, quantity=2, unit_price=product_1.price)
            order_item_2 = OrderItem(order=order, product=product_2, quantity=1, unit_price=product_2.price)
            db.session.add_all([order_item_1, order_item_2])

        # vincular cliente de exemplo à regra de cliente
        try:
            assoc = ClientRule(client_id=client.id, rule_id=client_rule.id)
            db.session.add(assoc)
        except Exception:
            pass

        db.session.commit()
        print('Seeds criados com sucesso!')


if __name__ == '__main__':
    seed_data()
