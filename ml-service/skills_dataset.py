"""
Taxonomy of technical skills categorized for student resume parsing and job matching.
"""

SKILL_TAXONOMY = {
    "Programming Languages": [
        "Python", "Java", "C++", "C", "C#", "JavaScript", "TypeScript",
        "Go", "Golang", "Rust", "Kotlin", "Swift", "PHP", "Ruby", "R",
        "Dart", "Scala", "Shell", "Bash", "SQL"
    ],
    "Frameworks & Libraries": [
        "React", "React.js", "Angular", "Vue", "Vue.js", "Next.js", "Node.js",
        "Express", "Express.js", "FastAPI", "Flask", "Django", "Spring Boot",
        "Spring", "ASP.NET", ".NET Core", "Tailwind CSS", "Bootstrap",
        "Redux", "GraphQL", "jQuery"
    ],
    "Databases & Caching": [
        "MongoDB", "PostgreSQL", "MySQL", "Redis", "SQLite", "Cassandra",
        "Elasticsearch", "Firebase", "DynamoDB", "MariaDB", "Oracle"
    ],
    "Cloud & DevOps": [
        "Docker", "Kubernetes", "AWS", "Amazon Web Services", "Azure",
        "Microsoft Azure", "Google Cloud", "GCP", "Git", "GitHub", "GitLab",
        "CI/CD", "Jenkins", "Terraform", "Linux", "Nginx", "Apache"
    ],
    "AI, ML & Data Science": [
        "Machine Learning", "Deep Learning", "Artificial Intelligence",
        "Scikit-learn", "TensorFlow", "PyTorch", "Keras", "Pandas", "NumPy",
        "Matplotlib", "Seaborn", "NLP", "Natural Language Processing",
        "Computer Vision", "OpenCV", "LLM", "Prompt Engineering"
    ],
    "Core CS & Methodologies": [
        "Data Structures", "Algorithms", "Object-Oriented Programming", "OOP",
        "Database Management", "DBMS", "Operating Systems", "Computer Networks",
        "REST API", "Microservices", "Agile", "Scrum", "Test-Driven Development",
        "TDD", "System Design"
    ]
}

def get_flat_skill_list():
    """Return an array of all distinct skills."""
    all_skills = set()
    for category, skills in SKILL_TAXONOMY.items():
        all_skills.update(skills)
    return sorted(list(all_skills))
