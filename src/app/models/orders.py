from app.models import db
from datetime import datetime

class Order(db.Model):
    __tablename__ = 'orders'

    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
    cart_id = db.Column(db.Integer, db.ForeignKey('carts.id'), nullable=False)
    status = db.Column(db.String(50), nullable=False, default='pending')
    total = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    client = db.relationship('Client', back_populates='orders')
    cart = db.relationship('Cart', back_populates='order', uselist=False)
    items = db.relationship('OrderItem', back_populates='order', lazy=True)
