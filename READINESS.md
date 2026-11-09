# Placement readiness and skill gap analysis

Placement readiness is a source-aware checklist of profile, resume, academic-field, and institute opportunity evidence. It is separate from job matching. V1 does not return an overall numerical readiness score, readiness percentage, predicted placement probability, or student ranking.

## Sources and provenance

`StudentProfile.skillInventory` is an additive embedded record. It is excluded from default Mongoose selection so existing recruiter and officer populations do not implicitly expose this private inventory. Readiness handlers explicitly select and serialize it.

Allowed sources are `student_declared`, `resume_extracted`, and `legacy_profile_skill`. Student declarations are self-reported. A self-assessed proficiency is also self-reported and is never used to calculate readiness. Resume entries reference a persisted `ResumeAnalysis` and begin `extracted_unreviewed`. Legacy flat `StudentProfile.skills` strings are synthesized in the readiness DTO as `legacy_profile_skill` / `source_unknown`; no live-data backfill or migration runs automatically. Evidence from distinct sources remains distinct even when normalized names match.

The resume parser output in `ResumeAnalysis.extractedSkills` is preserved when the student reviews or edits skill decisions. Review state is kept separately in inventory (`student_confirmed` or `student_rejected`). Confirmation means acknowledgement of a parser result only. A skill found in a resume is keyword evidence, not proven proficiency. Edits to the declared inventory do not edit parser records. To preserve compatibility and avoid erasing historical evidence of unknown origin, removing a student declaration removes only that inventory item; the legacy flat `skills` string remains. New student declarations are added to the flat array for existing search and matching consumers.

Normalization trims whitespace, normalizes case and repeated spaces, and reuses the existing small alias map (`JS`/`javascript`, `React.js`/`react`, and other aliases in `readinessService.js`). The display name and each provenance record remain available. Atomic conditional document updates prevent duplicate canonical student declarations and duplicate source-linked resume entries.

## Evidence states and stale resumes

Demand rows distinguish `found_in_latest_resume`, `student_declared`, `not_found_in_latest_resume`, `needs_confirmation`, `source_unknown`, `no_resume_available`, and `resume_unreadable`. These describe evidence availability, not proficiency. A missing keyword does not mean a student lacks the skill. Older resume records remain stored and the DTO reports older-only evidence separately from the latest resume. If the latest resume is scanned/unreadable, the service does not infer absence. No resume content or internal file path is returned.

Resume-analysis records created before this feature may have had their `extractedSkills` edited by the prior review flow; the system cannot reconstruct the original parser output for those historical records. New review actions preserve the recorded parser list.

## Demand and checklist

Student demand compares current open jobs with verified, active companies authorized for the student's institute. A job must have no institute restriction or match that institute; expired-deadline jobs are excluded. The API bounds the returned job sample to 300 and reports when it is truncated. Required and preferred counts are job-specific demand counts, not student skill counts. Missing data remains unknown/not provided.

The checklist reuses the existing profile-completeness helper for missing-field labels but omits its percentage. CGPA, department, batch and backlog values are described as recorded profile values; the current system does not attach transcript verification. Existing eligibility behavior, including its `backlogs` field, is unchanged.

## Roles and APIs

- `GET /api/readiness/me` — STUDENT; resolves the profile from the authenticated user and returns the checklist, own inventory, latest resume state and institute-authorized demand.
- `PUT /api/readiness/me/skills` — STUDENT; JSON action `{"action":"upsert","skillName":"Go","selfReportedProficiency":"beginner"}` adds/updates a declaration. Include `declarationId` to update one declaration. Remove with `{"action":"remove","declarationId":"<inventory-item-id>"}`. The endpoint rejects source, resume, owner, tenant, evidence-reference and review-state fields.
- `GET /api/readiness/institute/summary` — PLACEMENT_OFFICER or SUPER_ADMIN; officers are locked to their authenticated active institute and cannot pass an institute override. Super Admin may omit the filter for platform aggregates or pass a validated active `instituteId`.

No general recruiter readiness route exists. The aggregate endpoint returns no student IDs, resumes, feedback, or contact details. Cells with counts 1–4 are suppressed; zero is shown as zero. For groups under five students, all details are suppressed. Legacy skill strings are described as unknown provenance and may overlap other source counts. The aggregate output never claims that a profile skill is verified proficiency.

## Limitations

Skill extraction is a local taxonomy keyword scan and provides no per-skill extraction confidence. OCR is not available for scanned documents. Student-declared skills, project/certification content, and academic profile values are not independently verified. Open job requirements may be inconsistent. The readiness feature does not assess technical depth, communication ability, project quality, or placement likelihood. Demand queries are bounded (300 jobs per student and 500 for aggregate summaries); officer aggregate coverage is subject to the minimum-cell rule.

The implementation does not modify the Python `score_job_match` algorithm, its 70/15/15 baseline, dynamic renormalization, eligibility checks, or the offline Node fallback. It does not consume confidential `InterviewFeedback`.

## Tests

- Backend unit and mocked route tests: `npm test --prefix backend`.
- Python matching regression and recommender tests: `python -m pytest ml-service/tests`.
- Frontend tests: `npm test --prefix frontend`.
- Frontend production build: `npm run build --prefix frontend`.
- Opt-in readiness MongoDB integration: from `backend`, set `RUN_READINESS_MONGODB_TESTS=1` and `MONGODB_READINESS_TEST_BASE_URI=mongodb://127.0.0.1:27017/?directConnection=true`, then run `node --test tests/readiness.mongodb.integration.test.js`. The test verifies the loopback standalone host and port, requires the base URI not to select a database or contain credentials, creates a unique absent `campus_placement_readiness_test_*` database, asserts the selected DB name, and drops and verifies removal of only that database. It never uses `campus_placement`.

Mocked tests verify service logic and HTTP authorization with mocked identity/model lookups. The opt-in Mongo test exercises the registered authenticated routes, real models/indexes, persisted state, route-level concurrent declarations, and an additional cross-connection compare-and-set race. Skipped opt-in tests are not evidence that real MongoDB behavior passed.
