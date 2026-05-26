from flask import Flask, render_template, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from datetime import datetime
from config import Config  # Importa o arquivo de configuração criado

app = Flask(__name__)
app.config.from_object(Config) # Carrega as configurações da classe Config

db = SQLAlchemy(app) # Inicializa o Banco de Dados
migrate = Migrate(app, db) # Inicializa o sistema de migrations

# --- MODELOS DO BANCO DE DADOS ---

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    password = db.Column(db.String(255), nullable=False) 
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    sales = db.relationship('Sale', backref='buyer', lazy=True)


class Product(db.Model):
    __tablename__ = 'products'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    photo_path = db.Column(db.String(255), nullable=True) 
    description = db.Column(db.Text, nullable=True)
    price = db.Column(db.Numeric(10, 2), nullable=False, default=0.00) 
    
    sales = db.relationship('Sale', backref='product', lazy=True)


class Sale(db.Model):
    __tablename__ = 'sales'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    sale_date = db.Column(db.DateTime, default=datetime.utcnow)


@app.route("/")
def index():
    return render_template("index.html")

@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")

@app.route("/meus-pedidos")
def historico():
    return render_template("meus-pedidos.html")


@app.route('/api/users', methods=['GET'])
def listusers():
    data = {"users": ["admin", "cavalo"]}
    return jsonify(data)

@app.route('/api/products', methods=['GET'])
def listproducts():
    # 1. Busca todos os produtos cadastrados no banco de dados
    products_from_db = Product.query.all()
    
    # 2. Transforma os objetos do banco em uma lista de dicionários (JSON)
    products_list = []
    for product in products_from_db:
        products_list.append({
            "id": product.id,
            "nome": product.name,
            "photo_path": product.photo_path,
            "descricao": product.description,
            "price": float(product.price) if product.price else 0.00 # Convertendo Decimal para float
        })
    
    # 3. Retorna a lista vinda do banco
    return jsonify(products_list)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)