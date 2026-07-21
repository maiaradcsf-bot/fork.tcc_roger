from flask import Blueprint

admin_bp = Blueprint('api_admin', __name__, url_prefix='/admin')

# Import modules that register routes on `admin_bp`
from app.api.admin import products, products_import, categories, stock, stock_moves, clients, users, permissions, rules, orders  # noqa: F401
