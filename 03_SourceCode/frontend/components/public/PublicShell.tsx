import { getSession } from "@/lib/server/session";
import { PublicAccountMenu } from "./PublicAccountMenu";
import Link from "next/link";
import {
  GraduationCap,
  ArrowUpRight,
  Mail,
  Phone,
  Menu,
  ArrowRight,
} from "lucide-react";
const nav = [
  { href: "/", name: "Trang chủ" },
  { href: "/chuong-trinh-dao-tao", name: "Chương trình đào tạo" },
  { href: "/quy-che", name: "Quy chế & văn bản" },
  { href: "/dang-ky-thong-tin", name: "Tư vấn tuyển sinh" },
];
export async function PublicHeader() {
  const { user } = await getSession();
  return (
    <>
      <a
        href="#noi-dung"
        className="sr-only focus:not-sr-only focus:block focus:bg-emerald-900 focus:p-3 focus:text-white"
      >
        Đến nội dung chính
      </a>
      <div className="bg-[#075d4b] text-xs text-emerald-50">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-5 py-2.5 lg:px-8">
          <span>TRI THỨC HÔM NAY · GIÁ TRỊ NGÀY MAI</span>
          <div className="flex flex-wrap gap-5">
            <a href="tel:02966256565" className="flex items-center gap-2">
              <Phone size={13} />
              0296.6256565 - 1415
            </a>
            <a
              href="mailto:tuyensinhsaudaihoc@agu.edu.vn"
              className="hidden items-center gap-2 sm:flex"
            >
              <Mail size={13} />
              tuyensinhsaudaihoc@agu.edu.vn
            </a>
          </div>
        </div>
      </div>
      <header className="relative z-20 border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-5 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 sm:h-12 sm:w-12 border-[#087b62] text-[#087b62]">
              <GraduationCap size={29} />
            </span>
            <span>
              <span className="block text-[10px] font-bold tracking-[.06em] text-slate-700 sm:text-sm">
                TRƯỜNG ĐẠI HỌC AN GIANG
              </span>
              <span className="mt-1 block text-[8px] font-semibold tracking-[.1em] text-[#087b62] sm:text-xs sm:tracking-[.2em]">
                ĐÀO TẠO SAU ĐẠI HỌC
              </span>
            </span>
          </Link>
          <nav
            aria-label="Điều hướng chính"
            className="hidden items-center gap-4 text-sm font-semibold text-slate-700 xl:flex"
          >
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="transition-colors hover:text-emerald-700"
              >
                {n.name}
              </Link>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <PublicAccountMenu user={user} />
            <details className="group xl:hidden">
              <summary
                aria-label="Mở menu"
                className="cursor-pointer list-none rounded p-2 text-slate-700"
              >
                <Menu />
              </summary>
              <nav
                aria-label="Điều hướng di động"
                className="absolute inset-x-0 top-full border-b border-emerald-100 bg-white px-5 py-4 shadow-lg"
              >
                {nav.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="block py-3 text-sm font-semibold text-slate-800"
                  >
                    {n.name}
                  </Link>
                ))}
              </nav>
            </details>
          </div>
        </div>
      </header>
    </>
  );
}
export function PublicFooter() {
  return (
    <footer className="bg-[#073e35] text-emerald-50">
      <div className="mx-auto grid max-w-7xl gap-9 px-5 py-12 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div>
          <div className="flex items-center gap-3">
            <GraduationCap size={34} />
            <div className="font-bold">
              ĐÀO TẠO SAU ĐẠI HỌC
              <span className="mt-1 block text-xs font-normal text-emerald-200">
                Trường Đại học An Giang
              </span>
            </div>
          </div>
          <p className="mt-5 max-w-sm text-sm leading-7 text-emerald-100/80">
            Tra cứu chương trình đào tạo, tiếp cận văn bản và kết nối với thông
            tin tuyển sinh.
          </p>
        </div>
        <div>
          <h2 className="mb-4 font-semibold">Liên kết nhanh</h2>
          {nav.slice(1).map((n) => (
            <Link
              className="mb-3 flex items-center gap-2 text-sm text-emerald-100/80 hover:text-white"
              key={n.href}
              href={n.href}
            >
              <ArrowRight size={13} />
              {n.name}
            </Link>
          ))}
        </div>
        <div>
          <h2 className="mb-4 font-semibold">Thông tin tuyển sinh</h2>
          <a
            className="block text-sm leading-7 text-emerald-100/80"
            href="tel:02966256565"
          >
            0296.6256565 - 1415
          </a>
          <a
            className="block break-all text-sm leading-7 text-emerald-100/80"
            href="mailto:tuyensinhsaudaihoc@agu.edu.vn"
          >
            tuyensinhsaudaihoc@agu.edu.vn
          </a>
          <a
            href="https://pgd.agu.edu.vn/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm text-emerald-200"
          >
            Cổng thông tin chính thức <ArrowUpRight size={14} />
          </a>
        </div>
      </div>
      <div className="border-t border-white/10 px-5 py-4 text-center text-xs text-emerald-100/60">
        Hệ thống quản lý chương trình đào tạo · Đồ án Nhóm 04
      </div>
    </footer>
  );
}
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}
