"use client";
import { useEffect, useState, type FormEvent } from "react";
import { GraduationCap, Plus, Search, Pencil, Trash2 } from "lucide-react";
import { MajorImportModal } from "@/components/admin/MajorImportModal";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import {
  AdminFeedback,
  AdminPagination,
} from "@/components/admin/AdminFeedback";
import type { PageResult } from "@/lib/services/adminService";
import {
  majorService,
  type MajorInput,
  type MajorItem,
  type MajorUnit,
} from "@/lib/services/majorService";
const control =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 disabled:bg-slate-100 disabled:text-slate-600";
const blank = (): MajorInput => ({
  majorCode: "",
  majorName: "",
  unitId: "",
  status: "ACTIVE",
});
const asError = (e: unknown) =>
  e instanceof Error ? e : new Error("Không thể thực hiện thao tác.");
export default function MajorsPage() {
  const [search, setSearch] = useState(""),
    [unit, setUnit] = useState(""),
    [status, setStatus] = useState("ALL"),
    [page, setPage] = useState(1),
    [version, setVersion] = useState(0);
  const [data, setData] = useState<PageResult<MajorItem> | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<Error | null>(null);
  const [units, setUnits] = useState<MajorUnit[]>([]),
    [unitsLoading, setUnitsLoading] = useState(true),
    [unitsError, setUnitsError] = useState<Error | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [open, setOpen] = useState(false),
    [editing, setEditing] = useState<MajorItem | null>(null),
    [form, setForm] = useState<MajorInput>(blank),
    [saving, setSaving] = useState(false),
    [mutationError, setMutationError] = useState<Error | null>(null),
    [message, setMessage] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    majorService
      .options(abort.signal)
      .then((r) => {
        if (!abort.signal.aborted) {
          setUnits(r.units);
          setUnitsError(null);
        }
      })
      .catch((e) => {
        if (!abort.signal.aborted) setUnitsError(asError(e));
      })
      .finally(() => {
        if (!abort.signal.aborted) setUnitsLoading(false);
      });
    return () => abort.abort();
  }, [version]);
  useEffect(() => {
    const abort = new AbortController();
    const timer = window.setTimeout(() => {
      majorService
        .list(
          new URLSearchParams({
            searchTerm: search.trim(),
            status,
            ...(unit ? { unitId: unit } : {}),
            page: String(page),
            limit: "20",
          }),
          abort.signal,
        )
        .then((r) => {
          if (abort.signal.aborted) return;
          if (page > 1 && !r.data.length && page > r.meta.totalPages) {
            setPage(Math.max(1, r.meta.totalPages));
            return;
          }
          setData(r);
          setError(null);
          setLoading(false);
        })
        .catch((e) => {
          if (!abort.signal.aborted) {
            setData(null);
            setError(asError(e));
            setLoading(false);
          }
        });
    }, 300);
    return () => {
      abort.abort();
      window.clearTimeout(timer);
    };
  }, [search, unit, status, page, version]);
  function refresh() {
    setLoading(true);
    setVersion((v) => v + 1);
  }
  function begin(item: MajorItem | null) {
    setEditing(item);
    setForm(
      item
        ? {
            majorCode: item.majorCode,
            majorName: item.majorName,
            unitId: item.unitId,
            status: item.status,
          }
        : blank(),
    );
    setMutationError(null);
    setMessage("");
    setOpen(true);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMutationError(null);
    try {
      await majorService.save(editing, form);
      setOpen(false);
      setMessage(
        editing ? "Đã cập nhật ngành đào tạo." : "Đã thêm ngành đào tạo.",
      );
      refresh();
    } catch (e) {
      setMutationError(asError(e));
    } finally {
      setSaving(false);
    }
  }
  async function remove(item: MajorItem) {
    if (
      saving ||
      !confirm(
        "Xóa ngành " +
          item.majorCode +
          "? Chỉ ngành chưa được sử dụng mới được xóa.",
      )
    )
      return;
    setSaving(true);
    setMutationError(null);
    setMessage("");
    try {
      const r = await majorService.remove(item);
      setMessage(r.message);
      refresh();
    } catch (e) {
      setMutationError(asError(e));
    } finally {
      setSaving(false);
    }
  }
  const locked = !!editing?.identityLocked;
  const rows = loading || error ? [] : data?.data || [];
  return (
    <div className="space-y-6 pb-16 text-slate-950">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <GraduationCap className="text-blue-600" />
            Quản lý Ngành đào tạo
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Khai báo ngành và đơn vị quản lý để sử dụng khi tạo chương trình đào
            tạo.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => setImportOpen(true)}
          >
            Nhập Excel
          </Button>
          <Button onClick={() => begin(null)} disabled={saving}>
            <Plus className="mr-2 h-4 w-4" />
            Thêm ngành đào tạo
          </Button>
        </div>
      </header>
      {importOpen && (
        <MajorImportModal
          onClose={() => setImportOpen(false)}
          onImported={(count) => {
            setImportOpen(false);
            setMessage(`Đã nhập ${count} ngành đào tạo từ Excel.`);
            refresh();
          }}
        />
      )}
      <AdminFeedback
        error={error || (!open ? mutationError : null)}
        message={message}
        retry={refresh}
      />
      <section className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="flex min-w-60 flex-1 items-center gap-2">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            aria-label="Tìm ngành đào tạo"
            placeholder="Tìm mã, tên ngành hoặc đơn vị..."
            maxLength={255}
            className={control}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
              setLoading(true);
            }}
          />
        </label>
        <select
          aria-label="Lọc đơn vị quản lý ngành"
          className={control + " md:w-72"}
          value={unit}
          onChange={(e) => {
            setUnit(e.target.value);
            setPage(1);
            setLoading(true);
          }}
        >
          <option value="">Tất cả đơn vị</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.code} — {u.name}
            </option>
          ))}
          {unit && !units.some((u) => u.id === unit) && (
            <option value={unit}>Đơn vị đã chọn</option>
          )}
        </select>
        <select
          aria-label="Lọc trạng thái ngành"
          className={control + " md:w-48"}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
            setLoading(true);
          }}
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="ACTIVE">Hoạt động</option>
          <option value="INACTIVE">Ngừng sử dụng</option>
        </select>
        <Button variant="outline" disabled={saving} onClick={refresh}>
          Tải lại
        </Button>
      </section>
      <AdminFeedback error={unitsError} retry={refresh} />
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              {[
                "Mã ngành",
                "Tên ngành",
                "Đơn vị quản lý",
                "CTĐT liên kết",
                "Trạng thái",
                "Thao tác",
              ].map((h) => (
                <th key={h} className="p-4">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="p-4 font-semibold text-blue-700">
                  {item.majorCode}
                </td>
                <td className="p-4 font-medium">{item.majorName}</td>
                <td className="p-4">
                  {item.unitCode} — {item.unitName}
                  {item.unitStatus !== "ACTIVE" && (
                    <p className="text-xs text-amber-800">
                      Đơn vị đã ngừng hoạt động
                    </p>
                  )}
                </td>
                <td className="p-4">
                  {item.programCount}
                  {item.userScopeCount + item.registrationScopeCount > 0 && (
                    <p className="text-xs text-slate-600">
                      Có phạm vi dữ liệu tham chiếu
                    </p>
                  )}
                </td>
                <td className="p-4">
                  <span
                    className={
                      item.status === "ACTIVE"
                        ? "text-green-800"
                        : "text-slate-600"
                    }
                  >
                    {item.status === "ACTIVE" ? "Hoạt động" : "Ngừng sử dụng"}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={saving}
                      onClick={() => begin(item)}
                    >
                      <Pencil className="mr-1 h-4 w-4" />
                      Sửa
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={saving || item.identityLocked}
                      title={
                        item.identityLocked
                          ? "Ngành đã được sử dụng; có thể ngừng sử dụng thay vì xóa"
                          : "Xóa ngành chưa được sử dụng"
                      }
                      onClick={() => remove(item)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Xóa
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-slate-600">
                  {loading
                    ? "Đang tải ngành đào tạo..."
                    : error
                      ? "Không thể tải danh sách."
                      : "Không có ngành phù hợp."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <AdminPagination
        meta={data?.meta}
        page={page}
        loading={loading || saving}
        changePage={(p) => {
          setPage(p);
          setLoading(true);
        }}
      />
      <p className="text-sm text-slate-600">
        Ngành ngừng sử dụng không được chọn cho CTĐT mới. Các CTĐT đã liên kết
        vẫn giữ lịch sử.
      </p>
      <Modal
        isOpen={open}
        onClose={() => {
          if (!saving) setOpen(false);
        }}
        title={editing ? "Sửa ngành đào tạo" : "Thêm ngành đào tạo"}
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setOpen(false)}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              form="major-form"
              disabled={saving || unitsLoading || !!unitsError}
              isLoading={saving}
            >
              Lưu ngành đào tạo
            </Button>
          </>
        }
      >
        <form id="major-form" onSubmit={save} className="space-y-4">
          <AdminFeedback error={mutationError} />
          {locked && (
            <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">
              Ngành đã có liên kết nên mã và đơn vị quản lý được giữ cố định.
              Bạn có thể sửa tên hoặc ngừng sử dụng.
            </p>
          )}
          <label className="block space-y-1 text-sm font-medium">
            Mã ngành *
            <input
              aria-label="Mã ngành"
              required
              maxLength={50}
              pattern="[A-Za-z0-9_-]+"
              disabled={saving || locked}
              className={control}
              value={form.majorCode}
              onChange={(e) => setForm({ ...form, majorCode: e.target.value })}
            />
          </label>
          <label className="block space-y-1 text-sm font-medium">
            Tên ngành *
            <input
              aria-label="Tên ngành"
              required
              maxLength={255}
              disabled={saving}
              className={control}
              value={form.majorName}
              onChange={(e) => setForm({ ...form, majorName: e.target.value })}
            />
          </label>
          <label className="block space-y-1 text-sm font-medium">
            Đơn vị quản lý *
            <select
              aria-label="Đơn vị quản lý ngành"
              required
              disabled={saving || locked || unitsLoading || !!unitsError}
              className={control}
              value={form.unitId}
              onChange={(e) => setForm({ ...form, unitId: e.target.value })}
            >
              <option value="">Chọn đơn vị từ CSDL</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code} — {u.name}
                </option>
              ))}
              {editing && !units.some((u) => u.id === editing.unitId) && (
                <option value={editing.unitId}>
                  {editing.unitName} (ngừng hoạt động)
                </option>
              )}
            </select>
          </label>
          <label className="block space-y-1 text-sm font-medium">
            Trạng thái
            <select
              aria-label="Trạng thái ngành"
              className={control}
              disabled={saving}
              value={form.status}
              onChange={(e) =>
                setForm({
                  ...form,
                  status: e.target.value as MajorInput["status"],
                })
              }
            >
              <option value="ACTIVE">Hoạt động</option>
              <option value="INACTIVE">Ngừng sử dụng</option>
            </select>
          </label>
          {!unitsLoading && !units.length && (
            <p className="text-sm text-amber-900">
              Chưa có đơn vị hoạt động. Khai báo đơn vị tại Danh mục dùng chung
              trước.
            </p>
          )}
          {unitsLoading && <p>Đang tải đơn vị...</p>}
        </form>
      </Modal>
    </div>
  );
}
