"use client";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { AdminFeedback, AdminPagination } from "./AdminFeedback";
import {
  studentAccountsService,
  type StudentClass,
  type ClassMember,
} from "@/lib/services/studentAccountsService";
import type { PageResult } from "@/lib/services/adminService";
export function StudentClassMembers({
  item,
  onClose,
}: {
  item: StudentClass;
  onClose: () => void;
}) {
  const [data, setData] = useState<PageResult<ClassMember> | null>(null),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(true),
    [error, setError] = useState<Error | null>(null),
    [version, setVersion] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(() => {
      studentAccountsService
        .members(
          item.id,
          new URLSearchParams({
            searchTerm: search,
            page: String(page),
            limit: "20",
          }),
          abort.signal,
        )
        .then((result) => {
          if (!abort.signal.aborted) {
            setData(result);
            setError(null);
            setBusy(false);
          }
        })
        .catch((e) => {
          if (!abort.signal.aborted) {
            setError(
              e instanceof Error ? e : new Error("Không tải được học viên."),
            );
            setBusy(false);
          }
        });
    }, 250);
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [item.id, search, page, version]);
  return (
    <Modal
      isOpen
      title={"Học viên lớp " + item.code}
      size="2xl"
      onClose={onClose}
    >
      <div className="space-y-4 text-sm text-slate-950">
        <p>
          {item.name} · {item.versionCode} · {item.trackName} · Khóa{" "}
          {item.admissionYear}
        </p>
        <input
          aria-label="Tìm học viên trong lớp"
          className="w-full rounded border border-slate-300 p-2.5"
          value={search}
          placeholder="Tìm mã, tên học viên hoặc tên đăng nhập..."
          maxLength={255}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
            setBusy(true);
          }}
        />
        <AdminFeedback
          error={error}
          retry={() => {
            setBusy(true);
            setVersion((v) => v + 1);
          }}
        />
        {busy ? (
          <p role="status">Đang tải học viên...</p>
        ) : (
          !error && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    {[
                      "Mã / Họ tên",
                      "Tài khoản / Email",
                      "Phân công hiện tại",
                      "Trạng thái",
                    ].map((h) => (
                      <th key={h} className="p-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.data.map((row) => (
                    <tr
                      key={row.studentId}
                      className="border-t border-slate-100"
                    >
                      <td className="p-3">
                        <strong>{row.studentCode}</strong>
                        <p className="mt-1">{row.fullName}</p>
                      </td>
                      <td className="p-3">
                        {row.username || "Chưa có tài khoản"}
                        <p className="mt-1 text-slate-500">{row.email}</p>
                      </td>
                      <td className="p-3">
                        {row.versionCode || "Chưa phân công"}
                        <p className="mt-1">{row.trackName}</p>
                        {!row.assignmentMatchesClass && (
                          <p className="mt-1 text-amber-800">
                            Phân công hiện tại khác lớp quản lý.
                          </p>
                        )}
                      </td>
                      <td className="p-3">
                        {row.accountStatus || "—"}
                        <p className="mt-1 text-slate-500">
                          {row.mustChangePassword
                            ? "Cần đổi mật khẩu lần đầu"
                            : "Không bắt buộc đổi mật khẩu"}
                        </p>
                      </td>
                    </tr>
                  ))}
                  {!data?.data.length && (
                    <tr>
                      <td
                        className="p-6 text-center text-slate-500"
                        colSpan={4}
                      >
                        Chưa có học viên phù hợp.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )
        )}
        <AdminPagination
          meta={data?.meta}
          page={page}
          loading={busy}
          changePage={(p) => {
            setPage(p);
            setBusy(true);
          }}
        />
        <p className="text-xs leading-6 text-slate-500">
          Mật khẩu không được lưu dạng đọc được và không hiển thị tại danh sách
          này. Học viên dùng chức năng quên mật khẩu qua email nếu cần đặt lại.
        </p>
      </div>
    </Modal>
  );
}
