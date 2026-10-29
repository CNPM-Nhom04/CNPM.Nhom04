import { backendUrl } from "@/lib/server/backend";
import Link from "next/link";
import { PasswordForm } from "@/components/auth/PasswordForm";
export const metadata = { referrer: "no-referrer" };
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  let minimum = 10;
  try {
    const response = await fetch(backendUrl("/auth/password-policy"), {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) minimum = (await response.json()).passwordMinLength;
  } catch {
    /* API submission reports any backend outage. */
  }
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border bg-white p-8 space-y-5">
        <h1 className="text-2xl font-bold">Đặt lại mật khẩu</h1>
        <PasswordForm
          minimum={minimum}
          mode="reset"
          token={typeof params.token === "string" ? params.token : ""}
        />
        <Link href="/dang-nhap" className="block text-sm text-blue-600">
          Quay lại đăng nhập
        </Link>
      </div>
    </main>
  );
}
 
