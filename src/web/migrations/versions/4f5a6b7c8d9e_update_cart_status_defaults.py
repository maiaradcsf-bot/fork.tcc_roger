"""update cart status defaults

Revision ID: 4f5a6b7c8d9e
Revises: 3e4f5a6b7c8d
Create Date: 2026-05-31 21:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4f5a6b7c8d9e'
down_revision = '3e4f5a6b7c8d'
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
    op.execute("UPDATE carts SET status = 'open' WHERE status = 'active'")
    op.execute("UPDATE carts SET status = 'closed' WHERE status = 'checked_out'")


def downgrade():
    op.execute("UPDATE carts SET status = 'active' WHERE status = 'open'")
    op.execute("UPDATE carts SET status = 'checked_out' WHERE status = 'closed'")
    op.alter_column(
        'carts',
        'status',
        existing_type=sa.String(length=50),
        nullable=False,
        server_default=None,
    )
