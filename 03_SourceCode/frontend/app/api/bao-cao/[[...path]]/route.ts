import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, backendUrl, upstreamError } from "@/lib/server/backend";

const allowedPaths = new Set(["", "thong-ke", "bac-dao-tao", "xuat-excel"]);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const path = ((await context.params).path ?? []).join("/");
  if (!allowedPaths.has(path)) {
    return NextResponse.json(
      { message: "Không tìm thấy API." },
      { status: 404 },
    );
  }
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { message: "Vui lòng đăng nhập để xem báo cáo." },
      { status: 401 },
    );
  }
  try {
    const upstream = await fetch(
      backendUrl(`/bao-cao${path ? "/" + path : ""}`) + request.nextUrl.search,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(90000),
      },
    );
    if (!upstream.ok) {
      const response = NextResponse.json(
        { message: upstreamError(upstream.status) },
        { status: upstream.status < 500 ? upstream.status : 502 },
      );
      if (upstream.status === 401) response.cookies.delete(AUTH_COOKIE);
      return response;
    }
    const headers = new Headers({ "Cache-Control": "no-store" });
    for (const name of ["Content-Type", "Content-Disposition"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return NextResponse.json({ message: upstreamError(502) }, { status: 502 });
  }
}
