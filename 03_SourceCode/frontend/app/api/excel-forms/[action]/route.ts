import { hasTrustedOrigin } from "@/lib/server/requestOrigin";
import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, backendUrl } from "@/lib/server/backend";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;
  if (!["template", "read"].includes(action))
    return NextResponse.json(
      { message: "Không tìm thấy API." },
      { status: 404 },
    );
  if (!hasTrustedOrigin(request))
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
  try {
    const headers: Record<string, string> = {
      Authorization: "Bearer " + token,
    };
    let body: BodyInit;
    if (action === "read") {
      const form = await request.formData(),
        file = form.get("file");
      if (!(file instanceof File) || file.size > 5 * 1024 * 1024)
        return NextResponse.json(
          { message: "Chọn XLSX tối đa 5MB." },
          { status: 400 },
        );
      body = form;
    } else {
      body = JSON.stringify(await request.json());
      headers["Content-Type"] = "application/json";
    }
    const upstream = await fetch(backendUrl("/excel-forms/" + action), {
      method: "POST",
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(60000),
    });
    if (!upstream.ok) {
      const result = await upstream.json().catch(() => null);
      return NextResponse.json(
        { message: result?.message || "Không xử lý được Excel." },
        { status: upstream.status < 500 ? upstream.status : 502 },
      );
    }
    return new Response(upstream.body, {
      headers: {
        "Content-Type":
          upstream.headers.get("Content-Type") || "application/json",
        "Cache-Control": "no-store",
        ...(upstream.headers.get("Content-Disposition")
          ? {
              "Content-Disposition": upstream.headers.get(
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
