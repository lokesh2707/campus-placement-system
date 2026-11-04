"""
Job Recommendation Engine & Skill-Gap Analyzer.
Uses weighted rule-based skill overlap and scikit-learn TF-IDF cosine similarity.
"""

from typing import List, Dict, Any
import re
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Learning suggestions repository for common technical skills
SKILL_LEARNING_GUIDES = {
    "Python": "Practice Python 3 OOP, generators, list comprehensions, and PEP-8 conventions.",
    "JavaScript": "Master ES6+ features, async/await, closures, promises, and the event loop.",
    "TypeScript": "Learn interfaces, generic types, union types, and strict compiler configurations.",
    "React": "Practice custom hooks, Context API, component lifecycle, and state management.",
    "FastAPI": "Study Pydantic v2 schemas, asynchronous dependency injection, and OpenAPI doc generation.",
    "Node.js": "Understand event-driven architecture, streams, buffer management, and child processes.",
    "Express": "Master RESTful routing, middleware chaining, and centralized error handling.",
    "MongoDB": "Practice schema design, aggregation pipelines, compound indexing, and Mongoose ODM.",
    "PostgreSQL": "Study relational normalization, JOIN operations, foreign keys, and ACID transactions.",
    "Docker": "Learn Dockerfile multi-stage builds, container networking, and docker-compose configurations.",
    "Kubernetes": "Study Pods, Deployments, Services, ConfigMaps, and cluster orchestration concepts.",
    "Redis": "Learn in-memory data structures (strings, hashes, sets), caching patterns, and TTL expiration.",
    "Scikit-learn": "Master data preprocessing, train-test splitting, classification algorithms, and evaluation metrics.",
    "Git": "Practice branching workflows, interactive rebasing, merge conflict resolution, and pull requests.",
    "CI/CD": "Learn automated pipeline configuration (e.g. GitHub Actions) for linting, testing, and deployment.",
    "Java": "Master Core Java, Collections framework, multithreading, and JVM memory internals.",
    "Spring Boot": "Study Spring dependency injection, REST controllers, Spring Data JPA, and security filters.",
    "AWS": "Learn EC2, S3, RDS, IAM roles, Lambda, and core cloud architecture principles."
}

def normalize_skill(skill: str) -> str:
    """Normalize skill string for case-insensitive and alias matching."""
    s = skill.strip().lower()
    aliases = {
        "react.js": "react",
        "node": "node.js",
        "express.js": "express",
        "golang": "go",
        "js": "javascript",
        "ts": "typescript",
        "postgres": "postgresql",
        "k8s": "kubernetes",
    }
    return aliases.get(s, s)


def normalize_department(dept: str) -> str:
    """Normalize department so '&' and 'and' (and punctuation) match."""
    s = str(dept or "").lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def departments_match(student_dept: str, allowed_dept: str) -> bool:
    student = normalize_department(student_dept)
    allowed = normalize_department(allowed_dept)
    if not student or not allowed:
        return False
    return student == allowed or student in allowed or allowed in student

def check_eligibility(student: Dict[str, Any], job: Dict[str, Any]) -> Dict[str, Any]:
    """Verify hard academic eligibility criteria."""
    criteria = job.get("eligibilityCriteria", {})
    min_cgpa = criteria.get("minCgpa", 0.0)
    allowed_depts = criteria.get("allowedDepartments", [])
    target_batch = criteria.get("batch")
    max_backlogs = criteria.get("maxBacklogs", 0)

    student_cgpa = student.get("cgpa")
    student_dept = student.get("department", "")
    student_batch = student.get("batch")
    student_backlogs = student.get("backlogs")

    reasons = []
    missing_data = []

    # Check for missing critical profile fields
    if min_cgpa > 0 and (student_cgpa is None or student_cgpa == ""):
        missing_data.append("CGPA")
    if allowed_depts and len(allowed_depts) > 0 and not student_dept:
        missing_data.append("Department")
    if target_batch and not student_batch:
        missing_data.append("Graduation Batch")

    if missing_data:
        reasons.append(f"Eligibility needs review: missing candidate details ({', '.join(missing_data)})")
        return {
            "is_eligible": False,
            "eligibility_status": "Needs review",
            "eligibility_reasons": reasons,
            "missing_data": missing_data
        }

    is_eligible = True
    actual_cgpa = float(student_cgpa) if student_cgpa is not None else 0.0
    actual_backlogs = int(student_backlogs) if student_backlogs is not None else 0

    # 1. CGPA check
    if actual_cgpa < min_cgpa:
        is_eligible = False
        reasons.append(f"CGPA {actual_cgpa} is below minimum requirement of {min_cgpa}")

    # 2. Department check ("Computer Science & Engineering" == "... and Engineering")
    if allowed_depts and len(allowed_depts) > 0:
        dept_match = any(departments_match(student_dept, d) for d in allowed_depts)
        if not dept_match:
            is_eligible = False
            reasons.append(f"Department '{student_dept}' is not in eligible branches: {', '.join(allowed_depts)}")

    # 3. Backlogs check
    if actual_backlogs > max_backlogs:
        is_eligible = False
        reasons.append(f"Active backlogs ({actual_backlogs}) exceed maximum allowed ({max_backlogs})")

    # 4. Batch check
    if target_batch and student_batch and student_batch != target_batch:
        is_eligible = False
        reasons.append(f"Batch year {student_batch} does not match required batch {target_batch}")

    status = "Eligible" if is_eligible else "Not eligible"

    return {
        "is_eligible": is_eligible,
        "eligibility_status": status,
        "eligibility_reasons": reasons,
        "missing_data": []
    }

def calculate_text_similarity(student_text: str, job_text: str) -> float:
    """Calculate TF-IDF cosine similarity between student resume/skills and job description."""
    if not student_text.strip() or not job_text.strip():
        return 0.0
    try:
        vectorizer = TfidfVectorizer(stop_words="english")
        tfidf_matrix = vectorizer.fit_transform([student_text, job_text])
        sim = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
        return round(float(sim) * 100, 1)
    except Exception:
        return 0.0

def score_job_match(student: Dict[str, Any], job: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate explainable match score comparing student skills & profile with job criteria.
    """
    student_skills_raw = student.get("skills", [])
    student_skills_norm = {normalize_skill(s): s for s in student_skills_raw}

    req_skills_raw = job.get("requiredSkills", [])
    pref_skills_raw = job.get("preferredSkills", [])

    matched_required = []
    missing_required = []
    for s in req_skills_raw:
        if normalize_skill(s) in student_skills_norm:
            matched_required.append(s)
        else:
            missing_required.append(s)

    matched_preferred = []
    missing_preferred = []
    for s in pref_skills_raw:
        if normalize_skill(s) in student_skills_norm:
            matched_preferred.append(s)
        else:
            missing_preferred.append(s)

    # Component percentages (0–100). Missing skill LISTS do NOT award 100%.
    # Instead that component's weight is excluded and remaining weights are renormalized.
    BASE_WEIGHTS = {
        "required": 0.70,
        "preferred": 0.15,
        "text": 0.15,
    }
    active_weights = {}

    if len(req_skills_raw) > 0:
        req_score = (len(matched_required) / len(req_skills_raw)) * 100.0
        active_weights["required"] = BASE_WEIGHTS["required"]
    else:
        req_score = 0.0

    if len(pref_skills_raw) > 0:
        pref_score = (len(matched_preferred) / len(pref_skills_raw)) * 100.0
        active_weights["preferred"] = BASE_WEIGHTS["preferred"]
    else:
        pref_score = 0.0

    # Prefer richer student corpus when resume text / projects are available.
    project_bits = []
    for p in student.get("projects") or []:
        if isinstance(p, dict):
            project_bits.append(p.get("title", ""))
            project_bits.append(p.get("description", ""))
            project_bits.extend(p.get("technologies") or [])
    resume_extra = student.get("resume_text") or student.get("extractedText") or ""
    student_text = " ".join(
        [
            " ".join(student_skills_raw),
            student.get("department", "") or "",
            " ".join(project_bits),
            str(resume_extra)[:4000],
        ]
    )
    job_text = (
        job.get("title", "")
        + " "
        + job.get("description", "")
        + " "
        + " ".join(req_skills_raw)
        + " "
        + " ".join(pref_skills_raw)
    )
    text_sim = calculate_text_similarity(student_text, job_text)
    # Always include text component when any job/student text exists; else exclude weight.
    if student_text.strip() or job_text.strip():
        active_weights["text"] = BASE_WEIGHTS["text"]
    else:
        text_sim = 0.0

    # Composite Match Score (0 - 100) with renormalized active weights.
    # Documented baseline when all components apply: 70% required / 15% preferred / 15% text.
    # Eligibility is evaluated separately and NEVER alters the numeric score.
    weight_sum = sum(active_weights.values())
    if weight_sum <= 0:
        composite_score = 0.0
        applied_weights = {"required_skills": 0.0, "preferred_skills": 0.0, "text_similarity": 0.0}
    else:
        w_req = active_weights.get("required", 0.0) / weight_sum
        w_pref = active_weights.get("preferred", 0.0) / weight_sum
        w_text = active_weights.get("text", 0.0) / weight_sum
        composite_score = round(w_req * req_score + w_pref * pref_score + w_text * text_sim, 1)
        applied_weights = {
            "required_skills": round(w_req, 4),
            "preferred_skills": round(w_pref, 4),
            "text_similarity": round(w_text, 4),
        }

    # Eligibility evaluation (hard gates — independent of ranking score)
    eligibility = check_eligibility(student, job)

    explanation = (
        f"Matched {len(matched_required)} of {len(req_skills_raw)} required skills ({round(req_score)}%), "
        f"{len(matched_preferred)} of {len(pref_skills_raw)} preferred skills ({round(pref_score)}%), "
        f"and {text_sim}% semantic alignment with job description."
    )

    return {
        "job_id": str(job.get("_id", "")),
        "title": job.get("title", ""),
        "company": job.get("company", {}),
        "match_score": composite_score,
        "score_weights": applied_weights,
        "baseline_weights": {
            "required_skills": 0.70,
            "preferred_skills": 0.15,
            "text_similarity": 0.15,
        },
        "component_scores": {
            "required_skills_percent": round(req_score, 1),
            "preferred_skills_percent": round(pref_score, 1),
            "text_similarity_percent": text_sim,
        },
        "missing_components": [
            name
            for name, key in [
                ("required_skills", "required"),
                ("preferred_skills", "preferred"),
                ("text_similarity", "text"),
            ]
            if key not in active_weights
        ],
        "is_eligible": eligibility["is_eligible"],
        "eligibility_status": eligibility.get("eligibility_status"),
        "eligibility_reasons": eligibility["eligibility_reasons"],
        "missing_data": eligibility.get("missing_data", []),
        "matched_required_skills": matched_required,
        "missing_required_skills": missing_required,
        "matched_preferred_skills": matched_preferred,
        "missing_preferred_skills": missing_preferred,
        "text_similarity_percent": text_sim,
        "explanation": explanation,
        "disclaimer": "The match score reflects profile and skill alignment; it is not a hiring guarantee. AI never auto-selects or rejects candidates.",
    }

def perform_skill_gap_analysis(student: Dict[str, Any], job: Dict[str, Any]) -> Dict[str, Any]:
    """Detailed skill gap analysis with prioritized recommendations."""
    match_data = score_job_match(student, job)

    gaps = []
    # High Priority: Missing required skills
    for skill in match_data["missing_required_skills"]:
        gaps.append({
            "skill": skill,
            "priority": "High (Required)",
            "learning_suggestion": SKILL_LEARNING_GUIDES.get(
                skill, f"Study fundamental concepts, build a practical project, and review documentation for {skill}."
            )
        })

    # Medium Priority: Missing preferred skills
    for skill in match_data["missing_preferred_skills"]:
        gaps.append({
            "skill": skill,
            "priority": "Medium (Preferred)",
            "learning_suggestion": SKILL_LEARNING_GUIDES.get(
                skill, f"Gain familiarity with {skill} to strengthen your competitive profile for this role."
            )
        })

    return {
        "job_id": str(job.get("_id", "")),
        "job_title": job.get("title", ""),
        "overall_match_score": match_data["match_score"],
        "is_eligible": match_data["is_eligible"],
        "eligibility_reasons": match_data["eligibility_reasons"],
        "total_gaps_count": len(gaps),
        "gaps": gaps,
        "explanation": match_data["explanation"],
        "limitations_notice": "Automated skill-gap analysis evaluates documented keywords and may not assess practical depth."
    }

def extract_relevant_evidence(student: Dict[str, Any], job: Dict[str, Any], resume_text: str = "") -> List[str]:
    """Find concrete evidence from candidate's profile/projects/resume matching required & preferred skills."""
    evidence = []
    req_skills = [normalize_skill(s) for s in job.get("requiredSkills", [])]
    pref_skills = [normalize_skill(s) for s in job.get("preferredSkills", [])]
    target_skills = set(req_skills + pref_skills)

    # 1. Profile Projects
    projects = student.get("projects", [])
    for p in projects:
        title = p.get("title", "")
        desc = p.get("description", "")
        techs = p.get("technologies", [])
        matched = [t for t in techs if normalize_skill(t) in target_skills]
        if matched:
            evidence.append(f"Project '{title}' ({', '.join(matched)}): {desc[:140]}")
        elif title and len(evidence) < 2:
            evidence.append(f"Project '{title}': {desc[:140]}")

    # 2. Work Experience
    experience = student.get("experience", [])
    for exp in experience:
        role = exp.get("role", "")
        company = exp.get("company", "")
        desc = exp.get("description", "")
        if role or company:
            evidence.append(f"Experience as {role} at {company}: {desc[:140]}")

    # 3. Resume text snippets if provided
    if resume_text:
        lines = [ln.strip() for ln in resume_text.split("\n") if len(ln.strip()) > 25]
        for line_str in lines:
            if len(evidence) >= 5:
                break
            for s in job.get("requiredSkills", []) + job.get("preferredSkills", []):
                if re.search(rf"\b{re.escape(s)}\b", line_str, re.I):
                    evidence.append(f"Resume: \"{line_str[:140]}\"")
                    break

    return evidence[:5]

def evaluate_applicant_for_job(student: Dict[str, Any], job: Dict[str, Any], resume_text: str = "") -> Dict[str, Any]:
    """
    Recruiter-facing AI applicant evaluation against explicit job criteria.
    Combines rule-based required/preferred skill matching, hard academic eligibility checks,
    TF-IDF semantic relevance, and extracted profile evidence.
    """
    match_data = score_job_match(student, job)
    evidence = extract_relevant_evidence(student, job, resume_text)
    eligibility = check_eligibility(student, job)

    return {
        "job_id": str(job.get("_id", "")),
        "job_title": job.get("title", ""),
        "student_id": str(student.get("user", "") or student.get("_id", "")),
        "match_score": match_data["match_score"],
        "eligibility_status": eligibility.get("eligibility_status", "Eligible" if eligibility["is_eligible"] else "Not eligible"),
        "is_eligible": eligibility["is_eligible"],
        "eligibility_reasons": eligibility["eligibility_reasons"],
        "missing_data": eligibility.get("missing_data", []),
        "matched_required_skills": match_data["matched_required_skills"],
        "missing_required_skills": match_data["missing_required_skills"],
        "matched_preferred_skills": match_data["matched_preferred_skills"],
        "missing_preferred_skills": match_data["missing_preferred_skills"],
        "text_similarity_percent": match_data["text_similarity_percent"],
        "relevant_evidence": evidence,
        "explanation": match_data["explanation"],
        "disclaimer": "The AI match score reflects documented profile & skill alignment. It is intended to assist recruiter screening and is not an automated hiring decision."
    }
