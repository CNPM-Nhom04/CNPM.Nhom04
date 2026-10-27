"use client";
import { useCallback, useEffect, useState } from "react";
import { adminRequest, type PageResult } from "@/lib/services/adminService";

export function useAdminList<T>(
  resource: string,
  searchTerm: string,
  filterName: string,
  filterValue: string,
) {
  const [result, setResult] = useState<PageResult<T> | null>(null);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);
  const [selection, setSelection] = useState({ searchTerm, filterValue });
  // Adjust pagination immediately when a controlled filter changes.
  if (
    selection.searchTerm !== searchTerm ||
    selection.filterValue !== filterValue
  ) {
    setSelection({ searchTerm, filterValue });
    setPage(1);
    setBusy(true);
  }
  const refresh = useCallback(() => {
    setBusy(true);
    setVersion((value) => value + 1);
  }, []);
  const changePage = useCallback((value: number) => {
    setBusy(true);
    setPage(value);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({
        searchTerm: searchTerm.trim(),
        [filterName]: filterValue,
        page: String(page),
        limit: "20",
      });
      adminRequest<PageResult<T>>(resource + "?" + params, {
        signal: controller.signal,
      })
        .then((data) => {
          if (controller.signal.aborted) return;
          // A deletion can remove the last row of the last page.
          if (
            page > 1 &&
            data.data.length === 0 &&
            data.meta.totalPages < page
          ) {
            setPage(Math.max(1, data.meta.totalPages));
            return;
          }
          setResult(data);
          setError(null);
          setBusy(false);
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setResult(null);
          setError(
            reason instanceof Error
              ? reason
              : new Error("Không thể tải dữ liệu."),
          );
          setBusy(false);
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [resource, searchTerm, filterName, filterValue, page, version]);
  return {
    data: busy || error ? [] : (result?.data ?? []),
    meta: result?.meta,
    page,
    loading: busy,
    error,
    refresh,
    changePage,
  };
}
