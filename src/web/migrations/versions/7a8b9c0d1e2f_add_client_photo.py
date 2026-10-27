"""add client profile photo

Revision ID: 7a8b9c0d1e2f
Revises: 0a1b2c3d4e5f
Create Date: 2026-05-31 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '7a8b9c0d1e2f'
down_revision = '0a1b2c3d4e5f'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('clients', sa.Column('photo_path', sa.String(length=255), nullable=True))


def downgrade():
    op.drop_column('clients', 'photo_path')
