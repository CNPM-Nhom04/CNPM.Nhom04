"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Layers } from "lucide-react";
import { Button, Input, Select, Badge } from "@/components/ui";
import { ProgramFeedback } from "@/components/programs/ProgramFeedback";
import {
  programRequest,
  type PageResult,
  type ProgramPermissions,
} from "@/lib/services/programService";
interface Row {
  id: string;
  maCTDT: string;
  maPhienBan?: string;
  tenCTDT: string;
  levelName: string;
  unitName: string;
  majorName: string;
  khoaTuyenSinh?: string;
  cohortYear?: number;
  tongTinChiYeuCau?: number;
  status: string;
  statusLabel?: string;
}
interface Result extends PageResult<Row> {
  permissions: ProgramPermissions;
  unversionedCount?: number;
}
const labels: Record<string, string> = {
  DRAFT: "Bản nháp",
  SUBMITTED: "Chờ duyệt",
  REVIEWING: "Đang thẩm định",
  RETURNED: "Yêu cầu sửa",
  PUBLISHED: "Đã ban hành",
  ARCHIVED: "Đã lưu trữ",
  RETIRED: "Ngừng sử dụng",
};
export default function ProgramListPage() {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("ALL"),
    [page, setPage] = useState(1),
    [mode, setMode] = useState<"versions" | "unversioned">("versions");
  const [result, setResult] = useState<Result | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<Error | null>(null),
    [version, setVersion] = useState(0);
  const [unversionedCount, setUnversionedCount] = useState<number | null>(null);
  function refresh() {
    setLoading(true);
    setVersion((value) => value + 1);
  }
  function changeMode(value: "versions" | "unversioned") {
    if (value === mode) return;
    setMode(value);
    setPage(1);
    setStatus("ALL");
    setLoading(true);
  }
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const path = mode === "versions" ? "" : "/chua-co-phien-ban";
      programRequest<Result>(
        path +
          "?" +
          new URLSearchParams({
            searchTerm: search.trim(),
            selectedStatus: status,
            page: String(page),
            limit: "20",
          }),
        { signal: controller.signal },
      )
        .then((data) => {
          if (controller.signal.aborted) return;
          setResult(data);
          setError(null);
          if (data.unversionedCount != null)
            setUnversionedCount(data.unversionedCount);
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) {
            setError(
              reason instanceof Error
                ? reason
                : new Error("Không thể tải CTĐT."),
            );
            setResult(null);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search, status, page, mode, version]);
  return (
    <div className="space-y-6">
      <ProgramFeedback error={error} retry={refresh} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Chương trình Đào tạo
          </h2>
          <p className="text-sm text-slate-500">
            Danh mục gốc, các phiên bản và cấu trúc tín chỉ từ database
          </p>
        </div>
        {result?.permissions.canEdit && (
          <Link href="/dashboard/chuong-trinh-dao-tao/tao-moi">
            <Button>
              <Plus className="h-4 w-4 mr-1" />
              Khởi tạo CTĐT Mới
            </Button>
          </Link>
        )}
      </div>
      <div className="flex gap-3 flex-wrap">
        <Button
          variant={mode === "versions" ? "primary" : "outline"}
          onClick={() => changeMode("versions")}
        >
          Các phiên bản CTĐT
        </Button>
        <Button
          variant={mode === "unversioned" ? "primary" : "outline"}
          onClick={() => changeMode("unversioned")}
        >
          CTĐT chưa có phiên bản
          {unversionedCount != null ? " (" + unversionedCount + ")" : ""}
        </Button>
      </div>
      <p className="text-sm text-slate-500">
        Danh sách chỉ gồm dữ liệu trong phạm vi được gán cho tài khoản. Một CTĐT
        có thể có nhiều phiên bản, mỗi phiên bản là một dòng riêng.
      </p>
      <div className="bg-white p-4 rounded-lg border flex flex-col md:flex-row gap-4 justify-between">
        <Input
          aria-label="Tìm CTĐT"
          maxLength={255}
          placeholder="Tìm theo mã CTĐT, mã phiên bản hoặc tên..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
            setLoading(true);
          }}
        />
        {mode === "versions" && (
          <Select
            aria-label="Trạng thái CTĐT"
            options={[
              { label: "Tất cả trạng thái", value: "ALL" },
              ...Object.entries(labels).map(([value, label]) => ({
                label,
                value,
              })),
            ]}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
              setLoading(true);
            }}
          />
        )}
      </div>
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead>
            <tr className="bg-slate-50 border-b text-xs font-semibold text-slate-600 uppercase">
              {[
                "Mã CTĐT / phiên bản",
                "Tên chương trình",
                "Bậc đào tạo",
                "Niên khóa",
                "Định mức",
                "Trạng thái",
                "Thao tác",
              ].map((label) => (
                <th key={label} className="px-5 py-3.5">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody aria-busy={loading} className="divide-y divide-slate-100">
            {!loading &&
              !error &&
              result?.data.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <strong>{item.maCTDT}</strong>
                    <p className="text-xs text-blue-700">
                      {mode === "versions"
                        ? item.maPhienBan
                        : "Chưa có phiên bản"}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium">{item.tenCTDT}</p>
                    <p className="text-xs text-slate-400">{item.unitName}</p>
                    <p className="text-xs text-slate-500">
                      Ngành: {item.majorName}
                    </p>
                  </td>
                  <td className="px-5 py-4">{item.levelName}</td>
                  <td className="px-5 py-4">
                    {item.khoaTuyenSinh || "Chưa khai báo"}
                    {item.cohortYear && (
                      <p className="text-xs text-slate-400">
                        Năm tuyển sinh: {item.cohortYear}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 font-semibold text-blue-600">
                    {item.tongTinChiYeuCau != null
                      ? item.tongTinChiYeuCau + " TC"
                      : "Chưa có cấu trúc"}
                  </td>
                  <td className="px-5 py-4">
                    <Badge
                      variant={
                        mode === "unversioned"
                          ? "default"
                          : item.status === "PUBLISHED"
                            ? "approved"
                            : item.status === "RETURNED"
                              ? "rejected"
                              : ["SUBMITTED", "REVIEWING"].includes(item.status)
                                ? "pending"
                                : "draft"
                      }
                    >
                      {mode === "unversioned"
                        ? "Chưa có phiên bản"
                        : item.statusLabel}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    {mode === "unversioned" ? (
                      result.permissions.canEdit && item.status === "ACTIVE" ? (
                        <Link
                          href={`/dashboard/chuong-trinh-dao-tao/tao-moi?programId=${item.id}`}
                        >
                          <Button size="sm">Tạo phiên bản</Button>
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-500">
                          Chưa có phiên bản để xem cấu trúc
                        </span>
                      )
                    ) : (
                      <div className="flex gap-2">
                        <Link
                          href={`/dashboard/chuong-trinh-dao-tao/${item.id}/build`}
                        >
                          <Button variant="outline" size="sm">
                            <Layers className="h-3.5 w-3.5 mr-1" />
                            {["DRAFT", "RETURNED"].includes(item.status) &&
                            result.permissions.canEdit
                              ? "Xây dựng / Chi tiết"
                              : "Xem đầy đủ"}
                          </Button>
                        </Link>
                        {result.permissions.canApprove &&
                          ["SUBMITTED", "REVIEWING"].includes(item.status) && (
                            <Link
                              href={`/dashboard/chuong-trinh-dao-tao/${item.id}/xet-duyet`}
                            >
                              <Button size="sm">Thẩm định</Button>
                            </Link>
                          )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            {(loading || error || !result?.data.length) && (
              <tr>
                <td
                  colSpan={7}
                  role="status"
                  className="p-10 text-center text-slate-500"
                >
                  {loading
                    ? "Đang tải CTĐT..."
                    : error
                      ? "Không thể tải dữ liệu."
                      : mode === "unversioned"
                        ? "Không có CTĐT chưa lập phiên bản trong phạm vi tài khoản."
                        : "Không tìm thấy phiên bản CTĐT phù hợp."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap justify-between items-center gap-3 text-sm text-slate-600">
        <span>
          Tổng {result?.meta.total ?? 0}{" "}
          {mode === "versions" ? "phiên bản" : "CTĐT chưa có phiên bản"}
        </span>
        <div className="flex gap-3 items-center">
          <Button
            variant="outline"
            size="sm"
            disabled={loading || !!error || page <= 1}
            onClick={() => {
              setPage(page - 1);
              setLoading(true);
            }}
          >
            Trang trước
          </Button>
          <span>
            Trang {result?.meta.totalPages ? page : 0} /{" "}
            {result?.meta.totalPages ?? 0}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={
              loading || !!error || page >= (result?.meta.totalPages ?? 0)
            }
            onClick={() => {
              setPage(page + 1);
              setLoading(true);
            }}
          >
            Trang sau
          </Button>
        </div>
      </div>
    </div>
  );
}
