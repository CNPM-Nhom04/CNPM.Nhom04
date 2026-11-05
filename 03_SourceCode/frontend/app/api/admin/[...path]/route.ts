import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, backendUrl, upstreamError } from "@/lib/server/backend";

const allowed = [
  { pattern: /^master-data\/import\/mau-excel$/, methods: ["GET"] },
  {
    pattern: /^master-data\/import\/(kiem-tra|luu)$/,
    methods: ["POST"],
    upload: true,
  },
  {
    pattern: /^lop-hoc-vien\/[1-9]\d{0,19}\/lien-ket\/(tai-khoan|ho-so)$/,
    methods: ["GET"],
  },
  { pattern: /^lop-hoc-vien\/[1-9]\d{0,19}\/lien-ket$/, methods: ["POST"] },
  { pattern: /^lop-hoc-vien$/, methods: ["GET", "POST"] },
  { pattern: /^lop-hoc-vien\/options$/, methods: ["GET"] },
  {
    pattern: /^lop-hoc-vien\/[1-9]\d{0,19}$/,
    methods: ["GET", "PUT", "DELETE"],
  },
  {
    pattern: /^lop-hoc-vien\/[1-9]\d{0,19}\/(hoc-vien|import\/mau-excel)$/,
    methods: ["GET"],
  },
  {
    pattern: /^lop-hoc-vien\/[1-9]\d{0,19}\/import\/(kiem-tra|luu)$/,
    methods: ["POST"],
    upload: true,
  },
  { pattern: /^cong-thong-tin\/van-ban$/, methods: ["GET", "POST"] },
  {
    pattern: /^cong-thong-tin\/van-ban\/[1-9]\d{0,19}$/,
    methods: ["PUT", "DELETE"],
  },
  { pattern: /^cong-thong-tin\/dang-ky$/, methods: ["GET"] },
  {
    pattern: /^cong-thong-tin\/dang-ky\/[1-9]\d{0,19}\/da-lien-he$/,
    methods: ["POST"],
  },
  { pattern: /^khoa$/, methods: ["GET", "POST"] },
  { pattern: /^khoa\/[1-9]\d{0,19}$/, methods: ["PUT", "DELETE"] },
  { pattern: /^nganh-dao-tao\/import\/(options|mau-excel)$/, methods: ["GET"] },
  {
    pattern: /^nganh-dao-tao\/import\/(kiem-tra|luu)$/,
    methods: ["POST"],
    upload: true,
  },
  { pattern: /^nganh-dao-tao$/, methods: ["GET", "POST"] },
  { pattern: /^nganh-dao-tao\/options$/, methods: ["GET"] },
  {
    pattern: /^nganh-dao-tao\/[1-9]\d{0,19}$/,
    methods: ["GET", "PUT", "DELETE"],
  },
  { pattern: /^nguoi-dung$/, methods: ["GET", "POST"] },
  { pattern: /^nguoi-dung\/options$/, methods: ["GET"] },
  { pattern: /^nguoi-dung\/[1-9]\d{0,19}$/, methods: ["PUT", "DELETE"] },
  { pattern: /^master-data$/, methods: ["GET", "POST"] },
  {
    pattern:
      /^master-data\/(KHOA_QUAN_LY|BAC_DAO_TAO|KHOI_KIEN_THUC):[1-9]\d{0,19}$/,
    methods: ["PUT", "DELETE"],
  },
  { pattern: /^cau-hinh$/, methods: ["GET", "PUT"] },
  { pattern: /^cau-hinh\/options$/, methods: ["GET"] },
  { pattern: /^cau-hinh\/mac-dinh$/, methods: ["POST"] },
  { pattern: /^audit-log(?:\/xuat-excel)?$/, methods: ["GET"] },
];
async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const path = (await context.params).path.join("/");
  const route = allowed.find((entry) => entry.pattern.test(path));
  if (!route)
    return NextResponse.json(
      { message: "Không tìm thấy API." },
      { status: 404 },
    );
  if (!route.methods.includes(request.method))
    return NextResponse.json(
      { message: "Phương thức không hợp lệ." },
      { status: 405 },
    );
  if (
    request.method !== "GET" &&
    request.headers.get("origin") !== request.nextUrl.origin
  ) {
    return NextResponse.json(
      { message: "Yêu cầu không hợp lệ." },
      { status: 403 },
    );
  }
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token)
    return NextResponse.json(
      { message: "Vui lòng đăng nhập tài khoản quản trị." },
      { status: 401 },
    );
  let body: string | ArrayBuffer | undefined;
  let contentType = "application/json";
  if (request.method === "POST" || request.method === "PUT") {
    try {
      if (route.upload) {
        contentType = request.headers.get("content-type") || "";
        if (
          !contentType.toLowerCase().startsWith("multipart/form-data;") ||
          !request.body
        )
          return NextResponse.json(
            { message: "Chọn file Excel hợp lệ." },
            { status: 400 },
          );
        const maxBytes = 5 * 1024 * 1024 + 128 * 1024;
        const reader = request.body.getReader();
        const chunks: Uint8Array[] = [];
        let total = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > maxBytes) {
            await reader.cancel();
            return NextResponse.json(
              { message: "File vượt giới hạn 5 MB." },
              { status: 413 },
            );
          }
          chunks.push(value);
        }
        const bytes = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
        body = bytes.buffer;
      } else body = JSON.stringify(await request.json());
    } catch {
      return NextResponse.json(
        { message: "Dữ liệu không hợp lệ." },
        { status: 400 },
      );
    }
  }
  try {
    const upstream = await fetch(
      backendUrl("/admin/" + path) + request.nextUrl.search,
      {
        method: request.method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": contentType } : {}),
        },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(
          path.startsWith("lop-hoc-vien/") ? 180000 : 90000,
        ),
      },
    );
    if (!upstream.ok) {
      const payload =
        upstream.status < 500 ? await upstream.json().catch(() => null) : null;
      const response = NextResponse.json(
        { message: payload?.message || upstreamError(upstream.status) },
        { status: upstream.status < 500 ? upstream.status : 502 },
      );
      if (upstream.status === 401) response.cookies.delete(AUTH_COOKIE);
      return response;
    }
    const headers = new Headers({
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
    });
    for (const key of [
      "Content-Type",
      "Content-Disposition",
      "X-Imported-Count",
    ]) {
      const value = upstream.headers.get(key);
      if (value) headers.set(key, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return NextResponse.json(
      { message: "Không thể kết nối backend. Vui lòng thử lại." },
      { status: 502 },
    );
  }
}
export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE };
