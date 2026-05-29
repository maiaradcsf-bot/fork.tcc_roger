from app.models import db
from datetime import datetime

class Client(db.Model):
    __tablename__ = 'clients'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(50), nullable=True)
    auth_token = db.Column(db.String(255), unique=True, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    carts = db.relationship('Cart', back_populates='client', lazy=True)
    orders = db.relationship('Order', back_populates='client', lazy=True)
    addresses = db.relationship('Address', secondary='client_addresses', back_populates='clients')
