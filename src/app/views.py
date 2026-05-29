from flask import Blueprint, render_template

views_bp = Blueprint('views', __name__)

@views_bp.route("/")
def index():
    return render_template("index.html")

@views_bp.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")

@views_bp.route("/clientes")
def clientes():
    return render_template("clientes.html")

@views_bp.route("/meus-pedidos")
def historico():
    return render_template("meus-pedidos.html")