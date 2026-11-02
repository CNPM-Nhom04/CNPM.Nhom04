"use client";
import { useState } from "react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import {
  studentAccountsService,
  type StudentClass,
  type AccountOptions,
  type AccountPreview,
} from "@/lib/services/studentAccountsService";
export function StudentAccountImport({
  item,
  limits,
  onClose,
  onCreated,
}: {
  item: StudentClass;
  limits: AccountOptions["limits"];
  onClose: () => void;
  onCreated: (count: number) => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState<AccountPreview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [page, setPage] = useState(0);
  async function action(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể nhập tài khoản.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      isOpen
      title={"Nhập học viên — " + item.code}
      size="2xl"
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Đóng
          </Button>
          <Button
            disabled={busy || !preview?.canImport || !file}
            isLoading={busy}
            onClick={() =>
              action(async () => {
                if (!file || !preview?.canImport) return;
                const result = await studentAccountsService.commit(
                  item,
                  file,
                  preview,
                );
                onCreated(result.created);
              })
            }
          >
            Tạo {preview?.canImport ? preview.totalRows : ""} tài khoản & tải
            bàn giao
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-slate-950">
        <div className="rounded border border-blue-100 bg-blue-50 p-4 leading-7">
          <strong>{item.name}</strong>
          <p>
            {item.versionCode} · {item.trackName} · Khóa {item.admissionYear}
          </p>
          <p>{item.unitName}</p>
        </div>
        <p>
          Tải mẫu và điền danh sách học viên đã nhập học. Mã học viên, họ tên,
          email là bắt buộc. Tên đăng nhập để trống sẽ lấy mã học viên viết
          thường. Tối đa {limits.maxRows} dòng /{" "}
          {limits.maxFileBytes / 1024 / 1024} MB mỗi lần.
        </p>
        <p className="rounded border border-amber-200 bg-amber-50 p-3 leading-6 text-amber-900">
          Mỗi học viên được cấp mật khẩu ngẫu nhiên riêng và phải đổi lần đầu.
          File bàn giao chứa mật khẩu chỉ được tải khi tạo thành công; hãy lưu
          để bàn giao cho đúng học viên.
        </p>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => action(() => studentAccountsService.template(item))}
        >
          Tải mẫu học viên
        </Button>
        <label className="block space-y-2 font-medium">
          Chọn file Excel
          <input
            aria-label="File học viên Excel"
            type="file"
            accept=".xlsx"
            disabled={busy}
            className="block w-full rounded border border-slate-300 p-2 font-normal"
            onChange={(e) => {
              const selected = e.target.files?.[0] || null;
              setPreview(null);
              setPage(0);
              setError("");
              if (selected && selected.size > limits.maxFileBytes) {
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
          disabled={busy || !file}
          onClick={() =>
            action(async () => {
              if (file) {
                setPreview(null);
                setPage(0);
                setPreview(await studentAccountsService.preview(item, file));
              }
            })
          }
        >
          Kiểm tra file học viên
        </Button>
        {error && (
          <p
            role="alert"
            className="whitespace-pre-line rounded bg-red-50 p-4 leading-7 text-red-800"
          >
            {error}
          </p>
        )}
        {preview && (
          <section aria-label="Kết quả kiểm tra học viên" className="space-y-3">
            <p
              role="status"
              className={
                preview.canImport ? "text-emerald-800" : "text-red-800"
              }
            >
              Tổng {preview.totalRows} · Hợp lệ {preview.validRows} · Lỗi{" "}
              {preview.errorRows}.{" "}
              {preview.canImport
                ? "Có thể tạo tài khoản."
                : "Chưa lưu dữ liệu. Sửa file, chọn lại và kiểm tra."}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    {[
                      "Dòng",
                      "Mã học viên",
                      "Họ tên / Email",
                      "Tên đăng nhập",
                      "Xử lý hồ sơ",
                      "Kết quả",
                    ].map((h) => (
                      <th key={h} className="p-2">
                        {h}
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
                      <td className="p-2 font-semibold">{row.studentCode}</td>
                      <td className="p-2">
                        {row.fullName}
                        <p className="mt-1 text-slate-500">{row.email}</p>
                      </td>
                      <td className="p-2">{row.username}</td>
                      <td className="p-2">
                        {row.mode === "LINK_PROFILE"
                          ? "Liên kết hồ sơ có sẵn"
                          : "Tạo hồ sơ mới"}
                      </td>
                      <td
                        className={
                          "p-2 " +
                          (row.errors.length
                            ? "text-red-700"
                            : "text-emerald-700")
                        }
                      >
                        {row.errors.join(" ") || "Hợp lệ"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-end gap-3">
              <Button
                size="sm"
                variant="outline"
                disabled={busy || page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Trang trước
              </Button>
              <span>
                {page + 1}/{Math.ceil(preview.totalRows / 25)}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || (page + 1) * 25 >= preview.totalRows}
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
