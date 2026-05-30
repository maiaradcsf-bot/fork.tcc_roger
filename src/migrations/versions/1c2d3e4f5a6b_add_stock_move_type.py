"""add stock move type field

Revision ID: 1c2d3e4f5a6b
Revises: 0a1b2c3d4e5f
Create Date: 2026-05-30 00:00:01.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '1c2d3e4f5a6b'
down_revision = '0a1b2c3d4e5f'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('stock_moves', sa.Column('move_type', sa.String(20), nullable=True, server_default='entrada'))


def downgrade():
    op.drop_column('stock_moves', 'move_type')
