from app.models import db
from datetime import datetime

class StockMove(db.Model):
    __tablename__ = 'stock_moves'

    id = db.Column(db.Integer, primary_key=True)
    stock_id = db.Column(db.Integer, db.ForeignKey('stock.id'), nullable=False)
    quantity_change = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.String(255), nullable=True)
    move_type = db.Column(db.String(20), nullable=False, default='entrada')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    stock = db.relationship('Stock', back_populates='moves')
