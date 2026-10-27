from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Importe todos os seus modelos aqui para o Flask-Migrate detectá-los
from app.models.users import User
from app.models.products import Product
from app.models.categories import Category
from app.models.product_categories import ProductCategory
from app.models.stock import Stock
from app.models.stock_moves import StockMove
from app.models.carts import Cart
from app.models.cart_items import CartItem
from app.models.orders import Order
from app.models.order_items import OrderItem
from app.models.clients import Client
from app.models.addresses import Address
from app.models.client_addresses import ClientAddress
from app.models.rules import Rule
from app.models.permissions import Permission
from app.models.rule_permissions import RulePermission
from app.models.user_rules import UserRule
from app.models.client_rules import ClientRule
