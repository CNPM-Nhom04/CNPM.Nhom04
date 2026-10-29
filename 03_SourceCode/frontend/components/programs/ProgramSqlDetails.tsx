"use client";
import Link from "next/link";
import type {
  ProgramRecord,
  ProgramCourse,
} from "@/lib/services/programService";
const missing = "Chưa có thông tin";
const date = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
    : "—";
export function ProgramCourseDetails({ course }: { course: ProgramCourse }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-slate-500">
        Phiên bản học phần: {course.versionNumber ?? "—"} · LT{" "}
        {course.theoryHours ?? "—"} / TH {course.practiceHours ?? "—"} tiết
      </p>
      <details className="text-xs">
        <summary className="cursor-pointer text-blue-700">
          Tiên quyết ({course.prerequisites?.length ?? 0}) · Liên kết PLO (
          {course.ploMappings?.length ?? 0}) · Thông tin học phần
        </summary>
        <div className="mt-2 space-y-2 rounded border bg-slate-50 p-3">
          {course.englishName && <p>Tên tiếng Anh: {course.englishName}</p>}
          {course.description && (
            <p className="whitespace-pre-line">{course.description}</p>
          )}
          {course.notes && (
            <p className="whitespace-pre-line">
              Ghi chú cấu trúc: {course.notes}
            </p>
          )}
          <strong>Môn tiên quyết</strong>
          {course.prerequisites?.length ? (
            <ul className="list-disc pl-4">
              {course.prerequisites.map((item) => (
                <li key={item.id}>
                  {item.code} — {item.name}
                  {item.minimumGrade != null
                    ? "; điểm tối thiểu: " + item.minimumGrade
                    : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p>Chưa khai báo môn tiên quyết cho học phần này.</p>
          )}
          <strong>Chuẩn đầu ra được đóng góp</strong>
          {course.ploMappings?.length ? (
            <ul className="list-disc pl-4">
              {course.ploMappings.map((item) => (
                <li key={item.ploId}>
                  {item.code}: {item.description} (
                  {item.contributionLevel === "INTRODUCE"
                    ? "Giới thiệu"
                    : item.contributionLevel === "REINFORCE"
                      ? "Củng cố"
                      : item.contributionLevel === "MASTER"
                        ? "Làm chủ"
                        : "Chưa ghi mức đóng góp"}
                  )
                </li>
              ))}
            </ul>
          ) : (
            <p>Chưa khai báo liên kết PLO cho học phần này.</p>
          )}
        </div>
      </details>
    </div>
  );
}
export function ProgramSqlDetails({ program }: { program: ProgramRecord }) {
  const fields = [
    ["Mã chương trình", program.maCTDT],
    ["Mã phiên bản", program.maPhienBan],
    ["Năm tuyển sinh", program.cohortYear],
    ["Ngành", program.majorName],
    ["Đơn vị quản lý", program.unitName],
    ["Tên tiếng Anh", program.tenTiengAnh || missing],
    [
      "Hình thức đào tạo",
      program.hinhThucDaoTao === "CHINH_QUY"
        ? "Chính quy"
        : program.hinhThucDaoTao === "VUA_LAM_VUA_HOC"
          ? "Vừa làm vừa học"
          : program.hinhThucDaoTao === "LIEN_KET"
            ? "Liên kết"
            : missing,
    ],
    ["Thời gian đào tạo", program.thoiGianDaoTao || missing],
    ["Chuẩn ngoại ngữ", program.chuanDauRaTiengAnh || missing],
    ["Chuẩn CNTT", program.chuanDauRaTinHoc || missing],
    ["Số quyết định", program.soQuyetDinhBanHanh || missing],
    ["Ngày quyết định", program.ngayBanHanh || missing],
    ["Hiệu lực từ", program.effectiveFrom || "—"],
    ["Hiệu lực đến", program.effectiveTo || "—"],
    ["Người tạo", program.createdByName || "—"],
    ["Thời điểm tạo", date(program.createdAt)],
    ["Thời điểm gửi duyệt", date(program.submittedAt)],
    ["Thời điểm công bố (workflow)", date(program.publishedAt)],
    ["Thời điểm lưu trữ", date(program.archivedAt)],
    ["Thời điểm ngừng sử dụng", date(program.retiredAt)],
    ["Khóa chỉnh sửa từ", date(program.lockedAt)],
  ];
  const outcomes = program.learningOutcomes ?? [],
    history = program.approvalHistory ?? [];
  const actions: Record<string, string> = {
    SUBMIT: "Gửi duyệt",
    START_REVIEW: "Bắt đầu xét duyệt",
    APPROVE: "Phê duyệt",
    RETURN: "Trả về sửa",
    CANCEL: "Thu hồi",
  };
  return (
    <div className="space-y-5">
      <section
        id="program-details"
        className="bg-white rounded-xl border p-5 space-y-4"
      >
        <h2 className="font-bold">Thông tin phiên bản và dữ liệu gốc</h2>
        {!program.hasExtendedInfo && (
          <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">
            Phiên bản này chưa có thông tin bổ sung. Những trường tiếng Anh,
            hình thức, thời gian đào tạo và căn cứ quyết định chưa được lưu
            trong dữ liệu gốc; hệ thống không tự tạo giá trị thay thế.
          </p>
        )}
        {program.sourceVersionId && (
          <p className="text-sm">
            Kế thừa từ:{" "}
            <Link
              className="text-blue-600 underline"
              href={`/dashboard/chuong-trinh-dao-tao/${program.sourceVersionId}/build`}
            >
              {program.sourceVersionCode || program.sourceVersionId}
            </Link>
          </p>
        )}
        <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          {fields.map(([label, value]) => (
            <div key={String(label)}>
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd className="font-medium whitespace-pre-line">
                {value ?? "—"}
              </dd>
            </div>
          ))}
        </dl>
        {program.moTa && (
          <p className="text-sm whitespace-pre-line">{program.moTa}</p>
        )}
        {program.statusReason && (
          <p className="text-sm whitespace-pre-line">
            Lý do trạng thái: {program.statusReason}
          </p>
        )}
      </section>
      <section className="bg-white rounded-xl border p-5 space-y-3">
        <h2 id="program-plos" className="font-bold">
          Chuẩn đầu ra chương trình (PLO) — {outcomes.length} chuẩn
        </h2>
        {outcomes.length ? (
          <div className="space-y-2">
            {outcomes.map((item) => (
              <div key={item.id} className="border-b pb-2 text-sm">
                <strong>{item.code}</strong> — {item.description}
                {item.status !== "ACTIVE" && (
                  <span className="ml-2 text-xs text-amber-700">
                    Ngừng hoạt động
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Database chưa khai báo PLO cho phiên bản này.
          </p>
        )}
      </section>
      <section className="bg-white rounded-xl border p-5 space-y-3">
        <h2 id="program-history" className="font-bold">
          Toàn bộ lịch sử gửi duyệt và xét duyệt — {history.length} lần gửi
        </h2>
        {history.length ? (
          history.map((request) => (
            <details
              key={request.id}
              className="border rounded-lg p-3 text-sm"
              open={history.length === 1}
            >
              <summary className="cursor-pointer font-semibold">
                {request.requestNo} · {request.status} ·{" "}
                {date(request.requestedAt)}
              </summary>
              <div className="mt-3 space-y-2">
                <p>
                  Người gửi: {request.requesterName}; Hoàn tất:{" "}
                  {date(request.completedAt)}
                </p>
                {request.latestComment && (
                  <p className="whitespace-pre-line">
                    Ý kiến: {request.latestComment}
                  </p>
                )}
                {request.minutes && (
                  <p>
                    Hội đồng: {request.minutes.hoiDongThamDinh} · Biên bản:{" "}
                    {request.minutes.soBienBan || "—"} · Ngày họp:{" "}
                    {request.minutes.ngayHop}
                  </p>
                )}
                {!request.minutes && (
                  <p className="text-xs text-slate-500">
                    Có lịch sử xét duyệt; chưa có biên bản hội đồng theo mẫu
                    giao diện.
                  </p>
                )}
                <ol className="space-y-2 border-l pl-4">
                  {request.actions.map((action) => (
                    <li key={action.id}>
                      <strong>{actions[action.action] || action.action}</strong>{" "}
                      — {action.actorName} · {date(action.createdAt)}
                      {action.comment && (
                        <p className="whitespace-pre-line text-slate-600">
                          {action.comment}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            </details>
          ))
        ) : (
          <p className="text-sm text-slate-500">
            Phiên bản chưa có yêu cầu gửi duyệt.
          </p>
        )}
      </section>
    </div>
  );
}
