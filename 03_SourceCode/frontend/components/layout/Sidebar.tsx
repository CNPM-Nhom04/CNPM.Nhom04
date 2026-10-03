"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  CheckSquare,
  GitCompare,
  CalendarDays,
  UserCheck,
  FileSpreadsheet,
  Database,
  Sliders,
  Users,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";

const menuGroups = [
  {
    title: "TỔNG QUAN",
    items: [
      { name: "Bảng điều khiển", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "QUẢN TRỊ ĐÀO TẠO",
    items: [
      {
        name: "Danh mục Học phần",
        href: "/dashboard/hoc-phan",
        icon: BookOpen,
      },
      {
        name: "Chương trình đào tạo",
        href: "/dashboard/chuong-trinh-dao-tao",
        icon: GraduationCap,
      },
      {
        name: "Xét duyệt CTĐT",
        href: "/dashboard/xet-duyet",
        icon: CheckSquare,
      },
      {
        name: "So sánh 2 CTĐT",
        href: "/dashboard/so-sanh",
        icon: GitCompare,
      },
    ],
  },
  {
    title: "HỌC VỤ & ĐĂNG KÝ",
    items: [
      {
        name: "Đợt đăng ký & Xử lý lớp",
        href: "/dashboard/dang-ky-hoc-phan",
        icon: CalendarDays,
      },
      {
        name: "Cổng học viên (ĐKHP)",
        href: "/dashboard/sinh-vien/dang-ky",
        icon: UserCheck,
      },
      {
        name: "Tra cứu & Báo cáo Excel",
        href: "/dashboard/bao-cao",
        icon: FileSpreadsheet,
      },
    ],
  },
  {
    title: "QUẢN TRỊ HỆ THỐNG",
    items: [
      {
        name: "Danh mục dùng chung",
        href: "/dashboard/admin/master-data",
        icon: Database,
      },
      {
        name: "Cấu hình tham số",
        href: "/dashboard/admin/cau-hinh",
        icon: Sliders,
      },
      {
        name: "Nhân sự & Phân quyền",
        href: "/dashboard/admin/nguoi-dung",
        icon: Users,
      },
      {
        name: "Nhật ký hệ thống (Audit)",
        href: "/dashboard/admin/audit-log",
        icon: History,
      },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800">
      <div className="h-16 flex items-center px-6 border-b border-slate-800">
        <GraduationCap className="h-7 w-7 text-blue-500 mr-2.5" />
        <div>
          <span className="text-base font-bold text-white tracking-wide block leading-tight">
            ĐÀO TẠO SĐH
          </span>
          <span className="text-xs text-slate-400">Quản lý CTĐT</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
        {menuGroups.map((group, groupIdx) => (
          <div key={groupIdx}>
            <p className="text-[11px] font-semibold text-slate-400 px-3 uppercase tracking-wider mb-2">
              {group.title}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      isActive
                        ? "bg-blue-600 text-white font-semibold"
                        : "hover:bg-slate-800 hover:text-white text-slate-300",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800 text-[11px] text-slate-400 text-center">
        Phiên bản v1.0 • Khoa CNTT
      </div>
    </aside>
  );
}
