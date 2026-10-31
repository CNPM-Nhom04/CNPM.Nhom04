import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, backendUrl } from "@/lib/server/backend";
const patterns: Record<string, RegExp> = {
  GET: /^(?:|options|quy-dinh\/[1-9]\d{0,19}|[1-9]\d{0,19}(?:\/lich-su)?)$/,
  POST: /^(?:kiem-tra|quy-dinh\/[1-9]\d{0,19}|[1-9]\d{0,19}\/(?:minh-chung|kiem-tra))$/,
};
async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const path = ((await context.params).path || []).join("/");
  if (!patterns[request.method]?.test(path))
    return NextResponse.json(
      { message: "Không tìm thấy API." },
      { status: 404 },
    );
  if (
    request.method === "POST" &&
    request.headers.get("origin") !== request.nextUrl.origin
  )
    return NextResponse.json(
      { message: "Yêu cầu không hợp lệ." },
      { status: 403 },
    );
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token)
    return NextResponse.json(
      { message: "Vui lòng đăng nhập." },
      { status: 401 },
    );
  let body: string | undefined;
  if (request.method === "POST") {
    try {
      body = JSON.stringify(await request.json());
    } catch {
      return NextResponse.json(
        { message: "Dữ liệu JSON không hợp lệ." },
        { status: 400 },
      );
    }
  }
  try {
    const upstream = await fetch(
      backendUrl("/xet-tot-nghiep" + (path ? "/" + path : "")) +
        request.nextUrl.search,
      {
        method: request.method,
        body,
        headers: {
          Authorization: "Bearer " + token,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        cache: "no-store",
        signal: AbortSignal.timeout(90000),
      },
    );
    if (!upstream.ok) {
      const payload =
        upstream.status < 500 ? await upstream.json().catch(() => null) : null;
      const response = NextResponse.json(
        {
          message:
            payload?.message || "Không thể đối chiếu dữ liệu từ backend.",
        },
        {
          status: upstream.status < 500 ? upstream.status : 502,
          headers: { "Cache-Control": "no-store" },
        },
      );
      if (upstream.status === 401) response.cookies.delete(AUTH_COOKIE);
      return response;
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Không thể kết nối backend. Vui lòng thử lại." },
      { status: 502 },
    );
  }
}
export { proxy as GET, proxy as POST };
