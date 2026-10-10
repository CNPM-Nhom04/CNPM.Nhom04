"use client";

import { useState } from "react";
import {
  UserCheck,
  BookOpen,
  CheckCircle2,
  Plus,
  Trash2,
  Send,
  AlertCircle,
  GraduationCap,
} from "lucide-react";
import { Button, Badge } from "@/components/ui";

interface HocPhanDangKy {
  id: string;
  maHocPhan: string;
  tenHocPhan: string;
  soTinChi: number;
  giangVien: string;
  lichHoc: string;
  daChon: boolean;
}

const MOCK_AVAILABLE_COURSES: HocPhanDangKy[] = [
  {
    id: "hp-01",
    maHocPhan: "PHIL601",
    tenHocPhan: "Triết học (Dành cho SĐH)",
    soTinChi: 3,
    giangVien: "PGS.TS. Nguyễn Văn C",
    lichHoc: "Thứ 2 (Tiết 1-3) - Phòng A102",
    daChon: true,
  },
  {
    id: "hp-03",
    maHocPhan: "CS701",
    tenHocPhan: "Trí tuệ Nhân tạo Nâng cao",
    soTinChi: 3,
    giangVien: "TS. Trần Minh D",
    lichHoc: "Thứ 4 (Tiết 4-6) - Phòng Lab 3",
    daChon: true,
  },
  {
    id: "hp-04",
    maHocPhan: "CS702",
    tenHocPhan: "Học máy và Khai phá Dữ liệu lớn",
    soTinChi: 3,
    giangVien: "TS. Hoàng Văn E",
    lichHoc: "Thứ 6 (Tiết 1-3) - Phòng Lab 1",
    daChon: false,
  },
  {
    id: "hp-06",
    maHocPhan: "RES801",
    tenHocPhan: "Phương pháp Nghiên cứu Khoa học",
    soTinChi: 2,
    giangVien: "GS.TS. Phạm Văn F",
    lichHoc: "Thứ 7 (Tiết 4-6) - Phòng B204",
    daChon: false,
  },
];

export default function SinhVienDangKyPage() {
  const [courses, setCourses] = useState<HocPhanDangKy[]>(
    MOCK_AVAILABLE_COURSES,
  );

  const handleToggleSelect = (id: string) => {
    setCourses(
      courses.map((c) => (c.id === id ? { ...c, daChon: !c.daChon } : c)),
    );
  };

  const selectedCourses = courses.filter((c) => c.daChon);
  const totalCredits = selectedCourses.reduce((sum, c) => sum + c.soTinChi, 0);

  const handleSubmitRegistration = () => {
    if (selectedCourses.length === 0) {
      alert("Vui lòng chọn ít nhất một học phần trước khi gửi đăng ký.");
      return;
    }
    console.log("Phiếu đăng ký học phần:", selectedCourses);
    alert("Đã gửi phiếu đăng ký học phần thành công đến Phòng Đào tạo!");
  };

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header thông tin học viên */}
      <div className="bg-white px-6 py-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
            NH
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-950">
              Cổng Đăng Ký Học Phần - Học Viên SĐH
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Học viên:{" "}
              <strong className="text-slate-800">Nguyễn Đức Huy</strong> • MSSV:{" "}
              <strong className="text-slate-800">DPM235424</strong> • Chuyên
              ngành: Thạc sĩ KHMT
            </p>
          </div>
        </div>
        <Badge variant="approved">Đang mở đợt đăng ký</Badge>
      </div>

      {/* 2. Thẻ tổng quan tín chỉ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">
              Học phần đã chọn
            </p>
            <h3 className="text-xl font-bold text-slate-900">
              {selectedCourses.length} môn
            </h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">
              Tổng số tín chỉ
            </p>
            <h3 className="text-xl font-bold text-emerald-600">
              {totalCredits} TC
            </h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">
              Trạng thái hồ sơ
            </p>
            <p className="text-sm font-bold text-amber-600 mt-0.5">
              Chưa chốt đăng ký
            </p>
          </div>
          <Button
            onClick={handleSubmitRegistration}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
          >
            <Send className="h-3.5 w-3.5 mr-1.5" />
            Gửi Đăng Ký
          </Button>
        </div>
      </div>

      {/* 3. Danh sách học phần mở đăng ký */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-sm">
            Danh Mục Học Phần Mở Đăng Ký Học Kỳ 1 (2026-2027)
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            Tích chọn các môn học muốn đăng ký
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm table-fixed">
            <thead>
              <tr className="bg-slate-100/60 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="w-20 px-5 py-3.5 text-center">Chọn</th>
                <th className="w-32 px-5 py-3.5">Mã HP</th>
                <th className="w-80 px-5 py-3.5">Tên Học Phần</th>
                <th className="w-24 px-5 py-3.5 text-center">Tín Chỉ</th>
                <th className="w-48 px-5 py-3.5">Giảng Viên</th>
                <th className="px-5 py-3.5">Lịch Học Dự Kiến</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {courses.map((hp) => (
                <tr
                  key={hp.id}
                  className={`hover:bg-slate-50/80 transition-colors ${hp.daChon ? "bg-blue-50/30" : ""}`}
                >
                  <td className="px-5 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={hp.daChon}
                      onChange={() => handleToggleSelect(hp.id)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-5 py-4 font-bold text-blue-600 truncate">
                    {hp.maHocPhan}
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-900 truncate">
                    {hp.tenHocPhan}
                  </td>
                  <td className="px-5 py-4 text-center font-bold text-slate-800">
                    {hp.soTinChi} TC
                  </td>
                  <td className="px-5 py-4 text-slate-700 text-xs font-medium truncate">
                    {hp.giangVien}
                  </td>
                  <td className="px-5 py-4 text-slate-600 text-xs font-medium truncate">
                    {hp.lichHoc}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
