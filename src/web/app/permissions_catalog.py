"""Permissions and profiles the code depends on (checked by name in the routes and the frontend).

The seed creates them and the API refuses to rename or delete them, otherwise a rename would
silently break authorization checks.
"""

SYSTEM_PERMISSIONS = [
    ('admin.dashboard.view', 'Visualizar dashboard administrativo'),
    ('admin.categories.list', 'Listar categorias no admin'),
    ('admin.categories.create', 'Criar categorias no admin'),
    ('admin.categories.edit', 'Editar categorias no admin'),
    ('admin.categories.delete', 'Excluir categorias no admin'),
    ('admin.products.list', 'Listar produtos no admin'),
    ('admin.products.create', 'Criar produtos no admin'),
    ('admin.products.edit', 'Editar produtos no admin'),
    ('admin.products.delete', 'Excluir produtos no admin'),
    ('admin.products.import', 'Importar produtos via CSV no admin'),
    ('admin.stock.moves.list', 'Listar movimentações de estoque no admin'),
    ('admin.stock.moves.create', 'Registrar movimentações de estoque no admin'),
    ('admin.stock.moves.edit', 'Editar movimentações de estoque no admin'),
    ('admin.stock.moves.delete', 'Excluir movimentações de estoque no admin'),
    ('admin.orders.list', 'Listar pedidos no admin'),
    ('admin.orders.approve', 'Aprovar pedidos no admin'),
    ('admin.orders.reject', 'Rejeitar pedidos no admin'),
    ('admin.orders.cancel', 'Cancelar pedidos no admin'),
    ('admin.clients.list', 'Listar clientes no admin'),
    ('admin.clients.view', 'Visualizar dados de cliente no admin'),
    ('admin.clients.edit', 'Editar clientes no admin'),
    ('admin.settings.permissions.manage', 'Gerenciar permissões no admin'),
    ('admin.settings.profiles.manage', 'Gerenciar perfis no admin'),
    ('admin.settings.users.manage', 'Gerenciar usuários no admin'),
    ('clients.products.list', 'Listar produtos para clientes'),
    ('clients.products.view', 'Visualizar produto para cliente'),
    ('clients.products.request', 'Solicitar produto para cliente'),
    ('clients.orders.list', 'Listar solicitações para cliente'),
    ('clients.orders.view', 'Visualizar solicitação para cliente'),
    ('clients.orders.cancel', 'Cancelar solicitação para cliente'),
    ('clients.profile.view', 'Visualizar perfil do cliente'),
    ('clients.profile.edit', 'Editar perfil do cliente'),
    ('clients.cart.manage', 'Gerenciar carrinho do cliente'),
]

SYSTEM_PERMISSION_NAMES = {name for name, _ in SYSTEM_PERMISSIONS}

ADMIN_RULE_NAME = 'administrator'
CLIENT_RULE_NAME = 'cliente'
PROTECTED_RULE_NAMES = {ADMIN_RULE_NAME, CLIENT_RULE_NAME}
