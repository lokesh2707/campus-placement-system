import os
from fastapi import FastAPI, UploadFile, File, HTTPException, Body, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, List, Optional
from parser import extract_text_from_document, segment_sections
from extractor import extract_skills_from_text
from structure_extractor import extract_structured_resume
from recommender import (
    score_job_match,
    perform_skill_gap_analysis,
    evaluate_applicant_for_job,
)

app = FastAPI(
    title="Campus Placement Intelligence - ML Service",
    version="1.0.0",
    description="Resume parsing, skill extraction, recommendation engine, and skill-gap analysis"
)

# Local-only by default. When ML_SERVICE_TOKEN is set, mutating endpoints require it.
_ALLOWED_ORIGINS = [
    o.strip()
    for o in (os.getenv("ML_CORS_ORIGINS") or "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5000,http://localhost:5000").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_ml_token(request: Request) -> None:
    """Optional shared-secret gate for Node → ML calls (no cloud auth)."""
    expected = os.getenv("ML_SERVICE_TOKEN", "").strip()
    if not expected:
        return
    provided = (
        request.headers.get("x-ml-service-token")
        or request.headers.get("X-ML-Service-Token")
        or ""
    ).strip()
    if provided != expected:
        raise HTTPException(status_code=401, detail="Unauthorized ML service request")

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "ai-ml-service",
        "version": "1.0.0"
    }

@app.post("/parse-resume")
async def parse_resume(
    file: UploadFile = File(...),
    _: None = Depends(require_ml_token),
):
    """
    Accept an uploaded PDF, DOC, or DOCX resume, extract text,
    detect scanned files, and extract technical skills.
    """
    filename = file.filename or "resume.pdf"
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if ext not in ["pdf", "docx", "doc"]:
        raise HTTPException(
            status_code=400,
            detail="Only PDF, DOC, and DOCX files are supported."
        )

    file_bytes = await file.read()

    extraction = extract_text_from_document(file_bytes, filename)
    if not extraction["success"]:
        raise HTTPException(status_code=400, detail=extraction["error"])

    skill_result = extract_skills_from_text(extraction["text"])
    sections = segment_sections(extraction["text"])
    structured = extract_structured_resume(extraction["text"], sections)

    # Cap stored extract text for downstream evaluation (not returned in full to browsers).
    extract_text = extraction["text"] or ""
    extract_text_capped = extract_text[:20000]

    return {
        "filename": filename,
        "page_count": extraction["page_count"],
        "is_scanned": extraction["is_scanned"],
        "scan_notice": extraction["scan_notice"],
        "skills": skill_result["skills"],
        "categorized_skills": skill_result["categorized"],
        "sections": sections,
        "structured_fields": structured,
        "extracted_text": extract_text_capped,
        "raw_text_preview": extract_text[:500] if extract_text else "",
        "ocr_supported": False,
        "ocr_notice": (
            "Local OCR for scanned PDFs is not enabled in this deployment. "
            "Upload a text-based PDF or Word document for automated extraction."
            if extraction["is_scanned"]
            else ""
        ),
    }

@app.post("/recommend-jobs")
def recommend_jobs(
    payload: Dict[str, Any] = Body(...),
    _: None = Depends(require_ml_token),
):
    """
    Score and rank jobs for a student profile using skill overlap,
    eligibility checks, and TF-IDF text similarity.
    """
    student = payload.get("student", {})
    jobs = payload.get("jobs", [])

    if not student or not jobs:
        return {"recommendations": [], "count": 0}

    scored_jobs = []
    for job in jobs:
        match_result = score_job_match(student, job)
        scored_jobs.append(match_result)

    # Sort descending by match score
    scored_jobs.sort(key=lambda x: x["match_score"], reverse=True)

    return {
        "recommendations": scored_jobs,
        "count": len(scored_jobs)
    }

@app.post("/skill-gap-analysis")
def skill_gap_endpoint(
    payload: Dict[str, Any] = Body(...),
    _: None = Depends(require_ml_token),
):
    """
    Perform granular skill-gap analysis comparing a student with a specific job.
    """
    student = payload.get("student", {})
    job = payload.get("job", {})

    if not student or not job:
        raise HTTPException(status_code=400, detail="Student profile and job details are required")

    return perform_skill_gap_analysis(student, job)

@app.post("/evaluate-applicant")
def evaluate_applicant_endpoint(
    payload: Dict[str, Any] = Body(...),
    _: None = Depends(require_ml_token),
):
    """
    Evaluate a candidate's profile and resume against a specific job's requirements.
    Provides match score, eligibility verdict, matched/missing skills, and resume evidence.
    """
    student = payload.get("student", {})
    job = payload.get("job", {})
    resume_text = payload.get("resume_text", "")

    if not student or not job:
        raise HTTPException(
            status_code=400,
            detail="Student profile and job specifications are required for evaluation",
        )

    return evaluate_applicant_for_job(student, job, resume_text)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
