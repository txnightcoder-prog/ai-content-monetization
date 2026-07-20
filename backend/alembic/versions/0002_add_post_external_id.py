"""add external_id to posts

Revision ID: 0002
Revises: 0001
Create Date: 2025-07-20 00:00:00
"""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "posts",
        sa.Column("external_id", sa.String(255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("posts", "external_id")
