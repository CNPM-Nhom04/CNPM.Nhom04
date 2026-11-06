import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, backendUrl } from "@/lib/server/backend";
async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const path = ((await context.params).path ?? []).join("/");
  const allowed =
    request.method === "GET"
      ? /^(?:|excel\/(?:options|rows|mau|mon-hoc|chuan-bi|danh-sach-mau)|lop-hoc|dang-ky|[1-9]\d{0,19}|lop-hoc\/[1-9]\d{0,19}\/quy-tac)$/.test(
          path,
        )
      : /^(?:excel\/(?:kiem-tra|luu|mo-bang-diem|hoan-tat-mon|danh-sach-kiem-tra|danh-sach-luu)|lop-hoc\/[1-9]\d{0,19}\/quy-tac|[1-9]\d{0,19}\/(?:chot|huy|mo-lai|dieu-chinh))$/.test(
          path,
        );
  if (!allowed)
    return NextResponse.json(
      { message: "Không tìm thấy API." },
      { status: 404 },
    );
  if (
    request.method === "POST" &&
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
      { message: "Vui lòng đăng nhập để sử dụng chức năng quản lý điểm." },
      { status: 401 },
    );
  let body: BodyInit | undefined;
  let multipart = false;
  if (request.method === "POST") {
    try {
      if (
        request.headers.get("content-type")?.startsWith("multipart/form-data")
      ) {
        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File) || file.size > 5 * 1024 * 1024)
          return NextResponse.json(
            { message: "Chọn Excel tối đa 5MB." },
            { status: 400 },
          );
        body = form;
        multipart = true;
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
      backendUrl("/quan-ly-diem" + (path ? "/" + path : "")) +
        request.nextUrl.search,
      {
        method: request.method,
        body,
        headers: {
          Authorization: "Bearer " + token,
          ...(body && !multipart ? { "Content-Type": "application/json" } : {}),
        },
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!upstream.ok) {
      const result =
        upstream.status < 500 ? await upstream.json().catch(() => null) : null;
      const response = NextResponse.json(
        {
          message:
            result?.message ||
            "Không thể tải dữ liệu từ backend. Vui lòng thử lại.",
        },
        { status: upstream.status < 500 ? upstream.status : 502 },
      );
      if (upstream.status === 401) response.cookies.delete(AUTH_COOKIE);
      return response;
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("Content-Type") || "application/json",
        ...(upstream.headers.get("Content-Disposition")
          ? {
              "Content-Disposition": upstream.headers.get(
                "Content-Disposition",
              )!,
            }
          : {}),
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
