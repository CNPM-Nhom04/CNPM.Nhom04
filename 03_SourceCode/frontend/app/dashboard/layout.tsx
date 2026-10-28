import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { getSession } from "@/lib/server/session";
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, status } = await getSession();
  if (status === 401) redirect("/dang-nhap");
  if (!user)
    return (
      <main className="p-8">
        <p role="alert">Không thể kết nối hệ thống. Vui lòng thử lại sau.</p>
        <a href="/dashboard" className="text-blue-600 underline">
          Thử lại
        </a>
      </main>
    );
  if (user.mustChangePassword) redirect("/doi-mat-khau");
  return (
    <SessionProvider user={user}>
      <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-8">{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}
