import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/server/session";
import { PasswordForm } from "@/components/auth/PasswordForm";
export default async function ChangePasswordPage() {
  const { user, status } = await getSession();
  if (status === 401) redirect("/dang-nhap?next=/doi-mat-khau");
  if (!user)
    return (
      <main className="p-8">
        Không thể tải tài khoản. Vui lòng thử lại khi backend hoạt động.
      </main>
    );
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border bg-white p-8 space-y-5">
        <h1 className="text-2xl font-bold">Đổi mật khẩu</h1>
        {user.mustChangePassword && (
          <p className="text-sm text-amber-700">
            Bạn cần đổi mật khẩu trước khi sử dụng hệ thống.
          </p>
        )}
        <PasswordForm mode="change" minimum={user.passwordMinLength} />
        {!user.mustChangePassword && (
          <Link href="/dashboard" className="block text-sm text-blue-600">
            Về trang tổng quan
          </Link>
        )}
      </div>
    </main>
  );
}
