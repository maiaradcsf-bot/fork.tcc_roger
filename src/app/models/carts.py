from app.models import db
from datetime import datetime

class Cart(db.Model):
    __tablename__ = 'carts'

    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
    status = db.Column(db.String(50), nullable=False, default='active')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    client = db.relationship('Client', back_populates='carts')
    items = db.relationship('CartItem', back_populates='cart', lazy=True)
    order = db.relationship('Order', back_populates='cart', uselist=False)
