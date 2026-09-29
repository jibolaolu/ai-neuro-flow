"""
Transparent file-storage abstraction.

- When settings.s3_bucket_name is set  → uploads go to S3; downloads are presigned URLs.
- When it is empty                       → falls back to local filesystem (dev / tests).

S3 key convention: clients/{client_id}/{uuid}{suffix}
This matches the local path structure so stored_rel_path is valid in both modes.
"""
from __future__ import annotations

import io
import uuid
from pathlib import Path, PurePosixPath
from typing import AsyncIterator

from fastapi import HTTPException, status


def _s3_client():
    import boto3  # lazy import so local dev without boto3 still works
    from app.core.config import settings
    return boto3.client("s3", region_name=settings.aws_region)


def use_s3() -> bool:
    from app.core.config import settings
    return bool(settings.s3_bucket_name)


async def store_upload(
    file_data: bytes,
    client_id: str,
    suffix: str,
    mime_type: str,
) -> str:
    """
    Persist uploaded bytes and return the storage key / relative path.
    For S3: returns the S3 object key.
    For local: returns the relative path under document_upload_root().
    """
    stored_name = f"{uuid.uuid4().hex}{suffix}"
    rel_path = f"{client_id}/{stored_name}"

    if use_s3():
        from app.core.config import settings
        s3 = _s3_client()
        s3.put_object(
            Bucket=settings.s3_bucket_name,
            Key=rel_path,
            Body=file_data,
            ContentType=mime_type,
            ServerSideEncryption="AES256",
        )
    else:
        from app.core.config import document_upload_root
        root = document_upload_root()
        client_dir = root / client_id
        client_dir.mkdir(parents=True, exist_ok=True)
        abs_path = (client_dir / stored_name).resolve()
        abs_path.write_bytes(file_data)

    return rel_path


def presigned_url(rel_path: str, original_filename: str, mime_type: str, expiry: int) -> str:
    """Generate a presigned GET URL for an S3-stored document."""
    from app.core.config import settings
    s3 = _s3_client()
    return s3.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.s3_bucket_name,
            "Key": rel_path,
            "ResponseContentDisposition": f'inline; filename="{original_filename}"',
            "ResponseContentType": mime_type,
        },
        ExpiresIn=expiry,
    )


def local_file_path(rel_path: str) -> Path:
    """Resolve and validate a local filesystem path. Raises 404 if outside root or missing."""
    from app.core.config import document_upload_root
    root = document_upload_root().resolve()
    full = (root / rel_path).resolve()
    try:
        full.relative_to(root)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found") from None
    if not full.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File missing on server")
    return full


# ── Report PDF helpers ────────────────────────────────────────────────────────

_REPORT_S3_PREFIX = "reports/"


def _is_s3_key(path_or_key: str) -> bool:
    """True when stored value is an S3 key rather than a local absolute path."""
    return not path_or_key.startswith("/") and not Path(path_or_key).is_absolute()


def store_report_pdf(report_id: str, pdf_bytes: bytes) -> str:
    """
    Persist a generated report PDF and return the storage reference.
    S3:    returns the S3 key  (e.g. "reports/RPT-abc123.pdf")
    Local: returns the absolute path string (legacy behaviour).
    """
    if use_s3():
        from app.core.config import settings
        key = f"{_REPORT_S3_PREFIX}{report_id}.pdf"
        _s3_client().put_object(
            Bucket=settings.s3_bucket_name,
            Key=key,
            Body=pdf_bytes,
            ContentType="application/pdf",
            ServerSideEncryption="AES256",
        )
        return key
    else:
        from app.core.config import document_upload_root
        upload_root = document_upload_root() / "reports"
        upload_root.mkdir(parents=True, exist_ok=True)
        pdf_path = upload_root / f"{report_id}.pdf"
        pdf_path.write_bytes(pdf_bytes)
        return str(pdf_path)


def read_report_pdf(pdf_path_or_key: str) -> bytes:
    """
    Read a report PDF from wherever it was stored.
    Raises HTTPException 404 if not found.
    """
    if use_s3() and _is_s3_key(pdf_path_or_key):
        from app.core.config import settings
        try:
            obj = _s3_client().get_object(
                Bucket=settings.s3_bucket_name,
                Key=pdf_path_or_key,
            )
            return obj["Body"].read()
        except Exception:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report PDF not available") from None
    else:
        p = Path(pdf_path_or_key)
        if not p.is_file():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report PDF not available")
        return p.read_bytes()


def report_pdf_exists(pdf_path_or_key: str) -> bool:
    """Non-raising existence check for a stored report PDF."""
    if not pdf_path_or_key:
        return False
    if use_s3() and _is_s3_key(pdf_path_or_key):
        from app.core.config import settings
        try:
            _s3_client().head_object(
                Bucket=settings.s3_bucket_name,
                Key=pdf_path_or_key,
            )
            return True
        except Exception:
            return False
    return Path(pdf_path_or_key).is_file()
