import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import { PublicProgramDetail } from "@/components/public/PublicProgramDetail";
import { readPublic } from "@/lib/server/publicPortal";
import type { PublicProgramDetail as Detail } from "@/lib/services/portalService";
export const dynamic = "force-dynamic";
export default async function Program({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const program = /^[1-9]\d{0,19}$/.test(id)
    ? await readPublic<Detail>("chuong-trinh-dao-tao/" + id)
    : null;
  return (
    <PublicShell>
      <main id="noi-dung" className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <Link
          href="/chuong-trinh-dao-tao"
          className="text-sm font-semibold text-emerald-700"
        >
          ← Danh sách chương trình
        </Link>
        {program ? (
          <>
            <p className="mt-8 text-xs font-bold uppercase tracking-widest text-emerald-700">
              {program.levelName} · Khóa {program.cohortYear}
            </p>
            <h1 className="mb-8 mt-3 max-w-4xl text-3xl font-bold leading-tight text-[#113f36] md:text-4xl">
              {program.name}
            </h1>
            <PublicProgramDetail program={program} />
          </>
        ) : (
          <section className="my-12 border border-slate-200 p-8">
            <h1 className="text-2xl font-bold">
              Chưa thể hiển thị chương trình
            </h1>
            <p className="mt-4 text-sm text-slate-600">
              Chương trình chưa được công bố, không còn hiển thị hoặc dịch vụ
              đang tạm gián đoạn.
            </p>
          </section>
        )}
      </main>
    </PublicShell>
  );
}
