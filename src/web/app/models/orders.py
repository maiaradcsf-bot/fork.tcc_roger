from app.models import db
from datetime import datetime
from app.models.status_enums import OrderStatus

class Order(db.Model):
    __tablename__ = 'orders'

    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
    cart_id = db.Column(db.Integer, db.ForeignKey('carts.id'), nullable=False)
    status = db.Column(db.String(50), nullable=False, default=OrderStatus.PENDING.value)
    total = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    reason = db.Column(db.Text, nullable=True)

    approved_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    refused_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    refused_at = db.Column(db.DateTime, nullable=True)
    finished_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    finished_at = db.Column(db.DateTime, nullable=True)
    canceled_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    canceled_client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=True)
    canceled_at = db.Column(db.DateTime, nullable=True)

    client = db.relationship('Client', back_populates='orders', foreign_keys=[client_id])
    cart = db.relationship('Cart', back_populates='order', uselist=False)
    items = db.relationship('OrderItem', back_populates='order', lazy=True)
    approved_by = db.relationship('User', foreign_keys=[approved_user_id])
    refused_by = db.relationship('User', foreign_keys=[refused_user_id])
    finished_by = db.relationship('User', foreign_keys=[finished_user_id])
    canceled_by = db.relationship('User', foreign_keys=[canceled_user_id])
    canceled_by_client = db.relationship('Client', foreign_keys=[canceled_client_id], back_populates='canceled_orders')
