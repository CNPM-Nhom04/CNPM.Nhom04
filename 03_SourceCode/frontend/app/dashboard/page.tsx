export default function DashboardPage() {
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
          <div className="text-3xl font-bold text-slate-900 mt-2">128</div>
          <div className="text-xs text-green-600 mt-1 font-medium">
            Đã số hóa đề cương chi tiết
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">
            Chương trình Thạc sĩ / Tiến sĩ
          </div>
          <div className="text-3xl font-bold text-slate-900 mt-2">12</div>
          <div className="text-xs text-blue-600 mt-1 font-medium">
            Có 2 CTĐT đang chờ xét duyệt
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">
            Đợt đăng ký học phần
          </div>
          <div className="text-3xl font-bold text-slate-900 mt-2">Đang mở</div>
          <div className="text-xs text-orange-600 mt-1 font-medium">
            Học kỳ 1 / 2026-2027
          </div>
        </div>
      </div>
    </div>
  );
}
