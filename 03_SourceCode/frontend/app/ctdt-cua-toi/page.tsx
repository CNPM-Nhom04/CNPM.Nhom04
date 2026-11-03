import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/server/session";
import { canReadOwnProgram, OWN_PROGRAM_PATH } from "@/lib/accountAccess";
import { PublicShell } from "@/components/public/PublicShell";
import { StudentProgramContent } from "@/components/student/StudentProgramContent";
export const dynamic = "force-dynamic";
export const metadata = { title: "CTĐT của tôi | Đào tạo sau đại học" };
export default async function MyProgramPage() {
  const { user, status } = await getSession();
  if (status === 401)
    redirect("/dang-nhap?next=" + encodeURIComponent(OWN_PROGRAM_PATH));
  if (user?.mustChangePassword) redirect("/doi-mat-khau");
  return (
    <PublicShell>
      <main
        id="noi-dung"
        className="mx-auto w-full max-w-7xl px-5 py-10 lg:px-8"
      >
        {!user ? (
          <section
            role="alert"
            className="rounded border border-red-200 bg-red-50 p-6 text-red-800"
          >
            Không thể kết nối hệ thống để kiểm tra tài khoản. Vui lòng thử lại.
          </section>
        ) : !canReadOwnProgram(user) ? (
          <section
            role="alert"
            className="rounded border border-slate-200 bg-white p-6 text-slate-900"
          >
            <h1 className="text-xl font-bold">
              Tài khoản không có quyền tra cứu CTĐT cá nhân.
            </h1>
            <Link
              href="/"
              className="mt-4 inline-block text-emerald-700 underline"
            >
              Về trang chủ
            </Link>
          </section>
        ) : (
          <StudentProgramContent user={user} />
        )}
      </main>
    </PublicShell>
  );
}
