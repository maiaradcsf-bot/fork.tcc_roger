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


def seed_data():
    app = create_app()
    with app.app_context():
        db.create_all()

        admin_permission = Permission(name='admin_access', description='Acesso administrativo completo')
        manage_products = Permission(name='manage_products', description='Gerenciar produtos e estoque')
        manage_orders = Permission(name='manage_orders', description='Gerenciar pedidos')
        manage_clients = Permission(name='manage_clients', description='Gerenciar clientes e endereços')

        administrator = Rule(name='administrator', description='Regra de administrador completo')
        administrator.permissions = [admin_permission, manage_products, manage_orders, manage_clients]

        admin_user = User(username='admin', email='admin@example.com', password='admin123')
        admin_user.rules = [administrator]

        category_food = Category(name='Foods', description='Food products')
        category_electronics = Category(name='Electronics', description='Electronic items')

        product_1 = Product(name='Coffee Beans', description='1kg specialty coffee', price=39.90)
        product_2 = Product(name='Wireless Headphones', description='Noise-cancelling headphones', price=199.90)

        product_1.categories = [category_food]
        product_2.categories = [category_electronics]

        client = Client(name='Customer Example', email='client@example.com', password='client123', phone='(11) 99999-0000')
        address_shipping = Address(street='Rua Principal, 100', city='São Paulo', state='SP', zipcode='01000-000', country='Brasil', address_type='shipping')
        address_billing = Address(street='Rua Secundária, 200', city='São Paulo', state='SP', zipcode='01000-001', country='Brasil', address_type='billing')
        client.addresses = [address_shipping, address_billing]

        db.session.add_all([admin_permission, manage_products, manage_orders, manage_clients, administrator, admin_user, category_food, category_electronics, product_1, product_2, client, address_shipping, address_billing])
        db.session.flush()

        stock_1 = Stock(product_id=product_1.id, quantity=50)
        stock_2 = Stock(product_id=product_2.id, quantity=30)
        db.session.add_all([stock_1, stock_2])
        db.session.flush()

        StockMove(stock=stock_1, quantity_change=50, reason='Initial inventory')
        StockMove(stock=stock_2, quantity_change=30, reason='Initial inventory')

        cart = Cart(client=client, status='checked_out')
        db.session.add(cart)
        db.session.flush()

        item_1 = CartItem(cart=cart, product=product_1, quantity=2)
        item_2 = CartItem(cart=cart, product=product_2, quantity=1)
        db.session.add_all([item_1, item_2])
        db.session.flush()

        order = Order(client=client, cart=cart, status='completed', total=round(2 * float(product_1.price) + 1 * float(product_2.price), 2))
        db.session.add(order)
        db.session.flush()

        order_item_1 = OrderItem(order=order, product=product_1, quantity=2, unit_price=product_1.price)
        order_item_2 = OrderItem(order=order, product=product_2, quantity=1, unit_price=product_2.price)
        db.session.add_all([order_item_1, order_item_2])

        db.session.commit()
        print('Seeds criados com sucesso!')


if __name__ == '__main__':
    seed_data()
