"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  FileCheck,
  Users,
  Calendar,
  MessageSquare,
  UploadCloud,
} from "lucide-react";
import { Button, Input, Badge } from "@/components/ui";

export default function XetDuyetCTDTPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();

  const [approvalData, setApprovalData] = useState({
    hoiDongThamDinh: "Hội đồng Khoa học Đào tạo Khoa CNTT",
    chuTichHoidong: "PGS.TS. Nguyễn Văn A",
    thuKhao: "TS. Trần Thị B",
    ngayHop: "2026-10-15",
    ketLuan: "DAT_DIEU_KIEN",
    yKienDongGop:
      "Chương trình đáp ứng tốt định hướng ứng dụng và nghiên cứu. Cần bổ sung thêm 2 học phần tự chọn chuyên sâu về Trí tuệ nhân tạo.",
    soBienBan: "BB-HDT-2026/04",
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setApprovalData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Dữ liệu xét duyệt CTĐT ID:", params.id, approvalData);
    alert("Đã gửi hồ sơ xét duyệt hội đồng thành công!");
    router.push("/dashboard/chuong-trinh-dao-tao");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* 1. Header tác vụ */}
      <div className="bg-white px-6 py-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Quay lại
          </Button>
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              Xét Duyệt & Thẩm Định CTĐT
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Cập nhật kết quả làm việc của hội đồng khoa học và trình phê duyệt
              chính thức
            </p>
          </div>
        </div>
        <Badge variant="pending">Đang chờ thẩm định</Badge>
      </div>

      {/* 2. Form Nhập liệu Xét duyệt */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Khối 1: Thông tin Hội đồng */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 bg-slate-50/90 border-b border-slate-200 flex items-center gap-2">
            <Users className="h-4.5 w-4.5 text-blue-600" />
            <h2 className="font-bold text-slate-800 text-sm">
              1. Thành phần Hội đồng Thẩm định
            </h2>
          </div>

          <div className="p-6 space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Tên Hội Đồng / Ban Thẩm Định{" "}
                <span className="text-red-500">*</span>
              </label>
              <Input
                name="hoiDongThamDinh"
                value={approvalData.hoiDongThamDinh}
                onChange={handleChange}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Chủ Tịch Hội Đồng <span className="text-red-500">*</span>
                </label>
                <Input
                  name="chuTichHoidong"
                  value={approvalData.chuTichHoidong}
                  onChange={handleChange}
                  placeholder="VD: PGS.TS Nguyễn Văn A"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Thư Ký Khoa Học <span className="text-red-500">*</span>
                </label>
                <Input
                  name="thuKhao"
                  value={approvalData.thuKhao}
                  onChange={handleChange}
                  placeholder="VD: TS. Trần Thị B"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Số Biên Bản Họp Hội Đồng
                </label>
                <Input
                  name="soBienBan"
                  value={approvalData.soBienBan}
                  onChange={handleChange}
                  placeholder="VD: BB-HDT-2026/04"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Ngày Tổ Chức Thẩm Định <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  name="ngayHop"
                  value={approvalData.ngayHop}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Khối 2: Kết luận và Ý kiến đóng góp */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 bg-slate-50/90 border-b border-slate-200 flex items-center gap-2">
            <FileCheck className="h-4.5 w-4.5 text-blue-600" />
            <h2 className="font-bold text-slate-800 text-sm">
              2. Kết Luận & Biên Bản Thẩm Định
            </h2>
          </div>

          <div className="p-6 space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Kết Luận Của Hội Đồng <span className="text-red-500">*</span>
              </label>
              <select
                name="ketLuan"
                value={approvalData.ketLuan}
                onChange={handleChange}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="DAT_DIEU_KIEN">
                  Đạt điều kiện (Trình ban hành)
                </option>
                <option value="YEU_CAU_SUA_DOI">
                  Yêu cầu chỉnh sửa, bổ sung
                </option>
                <option value="KHONG_DAT">Không đạt</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Ý Kiến Đóng Góp / Ghi Chú Của Hội Đồng
              </label>
              <textarea
                name="yKienDongGop"
                rows={4}
                value={approvalData.yKienDongGop}
                onChange={handleChange}
                className="w-full p-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nhập chi tiết các góp ý cải tiến chương trình từ các thành viên hội đồng..."
              />
            </div>

            {/* Khu vực đính kèm file biên bản (Mockup UI) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Tài Liệu Đính Kèm (Biên bản họp ký quét PDF)
              </label>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer">
                <UploadCloud className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">
                  Kéo thả file biên bản vào đây hoặc{" "}
                  <span className="text-blue-600 underline">
                    tải lên từ máy
                  </span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Hỗ trợ định dạng PDF, DOCX (Tối đa 25MB)
                </p>
              </div>
            </div>
          </div>

          {/* Footer nút hành động */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
            <Button
              variant="outline"
              type="button"
              onClick={() => router.back()}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Lưu Kết Quản & Phê Duyệt CTĐT
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
