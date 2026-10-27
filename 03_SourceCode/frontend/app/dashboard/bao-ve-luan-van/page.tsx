"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Award, Search, Plus, CheckCircle2, Clock, Eye } from "lucide-react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import {
  thesisDefenseService as api,
  DefenseApiError,
  type DefenseItem,
  type DefenseList,
  type DefenseInput,
  type DefenseStatus,
  type StudentOption,
} from "@/lib/services/thesisDefenseService";

const emptyForm: DefenseInput = {
  maHocVien: "",
  tenDeTai: "",
  ngayBaoVe: "",
  diaDiem: "",
  chuTichHoidong: "",
  phanBien: "",
  thuKy: "",
};
const fieldClass =
  "w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

function Feedback({
  error,
  message,
  retry,
}: {
  error?: Error | null;
  message?: string;
  retry?: () => void;
}) {
  if (!error && !message) return null;
  return (
    <div
      role={error ? "alert" : "status"}
      className={`rounded-lg border p-4 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
    >
      <p>{error?.message || message}</p>
      {error instanceof DefenseApiError && [401, 403].includes(error.status) ? (
        <Link
          href="/dang-nhap?next=/dashboard/bao-ve-luan-van"
          className="mt-2 inline-block font-semibold underline"
        >
          Đăng nhập tài khoản có quyền bảo vệ luận văn
        </Link>
      ) : error && retry ? (
        <Button variant="outline" size="sm" onClick={retry} className="mt-2">
          Thử lại
        </Button>
      ) : null}
    </div>
  );
}
function StatusBadge({ status }: { status: DefenseStatus }) {
  if (status === "DA_DAT")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        Đã đạt
      </span>
    );
  if (status === "CHUA_DAT")
    return (
      <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
        Chưa đạt
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
      <Clock className="h-3 w-3" />
      Chờ bảo vệ
    </span>
  );
}

export default function BaoVeLuanVanPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<DefenseList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [message, setMessage] = useState("");
  const [version, setVersion] = useState(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [formData, setFormData] = useState<DefenseInput>({ ...emptyForm });
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(
    null,
  );
  const [studentSearch, setStudentSearch] = useState("");
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState<Error | null>(null);
  const [studentsVersion, setStudentsVersion] = useState(0);
  const [selectedItem, setSelectedItem] = useState<DefenseItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<Error | null>(null);
  const [score, setScore] = useState("");

  function refresh() {
    setLoading(true);
    setVersion((value) => value + 1);
  }

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      api
        .list(searchTerm.trim(), selectedStatus, page, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          if (page > 1 && page > result.meta.totalPages) {
            setPage(Math.max(1, result.meta.totalPages));
            return;
          }
          setList(result);
          setError(null);
          setLoading(false);
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) {
            setList(null);
            setError(
              reason instanceof Error
                ? reason
                : new Error("Không thể tải lịch bảo vệ."),
            );
            setLoading(false);
          }
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchTerm, selectedStatus, page, version]);

  useEffect(() => {
    if (!isAddModalOpen) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      api
        .students(studentSearch.trim(), controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) {
            setStudents(result.data);
            setStudentsError(null);
          }
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted)
            setStudentsError(
              reason instanceof Error
                ? reason
                : new Error("Không thể tải học viên."),
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setStudentsLoading(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isAddModalOpen, studentSearch, studentsVersion]);

  function openAdd() {
    setFormData({ ...emptyForm });
    setSelectedStudent(null);
    setStudentSearch("");
    setStudents([]);
    setStudentsLoading(true);
    setStudentsError(null);
    setModalError(null);
    setIsAddModalOpen(true);
    setMessage("");
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !selectedStudent) return;
    setSaving(true);
    setModalError(null);
    setMessage("");
    try {
      await api.create(formData);
      setIsAddModalOpen(false);
      setMessage("Lập lịch bảo vệ thành công.");
      if (page !== 1) setPage(1);
      refresh();
    } catch (reason) {
      setModalError(
        reason instanceof Error
          ? reason
          : new Error("Không thể lưu lịch bảo vệ."),
      );
    } finally {
      setSaving(false);
    }
  }
  async function openDetail(id: string) {
    setDetailLoading(true);
    setSelectedItem(null);
    setModalError(null);
    setScore("");
    setIsDetailModalOpen(true);
    try {
      setSelectedItem(await api.detail(id));
    } catch (reason) {
      setModalError(
        reason instanceof Error ? reason : new Error("Không thể tải chi tiết."),
      );
    } finally {
      setDetailLoading(false);
    }
  }
  async function saveResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedItem || saving || score === "") return;
    if (
      !confirm(
        "Xác nhận ghi kết quả bảo vệ? Kết quả đã ghi không thể sửa từ giao diện này.",
      )
    )
      return;
    setSaving(true);
    setModalError(null);
    try {
      setSelectedItem(await api.result(selectedItem.id, Number(score)));
      setMessage("Đã ghi nhận kết quả bảo vệ.");
      refresh();
    } catch (reason) {
      setModalError(
        reason instanceof Error ? reason : new Error("Không thể ghi kết quả."),
      );
    } finally {
      setSaving(false);
    }
  }
  const rows = loading || error ? [] : (list?.data ?? []);
  const permissions = list?.permissions;
  const formFields: {
    key: Exclude<keyof DefenseInput, "maHocVien">;
    label: string;
    type?: string;
    required: boolean;
    max: number;
  }[] = [
    {
      key: "tenDeTai",
      label: "Tên đề tài luận văn / luận án",
      required: true,
      max: 1000,
    },
    {
      key: "ngayBaoVe",
      label: "Ngày tổ chức bảo vệ",
      type: "date",
      required: true,
      max: 10,
    },
    { key: "diaDiem", label: "Địa điểm (phòng họp)", required: true, max: 255 },
    {
      key: "chuTichHoidong",
      label: "Chủ tịch hội đồng",
      required: true,
      max: 255,
    },
    { key: "phanBien", label: "Phản biện", required: false, max: 255 },
    { key: "thuKy", label: "Thư ký hội đồng", required: false, max: 255 },
  ];

  return (
    <div className="space-y-6 pb-16">
      <Feedback error={error} message={message} retry={refresh} />
      <div className="bg-white px-6 py-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-950 flex items-center gap-2">
            <Award className="h-6 w-6 text-blue-600" />
            Quản Lý Hội Đồng & Bảo Vệ Luận Văn / Luận Án
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Lập lịch hội đồng đánh giá, phân công phản biện và ghi nhận kết quả
            bảo vệ của học viên SĐH
          </p>
        </div>
        <Button
          onClick={openAdd}
          disabled={loading || !!error || !permissions?.canSchedule}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm Lịch Bảo Vệ Mới
        </Button>
      </div>
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            aria-label="Tìm lịch bảo vệ"
            maxLength={255}
            placeholder="Tìm theo mã, tên học viên, tên đề tài..."
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setPage(1);
              setLoading(true);
            }}
            className={fieldClass + " pl-10"}
          />
        </div>
        <select
          aria-label="Trạng thái bảo vệ"
          value={selectedStatus}
          onChange={(event) => {
            setSelectedStatus(event.target.value);
            setPage(1);
            setLoading(true);
          }}
          className={fieldClass + " md:w-64"}
        >
          <option value="ALL">Tất cả trạng thái bảo vệ</option>
          <option value="CHO_BAO_VE">Chờ bảo vệ</option>
          <option value="DA_DAT">Đã bảo vệ thành công</option>
          <option value="CHUA_DAT">Chưa đạt</option>
        </select>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                <th className="px-5 py-3.5">Mã HV</th>
                <th className="px-5 py-3.5">Học viên & Chuyên ngành</th>
                <th className="px-5 py-3.5">Tên đề tài nghiên cứu</th>
                <th className="px-4 py-3.5 text-center">Ngày bảo vệ</th>
                <th className="px-5 py-3.5 text-center">Trạng thái</th>
                <th className="px-5 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody aria-busy={loading} className="divide-y divide-slate-100">
              {rows.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80">
                  <td className="px-5 py-4 font-bold text-blue-600">
                    {item.maHocVien}
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-900">
                      {item.hoTen}
                    </div>
                    <div className="text-xs text-slate-400">
                      {item.chuyenNganh}
                    </div>
                  </td>
                  <td className="max-w-sm px-5 py-4 text-slate-800 text-xs">
                    {item.tenDeTai}
                  </td>
                  <td className="px-4 py-4 text-center text-xs">
                    {item.ngayBaoVe}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <StatusBadge status={item.trangThai} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={detailLoading}
                      onClick={() => openDetail(item.id)}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Chi tiết
                    </Button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td
                    colSpan={6}
                    role="status"
                    className="px-5 py-12 text-center text-slate-400"
                  >
                    {loading
                      ? "Đang tải lịch bảo vệ..."
                      : error
                        ? "Không thể tải lịch bảo vệ."
                        : "Không tìm thấy lịch bảo vệ phù hợp."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <span>
          {loading
            ? "Đang tải..."
            : `Tổng ${list?.meta.total ?? 0} lịch bảo vệ`}
        </span>
        <div className="flex items-center gap-3">
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
            Trang {list?.meta.totalPages ? page : 0} /{" "}
            {list?.meta.totalPages ?? 0}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={
              loading || !!error || page >= (list?.meta.totalPages ?? 0)
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
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          if (!saving) setIsAddModalOpen(false);
        }}
        title="Lập Lịch Bảo Vệ Luận Văn / Luận Án SĐH"
        description="Chọn học viên đang có CTĐT SĐH và khai báo thông tin hội đồng"
        size="xl"
        footer={
          <>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setIsAddModalOpen(false)}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              form="baove-form"
              isLoading={saving}
              disabled={!selectedStudent}
            >
              Lưu Lịch Bảo Vệ
            </Button>
          </>
        }
      >
        <form id="baove-form" onSubmit={save} className="space-y-4">
          <Feedback error={modalError} />
          <Feedback
            error={studentsError}
            retry={() => {
              setStudentsLoading(true);
              setStudentsVersion((value) => value + 1);
            }}
          />
          <fieldset disabled={saving} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="student-search"
                className="text-xs font-bold text-slate-700"
              >
                Tìm học viên theo mã hoặc tên
              </label>
              <input
                id="student-search"
                maxLength={255}
                value={studentSearch}
                onChange={(event) => {
                  setStudentSearch(event.target.value);
                  setStudentsLoading(true);
                }}
                className={fieldClass}
                placeholder="Nhập mã hoặc tên để tìm học viên..."
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="student"
                className="text-xs font-bold text-slate-700"
              >
                Mã học viên
              </label>
              <select
                id="student"
                required
                value={formData.maHocVien}
                disabled={studentsLoading || !!studentsError}
                onChange={(event) => {
                  const student =
                    students.find(
                      (item) => item.maHocVien === event.target.value,
                    ) ?? null;
                  setSelectedStudent(student);
                  setFormData({
                    ...formData,
                    maHocVien: student?.maHocVien ?? "",
                  });
                }}
                className={fieldClass}
              >
                <option value="">
                  {studentsLoading ? "Đang tải học viên..." : "Chọn học viên"}
                </option>
                {selectedStudent &&
                  !students.some(
                    (student) =>
                      student.maHocVien === selectedStudent.maHocVien,
                  ) && (
                    <option value={selectedStudent.maHocVien}>
                      {selectedStudent.maHocVien} — {selectedStudent.hoTen}
                    </option>
                  )}
                {students.map((student) => (
                  <option key={student.maHocVien} value={student.maHocVien}>
                    {student.maHocVien} — {student.hoTen}
                  </option>
                ))}
              </select>
              {!studentsLoading && !studentsError && !students.length && (
                <p className="text-xs text-slate-500">
                  Không có học viên phù hợp chưa lập lịch. Thử tìm theo mã/tên
                  hoặc kiểm tra việc gán CTĐT.
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="student-name"
                  className="text-xs font-bold text-slate-700"
                >
                  Họ và tên học viên
                </label>
                <input
                  id="student-name"
                  readOnly
                  value={selectedStudent?.hoTen ?? ""}
                  className={fieldClass + " bg-slate-50"}
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="student-program"
                  className="text-xs font-bold text-slate-700"
                >
                  Chuyên ngành
                </label>
                <input
                  id="student-program"
                  readOnly
                  value={selectedStudent?.chuyenNganh ?? ""}
                  className={fieldClass + " bg-slate-50"}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {formFields.map((field) => (
                <div
                  key={field.key}
                  className={
                    "space-y-1.5 " +
                    (field.key === "tenDeTai" ? "md:col-span-2" : "")
                  }
                >
                  <label
                    htmlFor={field.key}
                    className="text-xs font-bold text-slate-700"
                  >
                    {field.label}
                    {!field.required && " (tùy chọn)"}
                  </label>
                  <input
                    id={field.key}
                    type={field.type || "text"}
                    required={field.required}
                    maxLength={field.max}
                    value={formData[field.key]}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        [field.key]: event.target.value,
                      })
                    }
                    className={fieldClass}
                  />
                </div>
              ))}
            </div>
          </fieldset>
        </form>
      </Modal>
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          if (!saving) setIsDetailModalOpen(false);
        }}
        title="Thông Tin Hội Đồng & Kết Quả Bảo Vệ"
        description={
          selectedItem
            ? `Học viên: ${selectedItem.hoTen} (${selectedItem.maHocVien})`
            : "Đang tải thông tin hội đồng"
        }
        size="lg"
      >
        <div className="space-y-4 text-sm">
          <Feedback error={modalError} />
          {detailLoading && <p role="status">Đang tải chi tiết...</p>}
          {selectedItem && (
            <>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div>
                  <span className="text-slate-500 text-xs block">
                    Đề tài nghiên cứu:
                  </span>
                  <span className="font-bold">{selectedItem.tenDeTai}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-2">
                  <div>
                    <span className="text-slate-500 text-xs block">
                      Ngày tổ chức:
                    </span>
                    {selectedItem.ngayBaoVe}
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs block">
                      Địa điểm:
                    </span>
                    {selectedItem.diaDiem}
                  </div>
                </div>
              </div>
              <h4 className="font-bold text-slate-800 uppercase text-xs">
                Thành phần hội đồng đánh giá
              </h4>
              <dl className="rounded-lg border border-slate-200 p-3 space-y-2">
                <div className="flex justify-between gap-3">
                  <dt>Chủ tịch:</dt>
                  <dd className="font-semibold">
                    {selectedItem.chuTichHoidong}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Phản biện:</dt>
                  <dd className="font-semibold">
                    {selectedItem.phanBien || "Chưa phân công"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Thư ký:</dt>
                  <dd className="font-semibold">
                    {selectedItem.thuKy || "Chưa phân công"}
                  </dd>
                </div>
              </dl>
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between gap-3">
                <div>
                  <span className="text-blue-900 font-bold block">
                    Điểm trung bình hội đồng
                  </span>
                  <span className="text-xs text-blue-700">
                    Đạt yêu cầu tối thiểu ≥ {selectedItem.diemDat} điểm
                  </span>
                </div>
                <span className="text-xl font-bold text-blue-600">
                  {selectedItem.diemTrungBinh !== null
                    ? selectedItem.diemTrungBinh + " / 10"
                    : "Chưa chấm điểm"}
                </span>
              </div>
              <StatusBadge status={selectedItem.trangThai} />
              {selectedItem.trangThai === "CHO_BAO_VE" &&
                permissions?.canRecord && (
                  <form
                    onSubmit={saveResult}
                    className="space-y-3 border-t border-slate-200 pt-4"
                  >
                    <label
                      htmlFor="defense-score"
                      className="block font-semibold"
                    >
                      Ghi nhận điểm trung bình (0–10)
                    </label>
                    <input
                      id="defense-score"
                      type="number"
                      min="0"
                      max="10"
                      step="0.01"
                      required
                      disabled={saving}
                      value={score}
                      onChange={(event) => setScore(event.target.value)}
                      className={fieldClass}
                    />
                    <p className="text-xs text-slate-500">
                      Chỉ ghi kết quả từ ngày tổ chức bảo vệ. Kết quả được xác
                      nhận một lần.
                    </p>
                    <Button type="submit" isLoading={saving}>
                      Lưu Kết Quả Bảo Vệ
                    </Button>
                  </form>
                )}
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
