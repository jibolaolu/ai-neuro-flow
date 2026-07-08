"""
OCR service using pytesseract (Tesseract OCR engine).

Handles: PDF, PNG, JPG, TIFF, WEBP.
Falls back gracefully if Tesseract is not installed.
AWS Textract can be swapped in as the provider in production by setting
USE_TEXTRACT=true in .env and providing AWS_* credentials.
"""

from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)


class OCRService:
    def _tesseract_available(self) -> bool:
        try:
            import pytesseract
            from app.core.config import settings
            if settings.tesseract_cmd:
                pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd
            pytesseract.get_tesseract_version()
            return True
        except Exception:
            return False

    def extract_text(self, file_path: str) -> str:
        """
        Extract plain text from an image or PDF file.
        Returns empty string if extraction fails.
        """
        path = Path(file_path)
        if not path.exists():
            logger.warning("OCR: file not found: %s", file_path)
            return ""

        suffix = path.suffix.lower()

        if suffix == ".pdf":
            return self._extract_pdf(str(path))
        elif suffix in (".png", ".jpg", ".jpeg", ".tiff", ".tif", ".webp", ".bmp"):
            return self._extract_image(str(path))
        else:
            logger.warning("OCR: unsupported file type: %s", suffix)
            return ""

    def _extract_image(self, file_path: str) -> str:
        try:
            from PIL import Image
            import pytesseract
            img = Image.open(file_path)
            text = pytesseract.image_to_string(img, lang="eng")
            logger.info("OCR image: %s chars from %s", len(text), file_path)
            return text.strip()
        except ImportError:
            logger.warning("pytesseract/Pillow not installed — OCR disabled")
            return ""
        except Exception as exc:
            logger.error("OCR image failed [%s]: %s", file_path, exc)
            return ""

    def _extract_pdf(self, file_path: str) -> str:
        """Extract text from a PDF — first try native text layer, then OCR each page."""
        extracted: list[str] = []

        # 1. Try native PDF text extraction first (no OCR needed for digital PDFs)
        try:
            import io
            try:
                from pypdf import PdfReader  # pypdf >= 3.x
            except ImportError:
                from PyPDF2 import PdfReader  # type: ignore[no-redef]

            reader = PdfReader(file_path)
            for page in reader.pages:
                t = page.extract_text() or ""
                if t.strip():
                    extracted.append(t.strip())
            if extracted:
                logger.info("PDF native text: %d pages from %s", len(extracted), file_path)
                return "\n\n".join(extracted)
        except ImportError:
            pass  # no pdf library; fall through to OCR
        except Exception as exc:
            logger.warning("PDF native extraction failed, trying OCR: %s", exc)

        # 2. Fall back to Tesseract OCR on each page rendered as image
        try:
            from PIL import Image
            import pytesseract

            try:
                import pdf2image  # type: ignore
                pages = pdf2image.convert_from_path(file_path, dpi=200)
                for page_img in pages:
                    t = pytesseract.image_to_string(page_img, lang="eng")
                    if t.strip():
                        extracted.append(t.strip())
                logger.info("PDF OCR: %d pages from %s", len(pages), file_path)
            except ImportError:
                # pdf2image not available — just try the first page as image
                img = Image.open(file_path)
                t = pytesseract.image_to_string(img, lang="eng")
                extracted.append(t.strip())
        except Exception as exc:
            logger.error("PDF OCR failed [%s]: %s", file_path, exc)

        return "\n\n".join(extracted)

    def extract_structured(self, file_path: str) -> dict:
        """
        Extract text and attempt basic structure detection (tables, sections).
        Returns {text, sections, tables, page_count}.
        """
        text = self.extract_text(file_path)
        lines = [l for l in text.splitlines() if l.strip()]

        # Heuristic: lines that are all caps or end with ':' are likely headings
        sections: list[str] = []
        for line in lines:
            stripped = line.strip()
            if len(stripped) < 60 and (stripped.isupper() or stripped.endswith(":")):
                sections.append(stripped)

        return {
            "text":       text,
            "char_count": len(text),
            "line_count": len(lines),
            "sections":   sections[:20],  # cap at 20 headings
        }


# Module-level singleton
ocr_service = OCRService()
