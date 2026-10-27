"""merge alembic heads

Revision ID: 8c9d0e1f2a3b
Revises: 6b7c8d9e0f1a, 7a8b9c0d1e2f
Create Date: 2026-06-01 02:15:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '8c9d0e1f2a3b'
down_revision = ('6b7c8d9e0f1a', '7a8b9c0d1e2f')
branch_labels = None
depends_on = None


def upgrade():
    # merge-only revision: no DB changes required
    pass


def downgrade():
    # nothing to revert
    pass
