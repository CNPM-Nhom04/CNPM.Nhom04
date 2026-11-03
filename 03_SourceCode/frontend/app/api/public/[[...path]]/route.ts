import { NextRequest, NextResponse } from "next/server";
import { backendUrl } from "@/lib/server/backend";
async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const path = ((await context.params).path || []).join("/");
  const allowed =
    request.method === "GET"
      ? /^(options|van-ban|chuong-trinh-dao-tao(?:\/[1-9]\d{0,19})?)$/.test(
          path,
        )
      : request.method === "POST" && path === "dang-ky-thong-tin";
  if (!allowed)
    return NextResponse.json(
      { message: "Không tìm thấy chức năng." },
      { status: 404 },
    );
  let body: string | undefined;
  if (request.method === "POST") {
    if (request.headers.get("origin") !== request.nextUrl.origin)
      return NextResponse.json(
        { message: "Yêu cầu không hợp lệ." },
        { status: 403 },
      );
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return NextResponse.json(
        { message: "Dữ liệu không hợp lệ." },
        { status: 400 },
      );
    try {
      const reader = request.body?.getReader();
      if (!reader) throw Error();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 16384) {
          await reader.cancel();
          return NextResponse.json(
            { message: "Nội dung quá dài." },
            { status: 413 },
          );
        }
        chunks.push(value);
      }
      const data = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        data.set(chunk, offset);
        offset += chunk.byteLength;
      }
      body = JSON.stringify(JSON.parse(new TextDecoder().decode(data)));
    } catch {
      return NextResponse.json(
        { message: "Dữ liệu không hợp lệ." },
        { status: 400 },
      );
    }
  }
  try {
    const response = await fetch(
      backendUrl("/public/" + path) + request.nextUrl.search,
      {
        method: request.method,
        body,
        headers: body ? { "Content-Type": "application/json" } : {},
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok) {
      const data =
        response.status < 500 ? await response.json().catch(() => null) : null;
      return NextResponse.json(
        { message: data?.message || "Chưa thể tải dữ liệu. Vui lòng thử lại." },
        { status: response.status < 500 ? response.status : 502 },
      );
    }
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Chưa thể kết nối dịch vụ. Vui lòng thử lại." },
      { status: 502 },
    );
  }
}
export { proxy as GET, proxy as POST };
