import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, backendUrl } from "@/lib/server/backend";
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const path = ((await context.params).path ?? []).join("/");
  if (!["", "options", "export"].includes(path))
    return NextResponse.json(
      { message: "Không tìm thấy API." },
      { status: 404 },
    );
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token)
    return NextResponse.json(
      { message: "Vui lòng đăng nhập." },
      { status: 401 },
    );
  try {
    const upstream = await fetch(
      backendUrl("/so-sanh" + (path ? "/" + path : "")) +
        request.nextUrl.search,
      {
        headers: { Authorization: "Bearer " + token },
        cache: "no-store",
        signal: AbortSignal.timeout(60000),
      },
    );
    if (!upstream.ok) {
      const body =
        upstream.status < 500 ? await upstream.json().catch(() => null) : null;
      const response = NextResponse.json(
        { message: body?.message || "Không thể tải dữ liệu từ backend." },
        { status: upstream.status < 500 ? upstream.status : 502 },
      );
      if (upstream.status === 401) response.cookies.delete(AUTH_COOKIE);
      return response;
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type":
          path === "export"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "application/json",
        "Cache-Control": "no-store",
        ...(path === "export"
          ? {
              "Content-Disposition": 'attachment; filename="so-sanh-ctdt.xlsx"',
            }
          : {}),
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Không thể kết nối backend. Vui lòng thử lại." },
      { status: 502 },
    );
  }
}
