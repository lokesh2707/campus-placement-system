import re
from skills_dataset import SKILL_TAXONOMY

def extract_skills_from_text(text: str) -> dict:
    """
    Extract skills from plain text using boundary-aware regex matching
    against the categorized skill taxonomy.
    """
    matched_skills = set()
    categorized = {}

    for category, skill_list in SKILL_TAXONOMY.items():
        categorized[category] = []
        for skill in skill_list:
            escaped = re.escape(skill)
            # If purely alphanumeric/word characters, standard word boundary \b works best.
            # If it contains symbols (C++, C#, .NET, etc.), check against punctuation/spaces/line bounds.
            if re.match(r"^\w+$", skill):
                pattern = rf"(?i)\b{escaped}\b"
            else:
                pattern = rf"(?i)(?:^|[\s,./\(\)\[\];:\-])+{escaped}(?:$|[\s,./\(\)\[\];:\-])+"

            if re.search(pattern, text):
                matched_skills.add(skill)
                categorized[category].append(skill)

    # Clean up empty categories
    categorized = {k: v for k, v in categorized.items() if len(v) > 0}

    return {
        "skills": sorted(list(matched_skills)),
        "categorized": categorized,
        "total_skills_found": len(matched_skills)
    }
