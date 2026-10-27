"""add client active flag

Revision ID: 0a1b2c3d4e5f
Revises: 69661f5b7d10
Create Date: 2026-05-30 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0a1b2c3d4e5f'
down_revision = '69661f5b7d10'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('clients', sa.Column('active', sa.Boolean(), nullable=False, server_default=sa.text('1')))


def downgrade():
    op.drop_column('clients', 'active')
