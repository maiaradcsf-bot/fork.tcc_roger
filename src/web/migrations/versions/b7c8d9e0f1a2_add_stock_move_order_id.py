"""add stock move order id

Revision ID: b7c8d9e0f1a2
Revises: f6a7b8c9d0e1
Create Date: 2026-10-16 12:00:00.000000

"""
import re

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b7c8d9e0f1a2'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


ORDER_REASON_PATTERN = re.compile(r'^Solicitação de retirada #(\d+),')


def upgrade():
    op.add_column('stock_moves', sa.Column('order_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_stock_moves_order_id', 'stock_moves', 'orders', ['order_id'], ['id'])

    # Link existing order withdrawals to their order (they were only identified by the reason text)
    conn = op.get_bind()
    existing_order_ids = {row[0] for row in conn.execute(sa.text('SELECT id FROM orders'))}
    moves = conn.execute(sa.text(
        "SELECT id, reason FROM stock_moves WHERE reason LIKE 'Solicitação de retirada #%' AND quantity_change < 0"
    )).fetchall()
    for move_id, reason in moves:
        match = ORDER_REASON_PATTERN.match(reason or '')
        if match and int(match.group(1)) in existing_order_ids:
            conn.execute(
                sa.text('UPDATE stock_moves SET order_id = :order_id WHERE id = :move_id'),
                {'order_id': int(match.group(1)), 'move_id': move_id},
            )


def downgrade():
    op.drop_constraint('fk_stock_moves_order_id', 'stock_moves', type_='foreignkey')
    op.drop_column('stock_moves', 'order_id')
