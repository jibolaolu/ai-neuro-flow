from pydantic import BaseModel


class Clinician(BaseModel):
    id: str
    first_name: str
    last_name: str
    specialty: str
    license_number: str
