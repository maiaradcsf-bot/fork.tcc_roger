from app.models import db
from datetime import datetime

class StockMove(db.Model):
    __tablename__ = 'stock_moves'

    id = db.Column(db.Integer, primary_key=True)
    stock_id = db.Column(db.Integer, db.ForeignKey('stock.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    quantity_change = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.String(255), nullable=True)
    move_type = db.Column(db.String(20), nullable=False, default='entrada')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_reversal = db.Column(db.Boolean, nullable=False, default=False)
    original_move_id = db.Column(db.Integer, db.ForeignKey('stock_moves.id'), nullable=True)
    reverted_at = db.Column(db.DateTime, nullable=True)
    reverted_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=True)

    stock = db.relationship('Stock', back_populates='moves')
    user = db.relationship('User', foreign_keys=[user_id])
    reverted_by = db.relationship('User', foreign_keys=[reverted_by_user_id])
    original_move = db.relationship('StockMove', remote_side=[id], foreign_keys=[original_move_id])
    order = db.relationship('Order', foreign_keys=[order_id])

    def revert(self, user_id, reason):
        """Undo this move on its stock and return the reversal move (not yet added to the session).

        The caller must hold row locks on this move and its stock and ensure the
        resulting stock quantity is not negative.
        """
        reversal_change = -self.quantity_change
        self.stock.quantity = (self.stock.quantity or 0) + reversal_change
        self.reverted_at = datetime.utcnow()
        self.reverted_by_user_id = user_id
        return StockMove(
            stock=self.stock,
            quantity_change=reversal_change,
            reason=reason,
            move_type='entrada' if reversal_change > 0 else 'saida',
            user_id=user_id,
            is_reversal=True,
            original_move_id=self.id,
            order_id=self.order_id,
        )
