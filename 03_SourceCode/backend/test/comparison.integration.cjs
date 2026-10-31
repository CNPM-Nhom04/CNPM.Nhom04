/* Read-only SQL parity + HTTP contracts. No fixtures, grants or auth sessions are written.
   JWT is overridden ONLY in the in-process test app; the real SQL permission guard remains active. */
const assert = require("node:assert/strict"),
  path = require("node:path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});
const { ValidationPipe } = require("@nestjs/common");
const { ConfigModule } = require("@nestjs/config");
const { Test } = require("@nestjs/testing"),
  { TypeOrmModule } = require("@nestjs/typeorm");
const { DataSource } = require("typeorm"),
  request = require("supertest"),
  { Workbook } = require("exceljs");
const {
  ComparisonModule,
} = require("../dist/modules/comparisons/comparison.module");
const {
  ComparisonRepository,
} = require("../dist/modules/comparisons/domain/comparison");
const {
  JwtAuthGuard,
} = require("../dist/modules/identity/presentation/jwt-auth.guard");
const {
  ComparisonService,
} = require("../dist/modules/comparisons/application/comparison.service");
let app,
  db,
  actor = "0",
  checks = 0;
const same = (a, b, label) => {
  assert.deepEqual(a, b, label);
  checks++;
};
async function run() {
  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      TypeOrmModule.forRoot({
        type: "mysql",
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        timezone: "Z",
        synchronize: false,
      }),
      ComparisonModule,
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({
      canActivate(context) {
        context.switchToHttp().getRequest().user = { userId: actor };
        return true;
      },
    })
    .compile();
  app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  db = module.get(DataSource);
  const repo = module.get(ComparisonRepository),
    service = module.get(ComparisonService);
  const users = await db.query(
    "SELECT CAST(id AS CHAR) id,username FROM users WHERE account_status='ACTIVE' AND deleted_at IS NULL ORDER BY id",
  );
  let compared = 0,
    denied = 0;
  for (const user of users) {
    actor = user.id;
    const [permission] = await db.query(
      "SELECT COUNT(*) total FROM user_roles ur JOIN roles r ON r.id=ur.role_id AND r.status='ACTIVE' JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=? AND p.permission_code='PROGRAM_COMPARE'",
      [actor],
    );
    const expected = await db.query(
      "SELECT CAST(v.id AS CHAR) versionId FROM program_versions v JOIN training_programs p ON p.id=v.program_id WHERE EXISTS(SELECT 1 FROM vw_user_program_access a WHERE a.user_id=? AND a.program_id=p.id) ORDER BY p.program_code,v.cohort_year DESC,v.id DESC",
      [actor],
    );
    const options = await repo.options(actor, { page: 1, limit: 100 });
    same(
      options.data.map((x) => x.versionId),
      expected.map((x) => x.versionId),
      user.username + " version scope",
    );
    const http = await request(app.getHttpServer()).get("/so-sanh/options");
    same(
      http.status,
      Number(permission.total) ? 200 : 403,
      user.username + " SQL permission",
    );
    if (!Number(permission.total)) {
      denied++;
      continue;
    }
    same(http.body.meta.total, expected.length, "HTTP total");
    for (const option of options.data) {
      const expectedTracks = await db.query(
        "SELECT CAST(id AS CHAR) id FROM program_version_tracks WHERE program_version_id=? ORDER BY id",
        [option.versionId],
      );
      same(
        option.tracks.map((t) => t.id),
        expectedTracks.map((t) => t.id),
        "all SQL tracks",
      );
      for (const track of option.tracks) {
        const q = {
          versionA: option.versionId,
          trackA: track.id,
          versionB: option.versionId,
          trackB: track.id,
        };
        const response = await request(app.getHttpServer())
          .get("/so-sanh")
          .query(q);
        same(response.status, 200, "compare HTTP");
        const data = response.body;
        const sql = await db.query(
          "SELECT CAST(cc.course_id AS CHAR) courseId,CAST(cc.course_version_id AS CHAR) courseVersionId,cv.course_name name,cv.credits,cc.requirement_type requirementType,cc.suggested_semester semester FROM curriculum_courses cc JOIN course_versions cv ON cv.id=cc.course_version_id WHERE cc.program_version_track_id=? ORDER BY cc.course_id",
          [track.id],
        );
        same(
          [...data.a.courses]
            .sort((a, b) => Number(a.courseId) - Number(b.courseId))
            .map((c) => ({
              courseId: c.courseId,
              courseVersionId: c.courseVersionId,
              name: c.name,
              credits: c.credits,
              requirementType: c.requirementType,
              semester: c.semester,
            })),
          sql.map((c) => ({
            ...c,
            credits: Number(c.credits),
            semester: c.semester == null ? null : Number(c.semester),
          })),
          "exact SQL courses/versions/credits",
        );
        same(data.summary.same, sql.length, "self comparison");
        same(
          data.summary.changed + data.summary.onlyA + data.summary.onlyB,
          0,
          "no artificial differences",
        );
        const [groups] = await db.query(
          "SELECT COUNT(*) total FROM curriculum_groups WHERE program_version_track_id=?",
          [track.id],
        );
        same(data.groups.length, Number(groups.total), "all groups");
        const [plo] = await db.query(
          "SELECT COUNT(*) total FROM program_learning_outcomes WHERE program_version_id=?",
          [option.versionId],
        );
        same(data.outcomes.length, Number(plo.total), "all PLO");
        const rawGroups = await db.query(
          "SELECT g.group_code code,g.group_name name,parent.group_code parentCode,g.minimum_credits minimumCredits,g.maximum_credits maximumCredits FROM curriculum_groups g LEFT JOIN curriculum_groups parent ON parent.id=g.parent_group_id WHERE g.program_version_track_id=? ORDER BY g.display_order,g.id",
          [track.id],
        );
        same(
          data.a.groups,
          rawGroups.map((g) => ({
            ...g,
            minimumCredits: Number(g.minimumCredits),
            maximumCredits:
              g.maximumCredits == null ? null : Number(g.maximumCredits),
          })),
          "group constraints/zero/null SQL",
        );
        const [meta] = await db.query(
          "SELECT d.language_requirement languageRequirement,d.study_form studyForm,d.required_total_credits versionRequiredCredits,t.required_total_credits requiredCredits FROM program_versions v JOIN program_version_tracks t ON t.program_version_id=v.id LEFT JOIN program_ui_details d ON d.program_version_id=v.id WHERE v.id=? AND t.id=?",
          [option.versionId, track.id],
        );
        same(
          data.a.languageRequirement,
          meta.languageRequirement,
          "no invented language rule",
        );
        same(data.a.studyForm, meta.studyForm, "no invented study form");
        same(
          data.a.versionRequiredCredits,
          meta.versionRequiredCredits == null
            ? null
            : Number(meta.versionRequiredCredits),
          "no invented general credit quota",
        );
        same(
          data.a.requiredCredits,
          Number(meta.requiredCredits),
          "exact track quota",
        );
        for (const course of data.a.courses) {
          const expectedPrerequisites = await db.query(
            "SELECT CAST(required.course_id AS CHAR) courseId,c.course_code code,cp.minimum_grade minimumGrade FROM curriculum_prerequisites cp JOIN curriculum_courses owner ON owner.id=cp.curriculum_course_id JOIN curriculum_courses required ON required.id=cp.prerequisite_curriculum_course_id JOIN courses c ON c.id=required.course_id WHERE owner.program_version_track_id=? AND owner.course_id=? ORDER BY c.course_code",
            [track.id, course.courseId],
          );
          same(
            course.prerequisites,
            expectedPrerequisites,
            "complete prerequisite/minimum grade SQL",
          );
          const expectedMappings = await db.query(
            "SELECT plo.plo_code code,plo.description,plo.status,cm.contribution_level contributionLevel FROM curriculum_course_plos cm JOIN program_learning_outcomes plo ON plo.id=cm.plo_id JOIN curriculum_courses cc ON cc.id=cm.curriculum_course_id WHERE cc.program_version_track_id=? AND cc.course_id=? ORDER BY plo.plo_code",
            [track.id, course.courseId],
          );
          same(
            course.ploMappings,
            expectedMappings,
            "complete PLO mappings SQL",
          );
        }
        const invalid = await request(app.getHttpServer())
          .get("/so-sanh")
          .query({ ...q, trackB: "18446744073709551615" });
        same(invalid.status, 404, "unknown/mismatched direction");
        if (!compared) {
          for (const bad of [
            { versionA: "0" },
            { trackA: "1 OR 1=1" },
            { trackA: "" },
          ]) {
            same(
              (
                await request(app.getHttpServer())
                  .get("/so-sanh")
                  .query({ ...q, ...bad })
              ).status,
              400,
              "validation",
            );
          }
          same(
            (
              await request(app.getHttpServer()).get(
                "/so-sanh/options?limit=101",
              )
            ).status,
            400,
            "pagination bound",
          );
          const exportResponse = await request(app.getHttpServer())
            .get("/so-sanh/export")
            .query(q);
          same(exportResponse.status, 200, "xlsx HTTP");
          const workbook = new Workbook();
          await workbook.xlsx.load(await service.export(actor, q));
          same(workbook.worksheets.length, 4, "xlsx sheets");
          same(
            workbook.getWorksheet("Hoc phan").rowCount,
            sql.length + 1,
            "xlsx complete course rows",
          );
        }
        compared++;
      }
    }
    const tiny = await request(app.getHttpServer()).get(
      "/so-sanh/options?page=1&limit=1",
    );
    same(
      tiny.body.data.length,
      Math.min(1, expected.length),
      "option pagination",
    );
    same(tiny.body.meta.total, expected.length, "paged total");
    if (options.data.length) {
      const code = options.data[0].programCode;
      const search = await request(app.getHttpServer())
        .get("/so-sanh/options")
        .query({ searchTerm: code });
      same(search.status, 200, "search HTTP");
      assert(
        search.body.data.every(
          (v) =>
            v.programCode.includes(code) ||
            v.programName.includes(code) ||
            v.versionCode.includes(code),
        ),
      );
      checks++;
    }
    const choices = options.data.flatMap((v) =>
      v.tracks.map((t) => ({ version: v.versionId, track: t.id })),
    );
    for (let i = 1; i < choices.length; i++) {
      const a = choices[0],
        b = choices[i];
      const query = {
        versionA: a.version,
        trackA: a.track,
        versionB: b.version,
        trackB: b.track,
      };
      const response = await request(app.getHttpServer())
        .get("/so-sanh")
        .query(query);
      same(response.status, 200, "cross-version/direction HTTP");
      const result = response.body;
      const left = await db.query(
        "SELECT CAST(course_id AS CHAR) id,CAST(course_version_id AS CHAR) versionId FROM curriculum_courses WHERE program_version_track_id=?",
        [a.track],
      );
      const right = await db.query(
        "SELECT CAST(course_id AS CHAR) id,CAST(course_version_id AS CHAR) versionId FROM curriculum_courses WHERE program_version_track_id=?",
        [b.track],
      );
      const lm = new Map(left.map((x) => [x.id, x])),
        rm = new Map(right.map((x) => [x.id, x]));
      same(
        result.courses.length,
        new Set([...lm.keys(), ...rm.keys()]).size,
        "union without duplicate cross-track entries",
      );
      same(
        result.summary.onlyA,
        left.filter((x) => !rm.has(x.id)).length,
        "removed course count SQL",
      );
      same(
        result.summary.onlyB,
        right.filter((x) => !lm.has(x.id)).length,
        "added course count SQL",
      );
      for (const item of result.courses) {
        same(
          item.a?.courseVersionId || null,
          lm.get(item.key)?.versionId || null,
          "exact A historical version",
        );
        same(
          item.b?.courseVersionId || null,
          rm.get(item.key)?.versionId || null,
          "exact B historical version",
        );
        if (
          item.a &&
          item.b &&
          item.a.courseVersionId !== item.b.courseVersionId
        )
          same(
            item.status,
            "CHANGED",
            "changed historical course version detected",
          );
      }
      const reverse = await service.compare(actor, {
        versionA: b.version,
        trackA: b.track,
        versionB: a.version,
        trackB: a.track,
      });
      same(reverse.summary.onlyA, result.summary.onlyB, "swap A/B direction");
      same(
        reverse.summary.changed,
        result.summary.changed,
        "swap content change symmetry",
      );
    }
    const outside = await db.query(
      "SELECT CAST(v.id AS CHAR) versionId,CAST(t.id AS CHAR) trackId FROM program_versions v JOIN program_version_tracks t ON t.program_version_id=v.id WHERE NOT EXISTS(SELECT 1 FROM vw_user_program_access a WHERE a.user_id=? AND a.program_id=v.program_id) LIMIT 1",
      [actor],
    );
    if (outside.length) {
      const x = outside[0];
      same(
        (
          await request(app.getHttpServer()).get("/so-sanh").query({
            versionA: x.versionId,
            trackA: x.trackId,
            versionB: x.versionId,
            trackB: x.trackId,
          })
        ).status,
        404,
        "cross-unit scope injection",
      );
      same(
        (
          await request(app.getHttpServer()).get("/so-sanh/export").query({
            versionA: x.versionId,
            trackA: x.trackId,
            versionB: x.versionId,
            trackB: x.trackId,
          })
        ).status,
        404,
        "export scope injection",
      );
    }
  }
  assert(
    compared > 0,
    "Need real SQL tracks and PROGRAM_COMPARE users to verify.",
  );
  assert(
    denied > 0,
    "Need SQL account without PROGRAM_COMPARE to verify denial.",
  );
  console.log(
    "PASS " +
      checks +
      " read-only SQL/HTTP/XLSX checks; compared " +
      compared +
      " scoped tracks. JWT transport not exercised by this script.",
  );
}
run()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (app) await app.close();
  });
