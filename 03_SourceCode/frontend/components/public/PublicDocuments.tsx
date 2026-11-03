"use client";
import { useEffect, useState } from "react";
import { FileText, ArrowUpRight, Search } from "lucide-react";
import {
  portalRequest,
  type PublicDocument,
  type PublicPage,
} from "@/lib/services/portalService";
const labels: Record<string, string> = {
  ALL: "Tất cả văn bản",
  REGULATION: "Quy chế",
  ADMISSION: "Tuyển sinh",
  GUIDE: "Hướng dẫn",
};
export function PublicDocuments() {
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("ALL"),
    [page, setPage] = useState(1),
    [data, setData] = useState<PublicPage<PublicDocument> | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true),
    [reload, setReload] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(() => {
      portalRequest<PublicPage<PublicDocument>>(
        "van-ban?" +
          new URLSearchParams({
            search,
            category,
            page: String(page),
            limit: "10",
          }),
        { signal: abort.signal },
      )
        .then((result) => {
          if (!abort.signal.aborted) {
            setData(result);
            setError("");
            setBusy(false);
          }
        })
        .catch((e) => {
          if (!abort.signal.aborted) {
            setError(
              e instanceof Error ? e.message : "Không tải được văn bản.",
            );
            setBusy(false);
          }
        });
    }, 250);
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [search, category, page, reload]);
  return (
    <div>
      <div className="mb-7 flex flex-wrap gap-3 border border-slate-200 p-4">
        <label className="flex min-w-56 flex-1 items-center gap-3">
          <Search size={20} className="text-slate-400" />
          <input
            aria-label="Tìm văn bản"
            className="w-full bg-white p-2 text-sm outline-none"
            placeholder="Tìm tên hoặc số văn bản..."
            maxLength={255}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
              setBusy(true);
            }}
          />
        </label>
        <select
          aria-label="Loại văn bản"
          className="rounded border border-slate-200 bg-white px-4 py-3 text-sm"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
            setBusy(true);
          }}
        >
          {Object.entries(labels).map(([value, name]) => (
            <option key={value} value={value}>
              {name}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <p role="alert" className="bg-red-50 p-5 text-sm text-red-800">
          {error}
          <button
            className="ml-3 underline"
            onClick={() => {
              setBusy(true);
              setReload((n) => n + 1);
            }}
          >
            Thử lại
          </button>
        </p>
      ) : busy ? (
        <p role="status" className="p-8 text-center text-slate-500">
          Đang tải văn bản...
        </p>
      ) : data?.data.length ? (
        <div className="divide-y divide-slate-200 border-y border-slate-200">
          {data.data.map((d) => (
            <article key={d.id} className="flex items-start gap-4 py-7">
              <span className="rounded bg-emerald-50 p-3 text-emerald-700">
                <FileText size={25} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-emerald-700">
                  {labels[d.category]}
                  {d.issuedOn ? " · " + d.issuedOn : ""}
                  {d.referenceNumber ? " · " + d.referenceNumber : ""}
                </p>
                <h2 className="mt-2 text-lg font-bold leading-7">{d.title}</h2>
                {d.summary && (
                  <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-500">
                    {d.summary}
                  </p>
                )}
                <a
                  href={d.documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-emerald-700"
                >
                  Mở văn bản <ArrowUpRight size={16} />
                </a>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="border border-dashed border-slate-200 p-10 text-center text-sm leading-7 text-slate-500">
          Chưa có văn bản phù hợp được công bố.
          <br />
          Bạn có thể tham khảo thông tin tại{" "}
          <a
            href="https://pgd.agu.edu.vn/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-emerald-700 underline"
          >
            cổng thông tin chính thức
          </a>
          .
        </p>
      )}
      {data && !error && (
        <div className="mt-7 flex items-center justify-between gap-4 text-sm text-slate-500">
          <span>{data.meta.total} văn bản</span>
          <div className="flex items-center gap-3">
            <button
              className="rounded border px-3 py-2 disabled:opacity-40"
              disabled={busy || page <= 1}
              onClick={() => {
                setPage((p) => p - 1);
                setBusy(true);
              }}
            >
              Trang trước
            </button>
            <span>
              {data.meta.totalPages ? page : 0}/{data.meta.totalPages}
            </span>
            <button
              className="rounded border px-3 py-2 disabled:opacity-40"
              disabled={busy || page >= data.meta.totalPages}
              onClick={() => {
                setPage((p) => p + 1);
                setBusy(true);
              }}
            >
              Trang sau
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
