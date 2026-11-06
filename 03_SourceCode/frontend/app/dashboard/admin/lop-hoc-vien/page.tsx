"use client";
import { ExcelOnlyForm } from "@/components/excel/ExcelOnlyForm";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import {
  AdminFeedback,
  AdminPagination,
} from "@/components/admin/AdminFeedback";
import { StudentAccountImport } from "@/components/admin/StudentAccountImport";
import { StudentAccountLink } from "@/components/admin/StudentAccountLink";
import { StudentClassMembers } from "@/components/admin/StudentClassMembers";
import {
  studentAccountsService,
  type AccountOptions,
  type StudentClass,
} from "@/lib/services/studentAccountsService";
import type { PageResult } from "@/lib/services/adminService";
const control =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 disabled:bg-slate-100";
const asError = (e: unknown) =>
  e instanceof Error ? e : new Error("Không thể thực hiện yêu cầu.");
const blank = () => ({
  code: "",
  name: "",
  trackId: "",
  admissionYear: "",
  status: "ACTIVE",
});
export default function StudentClassesPage() {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("ALL"),
    [page, setPage] = useState(1),
    [version, setVersion] = useState(0),
    [data, setData] = useState<PageResult<StudentClass> | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<Error | null>(null),
    [notice, setNotice] = useState("");
  const [options, setOptions] = useState<AccountOptions | null>(null),
    [optionsError, setOptionsError] = useState<Error | null>(null),
    [busy, setBusy] = useState(false),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState<StudentClass | null>(null),
    [form, setForm] = useState(blank),
    [formError, setFormError] = useState<Error | null>(null);
  const [linking, setLinking] = useState<StudentClass | null>(null);
  const [importing, setImporting] = useState<StudentClass | null>(null),
    [members, setMembers] = useState<StudentClass | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    studentAccountsService
      .options(abort.signal)
      .then((result) => {
        if (!abort.signal.aborted) {
          setOptions(result);
          setOptionsError(null);
        }
      })
      .catch((e) => {
        if (!abort.signal.aborted) setOptionsError(asError(e));
      });
    return () => abort.abort();
  }, [version]);
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(() => {
      studentAccountsService
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
          if (page > 1 && page > result.meta.totalPages) {
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
  function begin(item: StudentClass | null) {
    setEditing(item);
    setForm(
      item
        ? {
            code: item.code,
            name: item.name,
            trackId: item.trackId,
            admissionYear: String(item.admissionYear),
            status: item.status,
          }
        : blank(),
    );
    setFormError(null);
    setOpen(true);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError(null);
    try {
      if (editing)
        await studentAccountsService.update(editing, {
          name: form.name,
          status: form.status,
        });
      else
        await studentAccountsService.create({
          code: form.code,
          name: form.name,
          trackId: form.trackId,
          admissionYear: Number(form.admissionYear),
        });
      setOpen(false);
      setNotice(
        editing
          ? "Đã cập nhật lớp quản lý."
          : "Đã tạo lớp. Có thể tải mẫu và nhập học viên.",
      );
      refresh();
    } catch (e) {
      setFormError(asError(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove(item: StudentClass) {
    if (busy || !confirm("Xóa lớp " + item.code + " chưa có học viên?")) return;
    setBusy(true);
    setError(null);
    try {
      setNotice((await studentAccountsService.remove(item)).message);
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
          <h1 className="text-xl font-bold">Lớp & Tài khoản học viên</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Tiếp nhận danh sách học viên đã nhập học, tạo tài khoản và phân công
            đúng CTĐT theo lớp quản lý.
          </p>
        </div>
        <Button
          disabled={busy || !options?.tracks.length}
          onClick={() => begin(null)}
        >
          Tạo lớp quản lý
        </Button>
      </header>
      {options && !options.tracks.length && (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          Chưa có phiên bản CTĐT và hướng đào tạo đủ điều kiện để tạo lớp. Cần
          hoàn thiện cấu trúc và ban hành CTĐT trước khi tiếp nhận học viên.
        </p>
      )}
      <AdminFeedback
        error={error || optionsError}
        message={notice}
        retry={refresh}
      />
      <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <input
          aria-label="Tìm lớp quản lý"
          className={control + " flex-1"}
          maxLength={255}
          placeholder="Tìm mã, tên lớp hoặc phiên bản CTĐT..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
            setLoading(true);
          }}
        />
        <select
          aria-label="Lọc trạng thái lớp"
          className={control + " md:w-56"}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
            setLoading(true);
          }}
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang tiếp nhận</option>
          <option value="INACTIVE">Ngừng tiếp nhận</option>
        </select>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          Tải lại
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              {[
                "Lớp quản lý",
                "CTĐT / Hướng",
                "Đơn vị / Khóa",
                "Học viên",
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
            {loading ? (
              <tr>
                <td colSpan={6} className="p-6">
                  Đang tải lớp...
                </td>
              </tr>
            ) : (
              data?.data.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="p-4">
                    <strong className="text-blue-700">{item.code}</strong>
                    <p className="mt-1 leading-6">{item.name}</p>
                  </td>
                  <td className="p-4">
                    <strong>{item.versionCode}</strong>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.trackName}
                    </p>
                  </td>
                  <td className="p-4">
                    <p>{item.unitName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Khóa {item.admissionYear}
                    </p>
                  </td>
                  <td className="p-4">{item.memberCount}</td>
                  <td className="p-4">
                    {item.status === "ACTIVE"
                      ? "Đang tiếp nhận"
                      : "Ngừng tiếp nhận"}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setMembers(item)}
                      >
                        Xem học viên
                      </Button>
                      <Button
                        size="sm"
                        disabled={busy || item.status !== "ACTIVE" || !options}
                        onClick={() => {
                          setNotice("");
                          setImporting(item);
                        }}
                      >
                        Nhập Excel
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || item.status !== "ACTIVE"}
                        onClick={() => {
                          setNotice("");
                          setLinking(item);
                        }}
                      >
                        Liên kết tài khoản
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => begin(item)}
                      >
                        Sửa
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || item.memberCount > 0}
                        onClick={() => remove(item)}
                      >
                        Xóa
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
            {!loading && !data?.data.length && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  Chưa có lớp phù hợp. Tạo lớp trước khi nhập danh sách học
                  viên.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <AdminPagination
        meta={data?.meta}
        page={page}
        loading={loading}
        changePage={(p) => {
          setPage(p);
          setLoading(true);
        }}
      />
      <p className="text-sm leading-7 text-slate-600">
        Lớp quản lý gắn với một phiên bản/hướng CTĐT cụ thể, không phải lớp học
        phần. Sau khi tạo lớp, phiên bản/hướng và khóa được giữ nguyên; ngừng
        tiếp nhận chỉ chặn nhập thêm, vẫn giữ tài khoản và phân công học viên.
      </p>
      {importing && options && (
        <StudentAccountImport
          item={importing}
          limits={options.limits}
          onClose={() => setImporting(null)}
          onCreated={(count) => {
            setImporting(null);
            setNotice(
              `Đã tạo ${count} tài khoản. File bàn giao đã được tải về; học viên phải đổi mật khẩu lần đầu.`,
            );
            refresh();
          }}
        />
      )}
      {linking && (
        <StudentAccountLink
          item={linking}
          onClose={() => setLinking(null)}
          onLinked={(message) => {
            setLinking(null);
            setNotice(message);
            refresh();
          }}
        />
      )}
      {members && (
        <StudentClassMembers item={members} onClose={() => setMembers(null)} />
      )}
      <Modal
        isOpen={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title={editing ? "Sửa lớp quản lý" : "Tạo lớp quản lý học viên"}
        size="xl"
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
              form="student-class"
              type="submit"
              disabled={busy || !options}
              isLoading={busy}
            >
              Lưu lớp
            </Button>
          </>
        }
      >
        <ExcelOnlyForm
          resource="student-classes"
          onImported={() => {
            setOpen(false);
            refresh();
          }}
          recordKey={String(editing?.id || "new")}
          id="student-class"
          onSubmit={save}
          className="space-y-4"
        >
          <AdminFeedback error={formError} />
          <label className="block space-y-2 text-sm font-medium">
            Mã lớp
            <input
              aria-label="Mã lớp quản lý"
              className={control}
              required
              disabled={busy || !!editing}
              maxLength={50}
              pattern="[A-Za-z0-9_.-]+"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </label>
          <label className="block space-y-2 text-sm font-medium">
            Tên lớp
            <input
              aria-label="Tên lớp quản lý"
              className={control}
              required
              disabled={busy}
              maxLength={255}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          {editing ? (
            <div className="rounded border border-slate-200 bg-slate-50 p-4 text-sm leading-7">
              {editing.versionCode} · {editing.trackName} · Khóa{" "}
              {editing.admissionYear}
              <br />
              {editing.unitName}
            </div>
          ) : (
            <>
              <label className="block space-y-2 text-sm font-medium">
                Phiên bản và hướng CTĐT
                <select
                  aria-label="Phiên bản và hướng CTĐT"
                  className={control}
                  required
                  disabled={busy}
                  value={form.trackId}
                  onChange={(e) => {
                    const track = options?.tracks.find(
                      (t) => t.id === e.target.value,
                    );
                    setForm({
                      ...form,
                      trackId: e.target.value,
                      admissionYear: track ? String(track.cohortYear) : "",
                    });
                  }}
                >
                  <option value="">
                    Chọn CTĐT đã ban hành hoặc lưu trữ từ SQL
                  </option>
                  {options?.tracks.map((track) => (
                    <option key={track.id} value={track.id}>
                      {track.unitName} — {track.versionCode} — {track.trackName}{" "}
                      ({track.versionStatus})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2 text-sm font-medium">
                Khóa nhập học
                <input
                  aria-label="Khóa nhập học"
                  className={control}
                  type="number"
                  required
                  min={1900}
                  max={2200}
                  disabled={busy}
                  value={form.admissionYear}
                  onChange={(e) =>
                    setForm({ ...form, admissionYear: e.target.value })
                  }
                />
              </label>
            </>
          )}
          {editing && (
            <label className="block space-y-2 text-sm font-medium">
              Trạng thái
              <select
                aria-label="Trạng thái lớp quản lý"
                className={control}
                disabled={busy}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="ACTIVE">Đang tiếp nhận</option>
                <option value="INACTIVE">Ngừng tiếp nhận</option>
              </select>
            </label>
          )}
        </ExcelOnlyForm>
      </Modal>
    </div>
  );
}
