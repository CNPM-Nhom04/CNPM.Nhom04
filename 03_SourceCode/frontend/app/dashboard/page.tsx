import { cookies } from "next/headers";
import { getSession } from "@/lib/server/session";
import { AUTH_COOKIE, backendUrl } from "@/lib/server/backend";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function DashboardPage() {
  const { user } = await getSession();
  if (!user) return null;
  if (!user.permissions.includes("PROGRAM_READ"))
    return (
      <div className="rounded-xl border bg-white p-6">
        <h2 className="text-xl font-bold">
          Xin chào {user.fullName || user.username}
        </h2>
        <p className="mt-2 text-slate-600">
          Chọn chức năng được cấp quyền trong menu bên trái.
        </p>
      </div>
    );
  let cards: { name: string; value: string | number }[] | null = null;
  try {
    const token = (await cookies()).get(AUTH_COOKIE)?.value;
    const [response, term] = await Promise.all([
      fetch(backendUrl("/bao-cao/thong-ke"), {
        headers: { Authorization: "Bearer " + token },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      }),
      prisma.academic_terms.findFirst({
        where: { status: "ACTIVE" },
        orderBy: { id: "desc" },
      }),
    ]);
    if (!response.ok) throw new Error("Summary unavailable");
    const summary = await response.json();
    cards = [
      { name: "CTĐT trong phạm vi của bạn", value: summary.tongChuongTrinh },
      {
        name: "Học phần đang hoạt động trong ngân hàng",
        value: summary.tongHocPhan,
      },
      {
        name: "Học kỳ hiện hành",
        value: term
          ? `${term.semester} / ${term.academic_year}`
          : "Chưa có học kỳ hoạt động",
      },
    ];
  } catch {
    /* Display an explicit load error below instead of invented zero totals. */
  }
  if (!cards)
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 p-6"
      >
        Không thể tải số liệu tổng quan.{" "}
        <a href="/dashboard" className="underline">
          Tải lại trang
        </a>
      </div>
    );
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Tổng quan Phân hệ</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card) => (
          <div key={card.name} className="rounded-lg border bg-white p-6">
            <p className="text-sm text-slate-500">{card.name}</p>
            <p className="mt-2 text-2xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
