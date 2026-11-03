import io
import re
import pymupdf
import docx

try:
    import olefile
except ImportError:
    olefile = None


def extract_text_from_pdf(pdf_bytes: bytes) -> dict:
    """
    Extract raw text from PDF bytes and check if document is a scanned image.
    """
    if not pdf_bytes:
        return {
            "success": False,
            "error": "Failed to parse PDF document: file is empty",
            "text": "",
            "is_scanned": False,
            "page_count": 0,
        }

    try:
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to parse PDF document: {str(e)}",
            "text": "",
            "is_scanned": False,
            "page_count": 0,
        }

    page_count = len(doc)
    text_content = []

    for page_num in range(page_count):
        page = doc[page_num]
        text_content.append(page.get_text())

    full_text = "\n".join(text_content).strip()

    # If the document has pages but contains fewer than 15 characters of extractable text,
    # it is almost certainly a scanned photo/image PDF without an OCR text layer.
    is_scanned = page_count > 0 and len(full_text.strip()) < 15

    scan_notice = ""
    if is_scanned:
        scan_notice = (
            "This PDF appears to be a scanned image or photo without an embedded text layer. "
            "To extract text from this document, Optical Character Recognition (OCR) would be required."
        )

    return {
        "success": True,
        "text": full_text,
        "page_count": page_count,
        "is_scanned": is_scanned,
        "scan_notice": scan_notice,
    }


def extract_text_from_docx(docx_bytes: bytes) -> dict:
    """
    Extract text from a DOCX document using python-docx.
    Traverses paragraphs and tables to extract all textual content.
    """
    if not docx_bytes:
        return {
            "success": False,
            "error": "Failed to parse DOCX document: file is empty",
            "text": "",
            "is_scanned": False,
            "page_count": 0,
        }

    try:
        doc = docx.Document(io.BytesIO(docx_bytes))
        paragraphs = []

        for p in doc.paragraphs:
            text = p.text.strip()
            if text:
                paragraphs.append(text)

        for table in doc.tables:
            for row in table.rows:
                cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                if cells:
                    # Deduplicate adjacent repeated cells from merged table layouts
                    deduped = []
                    for c in cells:
                        if not deduped or deduped[-1] != c:
                            deduped.append(c)
                    paragraphs.append(" | ".join(deduped))

        full_text = "\n".join(paragraphs).strip()
        is_scanned = len(full_text) < 15
        scan_notice = ""
        if is_scanned:
            scan_notice = (
                "This Word document contains little or no extractable text. "
                "It may contain scanned images without embedded text."
            )

        page_count = max(1, len(paragraphs) // 15 + 1)

        return {
            "success": True,
            "text": full_text,
            "page_count": page_count,
            "is_scanned": is_scanned,
            "scan_notice": scan_notice,
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to parse DOCX document: {str(e)}",
            "text": "",
            "is_scanned": False,
            "page_count": 0,
        }


def extract_text_from_doc(doc_bytes: bytes) -> dict:
    """
    Extract text from a legacy .doc file.
    1. First tries to parse as DOCX (in case it is an OpenXML file with a .doc extension).
    2. Then uses olefile to extract the WordDocument binary stream.
    3. Falls back to regex-based extraction of printable character sequences.
    """
    if not doc_bytes:
        return {
            "success": False,
            "error": "Failed to parse DOC document: file is empty",
            "text": "",
            "is_scanned": False,
            "page_count": 0,
        }

    # Attempt DOCX parser first (common when users save/rename .docx as .doc)
    try:
        res = extract_text_from_docx(doc_bytes)
        if res["success"] and len(res["text"]) >= 15:
            return res
    except Exception:
        pass

    extracted_lines = []

    # If olefile is available and it's a valid OLE file
    if olefile and olefile.isOleFile(io.BytesIO(doc_bytes)):
        try:
            with olefile.OleFileIO(io.BytesIO(doc_bytes)) as ole:
                if ole.exists("WordDocument"):
                    stream = ole.openstream("WordDocument").read()
                    matches = re.findall(rb"[\x20-\x7E\t\n\r]{3,}", stream)
                    for m in matches:
                        try:
                            s = m.decode("latin-1").strip()
                            if len(s) > 2 and any(c.isalnum() for c in s):
                                extracted_lines.append(s)
                        except Exception:
                            pass
        except Exception:
            pass

    # Fallback: scan printable byte blocks from the file
    if not extracted_lines:
        matches = re.findall(rb"[\x20-\x7E\t\n\r]{3,}", doc_bytes)
        for m in matches:
            try:
                s = m.decode("latin-1").strip()
                if len(s) > 2 and any(c.isalnum() for c in s):
                    extracted_lines.append(s)
            except Exception:
                pass

    full_text = "\n".join(extracted_lines).strip()
    is_scanned = len(full_text) < 15
    scan_notice = ""
    if is_scanned:
        scan_notice = (
            "This document contains little or no extractable text. "
            "It may be a scanned image or binary-encrypted file."
        )

    return {
        "success": True,
        "text": full_text,
        "page_count": 1,
        "is_scanned": is_scanned,
        "scan_notice": scan_notice,
    }


def extract_text_from_document(file_bytes: bytes, filename: str) -> dict:
    """
    Unified dispatcher to extract text from PDF, DOCX, or DOC documents.
    """
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if ext == "pdf":
        return extract_text_from_pdf(file_bytes)
    elif ext == "docx":
        return extract_text_from_docx(file_bytes)
    elif ext == "doc":
        return extract_text_from_doc(file_bytes)
    else:
        return {
            "success": False,
            "error": f"Unsupported file extension '.{ext}'. Supported: .pdf, .docx, .doc",
            "text": "",
            "is_scanned": False,
            "page_count": 0,
        }


def segment_sections(text: str) -> dict:
    """
    Basic heuristic section segmentation (Education, Experience, Projects, Skills).
    """
    sections = {"education": "", "experience": "", "projects": "", "skills": ""}

    header_patterns = {
        "education": r"(?i)\b(education|academic background|qualifications)\b",
        "experience": r"(?i)\b(work experience|experience|employment history|internships)\b",
        "projects": r"(?i)\b(projects|academic projects|personal projects)\b",
        "skills": r"(?i)\b(skills|technical skills|technologies|core competencies)\b",
    }

    lines = text.split("\n")
    current_section = None
    section_lines = {k: [] for k in sections}

    for line in lines:
        matched = False
        for sec_name, pattern in header_patterns.items():
            if re.search(pattern, line.strip()) and len(line.strip().split()) <= 4:
                current_section = sec_name
                matched = True
                break

        if not matched and current_section:
            section_lines[current_section].append(line)

    for k in sections:
        sections[k] = "\n".join(section_lines[k]).strip()

    return sections
