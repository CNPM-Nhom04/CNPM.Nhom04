"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { FileCheck } from "lucide-react";
import {
  approvalService,
  type ApprovalListResult,
} from "@/lib/services/approvalService";
export const requestLabels: Record<string, string> = {
  PENDING: "Đang chờ xử lý",
  APPROVED: "Đã phê duyệt",
  RETURNED: "Đã trả về",
  CANCELLED: "Đã thu hồi",
};
export function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Bangkok" })
    : "—";
}
export const inputClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 disabled:text-slate-600";
export const buttonClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-50";
export function ApprovalList({ versionId }: { versionId?: string }) {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(versionId ? "ALL" : "PENDING"),
    [state, setState] = useState("ALL"),
    [page, setPage] = useState(1);
  const [result, setResult] = useState<ApprovalListResult | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      approvalService
        .list(
          {
            searchTerm: search,
            status,
            reviewState: state,
            page: String(page),
            limit: "20",
            ...(versionId ? { versionId } : {}),
          },
          controller.signal,
        )
        .then((data) => {
          if (!controller.signal.aborted) {
            setResult(data);
            setError("");
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted) {
            setError(e.message);
            setResult(null);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, status, state, page, versionId, retry]);
  function change(set: (value: string) => void, value: string) {
    set(value);
    setPage(1);
    setLoading(true);
  }
  return (
    <div className="space-y-6 pb-12 text-slate-950">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <FileCheck className="text-blue-600" />
          Xét Duyệt & Thẩm Định CTĐT
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Mỗi dòng là một lượt gửi duyệt từ CSDL. Chỉ hiển thị hồ sơ thuộc phạm
          vi được phân quyền.
        </p>
        {versionId && (
          <p className="mt-2 text-sm">
            Đang lọc phiên bản #{versionId}.{" "}
            <Link
              className="text-blue-700 underline"
              href="/dashboard/xet-duyet"
            >
              Xem tất cả hồ sơ
            </Link>
          </p>
        )}
      </section>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Object.entries(requestLabels).map(([key, label]) => (
          <div
            key={key}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <p className="text-sm text-slate-600">{label}</p>
            <strong className="mt-2 block text-2xl">
              {loading ? "—" : (result?.summary[key] ?? "—")}
            </strong>
          </div>
        ))}
      </div>
      <p className="text-sm text-slate-600">
        Thống kê theo phạm vi, từ khóa và phiên bản đang tìm; không giới hạn
        theo bộ lọc trạng thái bên dưới.
      </p>
      <section className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <input
          className={inputClass + " min-w-64 flex-1"}
          aria-label="Tìm hồ sơ xét duyệt"
          placeholder="Mã hồ sơ, mã/tên CTĐT, phiên bản, người gửi..."
          maxLength={255}
          value={search}
          onChange={(e) => change(setSearch, e.target.value)}
        />
        <select
          className={inputClass}
          aria-label="Trạng thái hồ sơ"
          value={status}
          onChange={(e) => change(setStatus, e.target.value)}
        >
          <option value="ALL">Tất cả trạng thái</option>
          {Object.entries(requestLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select
          className={inputClass}
          aria-label="Tiến trình thẩm định"
          value={state}
          onChange={(e) => change(setState, e.target.value)}
        >
          <option value="ALL">Tất cả tiến trình</option>
          <option value="NOT_STARTED">Chưa bắt đầu</option>
          <option value="STARTED">Đang thẩm định</option>
          <option value="MINE">Mình đang thẩm định</option>
        </select>
      </section>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
          {error}{" "}
          <button
            className={buttonClass}
            onClick={() => {
              setLoading(true);
              setRetry((x) => x + 1);
            }}
          >
            Thử lại
          </button>
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1150px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              {[
                "Hồ sơ / Phiên bản",
                "Chương trình / Đơn vị",
                "Người gửi / Ngày gửi",
                "Tiến trình",
                "Kết quả hồ sơ",
                "Thao tác",
              ].map((x) => (
                <th key={x} className="p-4">
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody aria-busy={loading}>
            {!loading &&
              !error &&
              result?.data.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-slate-200 align-top"
                >
                  <td className="p-4">
                    <strong>{item.requestNo}</strong>
                    <p>{item.versionCode}</p>
                  </td>
                  <td className="p-4">
                    <strong>
                      {item.programCode} — {item.programName}
                    </strong>
                    <p className="mt-1 text-slate-600">
                      {item.unitName} · {item.levelName}
                    </p>
                  </td>
                  <td className="p-4">
                    {item.requesterName}
                    <p className="mt-1 text-slate-600">
                      {formatDate(item.requestedAt)}
                    </p>
                  </td>
                  <td className="p-4">
                    {item.reviewStartedAt
                      ? "Đã bắt đầu thẩm định"
                      : "Chưa ghi nhận bắt đầu"}
                    <p>{item.reviewerName || "—"}</p>
                    <p className="text-slate-600">
                      {formatDate(item.reviewStartedAt)}
                    </p>
                  </td>
                  <td className="p-4">
                    <span className="font-semibold">
                      {requestLabels[item.status] || item.status}
                    </span>
                    <p className="text-slate-600">
                      {formatDate(item.completedAt)}
                    </p>
                  </td>
                  <td className="p-4">
                    <Link
                      className={buttonClass + " inline-block text-blue-700"}
                      href={"/dashboard/xet-duyet/" + item.id}
                    >
                      {item.status === "PENDING" ? "Mở hồ sơ" : "Xem lịch sử"}
                    </Link>
                  </td>
                </tr>
              ))}
            {(loading || error || !result?.data.length) && (
              <tr>
                <td colSpan={6} className="p-10 text-center" role="status">
                  {loading
                    ? "Đang tải hồ sơ..."
                    : error
                      ? "Không thể tải dữ liệu."
                      : "Không có hồ sơ phù hợp trong phạm vi tài khoản."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span>
          Tổng {loading ? "—" : (result?.meta.total ?? 0)} lượt gửi duyệt
        </span>
        <div className="flex items-center gap-3">
          <button
            className={buttonClass}
            disabled={loading || !!error || page <= 1}
            onClick={() => {
              setPage((x) => x - 1);
              setLoading(true);
            }}
          >
            Trang trước
          </button>
          <span>
            Trang {result?.meta.totalPages ? page : 0} /{" "}
            {result?.meta.totalPages ?? 0}
          </span>
          <button
            className={buttonClass}
            disabled={
              loading || !!error || page >= (result?.meta.totalPages ?? 0)
            }
            onClick={() => {
              setPage((x) => x + 1);
              setLoading(true);
            }}
          >
            Trang sau
          </button>
        </div>
      </div>
    </div>
  );
}
