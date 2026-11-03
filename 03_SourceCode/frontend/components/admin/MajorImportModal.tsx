"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import {
  majorImportService,
  type MajorImportPreview,
} from "@/lib/services/majorService";
export function MajorImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [limits, setLimits] = useState<{
    maxRows: number;
    maxFileBytes: number;
  } | null>(null);
  const [preview, setPreview] = useState<MajorImportPreview | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [page, setPage] = useState(0);
  useEffect(() => {
    let live = true;
    majorImportService
      .limits()
      .then((value) => {
        if (live) setLimits(value);
      })
      .catch((e) => {
        if (live)
          setError(
            e instanceof Error ? e.message : "Không tải được giới hạn nhập.",
          );
      });
    return () => {
      live = false;
    };
  }, []);
  async function action(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể nhập Excel.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      isOpen
      title="Nhập ngành đào tạo từ Excel"
      size="2xl"
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Đóng
          </Button>
          <Button
            disabled={busy || !file || !preview?.canImport}
            isLoading={busy}
            onClick={() =>
              action(async () => {
                if (!file || !preview?.canImport) return;
                const result = await majorImportService.commit(
                  file,
                  preview.fileHash,
                );
                onImported(result.created);
              })
            }
          >
            Xác nhận nhập {preview?.canImport ? preview.totalRows : ""} ngành
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-slate-950">
        <p>
          Tải mẫu, điền ngành mới và mã đơn vị quản lý trong CSDL. Hệ thống kiểm
          tra toàn bộ file trước khi lưu; mã ngành đã tồn tại sẽ báo lỗi.
        </p>
        {limits && (
          <p>
            Tối đa {limits.maxRows} dòng, {limits.maxFileBytes / 1024 / 1024}{" "}
            MB. Dùng file .xlsx và giữ nguyên tên sheet, tiêu đề cột.
          </p>
        )}
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => action(() => majorImportService.template())}
        >
          Tải file mẫu Excel
        </Button>
        <label className="block space-y-2 font-medium">
          Chọn file Excel
          <input
            type="file"
            accept=".xlsx"
            disabled={busy || !limits}
            className="block w-full rounded border border-slate-300 p-2 font-normal"
            onChange={(event) => {
              const selected = event.target.files?.[0] || null;
              setPreview(null);
              setPage(0);
              setError("");
              if (selected && limits && selected.size > limits.maxFileBytes) {
                setFile(null);
                setError("File vượt giới hạn dung lượng.");
                return;
              }
              setFile(selected);
            }}
          />
        </label>
        <Button
          variant="outline"
          disabled={busy || !file || !limits}
          onClick={() =>
            action(async () => {
              if (file) {
                setPreview(null);
                setPage(0);
                setPreview(await majorImportService.preview(file));
              }
            })
          }
        >
          Kiểm tra file
        </Button>
        {error && (
          <p
            role="alert"
            className="whitespace-pre-line rounded bg-red-50 p-3 text-red-700"
          >
            {error}
          </p>
        )}
        {preview && (
          <section className="space-y-3" aria-label="Kết quả kiểm tra Excel">
            <p
              role="status"
              className={
                preview.canImport ? "text-emerald-700" : "text-red-700"
              }
            >
              Tổng {preview.totalRows} dòng · Hợp lệ: {preview.validRows} · Lỗi:{" "}
              {preview.errorRows}.{" "}
              {preview.canImport
                ? "Có thể xác nhận nhập."
                : "Chưa lưu dữ liệu. Sửa file rồi chọn và kiểm tra lại."}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    {[
                      "Dòng",
                      "Mã ngành",
                      "Tên ngành",
                      "Đơn vị",
                      "Trạng thái",
                      "Kết quả",
                    ].map((title) => (
                      <th key={title} className="p-2">
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(page * 25, (page + 1) * 25).map((row) => (
                    <tr
                      key={row.rowNumber}
                      className="border-b border-slate-200"
                    >
                      <td className="p-2">{row.rowNumber}</td>
                      <td className="p-2">{row.majorCode}</td>
                      <td className="p-2">{row.majorName}</td>
                      <td className="p-2">
                        {row.unitCode}
                        {row.unitName ? " — " + row.unitName : ""}
                      </td>
                      <td className="p-2">{row.status}</td>
                      <td
                        className={
                          "p-2 " +
                          (row.errors.length
                            ? "text-red-700"
                            : "text-emerald-700")
                        }
                      >
                        {row.errors.length ? row.errors.join(" ") : "Hợp lệ"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0 || busy}
                onClick={() => setPage((p) => p - 1)}
              >
                Trang trước
              </Button>
              <span>
                Trang {page + 1}/{Math.ceil(preview.totalRows / 25)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={(page + 1) * 25 >= preview.totalRows || busy}
                onClick={() => setPage((p) => p + 1)}
              >
                Trang sau
              </Button>
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}
