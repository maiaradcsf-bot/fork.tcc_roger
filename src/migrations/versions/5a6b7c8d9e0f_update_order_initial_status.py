"""update order initial status

Revision ID: 5a6b7c8d9e0f
Revises: 4f5a6b7c8d9e
Create Date: 2026-05-31 21:25:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5a6b7c8d9e0f'
down_revision = '4f5a6b7c8d9e'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        'orders',
        'status',
        existing_type=sa.String(length=50),
        nullable=False,
        server_default='initial',
    )
    op.execute("UPDATE orders SET status = 'initial' WHERE status = 'pending'")


def downgrade():
    op.execute("UPDATE orders SET status = 'pending' WHERE status = 'initial'")
    op.alter_column(
        'orders',
        'status',
        existing_type=sa.String(length=50),
        nullable=False,
        server_default=None,
    )
