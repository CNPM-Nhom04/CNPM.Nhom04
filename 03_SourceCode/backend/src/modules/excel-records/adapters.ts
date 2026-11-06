import {
  OfferingExcelRepository,
  OfferingInput,
} from "../grades/infrastructure/offering-excel.repository";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { Account, Adapter, Column, RecordRow, allPages } from "./types";
import { AuthSecurityRepository } from "../identity/domain/auth-security.repository";
import { MysqlAdminRepository } from "../admin/infrastructure/admin.repository";
import { AdminService } from "../admin/application/admin.service";
import { FacultyService } from "../admin/application/faculty.service";
import { FacultyInputDto } from "../admin/application/faculty.dto";
import { MajorInputDto, UpdateMajorDto } from "../admin/application/major.dto";
import { CreateUserDto, UserInputDto } from "../admin/application/admin.dto";
import { MysqlStudentAccountsRepository } from "../student-accounts/infrastructure/student-accounts.repository";
import { StudentAccountsService } from "../student-accounts/application/student-accounts.service";
import {
  CreateStudentClassDto,
  UpdateStudentClassDto,
} from "../student-accounts/application/student-accounts.dto";
import { MysqlCourseRepository } from "../courses/infrastructure/course.repository";
import { CourseService } from "../courses/application/course.service";
import {
  CreateCourseDto,
  ReviseCourseDto,
} from "../courses/application/course.dto";
import { MysqlProgramRepository } from "../programs/infrastructure/program.repository";
import { ProgramService } from "../programs/application/program.service";
import { ProgramInputDto } from "../programs/application/program.dto";
import { MysqlTopicRepository } from "../thesis-topic/infrastructure/thesis-topic.repository";
import { ThesisTopicService } from "../thesis-topic/application/thesis-topic.service";
import {
  CreateTopicDto,
  UpdateTopicDto,
  CreateSupervisorDto,
} from "../thesis-topic/application/thesis-topic.dto";
import { MysqlDefenseRepository } from "../thesis-defense/infrastructure/thesis-defense.repository";
import { ThesisDefenseService } from "../thesis-defense/application/thesis-defense.service";
import {
  CreateDefenseDto,
  RecordDefenseResultDto,
} from "../thesis-defense/application/thesis-defense.dto";
import { MysqlPortalRepository } from "../public-portal/infrastructure/portal.repository";
import { PortalService } from "../public-portal/application/portal.service";
import { PublicDocumentDto } from "../public-portal/application/portal.dto";
export const RESOURCES = [
  "faculties",
  "majors",
  "users",
  "student-classes",
  "courses",
  "programs",
  "topics",
  "supervisors",
  "defenses",
  "documents",
  "course-offerings",
] as const;
const status = [
  { value: "ACTIVE", label: "Hoạt động" },
  { value: "INACTIVE", label: "Ngừng hoạt động" },
];
const c = (
  key: string,
  label: string,
  extra: Partial<Column> = {},
): Column => ({ key, label, ...extra });
const pick = (v: any, keys: string[]) =>
  Object.fromEntries(keys.map((key) => [key, v[key]]));
const choices = (items: any[], id: string, label: (item: any) => string) =>
  items.map((item) => ({
    value: String(item[id]),
    label: label(item) + ` [${item[id]}]`,
  }));
async function checked(dto: any, input: any) {
  const value = plainToInstance(dto, input);
  const errors = await validate(value, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  if (errors.length)
    throw new BadRequestException(
      errors.flatMap((e) => Object.values(e.constraints || {})).join("; "),
    );
  return value;
}
function requirePermissions(
  account: Account,
  permissions: string[],
  admin = false,
) {
  if (
    (admin && !account.roles.includes("ADMIN")) ||
    permissions.some((p) => !account.permissions.includes(p))
  )
    throw new ForbiddenException(
      "Tài khoản chưa có quyền nhập/sửa dữ liệu này.",
    );
}
function record(
  raw: any,
  columns: Column[],
  label: string,
  values: any = raw,
  locked: string[] = [],
): RecordRow {
  return {
    id: String(raw.id),
    label,
    raw,
    locked,
    values: Object.fromEntries(
      columns.map((col) => [
        col.key,
        values[col.key] ?? col.default ?? (col.kind === "number" ? null : ""),
      ]),
    ),
  };
}
export async function adapterFor(
  resource: string,
  db: DataSource,
  account: Account,
  security: AuthSecurityRepository,
  baseId?: string,
): Promise<Adapter> {
  const actor = {
    id: account.id,
    username: account.username,
    ip: account.ip,
    permissions: account.permissions,
  };
  const adminRepo = new MysqlAdminRepository(db),
    admin = new AdminService(adminRepo, security);
  const adminActor = (permission: string) => ({ ...actor, permission });
  const adminLock = () =>
    db
      .query("SELECT id FROM roles WHERE role_code='ADMIN' FOR UPDATE")
      .then(() => {});
  if (resource === "faculties") {
    requirePermissions(account, ["MASTERDATA_MANAGE"], true);
    const service = new FacultyService(adminRepo);
    const columns = [
      c("code", "Mã khoa"),
      c("name", "Tên khoa"),
      c("description", "Mô tả"),
      c("status", "Trạng thái", { choices: status, default: "ACTIVE" }),
      c("parentName", "Đơn vị cha", { readonly: true }),
    ];
    return {
      title: "Khoa / đơn vị",
      columns,
      lock: adminLock,
      load: async () =>
        (
          await allPages((page) =>
            service.list({ page, limit: 100, status: "ALL" }),
          )
        ).map((r) => record(r, columns, r.code + " — " + r.name)),
      validate: async (v, row) => ({
        ...(await checked(
          FacultyInputDto,
          pick(v, ["code", "name", "description", "status"]),
        )),
        expectedUpdatedAt: row?.raw.updatedAt,
      }),
      save: (v, row) =>
        service.save(
          row?.id || null,
          v,
          adminActor("MASTERDATA_MANAGE"),
          v.expectedUpdatedAt,
        ),
    };
  }
  if (resource === "majors") {
    requirePermissions(account, ["MASTERDATA_MANAGE"], true);
    const options = await admin.majorOptions();
    const columns = [
      c("majorCode", "Mã ngành"),
      c("majorName", "Tên ngành"),
      c("unitId", "Khoa / đơn vị quản lý", {
        choices: choices(options.units, "id", (u) => u.code + " — " + u.name),
      }),
      c("status", "Trạng thái", { choices: status, default: "ACTIVE" }),
    ];
    return {
      title: "Ngành đào tạo",
      columns,
      lock: adminLock,
      load: async () =>
        (
          await allPages((page) =>
            admin.listMajors({ page, limit: 100, status: "ALL" }),
          )
        ).map((r) => record(r, columns, r.majorCode + " — " + r.majorName)),
      validate: (v, row) =>
        checked(row ? UpdateMajorDto : MajorInputDto, {
          ...v,
          ...(row ? { expectedUpdatedAt: row.raw.updatedAt } : {}),
        }),
      save: (v, row) =>
        row
          ? admin.updateMajor(row.id, v, adminActor("MASTERDATA_MANAGE"))
          : admin.createMajor(v, adminActor("MASTERDATA_MANAGE")),
    };
  }
  if (resource === "users") {
    requirePermissions(account, ["USER_MANAGE"], true);
    const options = await admin.userOptions();
    const roles = [
      ["QUAN_TRI", "Quản trị viên"],
      ["CAN_BO_DAO_TAO", "Cán bộ đào tạo"],
      ["HOI_DONG", "Hội đồng khoa học"],
      ["GIANG_VIEN", "Giảng viên"],
      ["HOC_VIEN", "Học viên"],
    ].map(([value, label]) => ({ value, label }));
    const columns = [
      c("username", "Tên đăng nhập", { immutable: true }),
      c("hoTen", "Họ và tên"),
      c("email", "Email"),
      c("donViId", "Khoa / đơn vị", {
        choices: [
          { value: "", label: "Không gắn đơn vị" },
          ...choices(options.units, "id", (u) => u.name),
        ],
      }),
      c("vaiTro", "Vai trò", { choices: roles, default: "HOC_VIEN" }),
      c("scopeMode", "Phạm vi quyền", {
        choices: [
          { value: "KEEP", label: "Giữ phạm vi hiện có" },
          { value: "UNIT", label: "Theo đơn vị" },
          { value: "GLOBAL", label: "Toàn hệ thống" },
          { value: "NONE", label: "Không cấp phạm vi" },
        ],
        default: "KEEP",
      }),
      c("trangThai", "Tài khoản hoạt động", { kind: "bool", default: true }),
      c("password", "Mật khẩu ban đầu (chỉ tài khoản mới)", {
        immutable: true,
        secret: true,
      }),
      c("confirmPassword", "Nhập lại mật khẩu ban đầu", {
        immutable: true,
        secret: true,
      }),
    ];
    return {
      title: "Tài khoản người dùng",
      columns,
      lock: adminLock,
      notes: [
        "Mật khẩu cũ không được xuất. Tài khoản mới cần mật khẩu và xác nhận trùng nhau; người dùng đổi mật khẩu ở lần đăng nhập đầu. Vai trò/phạm vi vẫn yêu cầu ROLE_SCOPE_MANAGE.",
      ],
      load: async () =>
        (
          await allPages((page) =>
            admin.listUsers({ page, limit: 100, selectedRole: "ALL" }),
          )
        ).map((r) =>
          record(r, columns, r.username + " — " + r.hoTen, {
            ...r,
            donViId: r.donViId || "",
            scopeMode: "KEEP",
            password: "",
            confirmPassword: "",
          }),
        ),
      validate: (v, row) =>
        checked(
          row ? UserInputDto : CreateUserDto,
          pick(
            v,
            row
              ? [
                  "hoTen",
                  "email",
                  "donViId",
                  "vaiTro",
                  "scopeMode",
                  "trangThai",
                ]
              : columns.map((col) => col.key),
          ),
        ),
      save: (v, row) =>
        row
          ? admin.updateUser(row.id, v, adminActor("USER_MANAGE"))
          : admin.createUser(v, adminActor("USER_MANAGE")),
    };
  }
  if (resource === "course-offerings") {
    requirePermissions(account, [
      "GRADE_READ",
      "GRADE_MANAGE",
      "REGISTRATION_MANAGE",
    ]);
    if (!account.roles.includes("TRAINING_OFFICER"))
      throw new ForbiddenException(
        "Chỉ cán bộ đào tạo được quản lý lớp học phần.",
      );
    const repo = new OfferingExcelRepository(db);
    const gradeActor = { ...actor, canManage: true, canPrepare: true };
    const options = await repo.options(gradeActor);
    const columns = [
      c("code", "Mã lớp học phần", { immutable: true }),
      c("courseVersionId", "Học phần / phiên bản", {
        immutable: true,
        choices: choices(
          options.courses,
          "id",
          (v) => `${v.code} — ${v.name} · v${v.version}`,
        ),
      }),
      c("termId", "Học kỳ", {
        immutable: true,
        choices: choices(
          options.terms,
          "id",
          (v) => `${v.year} — ${v.semester}`,
        ),
      }),
      c("capacity", "Sĩ số tối đa", { kind: "number" }),
      c("status", "Trạng thái lớp", {
        default: "OPEN",
        choices: [
          { value: "OPEN", label: "Đang giảng dạy" },
          { value: "COMPLETED", label: "Đã hoàn tất" },
          { value: "CANCELLED", label: "Đã hủy" },
          { value: "CLOSED", label: "Ngừng tiếp nhận" },
          { value: "CONFIRMED", label: "Đã xác nhận" },
          { value: "PLANNED", label: "Dự kiến" },
        ],
      }),
      c("enrolled", "Học viên đang có", {
        kind: "number",
        readonly: true,
        default: 0,
      }),
      c("reason", "Lý do thay đổi"),
      c("reference", "Số hồ sơ"),
    ];
    return {
      title: "Lớp học phần theo học kỳ",
      columns,
      notes: [
        "Chọn học phần và học kỳ từ danh sách. Lớp mới chọn Đang giảng dạy. Sau khi giảng dạy kết thúc, sửa trạng thái thành Đã hoàn tất để đủ điều kiện chốt điểm.",
        "Mỗi thay đổi cần lý do và số hồ sơ. Không thay môn/học kỳ của lớp cũ; không hủy lớp còn học viên.",
      ],
      lock: () => repo.lock(gradeActor),
      load: async () =>
        (await repo.list(gradeActor)).map((r) =>
          record(r, columns, r.code, {
            ...r,
            capacity: Number(r.capacity),
            enrolled: Number(r.enrolled),
            reason: "",
            reference: "",
          }),
        ),
      validate: async (v) => repo.validate(v as unknown as OfferingInput),
      save: (v, row) => repo.save(v, row?.id || null, gradeActor),
    };
  }
  if (resource === "student-classes") {
    requirePermissions(
      account,
      ["USER_MANAGE", "ROLE_SCOPE_MANAGE", "STUDENT_ACCOUNT_IMPORT"],
      true,
    );
    const service = new StudentAccountsService(
      new MysqlStudentAccountsRepository(db),
    );
    const options: any = await service.options();
    const tracks = options.tracks || options;
    const columns = [
      c("code", "Mã lớp", { immutable: true }),
      c("name", "Tên lớp"),
      c("trackId", "Phiên bản CTĐT / hướng", {
        immutable: true,
        choices: choices(Array.isArray(tracks) ? tracks : [], "id", (t) =>
          [t.programName, t.versionCode, t.trackName || t.name]
            .filter(Boolean)
            .join(" · "),
        ),
      }),
      c("admissionYear", "Khóa nhập học", { kind: "number", immutable: true }),
      c("status", "Trạng thái", { choices: status, default: "ACTIVE" }),
    ];
    return {
      title: "Lớp học viên",
      columns,
      load: async () =>
        (
          await allPages((page) =>
            service.list({ page, limit: 100, status: "ALL" }),
          )
        ).map((r) => record(r, columns, r.code + " — " + r.name)),
      validate: async (v, row) => {
        if (!row && v.status !== "ACTIVE")
          throw new BadRequestException("Lớp mới phải hoạt động.");
        return checked(
          row ? UpdateStudentClassDto : CreateStudentClassDto,
          row
            ? { name: v.name, status: v.status, revision: row.raw.revision }
            : pick(v, ["code", "name", "trackId", "admissionYear"]),
        );
      },
      save: async (v, row) =>
        row ? service.update(row.id, v, actor) : service.create(v, actor),
    };
  }
  if (resource === "courses") {
    requirePermissions(account, ["CATALOG_READ", "CATALOG_MANAGE"]);
    const service = new CourseService(new MysqlCourseRepository(db)),
      courseActor = { ...actor, canManage: true };
    const units = await service.units(courseActor);
    const columns = [
      c("courseCode", "Mã học phần", { immutable: true }),
      c("courseName", "Tên học phần"),
      c("englishName", "Tên tiếng Anh"),
      c("unitId", "Đơn vị quản lý", {
        immutable: true,
        choices: choices(units, "id", (u) => u.code + " — " + u.name),
      }),
      c("credits", "Tín chỉ", { kind: "number" }),
      c("theoryHours", "Tiết lý thuyết", { kind: "number", default: 0 }),
      c("practiceHours", "Tiết thực hành", { kind: "number", default: 0 }),
      c("description", "Mô tả"),
      c("effectiveFrom", "Hiệu lực từ", { kind: "date" }),
      c("effectiveTo", "Hiệu lực đến", { kind: "date" }),
      c("status", "Trạng thái học phần", { readonly: true, default: "ACTIVE" }),
      c("versionStatus", "Trạng thái phiên bản", {
        readonly: true,
        default: "DRAFT",
      }),
    ];
    return {
      title: "Danh mục học phần",
      columns,
      notes: [
        "Sửa thuộc tính học phần sẽ tạo phiên bản nháp mới, giữ nguyên phiên bản đã sử dụng. Kích hoạt phiên bản thực hiện bằng lệnh nghiệp vụ trên giao diện.",
      ],
      load: async () =>
        (
          await allPages((page) =>
            service.list({ page, limit: 100, status: "ALL" }, courseActor),
          )
        ).map((r) =>
          record(
            r,
            columns,
            r.courseCode + " — " + (r.courseName || ""),
            r,
            r.status === "RETIRED" ? columns.map((col) => col.key) : [],
          ),
        ),
      validate: (v, row) =>
        checked(row ? ReviseCourseDto : CreateCourseDto, {
          ...pick(v, [
            "courseName",
            "englishName",
            "credits",
            "theoryHours",
            "practiceHours",
            "description",
            "effectiveFrom",
          ]),
          effectiveTo: v.effectiveTo || undefined,
          ...(row
            ? { expectedLatestVersionId: row.raw.latestVersionId || "0" }
            : { courseCode: v.courseCode, unitId: v.unitId }),
        }),
      save: (v, row) =>
        row
          ? service.revise(row.id, v, courseActor)
          : service.create(v, courseActor),
    };
  }
  if (resource === "programs") {
    requirePermissions(account, ["PROGRAM_READ", "PROGRAM_EDIT"]);
    const service = new ProgramService(new MysqlProgramRepository(db));
    const options: any = await service.options(actor);
    const columns = [
      c("programId", "ID CTĐT gốc (để trống nếu tạo CTĐT mới)", {
        immutable: true,
      }),
      c("maCTDT", "Mã CTĐT", { immutable: true }),
      c("maPhienBan", "Mã phiên bản", { immutable: true, default: "v1" }),
      c("tenCTDT", "Tên CTĐT"),
      c("tenTiengAnh", "Tên tiếng Anh"),
      c("educationLevelId", "Bậc đào tạo", {
        immutable: true,
        choices: choices(options.levels, "id", (x) => x.name),
      }),
      c("managingUnitId", "Khoa quản lý", {
        immutable: true,
        choices: choices(options.units, "id", (x) => x.name),
      }),
      c("majorId", "Ngành đào tạo", {
        immutable: true,
        choices: choices(options.majors, "id", (x) => x.name),
      }),
      c("hinhThucDaoTao", "Hình thức đào tạo", {
        choices: [
          { value: "CHINH_QUY", label: "Chính quy" },
          { value: "VUA_LAM_VUA_HOC", label: "Vừa làm vừa học" },
          { value: "LIEN_KET", label: "Liên kết" },
        ],
        default: "CHINH_QUY",
      }),
      c("thoiGianDaoTao", "Thời gian đào tạo"),
      c("khoaTuyenSinh", "Khóa tuyển sinh"),
      c("tongTinChiYeuCau", "Tín chỉ yêu cầu", { kind: "number" }),
      c("chuanDauRaTiengAnh", "Chuẩn ngoại ngữ", {
        choices: [
          { value: "", label: "Chưa khai báo" },
          ...(options.languageRequirements || []).map((value) => ({
            value,
            label: value,
          })),
        ],
      }),
      c("chuanDauRaTinHoc", "Chuẩn CNTT", {
        choices: [
          { value: "", label: "Chưa khai báo" },
          ...(options.itRequirements || []).map((value) => ({
            value,
            label: value,
          })),
        ],
      }),
      c("soQuyetDinhBanHanh", "Số quyết định"),
      c("ngayBanHanh", "Ngày ban hành", { kind: "date" }),
      c("moTa", "Mô tả"),
      c("status", "Trạng thái", { readonly: true, default: "DRAFT" }),
    ];
    return {
      title: "Chương trình đào tạo",
      columns,
      notes: [
        "Chỉ sửa thông tin của bản nháp/được trả về. Các bản đã gửi duyệt/ban hành chỉ để đối chiếu.",
        "Tạo phiên bản mới bằng dòng trống: điền ID CTĐT gốc và mã phiên bản mới. Học phần/định mức nhập bằng file chi tiết CTĐT riêng.",
      ],
      load: async () => {
        const list = await allPages((page) =>
          service.list({ page, limit: 100, selectedStatus: "ALL" }, actor),
        );
        return Promise.all(
          list.map(async (entry) => {
            const r = await service.detail(entry.id, actor);
            return record(
              r,
              columns,
              r.maCTDT + " · " + r.maPhienBan + " — " + r.tenCTDT,
              {
                ...r,
                tongTinChiYeuCau: r.sourceUrl
                  ? r.sourceTotalCredits
                  : r.tongTinChiYeuCau,
              },
              !r.sourceReadOnly && ["DRAFT", "RETURNED"].includes(r.status)
                ? []
                : columns.map((col) => col.key),
            );
          }),
        );
      },
      seed: baseId
        ? async () => {
            if (!/^[1-9]\d{0,19}$/.test(baseId))
              throw new BadRequestException("ID CTĐT gốc không hợp lệ.");
            return {
              ...(await service.baseProgram(baseId, actor)),
              programId: baseId,
              status: "DRAFT",
            } as any;
          }
        : undefined,
      validate: async (v, row) => ({
        input: await checked(ProgramInputDto, {
          ...pick(
            v,
            columns
              .filter((col) => !["programId", "status"].includes(col.key))
              .map((col) => col.key),
          ),
          ngayBanHanh: v.ngayBanHanh || undefined,
          ...(row ? { revision: row.raw.revision } : {}),
        }),
        programId: v.programId,
      }),
      save: (v, row) =>
        row
          ? service.update(row.id, v.input, actor)
          : v.programId
            ? service.createVersion(v.programId, v.input, actor)
            : service.create(v.input, actor),
    };
  }
  if (resource === "topics" || resource === "supervisors") {
    requirePermissions(account, ["TOPIC_READ", "TOPIC_MANAGE"]);
    const service = new ThesisTopicService(new MysqlTopicRepository(db));
    const units = await service.units(actor);
    if (resource === "supervisors") {
      const columns = [
        c("code", "Mã giảng viên hướng dẫn", { immutable: true }),
        c("fullName", "Họ tên GVHD", { immutable: true }),
        c("unitId", "Đơn vị quản lý", {
          immutable: true,
          choices: choices(units, "id", (u) => u.name),
        }),
        c("institution", "Cơ quan công tác", { immutable: true }),
        c("qualification", "Học vị / chức danh", { immutable: true }),
        c("email", "Email", { immutable: true }),
        c("status", "Trạng thái", { choices: status, default: "ACTIVE" }),
      ];
      return {
        title: "Giảng viên hướng dẫn",
        columns,
        notes: [
          "Hồ sơ đã có chỉ đổi trạng thái theo nghiệp vụ hiện có; không ghi đè thông tin định danh.",
        ],
        load: async () =>
          (
            await allPages((page) =>
              service.supervisors({ page, limit: 100, status: "ALL" }, actor),
            )
          ).map((r) => record(r, columns, r.code + " — " + r.fullName)),
        validate: async (v, row) => {
          if (row) return { status: v.status };
          if (v.status !== "ACTIVE")
            throw new BadRequestException("Hồ sơ GVHD mới phải hoạt động.");
          return checked(
            CreateSupervisorDto,
            pick(v, [
              "unitId",
              "code",
              "fullName",
              "institution",
              "qualification",
              "email",
            ]),
          );
        },
        save: (v, row) =>
          row
            ? service.supervisorStatus(row.id, v.status, row.raw.status, actor)
            : service.createSupervisor(v, actor),
      };
    }
    const students = await allPages((page) =>
      service.students({ page, limit: 100 }, actor),
    );
    const supervisors = await allPages((page) =>
      service.supervisors({ page, limit: 100, status: "ALL" }, actor),
    );
    const columns = [
      c("assignmentId", "Học viên / phân CTĐT", {
        immutable: true,
        choices: choices(
          students,
          "assignmentId",
          (s) => s.studentCode + " — " + s.studentName + " · " + s.programName,
        ),
      }),
      c("studentName", "Họ tên học viên", { readonly: true }),
      c("title", "Tên đề tài"),
      c("description", "Mô tả"),
      c("supervisorId", "Giảng viên hướng dẫn", {
        choices: choices(supervisors, "id", (s) => s.code + " — " + s.fullName),
      }),
      c("status", "Trạng thái đề tài", {
        readonly: true,
        default: "CHO_DUYET",
      }),
    ];
    return {
      title: "Đề tài luận văn",
      columns,
      load: async () =>
        (
          await allPages((page) =>
            service.list({ page, limit: 100, selectedStatus: "ALL" }, actor),
          )
        ).map((r) => {
          if (
            !columns[0].choices!.some(
              (choice) => choice.value === r.assignmentId,
            )
          )
            columns[0].choices!.push({
              value: r.assignmentId,
              label:
                r.studentCode + " — " + r.studentName + ` [${r.assignmentId}]`,
            });
          return record(
            r,
            columns,
            r.studentCode + " — " + r.title,
            r,
            ["CHO_DUYET", "TU_CHOI"].includes(r.status)
              ? []
              : columns.map((col) => col.key),
          );
        }),
      validate: (v, row) =>
        checked(row ? UpdateTopicDto : CreateTopicDto, {
          ...pick(v, ["supervisorId", "title", "description"]),
          ...(row
            ? { revision: row.raw.revision }
            : { assignmentId: v.assignmentId }),
        }),
      save: (v, row) =>
        row
          ? service.change(row.id, "edit", v, actor)
          : service.create(v, actor),
    };
  }
  if (resource === "documents") {
    requirePermissions(account, ["MASTERDATA_MANAGE"], true);
    const service = new PortalService(new MysqlPortalRepository(db));
    const columns = [
      c("title", "Tên văn bản"),
      c("category", "Loại văn bản", {
        choices: [
          { value: "REGULATION", label: "Quy chế" },
          { value: "ADMISSION", label: "Tuyển sinh" },
          { value: "GUIDE", label: "Hướng dẫn" },
        ],
      }),
      c("summary", "Tóm tắt"),
      c("documentUrl", "Đường dẫn tài liệu"),
      c("referenceNumber", "Số văn bản"),
      c("issuedOn", "Ngày ban hành", { kind: "date" }),
      c("status", "Trạng thái", {
        choices: [
          { value: "DRAFT", label: "Bản nháp" },
          { value: "PUBLISHED", label: "Công bố" },
        ],
        default: "DRAFT",
      }),
    ];
    return {
      title: "Văn bản cổng thông tin",
      columns,
      lock: adminLock,
      load: async () =>
        (
          await allPages((page) =>
            service.documents({ page, limit: 100, status: "ALL" }, true),
          )
        ).map((r) => record(r, columns, r.title)),
      validate: (v, row) =>
        checked(PublicDocumentDto, {
          ...v,
          issuedOn: v.issuedOn || undefined,
          ...(row ? { revision: row.raw.revision } : {}),
        }),
      save: (v, row) => service.saveDocument(row?.id || null, v, actor),
    };
  }
  if (resource === "defenses") {
    requirePermissions(account, ["DEFENSE_READ"]);
    const canSchedule = account.permissions.includes("DEFENSE_SCHEDULE"),
      canRecord = account.permissions.includes("DEFENSE_RESULT");
    if (!canSchedule && !canRecord)
      throw new ForbiddenException(
        "Không có quyền lập lịch hoặc ghi kết quả bảo vệ.",
      );
    const service = new ThesisDefenseService(new MysqlDefenseRepository(db)),
      a = { ...actor, canSchedule, canRecord };
    const students = canSchedule
      ? await allPages((page) =>
          service.students({ page, limit: 100, selectedStatus: "ALL" }, a),
        )
      : [];
    const columns = [
      c("assignmentId", "Học viên / phân CTĐT", {
        immutable: true,
        choices: choices(
          students,
          "assignmentId",
          (s) => s.maHocVien + " — " + s.hoTen,
        ),
      }),
      c("maHocVien", "Mã học viên", { immutable: true }),
      c("tenDeTai", "Tên đề tài", { immutable: true }),
      c("ngayBaoVe", "Ngày bảo vệ", { kind: "date", immutable: true }),
      c("diaDiem", "Địa điểm", { immutable: true }),
      c("chuTichHoidong", "Chủ tịch hội đồng", { immutable: true }),
      c("phanBien", "Phản biện", { immutable: true }),
      c("thuKy", "Thư ký", { immutable: true }),
      c("diemDat", "Điểm đạt", { kind: "number", immutable: true }),
      c("eligibilityConfirmed", "Đã xác minh điều kiện", {
        kind: "bool",
        immutable: true,
        default: false,
      }),
      c("eligibilityNote", "Căn cứ điều kiện", { immutable: true }),
      c("diemTrungBinh", "Điểm trung bình bảo vệ", { kind: "number" }),
      c("trangThai", "Trạng thái", { readonly: true, default: "CHO_BAO_VE" }),
    ];
    return {
      title: "Lịch / kết quả bảo vệ luận văn",
      columns,
      notes: [
        "Lịch đã tạo giữ nguyên thông tin hội đồng/ngày/địa điểm. Chỉ ghi kết quả khi có quyền, lịch còn chờ và đến ngày bảo vệ; hủy lịch dùng lệnh riêng.",
      ],
      load: async () =>
        (
          await allPages((page) =>
            service.list({ page, limit: 100, selectedStatus: "ALL" }, a),
          )
        ).map((r) => {
          if (
            !columns[0].choices!.some(
              (choice) => choice.value === r.assignmentId,
            )
          )
            columns[0].choices!.push({
              value: r.assignmentId,
              label: r.maHocVien + " — " + r.hoTen + ` [${r.assignmentId}]`,
            });
          return record(
            r,
            columns,
            r.maHocVien + " — " + r.tenDeTai,
            { ...r, eligibilityConfirmed: true },
            canRecord && r.trangThai === "CHO_BAO_VE"
              ? []
              : columns.map((col) => col.key),
          );
        }),
      validate: async (v, row) => {
        if (row) {
          if (!canRecord)
            throw new ForbiddenException("Không có quyền ghi kết quả bảo vệ.");
          return checked(RecordDefenseResultDto, {
            diemTrungBinh: v.diemTrungBinh,
          });
        }
        if (!canSchedule)
          throw new ForbiddenException("Không có quyền lập lịch.");
        if (v.diemTrungBinh != null)
          throw new BadRequestException(
            "Lập lịch trước rồi mới ghi điểm bảo vệ.",
          );
        return checked(
          CreateDefenseDto,
          pick(
            v,
            columns
              .filter(
                (col) => !["diemTrungBinh", "trangThai"].includes(col.key),
              )
              .map((col) => col.key),
          ),
        );
      },
      save: (v, row) =>
        row ? service.recordResult(row.id, v, a) : service.create(v, a),
    };
  }
  throw new BadRequestException("Không hỗ trợ loại dữ liệu Excel này.");
}
