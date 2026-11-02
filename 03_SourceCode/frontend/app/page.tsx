import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  FileText,
  MessagesSquare,
  ChevronRight,
} from "lucide-react";
import { PublicShell } from "@/components/public/PublicShell";
import { ProgramCard } from "@/components/public/ProgramCard";
import { AdmissionForm } from "@/components/public/AdmissionForm";
import { readPublic } from "@/lib/server/publicPortal";
import type {
  PublicProgram,
  PublicDocument,
  PublicPage,
} from "@/lib/services/portalService";
export const dynamic = "force-dynamic";
export default async function Home() {
  const [programs, documents] = await Promise.all([
    readPublic<PublicPage<PublicProgram>>("chuong-trinh-dao-tao?limit=3"),
    readPublic<PublicPage<PublicDocument>>(
      "van-ban?category=ADMISSION&limit=3",
    ),
  ]);
  return (
    <PublicShell>
      <main id="noi-dung">
        <section className="overflow-hidden bg-[#f2f6ef]">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-12 pt-12 lg:grid-cols-[1fr_1.04fr] lg:gap-12 lg:px-8 lg:pb-16 lg:pt-16">
            <div>
              <p className="mb-5 flex items-center gap-3 text-xs font-bold tracking-[.2em] text-emerald-800">
                <span className="h-px w-9 bg-emerald-700" />
                KẾT NỐI TRI THỨC · KIẾN TẠO TƯƠNG LAI
              </p>
              <h1 className="text-[2.6rem] font-bold leading-[1.15] tracking-tight text-[#113f36] sm:text-6xl">
                Tiếp nối tri thức.
                <br />
                <span className="font-serif font-normal italic text-[#087b62]">
                  Mở rộng tương lai.
                </span>
              </h1>
              <p className="mt-6 max-w-lg text-base leading-8 text-slate-600">
                Khám phá chương trình đào tạo, tra cứu quy chế và tìm hiểu hành
                trình học tập phù hợp với bạn tại Trường Đại học An Giang.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/chuong-trinh-dao-tao"
                  className="flex items-center gap-4 rounded bg-[#087b62] px-6 py-3.5 text-sm font-bold text-white hover:bg-emerald-900"
                >
                  Khám phá chương trình <ArrowRight size={18} />
                </Link>
                <a
                  href="#dang-ky-tuyen-sinh"
                  className="flex items-center gap-2 rounded border border-emerald-800/25 px-5 py-3.5 text-sm font-bold text-emerald-900 hover:bg-white"
                >
                  Nhận tư vấn <ArrowUpRight size={17} />
                </a>
              </div>
              <div className="mt-9 flex items-center gap-5 border-t border-emerald-900/10 pt-6">
                <div className="text-3xl font-semibold text-[#087b62]">
                  {programs?.meta.total ?? "—"}
                </div>
                <p className="text-sm leading-6 text-slate-600">
                  Phiên bản chương trình đã ban hành
                  <br />
                  <span className="text-xs text-slate-500">
                    Tra cứu thông tin và cấu trúc học phần
                  </span>
                </p>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full border border-emerald-800/15" />
              <div className="relative overflow-hidden rounded-t-[110px] border border-emerald-800/10 bg-[#cfe6da]">
                <Image
                  src="/campus-illustration.svg"
                  width={760}
                  height={550}
                  priority
                  alt="Minh họa khuôn viên học tập với giảng đường và cây xanh"
                  className="h-auto w-full"
                />
                <div className="flex items-center justify-between gap-4 bg-[#075d4b] px-6 py-5 text-white">
                  <div>
                    <p className="text-[10px] font-semibold tracking-[.18em] text-emerald-200">
                      TRƯỜNG ĐẠI HỌC AN GIANG
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      Học tập. Nghiên cứu. Phát triển.
                    </p>
                  </div>
                  <BookOpen size={28} className="shrink-0 text-emerald-200" />
                </div>
              </div>
            </div>
          </div>
        </section>
        <section
          aria-label="Truy cập nhanh"
          className="border-b border-slate-100"
        >
          <div className="mx-auto grid max-w-7xl px-5 md:grid-cols-3 lg:px-8">
            {[
              {
                n: "01",
                title: "Chương trình đào tạo",
                desc: "Tra cứu phiên bản và khung học phần",
                href: "/chuong-trinh-dao-tao",
                Icon: BookOpen,
              },
              {
                n: "02",
                title: "Quy chế & văn bản",
                desc: "Thông tin và hướng dẫn được công bố",
                href: "/quy-che",
                Icon: FileText,
              },
              {
                n: "03",
                title: "Tư vấn tuyển sinh",
                desc: "Đăng ký nhận thông tin bạn quan tâm",
                href: "/dang-ky-thong-tin",
                Icon: MessagesSquare,
              },
            ].map(({ n, title, desc, href, Icon }) => (
              <Link
                href={href}
                key={href}
                className="group flex items-center gap-4 border-b border-slate-100 py-7 md:border-b-0 md:px-6 md:first:pl-0 md:last:pr-0"
              >
                <Icon
                  size={29}
                  strokeWidth={1.3}
                  className="shrink-0 text-emerald-700"
                />
                <div className="flex-1">
                  <p className="text-xs text-slate-400">{n}</p>
                  <h2 className="mt-1 text-base font-bold group-hover:text-emerald-700">
                    {title}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {desc}
                  </p>
                </div>
                <ChevronRight size={17} className="text-slate-400" />
              </Link>
            ))}
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs font-bold tracking-[.18em] text-emerald-700">
                CHỌN HÀNH TRÌNH CỦA BẠN
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                Chương trình đào tạo
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Các chương trình đã ban hành và đang được công bố trên hệ thống.
              </p>
            </div>
            <Link
              href="/chuong-trinh-dao-tao"
              className="flex items-center gap-2 text-sm font-bold text-emerald-700"
            >
              Xem tất cả <ArrowRight size={17} />
            </Link>
          </div>
          {programs?.data.length ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {programs.data.map((p, i) => (
                <ProgramCard key={p.id} program={p} index={i} />
              ))}
            </div>
          ) : (
            <p className="border border-dashed border-slate-200 p-8 text-sm text-slate-600">
              {programs
                ? "Chưa có chương trình được công bố."
                : "Chưa tải được chương trình. Bạn có thể mở mục Chương trình đào tạo để thử lại."}
            </p>
          )}
        </section>
        <section className="bg-[#075d4b]">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[.85fr_1.15fr] lg:px-8">
            <div>
              <p className="text-xs font-semibold tracking-[.18em] text-emerald-200">
                THÔNG TIN DÀNH CHO BẠN
              </p>
              <h2 className="mt-4 text-3xl font-bold leading-tight text-white">
                Sẵn sàng cho
                <br />
                bước tiến tiếp theo?
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-7 text-emerald-100/80">
                Theo dõi văn bản tuyển sinh và những hướng dẫn cần thiết trước
                khi bắt đầu hành trình học tập.
              </p>
              <Link
                href="/quy-che"
                className="mt-6 inline-flex items-center gap-3 text-sm font-semibold text-white"
              >
                Tra cứu quy chế & văn bản <ArrowRight size={17} />
              </Link>
            </div>
            <div className="divide-y divide-white/15">
              {documents?.data.length ? (
                documents.data.map((doc) => (
                  <a
                    href={doc.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    key={doc.id}
                    className="flex items-start gap-4 py-5 first:pt-0"
                  >
                    <FileText
                      size={25}
                      className="mt-1 shrink-0 text-emerald-200"
                    />
                    <div className="flex-1">
                      <p className="text-xs text-emerald-200">
                        {doc.issuedOn || "Thông tin tuyển sinh"}
                      </p>
                      <h3 className="mt-2 font-semibold leading-7 text-white">
                        {doc.title}
                      </h3>
                    </div>
                    <ArrowUpRight
                      size={19}
                      className="mt-2 shrink-0 text-emerald-200"
                    />
                  </a>
                ))
              ) : (
                <div className="border border-white/20 p-7">
                  <FileText size={30} className="text-emerald-200" />
                  <p className="mt-4 text-sm leading-7 text-emerald-50">
                    {documents
                      ? "Thông báo tuyển sinh sẽ hiển thị tại đây khi được công bố."
                      : "Chưa tải được thông báo. Vui lòng quay lại sau."}
                  </p>
                  <a
                    href="https://pgd.agu.edu.vn/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white underline underline-offset-4"
                  >
                    Tham khảo cổng thông tin chính thức{" "}
                    <ArrowUpRight size={16} />
                  </a>
                </div>
              )}
            </div>
          </div>
        </section>
        <section id="dang-ky-tuyen-sinh" className="scroll-mt-6 bg-[#f7f8f6]">
          <div className="mx-auto max-w-5xl px-5 py-16 lg:px-8 lg:py-20">
            <div className="mb-9 text-center">
              <p className="text-xs font-bold tracking-[.18em] text-emerald-700">
                GIỮ KẾT NỐI VỚI CHÚNG TÔI
              </p>
              <h2 className="mt-3 text-3xl font-bold text-slate-900">
                Đăng ký nhận thông tin tuyển sinh
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-500">
                Để lại thông tin và ngành bạn quan tâm để được liên hệ, tư vấn.
                Bạn không cần tạo tài khoản để đăng ký.
              </p>
            </div>
            <AdmissionForm />
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
