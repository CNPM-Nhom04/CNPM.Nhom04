"use client";
import { useState } from "react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { downloadExcel } from "@/lib/services/excelDownload";
type Preview = {
  created: number;
  updated: number;
  unchanged: number;
  changes: {
    id: string | null;
    kind: string;
    input: { maDanhMuc: string; tenDanhMuc: string; loaiDanhMuc: string };
    fields: {
      key: string;
      before: string | boolean | null;
      after: string | boolean;
    }[];
  }[];
};
const labels: Record<string, string> = {
  maDanhMuc: "Mã danh mục",
  tenDanhMuc: "Tên danh mục",
  moTa: "Mô tả",
  trangThai: "Trạng thái",
};
const display = (value: string | boolean | null) =>
  value === true
    ? "Hoạt động"
    : value === false
      ? "Ngừng hoạt động"
      : value || "—";
export function CategoryExcelModal({
  focus,
  onClose,
  onSaved,
}: {
  focus?: string;
  onClose: () => void;
  onSaved: (summary: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState<Preview | null>(null);
  async function upload(selected: File, apply = false) {
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", selected);
      const r = await fetch(
        "/api/admin/master-data/import/" + (apply ? "luu" : "kiem-tra"),
        { method: "POST", body },
      );
      const data = await r.json();
      if (!r.ok)
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join("\n")
            : data.message || "Không xử lý được Excel.",
        );
      if (apply)
        onSaved(
          `Đã thêm ${data.created}, cập nhật ${data.updated} và giữ nguyên ${data.unchanged} danh mục.`,
        );
      else {
        setFile(selected);
        setPreview(data);
      }
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : "Không nhập được file.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      isOpen
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Nhập / sửa danh mục bằng Excel"
      description="Mẫu chứa sẵn toàn bộ mã và tên danh mục trong CSDL, mỗi danh mục một dòng."
      size="2xl"
    >
      <div className="space-y-4 text-sm">
        <p>
          Tải mẫu có các dòng như DOCTOR — Tiến sĩ, MASTER — Thạc sĩ, FIT — Khoa
          Công nghệ Thông tin… Sửa trực tiếp dòng cần đổi; thêm dòng cuối bảng
          để tạo mới. Các dòng không đổi được giữ nguyên.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await downloadExcel(
                  "/api/admin/master-data/import/mau-excel" +
                    (focus ? "?" + new URLSearchParams({ focus }) : ""),
                  "Danh_muc_hien_co.xlsx",
                );
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Không tải được mẫu.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Tải Excel có danh sách hiện có
          </Button>
          <input
            type="file"
            accept=".xlsx"
            aria-label="Nhập danh mục Excel"
            disabled={busy}
            onChange={(e) => {
              if (e.target.files?.[0]) void upload(e.target.files[0]);
              e.target.value = "";
            }}
          />
        </div>
        <p className="text-slate-500">
          Trong sheet Danh muc: sửa mã/tên/mô tả/trạng thái; giữ nguyên loại của
          dòng cũ. Khi thêm mới, điền vào dòng trống ngay dưới danh sách; hệ
          thống tự cấp ID. Sheet cuối có các dòng thật để đối chiếu.
        </p>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-red-700 whitespace-pre-line"
          >
            {error}
          </p>
        )}
        {busy && <p role="status">Đang xử lý Excel…</p>}
        {preview && (
          <div className="space-y-3">
            <p>
              {preview.created} dòng thêm mới · {preview.updated} dòng cập nhật
              · {preview.unchanged} dòng giữ nguyên
            </p>
            <div className="max-h-72 overflow-auto border rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      "Mã",
                      "Tên danh mục",
                      "Thao tác",
                      "Thông tin",
                      "Trước",
                      "Sau",
                    ].map((h) => (
                      <th key={h} className="p-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.changes.flatMap((row) =>
                    row.fields.map((field) => (
                      <tr
                        key={
                          (row.id ||
                            row.input.loaiDanhMuc + row.input.maDanhMuc) +
                          field.key
                        }
                        className="border-t"
                      >
                        <td className="p-2">{row.input.maDanhMuc}</td>
                        <td className="p-2">{row.input.tenDanhMuc}</td>
                        <td className="p-2">
                          {row.kind === "create" ? "Thêm" : "Sửa"}
                        </td>
                        <td className="p-2">
                          {labels[field.key] || field.key}
                        </td>
                        <td className="p-2">{display(field.before)}</td>
                        <td className="p-2">{display(field.after)}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
            <Button
              disabled={busy || !file || !preview.changes.length}
              onClick={() => file && void upload(file, true)}
            >
              Xác nhận lưu {preview.changes.length} danh mục thay đổi
            </Button>
          </div>
        )}
        <div className="flex justify-end">
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>
    </Modal>
  );
}
