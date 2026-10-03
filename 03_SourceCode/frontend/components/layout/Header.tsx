"use client";

import { LogOut, UserCircle } from "lucide-react";

export default function Header() {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10">
      <div>
        <h1 className="text-base font-semibold text-slate-800">
          Hệ thống Quản lý Đào tạo Sau Đại học
        </h1>
        <p className="text-xs text-slate-500">
          Phân hệ Số hóa & Quản lý Chương trình đào tạo
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-sm font-medium text-slate-800">
            Cán bộ Đào tạo
          </div>
          <div className="text-xs text-slate-500">Khoa Công nghệ Thông tin</div>
        </div>
        <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
          <UserCircle className="h-6 w-6" />
        </div>
        <button
          title="Đăng xuất"
          className="p-2 text-slate-400 hover:text-red-600 rounded-md hover:bg-slate-50 transition-colors ml-1"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
