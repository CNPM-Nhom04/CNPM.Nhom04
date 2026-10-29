import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, backendUrl, upstreamError } from "@/lib/server/backend";
type Context = { params: Promise<{ action: string }> };
async function proxy(request: NextRequest, context: Context) {
  const { action } = await context.params;
  const expected = ["profile", "password-policy"].includes(action)
    ? "GET"
    : "POST";
  if (
    ![
      "profile",
      "password-policy",
      "forgot-password",
      "reset-password",
      "change-password",
      "logout",
    ].includes(action)
  )
    return NextResponse.json(
      { message: "Không tìm thấy chức năng." },
      { status: 404 },
    );
  if (request.method !== expected)
    return NextResponse.json(
      { message: "Phương thức không hợp lệ." },
      { status: 405 },
    );
  if (
    expected === "POST" &&
    request.headers.get("origin") !== request.nextUrl.origin
  )
    return NextResponse.json(
      { message: "Yêu cầu không hợp lệ." },
      { status: 403 },
    );
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const protectedAction = ["profile", "change-password", "logout"].includes(
    action,
  );
  if (protectedAction && !token && action !== "logout")
    return NextResponse.json(
      { message: "Vui lòng đăng nhập." },
      { status: 401 },
    );
  const clearCookie = (response: NextResponse) => {
    response.cookies.set(AUTH_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  };
  if (action === "logout" && !token)
    return clearCookie(NextResponse.json({ success: true }));
  let body: string | undefined;
  if (expected === "POST") {
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
    const upstream = await fetch(backendUrl("/auth/" + action), {
      method: expected,
      headers: {
        ...(token && protectedAction
          ? { Authorization: "Bearer " + token }
          : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(action === "forgot-password" ? 45000 : 15000),
    });
    const payload = await upstream.json().catch(() => null);
    const logoutExpired = action === "logout" && upstream.status === 401;
    const status = logoutExpired
      ? 200
      : upstream.status < 500 || upstream.status === 503
        ? upstream.status
        : 502;
    const response = NextResponse.json(
      upstream.ok || logoutExpired
        ? payload || { success: true }
        : {
            message:
              upstream.status < 500 || upstream.status === 503
                ? payload?.message || upstreamError(status)
                : upstreamError(status),
          },
      { status, headers: { "Cache-Control": "no-store" } },
    );
    const retry = upstream.headers.get("Retry-After");
    if (retry) response.headers.set("Retry-After", retry);
    if (
      upstream.status === 401 ||
      (upstream.ok &&
        ["logout", "change-password", "reset-password"].includes(action))
    )
      return clearCookie(response);
    return response;
  } catch {
    return NextResponse.json({ message: upstreamError(502) }, { status: 502 });
  }
}
export { proxy as GET, proxy as POST };
 
