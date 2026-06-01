from flask import Blueprint

client_bp = Blueprint('api_client', __name__, url_prefix='/client')

# Import client modules to register routes on client_bp
from app.api.client import profile, carts, orders, products  # noqa: F401
