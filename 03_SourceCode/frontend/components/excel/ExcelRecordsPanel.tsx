"use client";
import { useState } from "react";
import { Button } from "@/components/ui";
export type RecordsResult = {
  created: number;
  updated: number;
  unchanged: number;
  changes: {
    line: number;
    label: string;
    fields: { key: string; label: string; before: unknown; after: unknown }[];
  }[];
};
export function ExcelRecordsPanel({
  resource,
  focus,
  baseId,
  onImported,
}: {
  resource: string;
  focus?: string;
  baseId?: string;
  onImported?: (result: RecordsResult) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState<RecordsResult | null>(null);
  const url = `/api/excel-records/${resource}`;
  async function check(response: Response) {
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new Error(
        Array.isArray(result?.message)
          ? result.message.join("\n")
          : result?.message || "Không xử lý được Excel.",
      );
    }
    return response;
  }
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Không xử lý được Excel.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    await run(async () => {
      const query = new URLSearchParams();
      if (focus && /^\d+$/.test(focus)) query.set("focus", focus);
      if (baseId) query.set("baseId", baseId);
      const response = await check(
        await fetch(`${url}/template?${query}`, { cache: "no-store" }),
      );
      const blob = URL.createObjectURL(await response.blob()),
        anchor = document.createElement("a");
      anchor.href = blob;
      anchor.download = `${resource}.xlsx`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(blob), 1000);
    });
  }
  async function upload(selected: File) {
    setFile(selected);
    setPreview(null);
    setNotice("");
    await run(async () => {
      const body = new FormData();
      body.append("file", selected);
      setPreview(
        await (
          await check(await fetch(`${url}/preview`, { method: "POST", body }))
        ).json(),
      );
    });
  }
  async function apply() {
    if (!file || !preview) return;
    await run(async () => {
      const body = new FormData();
      body.append("file", file);
      const result: RecordsResult = await (
        await check(await fetch(`${url}/apply`, { method: "POST", body }))
      ).json();
      setPreview(null);
      setFile(null);
      setNotice(
        `Đã thêm ${result.created}, cập nhật ${result.updated} bản ghi; giữ nguyên ${result.unchanged} bản ghi.`,
      );
      onImported?.(result);
    });
  }
  return (
    <div className="rounded-xl border bg-blue-50/40 p-4 space-y-3 text-sm">
      <p className="font-semibold">Thêm / sửa danh sách bằng Excel</p>
      <p className="text-slate-600">
        Mẫu có sẵn tên và dữ liệu hiện tại, mỗi bản ghi một dòng. Sửa trực tiếp
        ô cần đổi hoặc thêm vào dòng trống. Ô nền xám chỉ đọc. Sheet “Ví dụ điền
        đúng” ở cuối file dùng để đối chiếu.
      </p>
      <div className="flex flex-wrap gap-3 items-center">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void download()}
        >
          Tải Excel có dữ liệu hiện tại
        </Button>
        <input
          type="file"
          accept=".xlsx"
          aria-label="Nhập Excel danh sách"
          disabled={busy}
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) void upload(selected);
            event.target.value = "";
          }}
        />
      </div>
      {busy && <p role="status">Đang xử lý Excel…</p>}
      {error && (
        <p role="alert" className="text-red-700 whitespace-pre-line">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {preview && (
        <div className="space-y-3">
          <p>
            Thêm {preview.created}, sửa {preview.updated}, giữ nguyên{" "}
            {preview.unchanged} bản ghi. Xóa dòng trong file không xóa dữ liệu.
          </p>
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="p-2">Bản ghi / dòng Excel</th>
                  <th className="p-2">Thông tin</th>
                  <th className="p-2">Trước</th>
                  <th className="p-2">Sau</th>
                </tr>
              </thead>
              <tbody>
                {preview.changes.flatMap((row) =>
                  row.fields.map((field) => (
                    <tr key={`${row.line}:${field.key}`} className="border-t">
                      <td className="p-2">
                        {row.label} · dòng {row.line}
                      </td>
                      <td className="p-2">{field.label}</td>
                      <td className="p-2 whitespace-pre-wrap">
                        {String(field.before ?? "—")}
                      </td>
                      <td className="p-2 whitespace-pre-wrap">
                        {String(field.after ?? "—")}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
          <Button
            type="button"
            disabled={busy || preview.created + preview.updated === 0}
            onClick={() => void apply()}
          >
            Xác nhận lưu các thay đổi
          </Button>
        </div>
      )}
    </div>
  );
}
