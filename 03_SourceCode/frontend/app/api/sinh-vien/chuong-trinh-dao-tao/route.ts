import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, backendUrl, upstreamError } from "@/lib/server/backend";
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  if (request.nextUrl.search)
    return NextResponse.json(
      {
        message:
          "CTĐT cá nhân được xác định từ tài khoản đăng nhập, không nhận tham số chọn học viên.",
      },
      { status: 400, headers },
    );
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token)
    return NextResponse.json(
      { message: "Vui lòng đăng nhập để tra cứu CTĐT cá nhân." },
      { status: 401, headers },
    );
  try {
    const upstream = await fetch(
      backendUrl("/sinh-vien/chuong-trinh-dao-tao"),
      {
        headers: { Authorization: "Bearer " + token },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!upstream.ok) {
      const payload =
        upstream.status < 500 ? await upstream.json().catch(() => null) : null;
      const response = NextResponse.json(
        { message: payload?.message || upstreamError(upstream.status) },
        { status: upstream.status < 500 ? upstream.status : 502, headers },
      );
      if (upstream.status === 401) response.cookies.delete(AUTH_COOKIE);
      return response;
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json(
      { message: "Không thể kết nối backend. Vui lòng thử lại." },
      { status: 502, headers },
    );
  }
}
