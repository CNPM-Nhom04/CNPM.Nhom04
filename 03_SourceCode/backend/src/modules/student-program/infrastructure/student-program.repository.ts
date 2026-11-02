import { ConflictException, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import {
  OwnCurriculum,
  OwnProgramResult,
  StudentProfile,
  StudentProgramRepository,
} from "../domain/student-program";
@Injectable()
export class MysqlStudentProgramRepository extends StudentProgramRepository {
  constructor(private readonly db: DataSource) {
    super();
  }
  own(userId: string): Promise<OwnProgramResult> {
    return this.db.transaction("REPEATABLE READ", async (manager) => {
      // Never infer identity from username/email/studentCode or accept a student ID from the caller.
      const [row] = await manager.query(
        `SELECT CAST(s.id AS CHAR) id,s.student_code studentCode,s.full_name fullName,s.admission_year admissionYear,s.status,u.unit_name unitName
    FROM students s LEFT JOIN organizational_units u ON u.id=s.organizational_unit_id WHERE s.user_id=?`,
        [userId],
      );
      if (!row)
        return {
          state: "UNLINKED",
          message:
            "Tài khoản chưa được liên kết với hồ sơ học viên. Vui lòng liên hệ cán bộ đào tạo.",
          student: null,
          curriculum: null,
        };
      const student: StudentProfile = {
        ...row,
        admissionYear: Number(row.admissionYear),
      };
      const assignments = await manager.query(
        `SELECT CAST(a.id AS CHAR) assignmentId,DATE_FORMAT(a.assigned_at,'%Y-%m-%d %H:%i:%s') assignedAt,
    CAST(t.id AS CHAR) trackId,t.track_code_snapshot trackCode,t.track_name_snapshot trackName,t.status trackStatus,t.required_total_credits requiredCredits,
    CAST(v.id AS CHAR) versionId,v.version_code versionCode,v.program_name_snapshot programName,v.status versionStatus,v.cohort_year cohortYear,
    p.program_code programCode,e.level_name levelName,m.major_name majorName,u.unit_name unitName,
    DATE_FORMAT(v.effective_from,'%Y-%m-%d') effectiveFrom,DATE_FORMAT(v.effective_to,'%Y-%m-%d') effectiveTo,
    d.decision_number decisionNumber,DATE_FORMAT(d.decision_date,'%Y-%m-%d') decisionDate
    FROM student_program_assignments a JOIN students s ON s.id=a.student_id
    JOIN program_version_tracks t ON t.id=a.program_version_track_id JOIN program_versions v ON v.id=t.program_version_id
    JOIN training_programs p ON p.id=v.program_id JOIN education_levels e ON e.id=p.education_level_id
    JOIN majors m ON m.id=p.major_id JOIN organizational_units u ON u.id=p.managing_unit_id LEFT JOIN program_ui_details d ON d.program_version_id=v.id
    WHERE s.user_id=? AND a.assignment_status='ACTIVE' ORDER BY a.id`,
        [userId],
      );
      if (!assignments.length)
        return {
          state: "UNASSIGNED",
          message:
            "Hồ sơ học viên chưa có phân công CTĐT đang hoạt động. Vui lòng liên hệ cán bộ đào tạo.",
          student,
          curriculum: null,
        };
      if (assignments.length !== 1)
        throw new ConflictException(
          "Hồ sơ có nhiều phân công CTĐT đang hoạt động. Vui lòng liên hệ cán bộ đào tạo để kiểm tra.",
        );
      const assigned = assignments[0];
      // Same publication rule as vw_student_curriculum; archived assignments remain the student's own curriculum.
      if (!["PUBLISHED", "ARCHIVED"].includes(assigned.versionStatus))
        return {
          state: "UNAVAILABLE",
          message:
            "CTĐT được phân công chưa ở trạng thái có thể tra cứu. Vui lòng liên hệ cán bộ đào tạo.",
          student,
          curriculum: null,
        };
      const groups = await manager.query(
        `SELECT CAST(id AS CHAR) id,group_code code,group_name name,CAST(parent_group_id AS CHAR) parentId,minimum_credits minimumCredits,maximum_credits maximumCredits
    FROM curriculum_groups WHERE program_version_track_id=? ORDER BY display_order,id`,
        [assigned.trackId],
      );
      const courses = await manager.query(
        `SELECT CAST(sc.curriculum_course_id AS CHAR) id,CAST(sc.course_version_id AS CHAR) courseVersionId,
    sc.course_code code,sc.course_name name,cv.version_no versionNo,sc.credits,cv.theory_hours theoryHours,cv.practice_hours practiceHours,
    CAST(cc.curriculum_group_id AS CHAR) groupId,sc.requirement_type requirementType,cc.suggested_semester semester,cc.notes
    FROM vw_student_curriculum sc JOIN curriculum_courses cc ON cc.id=sc.curriculum_course_id JOIN course_versions cv ON cv.id=sc.course_version_id
    WHERE sc.user_id=? AND sc.assignment_id=? AND sc.program_version_track_id=? ORDER BY cc.display_order,cc.id`,
        [userId, assigned.assignmentId, assigned.trackId],
      );
      const prerequisites = await manager.query(
        `SELECT CAST(cp.curriculum_course_id AS CHAR) ownerId,CAST(cp.prerequisite_curriculum_course_id AS CHAR) courseEntryId,
    c.course_code code,cv.course_name name,cv.version_no versionNo,cp.minimum_grade minimumGrade
    FROM curriculum_prerequisites cp JOIN vw_student_curriculum owner ON owner.curriculum_course_id=cp.curriculum_course_id
    JOIN curriculum_courses required ON required.id=cp.prerequisite_curriculum_course_id AND required.program_version_track_id=owner.program_version_track_id
    JOIN courses c ON c.id=required.course_id JOIN course_versions cv ON cv.id=required.course_version_id
    WHERE owner.user_id=? AND owner.assignment_id=? ORDER BY cp.id`,
        [userId, assigned.assignmentId],
      );
      const curriculum: OwnCurriculum = {
        ...assigned,
        cohortYear: Number(assigned.cohortYear),
        requiredCredits: Number(assigned.requiredCredits),
        groups: groups.map((g) => ({
          ...g,
          minimumCredits: Number(g.minimumCredits),
          maximumCredits:
            g.maximumCredits == null ? null : Number(g.maximumCredits),
        })),
        courses: courses.map((c) => ({
          ...c,
          credits: Number(c.credits),
          versionNo: Number(c.versionNo),
          theoryHours: Number(c.theoryHours),
          practiceHours: Number(c.practiceHours),
          semester: c.semester == null ? null : Number(c.semester),
          prerequisites: prerequisites
            .filter((p) => p.ownerId === c.id)
            .map(({ ownerId, ...p }) => p),
        })),
      };
      return {
        state: "READY",
        message: "CTĐT theo phân công đang hoạt động của học viên.",
        student,
        curriculum,
      };
    });
  }
}
