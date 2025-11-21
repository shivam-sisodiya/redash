"""add new table

Revision ID: 01fc772d1ca4
Revises: db0aca1ebd32
Create Date: 2025-11-20 23:36:03.160991

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '01fc772d1ca4'
down_revision = 'db0aca1ebd32'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "query_results",
        sa.Column("bucket_url", sa.Text(), nullable=True)
    )


def downgrade():
    op.drop_column("query_results", "bucket_url")

