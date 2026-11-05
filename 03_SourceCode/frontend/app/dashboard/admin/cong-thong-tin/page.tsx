"use client";
import { ExcelOnlyForm } from "@/components/excel/ExcelOnlyForm";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import {
  AdminFeedback,
  AdminPagination,
} from "@/components/admin/AdminFeedback";
import {
  portalAdminService,
  type DocumentInput,
  type SubscriptionRecord,
} from "@/lib/services/portalAdminService";
import type { PublicDocument, PublicPage } from "@/lib/services/portalService";
const control =
  "w-full rounded border border-slate-300 bg-white p-2.5 text-sm text-slate-950";
const blank = (): DocumentInput => ({
  title: "",
  category: "REGULATION",
  summary: "",
  documentUrl: "",
  referenceNumber: "",
  issuedOn: "",
  status: "DRAFT",
});
const categories: Record<string, string> = {
  REGULATION: "Quy chế",
  ADMISSION: "Tuyển sinh",
  GUIDE: "Hướng dẫn",
};
const asError = (e: unknown) =>
  e instanceof Error ? e : new Error("Không thể thực hiện thao tác.");
export default function PortalAdmin() {
  const [tab, setTab] = useState<"documents" | "subscriptions">("documents"),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("ALL"),
    [page, setPage] = useState(1),
    [version, setVersion] = useState(0),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [documents, setDocuments] = useState<PublicPage<PublicDocument> | null>(
      null,
    ),
    [subscriptions, setSubscriptions] =
      useState<PublicPage<SubscriptionRecord> | null>(null),
    [error, setError] = useState<Error | null>(null),
    [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false),
    [editing, setEditing] = useState<PublicDocument | null>(null),
    [form, setForm] = useState<DocumentInput>(blank),
    [formError, setFormError] = useState<Error | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(() => {
      const q = new URLSearchParams({
        search,
        status,
        page: String(page),
        limit: "20",
      });
      const task =
        tab === "documents"
          ? portalAdminService.documents(q, abort.signal).then((result) => {
              if (!abort.signal.aborted) setDocuments(result);
            })
          : portalAdminService.subscriptions(q, abort.signal).then((result) => {
              if (!abort.signal.aborted) setSubscriptions(result);
            });
      task
        .then(() => {
          if (!abort.signal.aborted) {
            setError(null);
            setLoading(false);
          }
        })
        .catch((e) => {
          if (!abort.signal.aborted) {
            setError(asError(e));
            setLoading(false);
          }
        });
    }, 250);
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [tab, search, status, page, version]);
  function refresh() {
    setLoading(true);
    setVersion((v) => v + 1);
  }
  function changeTab(t: "documents" | "subscriptions") {
    setTab(t);
    setStatus("ALL");
    setPage(1);
    setSearch("");
    setNotice("");
    setLoading(true);
  }
  function begin(item: PublicDocument | null) {
    setEditing(item);
    setForm(
      item
        ? {
            title: item.title,
            category: item.category,
            summary: item.summary,
            documentUrl: item.documentUrl,
            referenceNumber: item.referenceNumber || "",
            issuedOn: item.issuedOn || "",
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
      await portalAdminService.save(editing, {
        ...form,
        ...(!form.issuedOn ? { issuedOn: undefined } : {}),
      });
      setOpen(false);
      setNotice(
        "Đã lưu văn bản. Chỉ trạng thái Công bố mới hiển thị ở trang công khai.",
      );
      refresh();
    } catch (e) {
      setFormError(asError(e));
    } finally {
      setBusy(false);
    }
  }
  async function action(task: () => Promise<{ message: string }>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setNotice((await task()).message);
      refresh();
    } catch (e) {
      setError(asError(e));
    } finally {
      setBusy(false);
    }
  }
  const meta = tab === "documents" ? documents?.meta : subscriptions?.meta;
  return (
    <div className="space-y-5 pb-16 text-slate-950">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <h1 className="text-xl font-bold">Cổng thông tin & Tuyển sinh</h1>
          <p className="mt-2 text-sm text-slate-500">
            Công bố văn bản và theo dõi đăng ký nhận thông tin tuyển sinh.
          </p>
        </div>
        <Link
          href="/"
          target="_blank"
          className="text-sm font-semibold text-blue-700 underline"
        >
          Xem trang chủ
        </Link>
      </header>
      <div className="flex flex-wrap gap-3">
        <Button
          variant={tab === "documents" ? "primary" : "outline"}
          onClick={() => changeTab("documents")}
        >
          Văn bản công khai
        </Button>
        <Button
          variant={tab === "subscriptions" ? "primary" : "outline"}
          onClick={() => changeTab("subscriptions")}
        >
          Đăng ký nhận thông tin
        </Button>
      </div>
      <AdminFeedback error={error} message={notice} retry={refresh} />
      <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <input
          aria-label="Tìm trên cổng thông tin"
          maxLength={255}
          className={control + " flex-1"}
          placeholder={
            tab === "documents"
              ? "Tìm tên, số văn bản..."
              : "Tìm tên, email, số điện thoại..."
          }
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
            setLoading(true);
          }}
        />
        <select
          aria-label="Lọc trạng thái cổng thông tin"
          className={control + " md:w-56"}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
            setLoading(true);
          }}
        >
          <option value="ALL">Tất cả trạng thái</option>
          {tab === "documents" ? (
            <>
              <option value="DRAFT">Bản nháp</option>
              <option value="PUBLISHED">Công bố</option>
            </>
          ) : (
            <>
              <option value="NEW">Chưa liên hệ</option>
              <option value="CONTACTED">Đã liên hệ</option>
            </>
          )}
        </select>
        {tab === "documents" && (
          <Button onClick={() => begin(null)} disabled={busy}>
            Thêm văn bản
          </Button>
        )}
        <Button variant="outline" onClick={refresh} disabled={loading}>
          Tải lại
        </Button>
      </div>
      {loading ? (
        <p role="status">Đang tải dữ liệu...</p>
      ) : !error && tab === "documents" ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                {[
                  "Văn bản",
                  "Phân loại",
                  "Ngày ban hành",
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
              {documents?.data.map((d) => (
                <tr key={d.id} className="border-t border-slate-100">
                  <td className="p-4">
                    <strong>{d.title}</strong>
                    <p className="mt-1 text-xs text-slate-500">
                      {d.referenceNumber || "Chưa có số văn bản"}
                    </p>
                    <a
                      href={d.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs text-blue-700 underline"
                    >
                      Mở liên kết
                    </a>
                  </td>
                  <td className="p-4">{categories[d.category]}</td>
                  <td className="p-4">{d.issuedOn || "—"}</td>
                  <td className="p-4">
                    {d.status === "PUBLISHED" ? "Công bố" : "Bản nháp"}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => begin(d)}
                      >
                        Sửa
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm(
                              "Xóa văn bản " +
                                d.title +
                                " khỏi cổng thông tin?",
                            )
                          )
                            action(() => portalAdminService.remove(d));
                        }}
                      >
                        Xóa
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!documents?.data.length && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    Chưa có văn bản phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        !error && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[950px] text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    "Người đăng ký",
                    "Liên hệ",
                    "Thông tin quan tâm",
                    "Thông tin bổ sung",
                    "Trạng thái",
                  ].map((h) => (
                    <th key={h} className="p-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subscriptions?.data.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="p-4">
                      <strong>{s.fullName}</strong>
                      <p className="mt-2 text-xs text-slate-500">
                        {s.createdAt}
                      </p>
                    </td>
                    <td className="p-4">
                      <a
                        className="block text-blue-700"
                        href={"mailto:" + s.email}
                      >
                        {s.email}
                      </a>
                      <p className="mt-2">{s.phone}</p>
                    </td>
                    <td className="p-4">
                      {s.levelName}
                      <p className="mt-2 text-xs text-slate-500">
                        {s.majorName || "Chưa chọn ngành"}
                      </p>
                    </td>
                    <td className="max-w-xs p-4">
                      <p className="whitespace-pre-line">{s.message || "—"}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        Ngành đã học: {s.previousMajor || "—"}
                        {s.graduationYear ? " · " + s.graduationYear : ""}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        Đồng ý cung cấp thông tin: {s.consentedAt}
                      </p>
                    </td>
                    <td className="p-4">
                      {s.status === "CONTACTED" ? (
                        "Đã liên hệ"
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            action(() => portalAdminService.contact(s))
                          }
                        >
                          Đánh dấu đã liên hệ
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {!subscriptions?.data.length && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      Chưa có đăng ký phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )
      )}
      <AdminPagination
        meta={meta}
        page={page}
        loading={loading}
        changePage={(p) => {
          setPage(p);
          setLoading(true);
        }}
      />
      <Modal
        isOpen={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title={editing ? "Sửa văn bản công khai" : "Thêm văn bản công khai"}
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
              form="portal-document"
              type="submit"
              disabled={busy}
              isLoading={busy}
            >
              Lưu văn bản
            </Button>
          </>
        }
      >
        <ExcelOnlyForm
          resource="documents"
          onImported={() => {
            setOpen(false);
            refresh();
          }}
          recordKey={String(editing?.id || "new")}
          id="portal-document"
          onSubmit={save}
          className="space-y-4"
        >
          <AdminFeedback error={formError} />
          <label className="block space-y-2 text-sm font-medium">
            Tiêu đề
            <input
              aria-label="Tiêu đề văn bản"
              className={control}
              required
              maxLength={255}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2 text-sm font-medium">
              Phân loại
              <select
                aria-label="Phân loại văn bản"
                className={control}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {Object.entries(categories).map(([v, n]) => (
                  <option key={v} value={v}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2 text-sm font-medium">
              Trạng thái
              <select
                aria-label="Trạng thái văn bản"
                className={control}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="DRAFT">Bản nháp</option>
                <option value="PUBLISHED">Công bố</option>
              </select>
            </label>
          </div>
          <label className="block space-y-2 text-sm font-medium">
            Liên kết văn bản (HTTPS)
            <input
              aria-label="Liên kết văn bản"
              className={control}
              required
              type="url"
              pattern="https://.*"
              maxLength={2000}
              placeholder="https://..."
              value={form.documentUrl}
              onChange={(e) =>
                setForm({ ...form, documentUrl: e.target.value })
              }
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2 text-sm font-medium">
              Số văn bản
              <input
                aria-label="Số văn bản"
                className={control}
                maxLength={150}
                value={form.referenceNumber}
                onChange={(e) =>
                  setForm({ ...form, referenceNumber: e.target.value })
                }
              />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              Ngày ban hành
              <input
                aria-label="Ngày ban hành"
                className={control}
                type="date"
                value={form.issuedOn}
                onChange={(e) => setForm({ ...form, issuedOn: e.target.value })}
              />
            </label>
          </div>
          <label className="block space-y-2 text-sm font-medium">
            Tóm tắt
            <textarea
              aria-label="Tóm tắt văn bản"
              className={control + " min-h-28"}
              maxLength={2000}
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
            />
          </label>
          <p className="text-xs leading-6 text-slate-500">
            Chỉ công bố văn bản được phép công khai. Liên kết mở trực tiếp tài
            liệu ở nguồn đã nhập; hệ thống không tự sao chép hoặc gửi email hàng
            loạt.
          </p>
        </ExcelOnlyForm>
      </Modal>
    </div>
  );
}
