"""rename heygen_video_id to job_id

Revision ID: 0001
Revises:
Create Date: 2025-01-01 00:00:00
"""
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("videos", "heygen_video_id", new_column_name="job_id")


def downgrade() -> None:
    op.alter_column("videos", "job_id", new_column_name="heygen_video_id")
