from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import settings
from app.db.base import Base

# Import all models so their tables are reflected in metadata
import app.models.user  # noqa: F401
import app.models.client  # noqa: F401
import app.models.organization  # noqa: F401
import app.models.form_token  # noqa: F401
import app.models.referral  # noqa: F401
import app.models.clinical_report  # noqa: F401
import app.models.invoice  # noqa: F401
import app.models.assessment  # noqa: F401
import app.models.audit_log  # noqa: F401
import app.models.message  # noqa: F401
import app.models.notification  # noqa: F401
import app.models.newsfeed  # noqa: F401
import app.models.nps_survey  # noqa: F401
import app.models.policy  # noqa: F401
import app.models.hr  # noqa: F401
import app.models.second_opinion  # noqa: F401
import app.models.system_setting  # noqa: F401
import app.models.email_triage  # noqa: F401
import app.models.client_portal_message  # noqa: F401
import app.models.waitlist  # noqa: F401 - may not exist yet

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url() -> str:
    return settings.database_url


def run_migrations_offline() -> None:
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = get_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
