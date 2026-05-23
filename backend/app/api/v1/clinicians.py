from fastapi import APIRouter

from app.models.clinician import Clinician

router = APIRouter()


@router.get("/")
def list_clinicians() -> dict[str, list[dict[str, object]]]:
    sample = Clinician(
        id="clinician-001",
        first_name="Jordan",
        last_name="Lee",
        specialty="Autism",
        license_number="LIC-1001",
    )
    return {"items": [sample.model_dump()]}
