from recommender import normalize_skill, perform_skill_gap_analysis, score_job_match


def test_normalizes_known_skill_aliases():
    assert normalize_skill("React.js") == "react"
    assert normalize_skill("JS") == "javascript"


def test_reports_required_and_preferred_skill_gaps():
    result = perform_skill_gap_analysis(
        {"skills": ["Python"], "cgpa": 8.0, "department": "CSE", "batch": 2026, "backlogs": 0},
        {"title": "Developer", "requiredSkills": ["Python", "React"], "preferredSkills": ["Docker"], "eligibilityCriteria": {"minCgpa": 7, "allowedDepartments": ["CSE"], "batch": 2026, "maxBacklogs": 0}},
    )
    assert {gap["skill"] for gap in result["gaps"]} == {"React", "Docker"}
    assert result["is_eligible"] is True


def test_eligibility_is_separate_from_match_score():
    result = score_job_match(
        {"skills": ["Python"], "cgpa": 5.0, "department": "CSE", "batch": 2026, "backlogs": 0},
        {"title": "Developer", "requiredSkills": ["Python"], "preferredSkills": [], "eligibilityCriteria": {"minCgpa": 8, "allowedDepartments": ["CSE"], "batch": 2026, "maxBacklogs": 0}},
    )
    assert result["match_score"] > 0
    assert result["is_eligible"] is False
    assert result["missing_required_skills"] == []


def test_matching_baseline_weights_remain_exactly_70_15_15():
    result = score_job_match(
        {"skills": ["Python", "React"], "department": "CSE"},
        {"title": "Engineer", "description": "Build APIs", "requiredSkills": ["Python"], "preferredSkills": ["React"]},
    )
    assert result["baseline_weights"] == {
        "required_skills": 0.70,
        "preferred_skills": 0.15,
        "text_similarity": 0.15,
    }
    assert result["score_weights"] == result["baseline_weights"]


def test_matching_renormalizes_available_components_when_preferred_list_is_empty():
    result = score_job_match(
        {"skills": ["Python"]},
        {"title": "Engineer", "description": "Build APIs", "requiredSkills": ["Python"], "preferredSkills": []},
    )
    assert result["score_weights"]["required_skills"] == 0.8235
    assert result["score_weights"]["preferred_skills"] == 0.0
    assert result["score_weights"]["text_similarity"] == 0.1765
    assert "preferred_skills" in result["missing_components"]


def test_matching_omits_empty_skill_components_and_keeps_text_component():
    result = score_job_match(
        {"skills": ["Python"]},
        {"title": "Python engineer", "description": "", "requiredSkills": [], "preferredSkills": []},
    )
    assert result["score_weights"] == {
        "required_skills": 0.0,
        "preferred_skills": 0.0,
        "text_similarity": 1.0,
    }
    assert result["missing_components"] == ["required_skills", "preferred_skills"]


def test_matching_returns_zero_when_no_component_is_available():
    result = score_job_match(
        {"skills": [], "projects": [], "department": ""},
        {"title": "", "description": "", "requiredSkills": [], "preferredSkills": []},
    )
    assert result["match_score"] == 0.0
    assert result["score_weights"] == {
        "required_skills": 0.0,
        "preferred_skills": 0.0,
        "text_similarity": 0.0,
    }
    assert result["missing_components"] == ["required_skills", "preferred_skills", "text_similarity"]


def test_matching_existing_alias_normalization_remains_unchanged():
    result = score_job_match(
        {"skills": ["React.js", "JS"]},
        {"title": "Frontend", "description": "UI", "requiredSkills": ["react", "JavaScript"], "preferredSkills": []},
    )
    assert result["matched_required_skills"] == ["react", "JavaScript"]
    assert result["missing_required_skills"] == []
