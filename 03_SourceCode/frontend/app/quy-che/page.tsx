import { PublicShell } from "@/components/public/PublicShell";
import { PublicDocuments } from "@/components/public/PublicDocuments";
export const metadata = { title: "Quy chế & văn bản | Đào tạo sau đại học" };
export default function Regulations() {
  return (
    <PublicShell>
      <main id="noi-dung">
        <section className="bg-[#f2f6ef] px-5 py-12">
          <div className="mx-auto max-w-7xl lg:px-3">
            <p className="text-xs font-bold tracking-widest text-emerald-700">
              THÔNG TIN VÀ HƯỚNG DẪN
            </p>
            <h1 className="mt-3 text-4xl font-bold text-[#113f36]">
              Quy chế & văn bản
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Tra cứu quy chế, hướng dẫn đào tạo và văn bản tuyển sinh đã được
              công bố.
            </p>
          </div>
        </section>
        <section className="mx-auto max-w-5xl px-5 py-10 lg:px-8">
          <PublicDocuments />
        </section>
      </main>
    </PublicShell>
  );
}
