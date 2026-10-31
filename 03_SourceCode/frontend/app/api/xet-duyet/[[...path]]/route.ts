import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, backendUrl } from "@/lib/server/backend";
const patterns: Record<string, RegExp> = {
  GET: /^(?:|[1-9]\d{0,19}(?:\/tai-lieu\/[1-9]\d{0,19})?)$/,
  POST: /^[1-9]\d{0,19}\/(?:bat-dau|ket-luan|tai-lieu)$/,
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
    request.method !== "GET" &&
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
  const headers: Record<string, string> = { Authorization: "Bearer " + token };
  let body: BodyInit | undefined;
  if (request.method !== "GET") {
    if (
      request.headers.get("content-type")?.startsWith("multipart/form-data")
    ) {
      try {
        const form = await request.formData(),
          file = form.get("file");
        if (!(file instanceof File) || file.size > 25 * 1024 * 1024)
          return NextResponse.json(
            { message: "Chọn file tối đa 25MB." },
            { status: 400 },
          );
        body = form;
      } catch {
        return NextResponse.json(
          { message: "Tệp không hợp lệ." },
          { status: 400 },
        );
      }
    } else {
      try {
        body = JSON.stringify(await request.json());
        headers["Content-Type"] = "application/json";
      } catch {
        return NextResponse.json(
          { message: "Dữ liệu không hợp lệ." },
          { status: 400 },
        );
      }
    }
  }
  try {
    const upstream = await fetch(
      backendUrl("/xet-duyet" + (path ? "/" + path : "")) +
        request.nextUrl.search,
      {
        method: request.method,
        headers,
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(90000),
      },
    );
    if (!upstream.ok) {
      const result =
        upstream.status < 500 ? await upstream.json().catch(() => null) : null;
      const response = NextResponse.json(
        {
          message:
            result?.message || "Không thể thực hiện yêu cầu. Vui lòng thử lại.",
        },
        { status: upstream.status < 500 ? upstream.status : 502 },
      );
      if (upstream.status === 401) response.cookies.delete(AUTH_COOKIE);
      return response;
    }
    const responseHeaders = new Headers({ "Cache-Control": "no-store" });
    for (const name of ["Content-Type", "Content-Disposition"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { message: "Không thể kết nối backend. Vui lòng thử lại." },
      { status: 502 },
    );
  }
}
export { proxy as GET, proxy as POST };
