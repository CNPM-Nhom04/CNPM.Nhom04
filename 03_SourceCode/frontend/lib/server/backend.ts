export const AUTH_COOKIE = "ctdt_access_token";

export function backendUrl(path: string) {
  const base = (process.env.BACKEND_API_URL || "http://127.0.0.1:3000").replace(
    /\/$/,
    "",
  );
  return `${base}${path}`;
}

export function upstreamError(status: number) {
  if (status === 401)
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (status === 403) return "Bạn không có quyền truy cập báo cáo.";
  if (status === 400) return "Thông tin gửi lên không hợp lệ.";
  if (status === 429) return "Có quá nhiều yêu cầu. Vui lòng thử lại sau.";
  return "Không thể kết nối dịch vụ. Vui lòng thử lại.";
}
