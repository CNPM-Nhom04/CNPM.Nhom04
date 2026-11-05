import Link from "next/link";
import { getSession } from "@/lib/server/session";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await getSession();
  if (!user?.roles.includes("ADMIN"))
    return (
      <div role="alert" className="rounded-xl border bg-white p-6">
        <h2 className="font-semibold">
          Bạn không có quyền truy cập trang quản trị.
        </h2>
        <Link href="/dashboard" className="text-blue-600 underline">
          Về tổng quan
        </Link>
      </div>
    );
  return children;
}
