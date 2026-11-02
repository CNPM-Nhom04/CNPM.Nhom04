"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import {
  AdminFeedback,
  AdminPagination,
} from "@/components/admin/AdminFeedback";
import {
  facultyService,
  type FacultyInput,
  type FacultyItem,
} from "@/lib/services/facultyService";
import type { PageResult } from "@/lib/services/adminService";
const control =
  "w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-950 disabled:bg-slate-100";
const blank = (): FacultyInput => ({
  code: "",
  name: "",
  description: "",
  status: "ACTIVE",
});
const asError = (e: unknown) =>
  e instanceof Error ? e : new Error("Không thể thực hiện yêu cầu.");
export default function FacultiesPage() {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("ALL"),
    [page, setPage] = useState(1),
    [version, setVersion] = useState(0);
  const [data, setData] = useState<PageResult<FacultyItem> | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<Error | null>(null);
  const [open, setOpen] = useState(false),
    [editing, setEditing] = useState<FacultyItem | null>(null),
    [form, setForm] = useState<FacultyInput>(blank),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState<Error | null>(null),
    [message, setMessage] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(() => {
      facultyService
        .list(
          new URLSearchParams({
            searchTerm: search,
            status,
            page: String(page),
            limit: "20",
          }),
          abort.signal,
        )
        .then((result) => {
          if (abort.signal.aborted) return;
          if (
            page > 1 &&
            !result.data.length &&
            page > result.meta.totalPages
          ) {
            setPage(Math.max(1, result.meta.totalPages));
            return;
          }
          setData(result);
          setError(null);
          setLoading(false);
        })
        .catch((e) => {
          if (!abort.signal.aborted) {
            setError(asError(e));
            setData(null);
            setLoading(false);
          }
        });
    }, 250);
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [search, status, page, version]);
  function refresh() {
    setLoading(true);
    setVersion((v) => v + 1);
  }
  function begin(item: FacultyItem | null) {
    setEditing(item);
    setForm(
      item
        ? {
            code: item.code,
            name: item.name,
            description: item.description,
            status: item.status,
          }
        : blank(),
    );
    setFormError(null);
    setMessage("");
    setOpen(true);
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError(null);
    try {
      await facultyService.save(editing, form);
      setOpen(false);
      setMessage(editing ? "Đã cập nhật khoa." : "Đã thêm khoa.");
      refresh();
    } catch (e) {
      setFormError(asError(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove(item: FacultyItem) {
    if (busy || !confirm("Xóa khoa " + item.code + " chưa sử dụng?")) return;
    setBusy(true);
    setError(null);
    try {
      const result = await facultyService.remove(item);
      setMessage(result.message);
      refresh();
    } catch (e) {
      setError(asError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5 pb-16 text-slate-950">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <h1 className="text-xl font-bold">Quản lý Khoa</h1>
          <p className="mt-1 text-sm text-slate-600">
            Khoa trong danh mục đơn vị của hệ thống; dùng chung khi quản lý
            ngành, tài khoản và CTĐT.
          </p>
        </div>
        <Button disabled={busy} onClick={() => begin(null)}>
          Thêm khoa
        </Button>
      </header>
      <AdminFeedback error={error} message={message} retry={refresh} />
      <section className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <input
          aria-label="Tìm khoa"
          placeholder="Tìm mã hoặc tên khoa..."
          className={control + " flex-1"}
          value={search}
          maxLength={255}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
            setLoading(true);
          }}
        />
        <select
          aria-label="Lọc trạng thái khoa"
          className={control + " md:w-56"}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
            setLoading(true);
          }}
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="ACTIVE">Hoạt động</option>
          <option value="INACTIVE">Ngừng hoạt động</option>
        </select>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          Tải lại
        </Button>
      </section>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              {[
                "Mã khoa",
                "Tên khoa",
                "Đơn vị cha",
                "Ngành / CTĐT / Đơn vị con",
                "Trạng thái",
                "Thao tác",
              ].map((t) => (
                <th key={t} className="p-4">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-4">
                  Đang tải...
                </td>
              </tr>
            ) : data?.data.length ? (
              data.data.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="p-4 font-semibold text-blue-700">
                    {item.code}
                  </td>
                  <td className="p-4">
                    <strong>{item.name}</strong>
                    <p className="mt-1 text-xs text-slate-600">
                      {item.description}
                    </p>
                  </td>
                  <td className="p-4">{item.parentName || "—"}</td>
                  <td className="p-4">
                    {item.majorCount} / {item.programCount} / {item.childCount}
                  </td>
                  <td className="p-4">
                    {item.status === "ACTIVE" ? "Hoạt động" : "Ngừng hoạt động"}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => begin(item)}
                      >
                        Sửa
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy || item.referenceCount > 0}
                        title={
                          item.referenceCount
                            ? "Khoa đang được sử dụng. Có thể ngừng hoạt động."
                            : "Xóa khoa chưa sử dụng"
                        }
                        onClick={() => remove(item)}
                      >
                        Xóa
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="p-4">
                  Không có khoa phù hợp.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {data && (
        <AdminPagination
          meta={data.meta}
          page={page}
          changePage={(p) => {
            setPage(p);
            setLoading(true);
          }}
          loading={loading}
        />
      )}
      <p className="text-sm text-slate-600">
        Chỉ hiển thị loại Khoa (FACULTY). Bộ môn và các loại đơn vị khác xem
        trong Danh mục dùng chung. Ngừng hoạt động giữ nguyên dữ liệu và phạm vi
        đã gán; không tự chuyển tài khoản hay chương trình sang khoa khác.
      </p>
      <Modal
        isOpen={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title={editing ? "Sửa khoa" : "Thêm khoa"}
        footer={
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              form="faculty-form"
              isLoading={busy}
              disabled={busy}
            >
              Lưu khoa
            </Button>
          </>
        }
      >
        <form id="faculty-form" onSubmit={save} className="space-y-4">
          <AdminFeedback error={formError} />
          <label className="block text-sm font-medium">
            Mã khoa
            <input
              aria-label="Mã khoa"
              className={control}
              value={form.code}
              required
              maxLength={50}
              pattern="[A-Za-z0-9_-]+"
              disabled={busy}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </label>
          <label className="block text-sm font-medium">
            Tên khoa
            <input
              aria-label="Tên khoa"
              className={control}
              value={form.name}
              required
              maxLength={255}
              disabled={busy}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="block text-sm font-medium">
            Mô tả
            <textarea
              aria-label="Mô tả khoa"
              className={control}
              value={form.description}
              maxLength={1000}
              disabled={busy}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>
          <label className="block text-sm font-medium">
            Trạng thái
            <select
              aria-label="Trạng thái khoa"
              className={control}
              value={form.status}
              disabled={busy}
              onChange={(e) =>
                setForm({
                  ...form,
                  status: e.target.value as FacultyInput["status"],
                })
              }
            >
              <option value="ACTIVE">Hoạt động</option>
              <option value="INACTIVE">Ngừng hoạt động</option>
            </select>
          </label>
          {editing?.parentName && (
            <p className="text-sm text-slate-600">
              Đơn vị cha: {editing.parentName}. Không thay đổi cây đơn vị trong
              form này.
            </p>
          )}
        </form>
      </Modal>
    </div>
  );
}
