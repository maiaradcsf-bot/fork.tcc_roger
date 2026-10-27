"""add stock move revert fields

Revision ID: f6a7b8c9d0e1
Revises: d4e5f6a7b8c9
Create Date: 2026-07-28 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f6a7b8c9d0e1'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def _drop_foreign_keys(table, column):
    # Constraint names differ between databases created before and after the FKs were named
    inspector = sa.inspect(op.get_bind())
    for fk in inspector.get_foreign_keys(table):
        if fk['constrained_columns'] == [column]:
            op.drop_constraint(fk['name'], table, type_='foreignkey')


def upgrade():
    op.add_column('stock_moves', sa.Column('is_reversal', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('stock_moves', sa.Column('original_move_id', sa.Integer(), nullable=True))
    op.add_column('stock_moves', sa.Column('reverted_at', sa.DateTime(), nullable=True))
    op.add_column('stock_moves', sa.Column('reverted_by_user_id', sa.Integer(), nullable=True))

    op.create_foreign_key('fk_stock_moves_original_move_id', 'stock_moves', 'stock_moves', ['original_move_id'], ['id'])
    op.create_foreign_key('fk_stock_moves_reverted_by_user_id', 'stock_moves', 'users', ['reverted_by_user_id'], ['id'])


def downgrade():
    _drop_foreign_keys('stock_moves', 'reverted_by_user_id')
    _drop_foreign_keys('stock_moves', 'original_move_id')

    op.drop_column('stock_moves', 'reverted_by_user_id')
    op.drop_column('stock_moves', 'reverted_at')
    op.drop_column('stock_moves', 'original_move_id')
    op.drop_column('stock_moves', 'is_reversal')
