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
    return render_template("dashboard.html", active_page='dashboard')

@views_bp.route("/admin/orders")
def orders():
    return render_template("orders.html", active_page='orders')

@views_bp.route("/admin/categories")
def categories():
    return render_template("categories.html", active_page='categories')

@views_bp.route("/admin/products")
def products():
    return render_template("products.html", active_page='products')

@views_bp.route("/admin/clients")
def clients():
    return render_template("clients.html", active_page='clients')

@views_bp.route("/admin/settings")
def settings():
    return render_template("settings.html", active_page='settings')

@views_bp.route("/admin/settings/users")
def settings_users():
    return render_template("settings/users.html", active_page='settings')

@views_bp.route("/admin/settings/permissions")
def settings_permissions():
    return render_template("settings/permissions.html", active_page='settings')

@views_bp.route("/admin/settings/profiles")
def settings_profiles():
    return render_template("settings/profiles.html", active_page='settings')


@views_bp.route('/client/dashboard')
def client_dashboard():
    return render_template('client_dashboard.html', active_page='client_dashboard')


@views_bp.route('/client/products')
def client_products():
    return render_template('client_products.html', active_page='client_products')


@views_bp.route('/client/meus-pedidos')
def client_meus_pedidos():
    return render_template('meus-pedidos.html', active_page='client_orders')
