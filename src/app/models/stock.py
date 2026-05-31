from app.models import db
from datetime import datetime
import logging
from sqlalchemy import event

class Stock(db.Model):
    __tablename__ = 'stock'

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    product = db.relationship('Product', back_populates='stock')
    moves = db.relationship('StockMove', back_populates='stock', lazy=True)


# Log any changes to Stock.quantity for debugging/audit
logger = logging.getLogger('sesi.stock')

@event.listens_for(Stock.quantity, 'set', retval=False)
def _log_stock_quantity_set(target, value, oldvalue, initiator):
    try:
        logger.info(f"[StockEvent] stock_id={getattr(target, 'id', None)} product_id={getattr(target, 'product_id', None)} {oldvalue} -> {value}")
    except Exception:
        logger.exception('Error while logging stock quantity change')
