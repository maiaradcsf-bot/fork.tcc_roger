"""add audit fields to orders and stock moves

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('orders', sa.Column('approved_user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True))
    op.add_column('orders', sa.Column('approved_at', sa.DateTime(), nullable=True))
    op.add_column('orders', sa.Column('refused_user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True))
    op.add_column('orders', sa.Column('refused_at', sa.DateTime(), nullable=True))
    op.add_column('orders', sa.Column('finished_user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True))
    op.add_column('orders', sa.Column('finished_at', sa.DateTime(), nullable=True))
    op.add_column('orders', sa.Column('canceled_user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True))
    op.add_column('orders', sa.Column('canceled_client_id', sa.Integer(), sa.ForeignKey('clients.id'), nullable=True))
    op.add_column('orders', sa.Column('canceled_at', sa.DateTime(), nullable=True))
    op.add_column('stock_moves', sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True))


def downgrade():
    op.drop_column('stock_moves', 'user_id')
    op.drop_column('orders', 'canceled_at')
    op.drop_column('orders', 'canceled_client_id')
    op.drop_column('orders', 'canceled_user_id')
    op.drop_column('orders', 'finished_at')
    op.drop_column('orders', 'finished_user_id')
    op.drop_column('orders', 'refused_at')
    op.drop_column('orders', 'refused_user_id')
    op.drop_column('orders', 'approved_at')
    op.drop_column('orders', 'approved_user_id')
