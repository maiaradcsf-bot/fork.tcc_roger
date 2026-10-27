from flask import Blueprint

# Blueprint principal para todas as rotas da API
api_bp = Blueprint('api', __name__, url_prefix='/api')

# Importar módulos que registram rotas no `api_bp` e registrar sub-blueprints
# Importações feitas aqui (após criação de `api_bp`) para evitar problemas de import circular.
from app.api import auth  # noqa: F401 (import for side-effects: registra rotas em api_bp)
from app.api import admin as admin_pkg, client as client_pkg  # noqa: F401

# Registrar blueprints aninhados para manter prefixos '/api/admin' e '/api/client'
api_bp.register_blueprint(admin_pkg.admin_bp)
api_bp.register_blueprint(client_pkg.client_bp)
