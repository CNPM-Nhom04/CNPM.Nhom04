import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, backendUrl, upstreamError } from "@/lib/server/backend";

const allowed = [
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
  let body: string | undefined;
  if (request.method === "POST" || request.method === "PUT") {
    try {
      body = JSON.stringify(await request.json());
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
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(90000),
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
    const headers = new Headers({ "Cache-Control": "no-store" });
    for (const key of ["Content-Type", "Content-Disposition"]) {
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
