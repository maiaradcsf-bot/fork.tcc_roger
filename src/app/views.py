from flask import Blueprint, render_template

views_bp = Blueprint('views', __name__, template_folder='templates')

@views_bp.route("/")
def index():
    return render_template("index.html")

@views_bp.route("/register")
def register():
    return render_template("register.html")

@views_bp.route("/login")
def login():
    return render_template("index.html")

@views_bp.route("/dashboard")
@views_bp.route("/admin")
def dashboard():
    return render_template("admin/modules/dashboard/index.html", active_page='dashboard')

@views_bp.route("/admin/orders")
def orders():
    return render_template("admin/modules/orders/index.html", active_page='orders')

@views_bp.route("/admin/categories")
def categories():
    return render_template("admin/modules/categories/index.html", active_page='categories')

@views_bp.route("/admin/products")
def products():
    return render_template("admin/modules/products/index.html", active_page='products')


@views_bp.route('/admin/products/stock-moves')
def products_stock_moves():
    return render_template('admin/modules/products/stock_moves.html', active_page='stock_moves')

@views_bp.route("/admin/clients")
def clients():
    return render_template("admin/modules/clients/index.html", active_page='clients')

@views_bp.route("/admin/settings")
def settings():
    return render_template("admin/modules/settings/index.html", active_page='settings')

@views_bp.route("/admin/settings/users")
def settings_users():
    return render_template("admin/modules/settings/users/index.html", active_page='settings')

@views_bp.route("/admin/settings/permissions")
def settings_permissions():
    return render_template("admin/modules/settings/permissions/index.html", active_page='settings')

@views_bp.route("/admin/settings/profiles")
def settings_profiles():
    return render_template("admin/modules/settings/profiles/index.html", active_page='settings')


@views_bp.route('/client')
@views_bp.route('/client/dashboard')
def client_dashboard():
    return render_template('client/modules/dashboard/index.html', active_page='client_dashboard')


@views_bp.route('/client/products')
def client_products():
    return render_template('client/modules/products/index.html', active_page='client_products')


@views_bp.route('/client/meus-pedidos')
def client_meus_pedidos():
    return render_template('client/modules/orders/index.html', active_page='client_orders')

@views_bp.route('/client/perfil')
def client_profile():
    return render_template('client/modules/profile/index.html', active_page='client_profile')
