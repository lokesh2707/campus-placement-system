"""
Structured resume field extraction with explicit confidence levels.

Extracted values are heuristics — not verified facts. Callers must present
them for student review before promoting into confirmed profile records.
OCR for scanned PDFs is intentionally NOT implemented (local CPU/binary
constraints); parser.is_scanned remains the signal for that limitation.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional


DEGREE_PATTERN = re.compile(
    r"\b(B\.?\s?Tech|B\.?\s?E\.?|M\.?\s?Tech|M\.?\s?S\.?|MBA|BCA|MCA|"
    r"Bachelor(?:'s)?|Master(?:'s)?|Ph\.?D\.?|Diploma)\b"
    r"[^\n,]{0,80}",
    re.I,
)
YEAR_PATTERN = re.compile(r"\b(20\d{2})\b")
CGPA_PATTERN = re.compile(
    r"(?:CGPA|GPA)\s*[:\-]?\s*([0-9](?:\.\d{1,2})?)\s*(?:/\s*10)?",
    re.I,
)
CERT_PATTERN = re.compile(
    r"(?i)(?:certified|certification|certificate)\s+(?:in\s+)?([A-Za-z0-9+.# /\-]{3,60})"
)
EMAIL_LINE = re.compile(r"[\w.+-]+@[\w.-]+\.\w+")


def _field(
    value: Any,
    confidence: str,
    evidence: str = "",
    source: str = "resume_text",
) -> Dict[str, Any]:
    return {
        "value": value,
        "confidence": confidence,  # high | medium | low | unavailable
        "evidence": (evidence or "")[:240],
        "source": source,
        "confirmed": False,
    }


def _lines(text: str) -> List[str]:
    return [ln.strip() for ln in (text or "").split("\n") if ln.strip()]


def extract_education(section_text: str, full_text: str) -> Dict[str, Any]:
    blob = section_text or full_text or ""
    degree_match = DEGREE_PATTERN.search(blob)
    years = YEAR_PATTERN.findall(blob)
    cgpa_match = CGPA_PATTERN.search(blob)

    institution = None
    conf_inst = "unavailable"
    evid_inst = ""
    if degree_match:
        # Prefer the line containing the degree for institution hints
        for ln in _lines(blob):
            if DEGREE_PATTERN.search(ln):
                # Strip degree token; leftover may include college name
                cleaned = DEGREE_PATTERN.sub("", ln).strip(" -|,:")
                if len(cleaned) >= 4 and "@" not in cleaned:
                    institution = cleaned[:120]
                    conf_inst = "low"
                    evid_inst = ln[:200]
                break

    graduation_year = None
    conf_year = "unavailable"
    if years:
        # Prefer the latest plausible graduation year
        graduation_year = max(int(y) for y in years)
        conf_year = "medium" if section_text else "low"

    return {
        "degree": _field(
            degree_match.group(0).strip() if degree_match else None,
            "medium" if degree_match and section_text else ("low" if degree_match else "unavailable"),
            degree_match.group(0) if degree_match else "",
        ),
        "institution": _field(institution, conf_inst, evid_inst),
        "graduation_year": _field(
            graduation_year,
            conf_year,
            str(graduation_year) if graduation_year else "",
        ),
        "cgpa_mentioned": _field(
            float(cgpa_match.group(1)) if cgpa_match else None,
            "low" if cgpa_match else "unavailable",
            cgpa_match.group(0) if cgpa_match else "",
        ),
    }


def extract_list_items(
    section_text: str,
    item_type: str,
    max_items: int = 5,
) -> List[Dict[str, Any]]:
    """Split a section into bullet-like items with low/medium confidence."""
    if not section_text:
        return []

    raw_items = []
    for ln in _lines(section_text):
        if EMAIL_LINE.search(ln) and len(ln) < 40:
            continue
        cleaned = re.sub(r"^[\-\*\u2022\d\.\)\s]+", "", ln).strip()
        if len(cleaned) < 8:
            continue
        raw_items.append(cleaned)

    results = []
    for item in raw_items[:max_items]:
        results.append(
            {
                "type": item_type,
                "title": _field(item[:100], "medium" if len(item) < 120 else "low", item),
                "description": _field(item, "low", item),
                "confidence": "medium" if len(item) < 160 else "low",
            }
        )
    return results


def extract_certifications(section_text: str, full_text: str) -> List[Dict[str, Any]]:
    blob = section_text or full_text or ""
    found = []
    for m in CERT_PATTERN.finditer(blob):
        title = m.group(1).strip(" .-|,")
        if len(title) < 3:
            continue
        found.append(
            {
                "title": _field(title, "low", m.group(0)[:200]),
                "confidence": "low",
            }
        )
        if len(found) >= 5:
            break
    return found


def extract_structured_resume(
    full_text: str,
    sections: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    sections = sections or {}
    education = extract_education(sections.get("education", ""), full_text)
    experience = extract_list_items(sections.get("experience", ""), "experience")
    projects = extract_list_items(sections.get("projects", ""), "project")
    certifications = extract_certifications(sections.get("education", ""), full_text)
    # Also scan full text for certs if none found
    if not certifications:
        certifications = extract_certifications("", full_text)

    return {
        "education": education,
        "experience": experience,
        "projects": projects,
        "certifications": certifications,
        "internships": [
            e for e in experience if re.search(r"(?i)intern", str(e.get("title", {}).get("value") or ""))
        ],
        "notice": (
            "Structured fields are heuristic extractions with confidence labels. "
            "They are not verified academic or employment records until the student confirms them. "
            "Scanned PDFs without a text layer are not OCR-processed in this local deployment."
        ),
    }
