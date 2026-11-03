"use client";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import {
  portalRequest,
  type PublicOptions,
  type PublicPage,
  type PublicProgram,
} from "@/lib/services/portalService";
import { ProgramCard } from "./ProgramCard";
export function PublicPrograms() {
  const [search, setSearch] = useState(""),
    [level, setLevel] = useState(""),
    [page, setPage] = useState(1),
    [data, setData] = useState<PublicPage<PublicProgram> | null>(null),
    [options, setOptions] = useState<PublicOptions | null>(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    portalRequest<PublicOptions>("options", { signal: abort.signal })
      .then(setOptions)
      .catch(() => {});
    return () => abort.abort();
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(() => {
      portalRequest<PublicPage<PublicProgram>>(
        "chuong-trinh-dao-tao?" +
          new URLSearchParams({
            search,
            ...(level ? { levelId: level } : {}),
            page: String(page),
            limit: "9",
          }).toString(),
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
              e instanceof Error ? e.message : "Không thể tải chương trình.",
            );
            setBusy(false);
          }
        });
    }, 250);
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [search, level, page, reload]);
  return (
    <div>
      <div className="mb-8 flex flex-wrap gap-3 border border-slate-200 bg-white p-4">
        <label className="flex min-w-60 flex-1 items-center gap-3">
          <Search size={20} className="text-slate-400" />
          <input
            aria-label="Tìm chương trình đào tạo"
            className="w-full bg-white p-2 text-sm outline-none"
            placeholder="Tìm mã, tên chương trình hoặc ngành..."
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
          aria-label="Bậc đào tạo"
          className="rounded border border-slate-200 bg-white px-4 py-3 text-sm"
          value={level}
          onChange={(e) => {
            setLevel(e.target.value);
            setPage(1);
            setBusy(true);
          }}
        >
          <option value="">Tất cả bậc đào tạo</option>
          {options?.levels.map((l) => (
            <option value={l.id} key={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <p
          role="alert"
          className="border border-red-200 bg-red-50 p-5 text-sm text-red-800"
        >
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
        <p role="status" className="py-12 text-center text-slate-500">
          Đang tải chương trình...
        </p>
      ) : data?.data.length ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {data.data.map((p, i) => (
            <ProgramCard key={p.id} program={p} index={(page - 1) * 9 + i} />
          ))}
        </div>
      ) : (
        <p className="border border-dashed border-slate-200 p-10 text-center text-slate-500">
          Không có chương trình được công bố phù hợp.
        </p>
      )}
      {data && !error && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 text-sm text-slate-500">
          <span>Tổng {data.meta.total} phiên bản đã ban hành</span>
          <div className="flex items-center gap-4">
            <button
              disabled={busy || page <= 1}
              onClick={() => {
                setPage((p) => p - 1);
                setBusy(true);
              }}
              className="rounded border border-slate-200 px-4 py-2 disabled:opacity-40"
            >
              Trang trước
            </button>
            <span>
              {data.meta.totalPages ? page : 0} / {data.meta.totalPages}
            </span>
            <button
              disabled={busy || page >= data.meta.totalPages}
              onClick={() => {
                setPage((p) => p + 1);
                setBusy(true);
              }}
              className="rounded border border-slate-200 px-4 py-2 disabled:opacity-40"
            >
              Trang sau
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
