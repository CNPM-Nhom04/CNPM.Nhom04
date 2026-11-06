"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { downloadExcel } from "@/lib/services/excelDownload";
type Data = {
  members: { studentCode: string; studentName: string }[];
  offerings: {
    offeringId: string;
    offeringCode: string;
    courseCode: string;
    courseName: string;
    policyId: string | null;
  }[];
  registrations: { status: string }[];
  permissions: { canPrepare: boolean };
};
type Preview = {
  changed: number;
  unchanged: number;
  changes: {
    studentCode: string;
    studentName: string;
    offeringCode: string;
    courseCode: string;
  }[];
};
async function request<T>(path: string, options: RequestInit = {}) {
  const r = await fetch("/api/quan-ly-diem/excel/" + path, {
    ...options,
    cache: "no-store",
  });
  if (!r.ok) {
    const b = await r.json().catch(() => null);
    throw new Error(b?.message || "Không thực hiện được yêu cầu.");
  }
  return r.json() as Promise<T>;
}
export function GradePreparation({
  classId,
  termId,
  hasRows,
  onSaved,
  onPolicy,
}: {
  classId: string;
  termId: string;
  hasRows: boolean;
  onSaved: () => void;
  onPolicy: (id: string) => void;
}) {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState<Preview | null>(null);
  const query = "?" + new URLSearchParams({ classId, termId });
  useEffect(() => {
    const controller = new AbortController();
    request<Data>("chuan-bi" + query, { signal: controller.signal })
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [query]);
  async function upload(selected: File, apply = false) {
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", selected);
      const result = await request<Preview>(
        (apply ? "danh-sach-luu" : "danh-sach-kiem-tra") + query,
        { method: "POST", body },
      );
      if (apply) {
        setPreview(null);
        setFile(null);
        onSaved();
      } else {
        setPreview(result);
        setFile(selected);
      }
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : "Không đọc được danh sách.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-xl border bg-white p-4 space-y-4 print:hidden text-sm">
      <div>
        <h2 className="font-semibold">Chuẩn bị nhập điểm</h2>
        <p className="text-slate-500">
          1. Lập danh sách học → 2. Cấu hình quy tắc điểm → 3. Nhập bảng điểm
          Excel
        </p>
      </div>
      {error && (
        <p role="alert" className="text-red-700 whitespace-pre-line">
          {error}
        </p>
      )}
      {!data && !error && (
        <p role="status">Đang kiểm tra học viên và lớp học phần…</p>
      )}
      {data && (
        <>
          {!hasRows && (
            <p className="rounded-lg bg-amber-50 p-3 text-amber-900">
              Lớp đã có {data.members.length} học viên phù hợp trong phạm vi,
              nhưng chưa có danh sách học theo môn để nhập điểm ở học kỳ này.
              Cần lập danh sách học theo hồ sơ trước.
            </p>
          )}
          {!data.members.length && (
            <p className="text-amber-800">
              Chưa có học viên hoạt động với phân công CTĐT phù hợp. Kiểm tra
              xếp lớp và phân công CTĐT trước.
            </p>
          )}
          {!data.offerings.length && (
            <p className="text-amber-800">
              Chưa có lớp học phần khả dụng khớp phiên bản CTĐT và học kỳ. Cần
              cấu hình lớp học phần phù hợp trước khi lập danh sách học.
            </p>
          )}
          <details open={!hasRows} className="rounded-lg border p-3">
            <summary className="cursor-pointer font-semibold">
              Bước 1 · Lập danh sách học bằng Excel
            </summary>
            <div className="mt-3 space-y-3">
              <p>
                Mẫu có mã học viên và danh sách học hiện có. Chọn ID lớp học
                phần từ danh sách trong file, điền lý do và số hồ sơ. Hệ thống
                chỉ thêm các dòng bạn xác nhận; giữ nguyên điểm và danh sách đã
                có.
              </p>
              {!data.permissions.canPrepare ? (
                <p className="text-amber-800">
                  Tài khoản cần quyền lập danh sách học; quyền nhập điểm riêng
                  không đủ.
                </p>
              ) : (
                <div className="flex gap-3 flex-wrap items-center">
                  <Button
                    variant="outline"
                    disabled={
                      busy || !data.members.length || !data.offerings.length
                    }
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        await downloadExcel(
                          "/api/quan-ly-diem/excel/danh-sach-mau" + query,
                          "Danh_sach_hoc.xlsx",
                        );
                      } catch (e) {
                        setError(
                          e instanceof Error
                            ? e.message
                            : "Không tải được mẫu.",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Tải mẫu danh sách học
                  </Button>
                  <input
                    type="file"
                    aria-label="Nhập danh sách học Excel"
                    accept=".xlsx"
                    disabled={
                      busy || !data.members.length || !data.offerings.length
                    }
                    onChange={(e) => {
                      if (e.target.files?.[0]) void upload(e.target.files[0]);
                      e.target.value = "";
                    }}
                  />
                </div>
              )}
              {busy && <p role="status">Đang xử lý danh sách…</p>}
              {preview && (
                <div className="space-y-3">
                  <p>
                    {preview.changed} đăng ký mới · {preview.unchanged} đăng ký
                    giữ nguyên
                  </p>
                  <div className="max-h-56 overflow-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr>
                          <th className="p-2">Mã học viên</th>
                          <th>Họ tên</th>
                          <th>Môn</th>
                          <th>Lớp học phần</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.changes.map((r, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-2">{r.studentCode}</td>
                            <td>{r.studentName}</td>
                            <td>{r.courseCode}</td>
                            <td>{r.offeringCode}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button
                    disabled={busy || !file || !preview.changed}
                    onClick={() => file && void upload(file, true)}
                  >
                    Xác nhận thêm {preview.changed} đăng ký
                  </Button>
                </div>
              )}
            </div>
          </details>
          {data.offerings.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">
                Bước 2 · Quy tắc điểm của lớp học phần
              </h3>
              <div className="flex flex-wrap gap-2">
                {data.offerings.map((o) => (
                  <Button
                    key={o.offeringId}
                    size="sm"
                    variant="outline"
                    onClick={() => onPolicy(o.offeringId)}
                  >
                    {o.offeringCode} ·{" "}
                    {o.policyId ? "Đã có quy tắc" : "Chưa có quy tắc"}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
