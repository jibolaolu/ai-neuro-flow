from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import all ORM models here so metadata.create_all() discovers them
from app.models import user as _user_models  # noqa: E402, F401
from app.models import client as _client_models  # noqa: E402, F401
from app.models import client_profile as _client_profile_models  # noqa: E402, F401
from app.models import form_token as _form_token_models  # noqa: E402, F401
from app.models import email_send_log as _email_send_log_models  # noqa: E402, F401
from app.models import clinician_availability as _clinician_availability_models  # noqa: E402, F401
from app.models import clinician_finance as _clinician_finance_models  # noqa: E402, F401
from app.models import client_case_note as _client_case_note_models  # noqa: E402, F401
from app.models import client_document as _client_document_models  # noqa: E402, F401
from app.models import pending_checkout as _pending_checkout_models  # noqa: E402, F401
from app.models import organization as _organization_models  # noqa: E402, F401
from app.models import support_ticket as _support_ticket_models  # noqa: E402, F401
