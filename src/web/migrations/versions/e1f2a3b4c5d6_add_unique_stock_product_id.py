"""add unique constraint on stock.product_id

Revision ID: e1f2a3b4c5d6
Revises: b7c8d9e0f1a2
Create Date: 2026-10-16 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'e1f2a3b4c5d6'
down_revision = 'b7c8d9e0f1a2'
branch_labels = None
depends_on = None


def upgrade():
    # Refuse to run instead of silently merging or deleting stock rows: duplicates must be
    # reviewed by hand because each row may have its own movement history
    duplicates = op.get_bind().execute(sa.text(
        'SELECT product_id, COUNT(*) AS total FROM stock GROUP BY product_id HAVING COUNT(*) > 1'
    )).fetchall()
    if duplicates:
        listed = ', '.join(f'produto {row[0]} ({row[1]} registros)' for row in duplicates)
        raise RuntimeError(f'Existem registros de estoque duplicados; corrija antes de migrar: {listed}')

    op.create_unique_constraint('uq_stock_product_id', 'stock', ['product_id'])


def downgrade():
    # MySQL may drop the implicit foreign key index once the unique index covers product_id,
    # so a plain index has to exist before the unique one can be removed
    op.create_index('ix_stock_product_id', 'stock', ['product_id'])
    op.drop_constraint('uq_stock_product_id', 'stock', type_='unique')
