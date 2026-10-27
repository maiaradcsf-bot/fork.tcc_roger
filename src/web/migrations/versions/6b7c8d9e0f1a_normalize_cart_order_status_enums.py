"""normalize cart and order status enums

Revision ID: 6b7c8d9e0f1a
Revises: 5a6b7c8d9e0f
Create Date: 2026-05-31 21:45:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '6b7c8d9e0f1a'
down_revision = '5a6b7c8d9e0f'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        'carts',
        'status',
        existing_type=sa.String(length=50),
        nullable=False,
        server_default='open',
    )
    op.alter_column(
        'orders',
        'status',
        existing_type=sa.String(length=50),
        nullable=False,
        server_default='pending',
    )

    op.execute("UPDATE carts SET status = 'open' WHERE status IN ('active', 'aberto')")
    op.execute("UPDATE carts SET status = 'closed' WHERE status IN ('checked_out', 'checkout', 'finalizado', 'fechado')")

    op.execute("UPDATE orders SET status = 'pending' WHERE status IN ('initial', 'inicial', 'pendent', 'pendente')")
    op.execute("UPDATE orders SET status = 'approved' WHERE status IN ('aprovado')")
    op.execute("UPDATE orders SET status = 'finished' WHERE status IN ('completed', 'concluido', 'concluído', 'retirado', 'picked_up', 'withdrawn', 'checked_out')")


def downgrade():
    op.execute("UPDATE orders SET status = 'initial' WHERE status = 'pending'")
    op.execute("UPDATE orders SET status = 'completed' WHERE status = 'finished'")
    op.execute("UPDATE carts SET status = 'active' WHERE status = 'open'")
    op.execute("UPDATE carts SET status = 'checked_out' WHERE status = 'closed'")

    op.alter_column(
        'orders',
        'status',
        existing_type=sa.String(length=50),
        nullable=False,
        server_default='initial',
    )
    op.alter_column(
        'carts',
        'status',
        existing_type=sa.String(length=50),
        nullable=False,
        server_default='open',
    )
