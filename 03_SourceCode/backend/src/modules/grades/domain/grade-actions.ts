export interface GradeActionContext {
  state: string;
  classStatus: string | null;
  registrationStatus: string | null;
  totalScore: number | null;
  policyId: string | null;
}
export type GradeAction = "chot" | "huy" | "mo-lai";
export function gradeActionAvailability(
  item: GradeActionContext,
  canManage: boolean,
): Record<GradeAction, { allowed: boolean; reason: string }> {
  function reason(action: GradeAction): string {
    if (!canManage) return "Tài khoản chỉ được xem và in bảng điểm.";
    if (action === "huy")
      return ["DRAFT", "FINALIZED"].includes(item.state)
        ? ""
        : "Chỉ hủy hiệu lực điểm nháp hoặc điểm đã chốt.";
    if (action === "chot" && item.state !== "DRAFT")
      return "Chỉ chốt điểm đang ở trạng thái nháp.";
    if (action === "mo-lai" && item.state !== "VOIDED")
      return "Chỉ mở lại điểm đã hủy hiệu lực.";
    if (item.registrationStatus !== "REGISTERED")
      return "Đăng ký học phần không còn hiệu lực; chưa thể thực hiện thao tác này.";
    if (action === "chot" && item.classStatus !== "COMPLETED")
      return "Lớp học phần chưa hoàn tất. Chỉ chốt điểm sau khi lớp đã được xác nhận hoàn tất.";
    if (
      action === "mo-lai" &&
      !["OPEN", "CLOSED", "CONFIRMED", "COMPLETED"].includes(
        item.classStatus || "",
      )
    )
      return "Lớp học phần đang dự kiến hoặc đã hủy; chưa thể mở lại điểm.";
    if (action === "chot" && !item.policyId)
      return "Lớp học phần chưa có quy tắc tính điểm.";
    if (action === "chot" && item.totalScore == null)
      return "Chưa đủ điểm thành phần có trọng số. Bổ sung điểm bằng Excel trước khi chốt.";
    return "";
  }
  return Object.fromEntries(
    (["chot", "huy", "mo-lai"] as const).map((action) => {
      const message = reason(action);
      return [action, { allowed: !message, reason: message }];
    }),
  ) as Record<GradeAction, { allowed: boolean; reason: string }>;
}
