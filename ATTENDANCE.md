# Placement Drive Attendance

## Scope and status values

Attendance is drive-level. A Job represents a recruitment drive, and each Attendance document identifies one Application for that Job. InterviewRound attendance and multiple sessions for one Job are not supported. `PRESENT`, `ABSENT`, `LATE`, and `EXCUSED` are the persisted values. A missing Attendance document is `NOT_RECORDED`; it is not equivalent to `ABSENT`. The current Job schema has no scheduled drive date. `recordedAt` means when staff recorded the status, not when the drive occurred.

## Authorization

| Role | Read | Write |
|---|---|---|
| Student | Own application attendance history | None |
| Recruiter | Jobs and applications of the authenticated company, when company verification, active status, institute authorization, and record relationships are valid | Record and correct within that company; corrections require reason and current revision |
| Placement Officer | Job/application records within the assigned active institute and consistent institute relationships | None |
| Super Admin | Platform-wide Job attendance read | None |

All student, Job, company, and institute relationships are derived from persisted Application, Job, User, StudentProfile, Company, and Institute records. Client ownership or actor fields are ignored. Inconsistent relationships fail closed.

## Model and correction behavior

`Attendance.application` is required and uniquely indexed. The server creates the Attendance index after connecting and before listening, so the unique constraint is present before attendance writes are accepted. Job, student, company, and institute IDs are not duplicated. `recordedBy` and `recordedAt` are immutable initial-record metadata; `lastModifiedBy`, `revision`, and `correctionHistory` track changes. Revision begins at 1. Corrections require `expectedRevision`; a single conditional MongoDB update changes the status, appends one history entry, updates the actor, and increments the revision. A stale revision returns HTTP 409. Duplicate insertion is protected by the unique index and also returns HTTP 409.

Audit writes use `AdminAuditLog` actions `attendance_recorded` and `attendance_corrected`. Attendance and audit writes are not transactional: if audit storage fails after attendance persistence, the attendance change remains committed. Attendance does not update applications, offers, Job vacancies, selections, student placement state, interviews, or feedback. Closing a Job does not lock attendance.

## API

- `GET /api/jobs/:jobId/attendance?page=1&limit=25` — recruiter, assigned placement officer, Super Admin. Stable database pagination; maximum limit 50. Missing attendance is serialized as `NOT_RECORDED`.
- `POST /api/jobs/:jobId/attendance` — recruiter. Body: `{ "applicationId": "...", "status": "PRESENT" }`.
- `PATCH /api/attendance/:attendanceId` — recruiter. Body: `{ "status": "ABSENT", "reason": "...", "expectedRevision": 1 }`.
- `GET /api/attendance/me?page=1&limit=25` — student. Ownership comes from the authenticated user. Correction notes and other students' data are excluded.

Responses are explicit allowlisted DTOs, not raw Mongoose documents.

## Frontend

Recruiters record and correct attendance in the Job applicant management page. Placement officers view the selected Job roster in the recruitment monitor. Students see read-only status and recording time in Applications. No new dashboard, bulk entry, attendance percentages, or notifications are added.

## Tests

Run standard suites from the repository root:

```powershell
npm --prefix backend test
& '.\ml-service\.venv\Scripts\python.exe' -m pytest ml-service\tests -q
npm --prefix frontend test
npm --prefix frontend run build
```

`backend/tests/attendance.routes.test.js` exercises the registered Express router and its JWT/role middleware with mocked persistence; it does not prove MongoDB index or multi-connection behavior. The opt-in `backend/tests/attendance.mongodb.integration.test.js` uses real Mongoose models, indexes, authenticated HTTP requests, and concurrent requests. Enable it only with `RUN_ATTENDANCE_MONGODB_TESTS=1` and an explicit `MONGODB_ATTENDANCE_TEST_BASE_URI` for standalone MongoDB at `127.0.0.1:27017`, with no selected DB path or embedded credentials. It confirms an absent generated test DB before connection and drops/verifies absent only that exact generated `campus_placement_attendance_test_*` database in cleanup. It never selects `campus_placement`.

## Limitations

- One Job is treated as one attendance scope. Multiple separately attended sessions under a single Job require a future session model and unique scope redesign.
- There is no formal student dispute flow or explicit attendance-lock deadline.
- The audit record and attendance mutation are separate writes; cross-document atomicity is not claimed.
- The repository does not define an actual scheduled drive timestamp; do not interpret `recordedAt` as one.
