"""add barcode and stock bounds to products

Revision ID: a9b8c7d6e5f4
Revises: 8c9d0e1f2a3b
Create Date: 2026-05-31 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a9b8c7d6e5f4'
down_revision = '8c9d0e1f2a3b'
branch_labels = None
depends_on = None


def upgrade():
    # Add barcode column (unique), min_stock (default 0) and max_stock
    op.add_column('products', sa.Column('barcode', sa.String(length=64), nullable=True))
    op.add_column('products', sa.Column('min_stock', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('products', sa.Column('max_stock', sa.Integer(), nullable=True))
    # Create unique constraint for barcode
    op.create_unique_constraint('uq_products_barcode', 'products', ['barcode'])


def downgrade():
    # Drop unique constraint and columns
    op.drop_constraint('uq_products_barcode', 'products', type_='unique')
    op.drop_column('products', 'max_stock')
    op.drop_column('products', 'min_stock')
    op.drop_column('products', 'barcode')
