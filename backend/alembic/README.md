# Database Migrations

This directory contains Alembic database migrations for the AI Content Monetization system.

## Setup

1. Ensure PostgreSQL is running
2. Update `DATABASE_URL` in `.env` file
3. Install dependencies: `pip install -r requirements.txt`

## Creating Migrations

### Auto-generate migration from model changes:
```bash
cd backend
alembic revision --autogenerate -m "description of changes"
```

### Create empty migration:
```bash
alembic revision -m "description"
```

## Running Migrations

### Upgrade to latest:
```bash
alembic upgrade head
```

### Upgrade one version:
```bash
alembic upgrade +1
```

### Downgrade one version:
```bash
alembic downgrade -1
```

### Show current version:
```bash
alembic current
```

### Show migration history:
```bash
alembic history
```

## Initial Migration

To create the initial database schema:

```bash
# From backend directory
alembic revision --autogenerate -m "Initial schema"
alembic upgrade head
```

This will create all tables:
- content_scripts
- videos
- posts
- leads
- products
- conversions
- analytics
- integrations

## Migration Files

Migration files are stored in `alembic/versions/` directory.

Each migration has:
- `upgrade()` - Apply changes
- `downgrade()` - Revert changes

## Environment Variables

The migration system reads `DATABASE_URL` from environment variables.

Example:
```
DATABASE_URL=postgresql://admin:password@localhost:5432/content_monetization
```

For Azure deployment, this will be set automatically.