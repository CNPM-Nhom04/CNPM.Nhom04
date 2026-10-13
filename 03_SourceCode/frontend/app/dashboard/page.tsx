import { prisma } from "@/lib/db";

export default async function DashboardPage() {
  // Lấy số liệu thực tế từ cơ sở dữ liệu
  let courseCount = 0;
  let programCount = 0;
  let activeTerm: any = null;

  try {
    [courseCount, programCount, activeTerm] = await Promise.all([
      prisma.courses.count(),
      prisma.training_programs.count(),
      prisma.academic_terms.findFirst({
        where: { status: "ACTIVE" },
        orderBy: { id: "desc" },
      }),
    ]);
  } catch (error) {
    console.error("Lỗi khi tải dữ liệu dashboard:", error);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Tổng quan Phân hệ</h2>
        <p className="text-sm text-slate-500">
          Chào mừng đến với hệ thống quản lý chương trình đào tạo sau đại học.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">
            Học phần đang quản lý
          </div>
          <div className="text-3xl font-bold text-slate-900 mt-2">
            {courseCount}
          </div>
          <div className="text-xs text-green-600 mt-1 font-medium">
            Đã đồng bộ từ cơ sở dữ liệu
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">
            Chương trình Đào tạo
          </div>
          <div className="text-3xl font-bold text-slate-900 mt-2">
            {programCount}
          </div>
          <div className="text-xs text-blue-600 mt-1 font-medium">
            Tổng số chương trình hiện có
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">
            Đợt đăng ký học phần
          </div>
          <div className="text-3xl font-bold text-slate-900 mt-2">
            {activeTerm ? "Đang mở" : "Tạm đóng"}
          </div>
          <div className="text-xs text-orange-600 mt-1 font-medium">
            {activeTerm
              ? `${activeTerm.semester} / ${activeTerm.academic_year}`
              : "Không có học kỳ active"}
          </div>
        </div>
      </div>
    </div>
  );
}
