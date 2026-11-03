# Job match scoring formula

Verified against `recommender.py` → `score_job_match`.

## Baseline weights (when all components apply)

| Component | Weight | Calculation |
|-----------|--------|-------------|
| Required skills overlap | 70% | `matched_required / required_count * 100` |
| Preferred skills overlap | 15% | `matched_preferred / preferred_count * 100` |
| Text similarity | 15% | TF-IDF cosine similarity × 100 |

Student corpus: confirmed skills + department + project fields + optional resume extract.

## Missing-data behavior (no silent full credit)

- Empty **required** skill list → that component is **excluded** (not scored as 100%). Remaining active weights are renormalized to sum to 1.0.
- Empty **preferred** skill list → preferred component excluded; weights renormalized.
- Empty student and job text → text component excluded; `text_similarity_percent = 0`.
- If **no** components are active → overall score is `0`.

Response fields:

- `baseline_weights` — fixed 0.70 / 0.15 / 0.15 design intent
- `score_weights` — renormalized weights actually applied
- `missing_components` — which baseline components were inactive

## Hard eligibility (independent of score)

`check_eligibility` uses `job.eligibilityCriteria`:

- `minCgpa`, `allowedDepartments`, `batch`, `maxBacklogs`

Statuses: `Eligible` | `Not eligible` | `Needs review`.

A high match score never marks a candidate eligible if a mandatory gate fails.

## Examples

1. Required `[Python, React]`, student has both, preferred empty, some text overlap:  
   active = required 0.70 + text 0.15 → renormalize → required ≈ 0.8235, text ≈ 0.1765.
2. No required, no preferred, empty text: score `0`.
3. CGPA below minimum with strong skills: `match_score` may be high; `is_eligible` is still `false`.

## Determinism

Identical inputs → identical scores.

## Human control

AI assists screening only. Recruiters/officers perform shortlist, interview, select, reject. No automatic selection or rejection from match score.
