import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import {
  ReportFilter,
  ReportItem,
  ReportRepository,
  ReportSummary,
} from "../domain/report";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Bản nháp",
  SUBMITTED: "Chờ duyệt",
  REVIEWING: "Đang xét duyệt",
  RETURNED: "Trả về chỉnh sửa",
  PUBLISHED: "Đã ban hành",
  ARCHIVED: "Đã lưu trữ",
  RETIRED: "Ngừng sử dụng",
};

// One row per program; the latest version is ordered by cohort, creation time, ID.
// Aggregate tracks and assignments separately to avoid multiplying student counts.
const BASE_QUERY = `
  SELECT CAST(p.id AS CHAR) AS id, p.program_code AS maCTDT,
    COALESCE(v.program_name_snapshot, p.program_name) AS tenCTDT,
    e.level_name AS bacDaoTao, u.unit_name AS khoaQuanLy,
    CAST(v.id AS CHAR) AS programVersionId, v.status AS status,
    COALESCE((
      SELECT MAX(t.required_total_credits) FROM program_version_tracks t
      WHERE t.program_version_id = v.id AND t.status = 'ACTIVE'
    ), 0) AS tongTinChi,
    (SELECT COUNT(DISTINCT a.student_id)
      FROM student_program_assignments a
      JOIN program_version_tracks t ON t.id = a.program_version_track_id
      JOIN program_versions av ON av.id = t.program_version_id
      WHERE av.program_id = p.id AND a.assignment_status = 'ACTIVE'
    ) AS soHocVien
  FROM training_programs p
  JOIN education_levels e ON e.id = p.education_level_id
  JOIN organizational_units u ON u.id = p.managing_unit_id
  LEFT JOIN program_versions v ON v.id = (
    SELECT latest.id FROM program_versions latest WHERE latest.program_id = p.id
    ORDER BY latest.cohort_year DESC, latest.created_at DESC, latest.id DESC LIMIT 1
  )
  WHERE (? = '' OR LOCATE(LOWER(?), LOWER(p.program_code)) > 0
    OR LOCATE(LOWER(?), LOWER(COALESCE(v.program_name_snapshot, p.program_name))) > 0)
    AND (? = 'ALL' OR e.level_code = ? OR e.level_name = ?)
    AND (? IS NULL OR EXISTS (
      SELECT 1 FROM user_scopes s WHERE s.user_id=? AND (
        s.scope_type='GLOBAL'
        OR (s.scope_type='ORG_UNIT' AND EXISTS (SELECT 1 FROM organizational_unit_closure cl WHERE cl.ancestor_id=s.organizational_unit_id AND cl.descendant_id=p.managing_unit_id))
        OR (s.scope_type='MAJOR' AND s.major_id=p.major_id)
        OR (s.scope_type='PROGRAM' AND s.program_id=p.id)
      )
    ))
`;

@Injectable()
export class MysqlReportRepository implements ReportRepository {
  constructor(private readonly dataSource: DataSource) {}

  private parameters(filter: ReportFilter): (string | null)[] {
    const search = filter.searchTerm?.trim() || "";
    const degree = filter.selectedDegree?.trim() || "ALL";
    return [
      search,
      search,
      search,
      degree,
      degree,
      degree,
      filter.actorId || null,
      filter.actorId || null,
    ];
  }

  async findAll(
    filter: ReportFilter,
    offset?: number,
    limit?: number,
  ): Promise<ReportItem[]> {
    const parameters: (string | number | null)[] = this.parameters(filter);
    let sql = BASE_QUERY + " ORDER BY maCTDT ASC, p.id ASC";
    if (limit !== undefined) {
      sql += " LIMIT ? OFFSET ?";
      parameters.push(limit, offset ?? 0);
    }
    const rows = await this.dataSource.query(sql, parameters);
    return rows.map((row) => ({
      ...row,
      id: String(row.id),
      programVersionId:
        row.programVersionId == null ? null : String(row.programVersionId),
      tongTinChi: Number(row.tongTinChi),
      soHocVien: Number(row.soHocVien),
      trangThai: STATUS_LABELS[row.status] ?? "Chưa có phiên bản",
    }));
  }

  async getSummary(filter: ReportFilter): Promise<ReportSummary> {
    const [row] = await this.dataSource.query(
      `
      SELECT COUNT(*) AS tongChuongTrinh,
        COALESCE(SUM(r.soHocVien), 0) AS tongHocVien,
        (SELECT COUNT(*) FROM courses WHERE status = 'ACTIVE') AS tongHocPhan,
        COALESCE(ROUND(100.0 * SUM(CASE WHEN r.status = 'PUBLISHED' THEN 1 ELSE 0 END)
          / NULLIF(COUNT(*), 0), 1), 0) AS tyLeHoanThanh
      FROM (${BASE_QUERY}) r
    `,
      this.parameters(filter),
    );
    return {
      tongChuongTrinh: Number(row.tongChuongTrinh),
      tongHocVien: Number(row.tongHocVien),
      tongHocPhan: Number(row.tongHocPhan),
      tyLeHoanThanh: Number(row.tyLeHoanThanh),
    };
  }

  async getDegrees(): Promise<{ value: string; label: string }[]> {
    return this.dataSource.query(
      "SELECT level_code AS value, level_name AS label FROM education_levels ORDER BY level_name, id",
    );
  }
}
