import { PublicShell } from "@/components/public/PublicShell";
import { AdmissionForm } from "@/components/public/AdmissionForm";
export const metadata = { title: "Đăng ký nhận thông tin tuyển sinh" };
export default function Admissions() {
  return (
    <PublicShell>
      <main id="noi-dung" className="bg-[#f7f8f6]">
        <div className="mx-auto max-w-5xl px-5 py-14 lg:px-8">
          <div className="mb-9 text-center">
            <p className="text-xs font-bold tracking-[.18em] text-emerald-700">
              KẾT NỐI VÀ TƯ VẤN
            </p>
            <h1 className="mt-3 text-3xl font-bold text-[#113f36] md:text-4xl">
              Đăng ký nhận thông tin tuyển sinh
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-500">
              Vui lòng điền thông tin để được liên hệ, tư vấn theo bậc đào tạo
              và ngành bạn quan tâm.
            </p>
          </div>
          <AdmissionForm />
        </div>
      </main>
    </PublicShell>
  );
}
