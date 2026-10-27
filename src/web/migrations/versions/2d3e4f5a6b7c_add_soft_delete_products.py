"""add soft delete to products

Revision ID: 2d3e4f5a6b7c
Revises: 1c2d3e4f5a6b
Create Date: 2026-05-30 00:00:02.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '2d3e4f5a6b7c'
down_revision = '1c2d3e4f5a6b'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('products', sa.Column('deleted_at', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column('products', 'deleted_at')
