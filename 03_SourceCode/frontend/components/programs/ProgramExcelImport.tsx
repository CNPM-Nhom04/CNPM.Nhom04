"use client";
import { useState } from "react";
import { Button } from "@/components/ui";
import { downloadExcel } from "@/lib/services/excelDownload";
import {
  programRequest,
  type ProgramCourse,
  type ProgramTrack,
} from "@/lib/services/programService";
import { fillGroupCredits } from "@/lib/programs/selection";
type Preview = {
  revision: number;
  trackId: string;
  courses: ProgramCourse[];
  groups: { code: string; credits: number }[];
  minimums: { id: string; minimumCredits: number }[];
  issues: string[];
  valid: boolean;
};
export function ProgramExcelImport({
  programId,
  track,
  revision,
  disabled,
  onApply,
}: {
  programId: string;
  track: ProgramTrack;
  revision: number;
  disabled: boolean;
  onApply: (change: (track: ProgramTrack) => ProgramTrack) => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const base = `/${programId}/import/`;
  const query = "?" + new URLSearchParams({ trackId: track.id });
  async function upload(file?: File) {
    setPreview(null);
    setError("");
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name) || file.size > 5 * 1024 * 1024) {
      setError("Chọn tệp .xlsx tối đa 5MB.");
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      setPreview(
        await programRequest<Preview>(base + "kiem-tra" + query, {
          method: "POST",
          body,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể đọc Excel.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details open className="rounded-xl border bg-white p-4">
      <summary className="cursor-pointer font-semibold text-sm">
        Nhập học phần bằng Excel
      </summary>
      <div className="mt-3 space-y-3 text-sm">
        <p className="text-slate-500">
          Tải mẫu, nhập mã môn và nhóm A–D. Hệ thống đối chiếu tín chỉ và cộng
          định mức nhóm. Áp dụng để thêm/cập nhật môn trong hướng {track.name},
          sau đó lưu cấu trúc.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await downloadExcel(
                  "/api/chuong-trinh-dao-tao" + base + "mau-excel" + query,
                  "Nhap_CTDT.xlsx",
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
            Tải file mẫu
          </Button>
          <input
            aria-label="Chọn Excel chi tiết CTĐT"
            type="file"
            accept=".xlsx"
            disabled={disabled || busy}
            onChange={(event) => {
              void upload(event.target.files?.[0]);
              event.target.value = "";
            }}
            className="max-w-full text-sm"
          />
        </div>
        {busy && <p role="status">Đang xử lý Excel…</p>}
        {error && (
          <p role="alert" className="text-red-700 whitespace-pre-line">
            {error}
          </p>
        )}
        {preview && (
          <div className="space-y-3">
            {preview.issues.length > 0 && (
              <ul role="alert" className="text-red-700 list-disc pl-5">
                {preview.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            )}
            <p>
              {preview.courses.length} môn hợp lệ ·{" "}
              {preview.courses.reduce((sum, c) => sum + c.credits, 0)} TC trong
              tệp
            </p>
            <div
              className="flex flex-wrap gap-2"
              aria-label="Tín chỉ nhóm sau khi nhập"
            >
              {preview.groups.map((group) => (
                <span
                  key={group.code}
                  className="rounded-lg bg-blue-50 px-3 py-1 text-xs text-blue-800"
                >
                  {group.code}: {group.credits} TC
                </span>
              ))}
            </div>
            <div className="max-h-56 overflow-auto border rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    {["Mã môn", "Tên môn", "Nhóm", "TC", "Tính chất", "HK"].map(
                      (s) => (
                        <th className="p-2" key={s}>
                          {s}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {preview.courses.map((c) => (
                    <tr key={c.courseId} className="border-t">
                      <td className="p-2">{c.code}</td>
                      <td className="p-2">{c.name}</td>
                      <td className="p-2">
                        {track.groups.find((g) => g.id === c.groupId)?.code}
                      </td>
                      <td className="p-2">{c.credits}</td>
                      <td className="p-2">
                        {c.requirementType === "REQUIRED"
                          ? "Bắt buộc"
                          : "Tự chọn"}
                      </td>
                      <td className="p-2">{c.semester ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              size="sm"
              disabled={
                disabled ||
                busy ||
                !preview.valid ||
                preview.revision !== revision
              }
              onClick={() => {
                onApply((current) => {
                  const incoming = new Set(
                    preview.courses.map((c) => c.courseId),
                  );
                  const merged = fillGroupCredits({
                    ...current,
                    courses: [
                      ...current.courses.filter(
                        (c) => !incoming.has(c.courseId),
                      ),
                      ...preview.courses,
                    ],
                  });
                  return {
                    ...merged,
                    groups: merged.groups.map((group) => ({
                      ...group,
                      minimumCredits:
                        preview.minimums.find((item) => item.id === group.id)
                          ?.minimumCredits ?? group.minimumCredits,
                    })),
                  };
                });
                setPreview(null);
              }}
            >
              Áp dụng {preview.courses.length} môn & tính tín chỉ nhóm
            </Button>
            {preview.revision !== revision && (
              <p className="text-amber-700">
                Cấu trúc đã thay đổi trên máy chủ. Hãy nhập lại tệp.
              </p>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
