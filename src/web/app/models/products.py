from app.models import db
from datetime import datetime

class Product(db.Model):
    __tablename__ = 'products'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    price = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    barcode = db.Column(db.String(64), nullable=True, unique=True)
    min_stock = db.Column(db.Integer, nullable=True, default=0)
    max_stock = db.Column(db.Integer, nullable=True)
    photo_path = db.Column(db.String(255), nullable=True)
    deleted_at = db.Column(db.DateTime, nullable=True)

    categories = db.relationship('Category', secondary='product_categories', back_populates='products')
    stock = db.relationship('Stock', back_populates='product', uselist=False)
    order_items = db.relationship('OrderItem', back_populates='product', lazy=True)

    def soft_delete(self):
        """Mark product as deleted without removing it from database"""
        self.deleted_at = datetime.utcnow()
