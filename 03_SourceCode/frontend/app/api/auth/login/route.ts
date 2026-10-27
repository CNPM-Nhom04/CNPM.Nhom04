import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, backendUrl } from "@/lib/server/backend";
export async function POST(request: NextRequest) {
  if (
    request.headers.get("origin") &&
    request.headers.get("origin") !== request.nextUrl.origin
  ) {
    return NextResponse.json(
      { message: "Yêu cầu không hợp lệ." },
      { status: 403 },
    );
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Dữ liệu không hợp lệ." },
      { status: 400 },
    );
  }
  if (
    typeof body?.identifier !== "string" ||
    !body.identifier.trim() ||
    typeof body?.password !== "string" ||
    !body.password
  ) {
    return NextResponse.json(
      { message: "Vui lòng nhập tài khoản và mật khẩu." },
      { status: 400 },
    );
  }
  try {
    const upstream = await fetch(backendUrl("/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: body.identifier.trim(),
        password: body.password,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!upstream.ok)
      return NextResponse.json(
        {
          message:
            upstream.status === 401
              ? "Tài khoản hoặc mật khẩu không đúng, hoặc tài khoản đang bị khóa."
              : "Đăng nhập thất bại.",
        },
        { status: upstream.status < 500 ? upstream.status : 502 },
      );
    const result = await upstream.json();
    if (typeof result.access_token !== "string")
      throw new Error("Missing token");
    const response = NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(AUTH_COOKIE, result.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 1800,
    });
    return response;
  } catch {
    return NextResponse.json(
      { message: "Không thể kết nối backend. Vui lòng thử lại." },
      { status: 502 },
    );
  }
}
