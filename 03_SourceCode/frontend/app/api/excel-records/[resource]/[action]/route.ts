import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, backendUrl } from "@/lib/server/backend";
const resources = new Set([
  "faculties",
  "majors",
  "users",
  "student-classes",
  "courses",
  "programs",
  "topics",
  "supervisors",
  "defenses",
  "documents",
  "course-offerings",
]);
async function handle(
  request: NextRequest,
  { params }: { params: Promise<{ resource: string; action: string }> },
) {
  const { resource, action } = await params;
  if (
    !resources.has(resource) ||
    !["template", "preview", "apply"].includes(action) ||
    (request.method === "GET") !== (action === "template")
  )
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
  if (
    request.method === "POST" &&
    request.headers.get("origin") !== request.nextUrl.origin
  )
    return NextResponse.json(
      { message: "Yêu cầu không hợp lệ." },
      { status: 403 },
    );
  try {
    let body: FormData | undefined;
    if (request.method === "POST") {
      body = await request.formData();
      const file = body.get("file");
      if (!(file instanceof File) || file.size > 5 * 1024 * 1024)
        return NextResponse.json(
          { message: "Chọn XLSX tối đa 5MB." },
          { status: 400 },
        );
    }
    const query = new URLSearchParams();
    for (const key of ["focus", "baseId"]) {
      const value = request.nextUrl.searchParams.get(key);
      if (value && /^\d+$/.test(value)) query.set(key, value);
    }
    const response = await fetch(
      backendUrl(`/excel-records/${resource}/${action}?${query}`),
      {
        method: request.method,
        headers: { Authorization: `Bearer ${token}` },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(60000),
      },
    );
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return NextResponse.json(
        { message: data?.message || "Không xử lý được Excel." },
        { status: response.status < 500 ? response.status : 502 },
      );
    }
    return new Response(response.body, {
      headers: {
        "Content-Type":
          response.headers.get("Content-Type") || "application/json",
        "Cache-Control": "private, no-store",
        ...(response.headers.get("Content-Disposition")
          ? {
              "Content-Disposition": response.headers.get(
                "Content-Disposition",
              )!,
            }
          : {}),
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Không kết nối được dịch vụ Excel." },
      { status: 502 },
    );
  }
}
export const GET = handle;
export const POST = handle;
