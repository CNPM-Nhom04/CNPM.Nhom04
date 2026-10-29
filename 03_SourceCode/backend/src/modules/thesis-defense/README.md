# Bảo vệ luận văn / luận án

NestJS module: domain (contracts), application (DTO/service), infrastructure (SQL repository),
presentation (controller/guard). Next.js calls the backend through its own authenticated
/api/bao-ve-luan-van route; JWT remains in an HttpOnly cookie.

## Source schema and extensions

CSDL.sql contains students, student_program_assignments, program_version_tracks,
program_versions, training_programs, majors, education_levels, organizational units,
RBAC, access views and audit_logs. It has no defense schedule, council or result tables.
Migration 1793293200000-ThesisDefenses adds:

- thesis_defense_levels: eligible education-level references; initialized only from
  existing MASTER/PHD/DOCTOR/DOCTORATE rows, never fictitious students or degrees.
- thesis_defenses: exact assignment and track, identity/program snapshots, entered
  thesis title and council, eligibility evidence, date/location, threshold and result,
  cancellation metadata and actors. Foreign keys, generated unique keys and triggers
  preserve consistency and immutable finalized history.
- DEFENSE_READ, DEFENSE_SCHEDULE and DEFENSE_RESULT permissions and explicit role grants.

No student, program, topic, council name, score or defense demo rows are seeded.
Existing passwords, other modules and original CSDL.sql are not overwritten.

## No assumed passing threshold

There is NO default 5.5 (or other default) in the application/migration.
Optional system_settings key defense.passing_score is read if actually configured.
If absent/blank, GET policy returns passingScore=null and the form is blank. A staff
member must enter the actual threshold (greater than 0, at most 10, two decimal places)
before saving. If configured, the saved value is shown read-only and checked again on
create. Invalid stored configuration is an error, not a silent fallback.
Each schedule stores its own immutable passing_score; later policy changes do not
reclassify an existing schedule. An unscored defense has NULL, distinct from score 0.

The schema does not prove language certificates, plagiarism approval, thesis approval
or all formal defense eligibility conditions. Active enrollment is not advertised as
proof of academic eligibility. Staff must verify actual documents, enter eligibilityNote
and explicitly confirm eligibilityConfirmed=true. This is recorded with created_by and
audit. No thesis-course completion requirement is inferred from course names.

## SQL-based authorization and scope

| Role             | Read                                              | Schedule/cancel | Record council aggregate result |
| ---------------- | ------------------------------------------------- | --------------- | ------------------------------- |
| ADMIN            | Yes                                               | No              | No                              |
| TRAINING_OFFICER | Yes                                               | Yes             | Yes                             |
| APPROVER         | Yes                                               | No              | Yes                             |
| Others           | Only if explicitly granted the module permissions | Same            | Same                            |

Roles are not hardcoded in runtime guards. Current permission grants and active account
state are read from SQL each request and checked again inside write transactions.
ADMIN never bypasses scope. JWT role claims are not trusted.
Both vw_user_program_access (exact program of the defense) and vw_user_student_access
(student identity) must authorize the actor. GLOBAL/ORG_UNIT student grants are therefore
required; MAJOR/PROGRAM access alone is not a blanket grant to student identities.
ORG_UNIT includes descendants according to organizational_unit_closure. List, counts,
student options, detail, scheduling, result and cancellation all follow these rules.
Off-faculty record IDs return 404; missing function permissions return 403.

## Scheduling and lifecycle

Student choices come from ACTIVE students with ACTIVE assignments and tracks, an enabled
education level, an ACTIVE program and PUBLISHED/ARCHIVED exact version. An archived
version remains valid for a student actually assigned to it; the newest version is not
silently substituted. Bachelor programs are excluded unless explicitly configured.

The form sends assignmentId with the chosen student code; changed/ended assignments
cannot be silently replaced on save. Names/programs come from relational SQL, not supplied
identity text. New schedules cannot be backdated. Dates use Asia/Ho_Chi_Minh (UTC+7).
Council chair, reviewer and secretary are entered from actual council documents, required
and distinct by normalized name. This records a council aggregate; it does not establish
member qualifications or collect individual member ballots.

- CHO_BAO_VE: at most one pending schedule per student, protected against concurrent calls.
- CHUA_DAT: score below the saved threshold, including 0; another attempt is allowed.
- DA_DAT: score at/above the saved threshold; another schedule for that assignment is blocked.
- DA_HUY: cancellation reason/actor/time retained; rescheduling is allowed if still eligible.

Results may be recorded only from the defense date and only while the selected assignment
and student remain eligible/active. No early grading or result rewrite. Concurrent calls
allow only one final action. Changed enrollment must be checked and the pending schedule
cancelled/replaced if appropriate. Cancellation is allowed only before a result exists.
Final rows and history cannot be updated/deleted, including through ordinary SQL writes.
Mutations and audit are atomic with UTC timestamps and row locks. No automatic course
result, academic assignment or graduation update is made by recording a defense result.
Schedules are day-based; room/time overlap and formal result correction workflows are
not implemented because the original screen has no time slots or correction process.

## API and local setup

```bash
cd 03_SourceCode/backend
npm ci
npm run migration:run
npm run start:dev
```

Frontend .env.local: BACKEND_API_URL=http://localhost:3002. Run npm ci and npm run dev
in frontend. Open http://localhost:3000/dashboard/bao-ve-luan-van after login.
Swagger: http://localhost:3002/api, tag Thesis Defense.

| Method | URL under /bao-ve-luan-van | Purpose                                                                                                                                            |
| ------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | /                          | Search/status filter/pagination with SQL counts and current permissions                                                                            |
| GET    | /policy                    | Actual nullable threshold and business-calendar today                                                                                              |
| GET    | /hoc-vien                  | Search/paginate matching student assignments                                                                                                       |
| GET    | /:id                       | Scope-checked schedule, snapshots, council, evidence and result                                                                                    |
| POST   | /                          | Create with assignmentId, maHocVien, tenDeTai, ngayBaoVe, diaDiem, chuTichHoidong, phanBien, thuKy, diemDat, eligibilityConfirmed, eligibilityNote |
| POST   | /:id/ket-qua               | Record {diemTrungBinh:number} once                                                                                                                 |
| POST   | /:id/huy                   | Cancel pending with {reason:string}, minimum 10 characters                                                                                         |

IDs are strings, DECIMAL scores are numbers/null. Selected statuses: ALL, CHO_BAO_VE,
DA_DAT, CHUA_DAT, DA_HUY. page>=1, 1<=limit<=100. Dates are YYYY-MM-DD.

## Test and handoff

```bash
npm test -- --runInBand
npm run build
npm run lint
```

For write integration, provision a DISPOSABLE copy of the schema/data, run migrations,
and point a separate backend/frontend pair to that copy (e.g. 3102/3101). Then:

```bash
DEFENSE_TEST_ALLOW_WRITES=1 npm run test:defense-integration
```

The test refuses the shared ctdt_management database. It uses temporary sessions and
isolated users/students/programs to cover scope, SQL parity, null/manual thresholds,
zero/invalid scores, conflicting schedules, concurrent results, cancellation, stale
assignments, failed retakes, passed-attempt denial, policy snapshots and immutability.
Test history stays in the disposable database, which is removed after testing.
Do not run write tests against the shared database. SMTP is not used by this module.

## Verified implementation

- Backend: 117 unit tests passed; build and lint passed.
- Frontend production build and lint for changed code passed.
- Disposable integration: 119 HTTP/SQL checks passed.
- Browser: explicit blank threshold, creation, zero score, reload persistence,
  future-date result denial, cancellation, Admin/reviewer read limits, faculty
  isolation and student denial passed without JavaScript runtime errors.
- Source database: 26 read-only API checks passed; 0 defense schedules, 3 original
  postgraduate student choices for FIT, 0 for FBE, passingScore=null.
- Source data was not populated with fake councils/topics/results or test accounts;
  disposable test data/processes were removed after verification.

To compare in DBeaver, use database ctdt_management. Core record columns:

```sql
SELECT d.id,s.student_code,d.student_name_snapshot,d.program_name_snapshot,
       d.assignment_id,d.program_version_track_id,d.thesis_title,d.defense_date,
       d.location,d.council_chair,d.reviewer,d.secretary,d.eligibility_note,
       d.passing_score,d.average_score,d.status,d.cancellation_reason
FROM thesis_defenses d JOIN students s ON s.id=d.student_id
ORDER BY d.id DESC;
```

This SQL is an administrator view; application results additionally enforce the
logged-in user's permission and scope. No rows is expected before actual scheduling.
