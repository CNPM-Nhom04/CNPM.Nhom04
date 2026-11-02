import { PublicShell } from "@/components/public/PublicShell";
import { PublicPrograms } from "@/components/public/PublicPrograms";
export const metadata = { title: "Chương trình đào tạo | Đào tạo sau đại học" };
export default function Programs() {
  return (
    <PublicShell>
      <main id="noi-dung">
        <section className="border-b border-emerald-100 bg-[#f2f6ef] px-5 py-12">
          <div className="mx-auto max-w-7xl lg:px-3">
            <p className="text-xs font-bold tracking-widest text-emerald-700">
              TRA CỨU THÔNG TIN
            </p>
            <h1 className="mt-3 text-4xl font-bold text-[#113f36]">
              Chương trình đào tạo
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Khám phá chương trình đã ban hành, xem cấu trúc học phần theo từng
              phiên bản và hướng đào tạo.
            </p>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
          <PublicPrograms />
        </section>
      </main>
    </PublicShell>
  );
}
