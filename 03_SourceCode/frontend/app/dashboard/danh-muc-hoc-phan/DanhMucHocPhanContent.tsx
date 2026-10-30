"use client";
import { FormEvent, useEffect, useState } from "react";
import { BookOpen, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import {
  courseService,
  CourseItem,
  CourseDetail,
  CourseList,
  CourseUnit,
} from "@/lib/services/courseService";

const control =
  "w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-950 disabled:bg-slate-100 disabled:text-slate-700";
const labels: Record<string, string> = {
  ACTIVE: "Đang sử dụng",
  INACTIVE: "Đã khóa",
  RETIRED: "Ngừng dùng",
  DRAFT: "Bản nháp",
};
const message = (error: unknown) =>
  error instanceof Error ? error.message : "Không thể thực hiện yêu cầu.";
const blankForm = () => ({
  courseCode: "",
  unitId: "",
  courseName: "",
  englishName: "",
  credits: "",
  theoryHours: "",
  practiceHours: "",
  description: "",
  effectiveFrom: "",
  effectiveTo: "",
});
export default function DanhMucHocPhanContent() {
  const [list, setList] = useState<CourseList | null>(null);
  const [units, setUnits] = useState<CourseUnit[]>([]);
  const [unitsError, setUnitsError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [unitId, setUnitId] = useState("");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<CourseDetail | null>(null);
  const [editing, setEditing] = useState<CourseDetail | "new" | null>(null);
  const [form, setForm] = useState(blankForm);
  const [formError, setFormError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    courseService
      .units(abort.signal)
      .then((data) => {
        setUnits(data);
        setUnitsError("");
      })
      .catch((e) => {
        if (!abort.signal.aborted) setUnitsError(message(e));
      });
    return () => abort.abort();
  }, [reload]);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      courseService
        .list(search, status, unitId, page, abort.signal)
        .then(setList)
        .catch((e) => {
          if (!abort.signal.aborted) setError(message(e));
        })
        .finally(() => {
          if (!abort.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [search, status, unitId, page, reload]);
  function begin(item: CourseDetail | "new") {
    setEditing(item);
    setFormError("");
    setDetailError("");
    setNotice("");
    setForm(
      item === "new"
        ? blankForm()
        : {
            courseCode: item.courseCode,
            unitId: item.unitId,
            courseName: item.courseName || "",
            englishName: item.englishName || "",
            credits: item.credits == null ? "" : String(item.credits),
            theoryHours:
              item.theoryHours == null ? "" : String(item.theoryHours),
            practiceHours:
              item.practiceHours == null ? "" : String(item.practiceHours),
            description: item.description || "",
            effectiveFrom: "",
            effectiveTo: "",
          },
    );
  }
  async function view(item: CourseItem) {
    setBusy(true);
    setError("");
    setDetailError("");
    try {
      setSelected(await courseService.detail(item.id));
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing || busy) return;
    setBusy(true);
    setFormError("");
    const input = {
      courseName: form.courseName,
      englishName: form.englishName,
      credits: Number(form.credits),
      theoryHours: Number(form.theoryHours),
      practiceHours: Number(form.practiceHours),
      description: form.description,
      effectiveFrom: form.effectiveFrom,
      ...(form.effectiveTo ? { effectiveTo: form.effectiveTo } : {}),
    };
    try {
      const result =
        editing === "new"
          ? await courseService.create({
              ...input,
              courseCode: form.courseCode,
              unitId: form.unitId,
            })
          : await courseService.revise(editing.id, {
              ...input,
              expectedLatestVersionId: editing.latestVersionId || "0",
            });
      setEditing(null);
      setSelected(result);
      setNotice(
        "Đã lưu bản nháp vào CSDL. Kiểm tra chi tiết trước khi kích hoạt.",
      );
      setReload((n) => n + 1);
    } catch (e) {
      setFormError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function mutate(action: "activate" | "status") {
    if (!selected || busy) return;
    const prompt =
      action === "activate"
        ? "Kích hoạt bản nháp mới nhất? Bản ACTIVE cũ sẽ ngừng dùng; các CTĐT cũ vẫn giữ phiên bản đã chọn."
        : selected.status === "ACTIVE"
          ? "Khóa học phần khỏi danh mục sử dụng mới? Toàn bộ lịch sử vẫn được giữ."
          : "Mở sử dụng lại học phần này?";
    if (!window.confirm(prompt)) return;
    setBusy(true);
    setDetailError("");
    try {
      const result =
        action === "activate"
          ? await courseService.activate(selected.id, selected.latestVersionId!)
          : await courseService.status(
              selected.id,
              selected.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
              selected.status,
            );
      setSelected(result);
      setReload((n) => n + 1);
      setNotice("Đã cập nhật CSDL.");
    } catch (e) {
      setDetailError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const set = (key: keyof ReturnType<typeof blankForm>, value: string) =>
    setForm((old) => ({ ...old, [key]: value }));
  const input = (
    key: keyof ReturnType<typeof blankForm>,
    label: string,
    type = "text",
    options: {
      required?: boolean;
      maxLength?: number;
      min?: number;
      max?: number;
      step?: string;
    } = {},
  ) => (
    <label className="block space-y-1 text-sm font-medium text-slate-800">
      {label}
      <input
        aria-label={label}
        type={type}
        className={control}
        value={form[key]}
        disabled={busy}
        onChange={(e) => set(key, e.target.value)}
        {...options}
      />
    </label>
  );
  return (
    <div className="space-y-5 pb-16 text-slate-950">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <BookOpen className="text-blue-600" />
            Danh Mục Học Phần
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Ngân hàng học phần, phiên bản nội dung và đơn vị quản lý.
          </p>
        </div>
        {list?.permissions.canManage && (
          <Button disabled={busy} onClick={() => begin("new")}>
            <Plus className="mr-2 h-4 w-4" />
            Thêm học phần mới
          </Button>
        )}
      </div>
      <p className="text-sm text-slate-600">
        Bắt buộc/tự chọn và khối kiến thức được xác định khi xếp học phần vào
        từng CTĐT.
      </p>
      {notice && (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">
          {notice}
        </p>
      )}
      <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="flex min-w-64 flex-1 items-center gap-2">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            aria-label="Tìm học phần"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm mã, tên học phần hoặc tên tiếng Anh..."
            className={control}
            maxLength={255}
          />
        </label>
        <select
          aria-label="Lọc trạng thái"
          className={control + " md:w-48"}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang sử dụng</option>
          <option value="INACTIVE">Đã khóa</option>
          <option value="RETIRED">Ngừng dùng</option>
        </select>
        <select
          aria-label="Lọc đơn vị"
          className={control + " md:w-72"}
          value={unitId}
          onChange={(e) => {
            setUnitId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả đơn vị trong phạm vi</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          onClick={() => setReload((n) => n + 1)}
          disabled={loading}
        >
          Tải lại
        </Button>
      </div>
      {unitsError && (
        <p role="alert" className="text-red-700">
          Không tải được đơn vị: {unitsError}
        </p>
      )}
      {error ? (
        <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
          {error}
          <Button variant="outline" onClick={() => setReload((n) => n + 1)}>
            Thử lại
          </Button>
        </div>
      ) : loading ? (
        <p role="status">Đang tải dữ liệu học phần...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-4">Mã học phần</th>
                <th className="p-4">Phiên bản mới nhất</th>
                <th className="p-4">Tín chỉ</th>
                <th className="p-4">Đơn vị quản lý</th>
                <th className="p-4">Trạng thái học phần</th>
                <th className="p-4">Phiên bản ACTIVE</th>
                <th className="p-4">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list?.data.map((item) => (
                <tr key={item.id}>
                  <td className="p-4 font-semibold text-blue-700">
                    {item.courseCode}
                  </td>
                  <td className="p-4">
                    <strong>{item.courseName || "Chưa có phiên bản"}</strong>
                    {item.versionNo && (
                      <div className="text-xs text-slate-600">
                        v{item.versionNo} ·{" "}
                        {labels[item.versionStatus!] || item.versionStatus}
                      </div>
                    )}
                  </td>
                  <td className="p-4">{item.credits ?? "—"}</td>
                  <td className="p-4">{item.unitName}</td>
                  <td className="p-4">{labels[item.status]}</td>
                  <td className="p-4">
                    {item.activeVersionId ? (
                      <span>
                        v{item.activeVersionNo} · {item.activeCredits} TC
                      </span>
                    ) : (
                      "Chưa có"
                    )}
                  </td>
                  <td className="p-4">
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => view(item)}
                    >
                      Chi tiết
                    </Button>
                  </td>
                </tr>
              ))}
              {!list?.data.length && (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-600">
                    Không có học phần phù hợp trong phạm vi được cấp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {list && !error && !loading && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span>
            Tổng {list.meta.total} học phần · Trang {page}/
            {Math.max(1, list.meta.totalPages)}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Trang trước
            </Button>
            <Button
              variant="outline"
              disabled={page >= list.meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Trang sau
            </Button>
          </div>
        </div>
      )}
      <Modal
        isOpen={!!selected && !editing}
        onClose={() => {
          if (!busy) {
            setSelected(null);
            setDetailError("");
          }
        }}
        title={
          selected
            ? selected.courseCode + " — Chi tiết học phần"
            : "Chi tiết học phần"
        }
        size="2xl"
      >
        {selected && (
          <div className="space-y-4">
            <p>
              Đơn vị quản lý: <strong>{selected.unitName}</strong> ·{" "}
              {labels[selected.status]}
            </p>
            {detailError && (
              <p role="alert" className="rounded bg-red-50 p-3 text-red-800">
                {detailError}
              </p>
            )}
            {selected.permissions.canManage && (
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy || selected.status !== "ACTIVE"}
                  onClick={() => begin(selected)}
                >
                  Tạo bản sửa đổi
                </Button>
                {selected.versionStatus === "DRAFT" && (
                  <Button
                    disabled={busy || selected.status !== "ACTIVE"}
                    onClick={() => mutate("activate")}
                  >
                    Kích hoạt bản nháp v{selected.versionNo}
                  </Button>
                )}
                {selected.status !== "RETIRED" && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => mutate("status")}
                  >
                    {selected.status === "ACTIVE"
                      ? "Khóa sử dụng"
                      : "Mở sử dụng"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => view(selected)}
                >
                  Tải lại chi tiết
                </Button>
              </div>
            )}
            <p className="text-sm text-slate-600">
              Bản sửa đổi luôn tạo phiên bản mới. Các CTĐT và kết quả cũ giữ
              nguyên ID phiên bản đã tham chiếu. Khóa sử dụng giữ toàn bộ lịch
              sử.
            </p>
            <h2 className="font-bold">Lịch sử phiên bản từ CSDL</h2>
            {selected.versions.length === 0 && <p>Chưa có phiên bản.</p>}
            {selected.versions.map((v) => (
              <article
                key={v.id}
                className="space-y-2 rounded-lg border border-slate-200 p-4 text-sm"
              >
                <h3 className="font-semibold">
                  v{v.versionNo} — {v.courseName} · {labels[v.status]}
                </h3>
                <p>{v.englishName || "Chưa nhập tên tiếng Anh"}</p>
                <p>
                  {v.credits} tín chỉ · Lý thuyết {v.theoryHours} giờ · Thực
                  hành {v.practiceHours} giờ
                </p>
                <p>
                  Hiệu lực: {v.effectiveFrom} →{" "}
                  {v.effectiveTo || "Chưa có ngày kết thúc"} · Tham chiếu trong{" "}
                  {v.usageCount} vị trí CTĐT
                </p>
                <p className="whitespace-pre-wrap">
                  {v.description || "Chưa nhập mô tả"}
                </p>
              </article>
            ))}
          </div>
        )}
      </Modal>
      <Modal
        isOpen={!!editing}
        onClose={() => {
          if (!busy) setEditing(null);
        }}
        title={
          editing === "new" ? "Thêm học phần mới" : "Tạo bản sửa đổi học phần"
        }
        size="xl"
        footer={
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setEditing(null)}
            >
              Hủy bỏ
            </Button>
            <Button form="course-form" type="submit" disabled={busy}>
              {busy ? "Đang lưu..." : "Lưu bản nháp"}
            </Button>
          </>
        }
      >
        <form id="course-form" onSubmit={save} className="space-y-4">
          {formError && (
            <p role="alert" className="rounded bg-red-50 p-3 text-red-800">
              {formError}
            </p>
          )}
          {editing === "new" ? (
            <div className="grid gap-4 md:grid-cols-2">
              {input("courseCode", "Mã học phần", "text", {
                required: true,
                maxLength: 50,
              })}
              <label className="block space-y-1 text-sm font-medium text-slate-800">
                Đơn vị quản lý
                <select
                  aria-label="Đơn vị quản lý"
                  required
                  className={control}
                  value={form.unitId}
                  onChange={(e) => set("unitId", e.target.value)}
                  disabled={busy || !!unitsError}
                >
                  <option value="">Chọn đơn vị từ CSDL</option>
                  {units
                    .filter((u) => u.status === "ACTIVE")
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          ) : (
            <p className="text-sm text-slate-700">
              {form.courseCode} · {editing?.unitName}. Mã và đơn vị được giữ
              nguyên để bảo toàn phạm vi và lịch sử.
            </p>
          )}
          {input("courseName", "Tên học phần", "text", {
            required: true,
            maxLength: 255,
          })}
          {input("englishName", "Tên tiếng Anh", "text", { maxLength: 255 })}
          <div className="grid gap-4 md:grid-cols-3">
            {input("credits", "Số tín chỉ", "number", {
              required: true,
              min: 0.01,
              max: 999.99,
              step: "0.01",
            })}
            {input("theoryHours", "Giờ lý thuyết", "number", {
              required: true,
              min: 0,
              max: 65535,
              step: "1",
            })}
            {input("practiceHours", "Giờ thực hành", "number", {
              required: true,
              min: 0,
              max: 65535,
              step: "1",
            })}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {input("effectiveFrom", "Ngày bắt đầu hiệu lực", "date", {
              required: true,
            })}
            {input("effectiveTo", "Ngày kết thúc hiệu lực", "date")}
          </div>
          <label className="block space-y-1 text-sm font-medium text-slate-800">
            Mô tả học phần
            <textarea
              aria-label="Mô tả học phần"
              rows={4}
              className={control}
              maxLength={15000}
              value={form.description}
              disabled={busy}
              onChange={(e) => set("description", e.target.value)}
            />
          </label>
          <p className="text-sm text-slate-600">
            Lưu ở trạng thái DRAFT. Chỉ kích hoạt khi đã đến ngày hiệu lực; bản
            mới phải bắt đầu sau bản ACTIVE hiện tại. Không tự quy đổi tín chỉ
            thành giờ.
          </p>
        </form>
      </Modal>
    </div>
  );
}
