import { Injectable, NotFoundException } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { ComparisonRepository, ComparisonSnapshot } from "../domain/comparison";
import { ComparisonOptionsDto } from "../application/comparison.dto";
const ACCESS = `EXISTS(SELECT 1 FROM vw_user_program_access access
 WHERE access.user_id=? AND access.program_id=p.id)`;
@Injectable()
export class MysqlComparisonRepository extends ComparisonRepository {
  constructor(private readonly db: DataSource) {
    super();
  }
  async options(actorId: string, query: ComparisonOptionsDto) {
    return this.db.transaction("REPEATABLE READ", async (manager) => {
      const search = query.searchTerm || "";
      const from = ` FROM program_versions v JOIN training_programs p ON p.id=v.program_id
        JOIN organizational_units u ON u.id=p.managing_unit_id WHERE ${ACCESS}
        AND (?='' OR LOCATE(?,p.program_code)>0 OR LOCATE(?,v.program_name_snapshot)>0 OR LOCATE(?,v.version_code)>0)`;
      const params = [actorId, search, search, search, search];
      const [count] = await manager.query(
        "SELECT COUNT(*) total" + from,
        params,
      );
      const data = await manager.query(
        `SELECT CAST(v.id AS CHAR) versionId,p.program_code programCode,
        v.program_name_snapshot programName,v.version_code versionCode,v.status,v.cohort_year cohortYear,u.unit_name unitName` +
          from +
          " ORDER BY p.program_code,v.cohort_year DESC,v.id DESC LIMIT ? OFFSET ?",
        [...params, query.limit, (query.page - 1) * query.limit],
      );
      for (const row of data) {
        row.cohortYear = Number(row.cohortYear);
        row.tracks = await manager.query(
          `SELECT CAST(id AS CHAR) id,track_code_snapshot code,
          track_name_snapshot name,status FROM program_version_tracks WHERE program_version_id=? ORDER BY id`,
          [row.versionId],
        );
      }
      const total = Number(count.total);
      return {
        data,
        meta: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      };
    });
  }
  async snapshots(
    actorId: string,
    va: string,
    ta: string,
    vb: string,
    tb: string,
  ): Promise<[ComparisonSnapshot, ComparisonSnapshot]> {
    return this.db.transaction("REPEATABLE READ", async (manager) => [
      await this.snapshot(manager, actorId, va, ta),
      await this.snapshot(manager, actorId, vb, tb),
    ]);
  }
  private async snapshot(
    manager: EntityManager,
    actorId: string,
    version: string,
    track: string,
  ): Promise<ComparisonSnapshot> {
    const [row] = await manager.query(
      `SELECT CAST(v.id AS CHAR) versionId,p.program_code programCode,
      v.program_name_snapshot programName,v.version_code versionCode,v.status,v.cohort_year cohortYear,
      u.unit_name unitName,e.level_name levelName,m.major_name majorName,
      d.study_form studyForm,d.duration_label duration,d.cohort_label cohortLabel,
      d.language_requirement languageRequirement,d.it_requirement itRequirement,d.required_total_credits versionRequiredCredits,
      DATE_FORMAT(v.effective_from,'%Y-%m-%d') effectiveFrom,DATE_FORMAT(v.effective_to,'%Y-%m-%d') effectiveTo,
      CAST(t.id AS CHAR) trackId,t.track_code_snapshot trackCode,t.track_name_snapshot trackName,
      t.status trackStatus,t.required_total_credits requiredCredits
      FROM program_versions v JOIN training_programs p ON p.id=v.program_id
      JOIN organizational_units u ON u.id=p.managing_unit_id JOIN education_levels e ON e.id=p.education_level_id
      JOIN majors m ON m.id=p.major_id JOIN program_version_tracks t ON t.program_version_id=v.id AND t.id=?
      LEFT JOIN program_ui_details d ON d.program_version_id=v.id WHERE v.id=? AND ${ACCESS}`,
      [track, version, actorId],
    );
    if (!row)
      throw new NotFoundException(
        "Không tìm thấy phiên bản/hướng trong phạm vi được cấp quyền.",
      );
    row.cohortYear = Number(row.cohortYear);
    row.requiredCredits = Number(row.requiredCredits);
    row.versionRequiredCredits =
      row.versionRequiredCredits == null
        ? null
        : Number(row.versionRequiredCredits);
    const groups = await manager.query(
      `SELECT g.group_code code,g.group_name name,parent.group_code parentCode,
      g.minimum_credits minimumCredits,g.maximum_credits maximumCredits FROM curriculum_groups g
      LEFT JOIN curriculum_groups parent ON parent.id=g.parent_group_id
      WHERE g.program_version_track_id=? ORDER BY g.display_order,g.id`,
      [track],
    );
    const courses = await manager.query(
      `SELECT CAST(cc.id AS CHAR) entryId,CAST(cc.course_id AS CHAR) courseId,c.course_code code,
      CAST(cv.id AS CHAR) courseVersionId,cv.version_no versionNumber,cv.course_name name,cv.english_name englishName,
      cv.credits,cv.theory_hours theoryHours,cv.practice_hours practiceHours,cv.description,
      g.group_code groupCode,cc.requirement_type requirementType,cc.suggested_semester semester,cc.notes
      FROM curriculum_courses cc JOIN courses c ON c.id=cc.course_id JOIN course_versions cv ON cv.id=cc.course_version_id
      JOIN curriculum_groups g ON g.id=cc.curriculum_group_id WHERE cc.program_version_track_id=? ORDER BY c.course_code`,
      [track],
    );
    const prerequisites = await manager.query(
      `SELECT CAST(cp.curriculum_course_id AS CHAR) ownerId,
      CAST(required.course_id AS CHAR) courseId,c.course_code code,cp.minimum_grade minimumGrade
      FROM curriculum_prerequisites cp JOIN curriculum_courses owner ON owner.id=cp.curriculum_course_id
      JOIN curriculum_courses required ON required.id=cp.prerequisite_curriculum_course_id
      JOIN courses c ON c.id=required.course_id WHERE owner.program_version_track_id=? ORDER BY c.course_code`,
      [track],
    );
    const mappings = await manager.query(
      `SELECT CAST(cm.curriculum_course_id AS CHAR) ownerId,
      plo.plo_code code,plo.description,plo.status,cm.contribution_level contributionLevel
      FROM curriculum_course_plos cm JOIN program_learning_outcomes plo ON plo.id=cm.plo_id
      JOIN curriculum_courses cc ON cc.id=cm.curriculum_course_id WHERE cc.program_version_track_id=? ORDER BY plo.plo_code`,
      [track],
    );
    const outcomes = await manager.query(
      `SELECT plo_code code,description,status FROM program_learning_outcomes
      WHERE program_version_id=? ORDER BY display_order,id`,
      [version],
    );
    return {
      ...row,
      outcomes,
      groups: groups.map((g) => ({
        ...g,
        minimumCredits: Number(g.minimumCredits),
        maximumCredits:
          g.maximumCredits == null ? null : Number(g.maximumCredits),
      })),
      courses: courses.map(({ entryId, ...c }) => ({
        ...c,
        versionNumber: Number(c.versionNumber),
        credits: Number(c.credits),
        theoryHours: Number(c.theoryHours),
        practiceHours: Number(c.practiceHours),
        semester: c.semester == null ? null : Number(c.semester),
        prerequisites: prerequisites
          .filter((p) => p.ownerId === entryId)
          .map(({ ownerId, ...p }) => p),
        ploMappings: mappings
          .filter((p) => p.ownerId === entryId)
          .map(({ ownerId, ...p }) => p),
      })),
    };
  }
}
