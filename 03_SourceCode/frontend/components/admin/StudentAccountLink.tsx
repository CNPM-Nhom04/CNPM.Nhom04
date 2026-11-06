"use client";
import { ExcelOnlyForm } from "@/components/excel/ExcelOnlyForm";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { AdminFeedback, AdminPagination } from "./AdminFeedback";
import {
  studentAccountsService,
  type StudentClass,
  type LinkAccountOption,
  type LinkProfileOption,
} from "@/lib/services/studentAccountsService";
import type { PageResult } from "@/lib/services/adminService";
const control =
  "w-full rounded border border-slate-300 bg-white p-2.5 text-sm text-slate-950 disabled:bg-slate-100";
export function StudentAccountLink({
  item,
  onClose,
  onLinked,
}: {
  item: StudentClass;
  onClose: () => void;
  onLinked: (message: string) => void;
}) {
  const [accountSearch, setAccountSearch] = useState(""),
    [accountPage, setAccountPage] = useState(1),
    [accounts, setAccounts] = useState<PageResult<LinkAccountOption> | null>(
      null,
    ),
    [account, setAccount] = useState<LinkAccountOption | null>(null);
  const [profileSearch, setProfileSearch] = useState(""),
    [profilePage, setProfilePage] = useState(1),
    [profiles, setProfiles] = useState<PageResult<LinkProfileOption> | null>(
      null,
    ),
    [profile, setProfile] = useState<LinkProfileOption | null>(null);
  const [mode, setMode] = useState("EXISTING"),
    [code, setCode] = useState(""),
    [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [loadingAccounts, setLoadingAccounts] = useState(true),
    [loadingProfiles, setLoadingProfiles] = useState(true),
    [accountError, setAccountError] = useState<Error | null>(null),
    [profileError, setProfileError] = useState<Error | null>(null),
    [error, setError] = useState<Error | null>(null),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(() => {
      studentAccountsService
        .linkAccounts(
          item.id,
          new URLSearchParams({
            page: String(accountPage),
            limit: "10",
            searchTerm: accountSearch,
          }),
          abort.signal,
        )
        .then((value) => {
          if (!abort.signal.aborted) {
            setAccounts(value);
            setAccountError(null);
            setLoadingAccounts(false);
          }
        })
        .catch((e) => {
          if (!abort.signal.aborted) {
            setAccountError(
              e instanceof Error ? e : new Error("Không tải được tài khoản."),
            );
            setLoadingAccounts(false);
          }
        });
    }, 250);
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [item.id, accountPage, accountSearch, refresh]);
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(() => {
      studentAccountsService
        .linkProfiles(
          item.id,
          new URLSearchParams({
            page: String(profilePage),
            limit: "10",
            searchTerm: profileSearch,
          }),
          abort.signal,
        )
        .then((value) => {
          if (!abort.signal.aborted) {
            setProfiles(value);
            setProfileError(null);
            setLoadingProfiles(false);
          }
        })
        .catch((e) => {
          if (!abort.signal.aborted) {
            setProfileError(
              e instanceof Error ? e : new Error("Không tải được hồ sơ."),
            );
            setLoadingProfiles(false);
          }
        });
    }, 250);
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [item.id, profilePage, profileSearch, refresh]);
  const accountOptions =
    account && !accounts?.data.some((x) => x.id === account.id)
      ? [account, ...(accounts?.data || [])]
      : accounts?.data || [];
  const profileOptions =
    profile && !profiles?.data.some((x) => x.id === profile.id)
      ? [profile, ...(profiles?.data || [])]
      : profiles?.data || [];
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy || !account || !confirmed) return;
    setBusy(true);
    setError(null);
    try {
      const result = await studentAccountsService.link(item.id, {
        userId: account.id,
        revision: item.revision,
        reason,
        confirmed,
        ...(account.studentId
          ? { studentId: account.studentId }
          : mode === "EXISTING"
            ? { studentId: profile?.id }
            : { studentCode: code }),
      });
      onLinked(result.message);
    } catch (e) {
      setError(
        e instanceof Error ? e : new Error("Không liên kết được tài khoản."),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      isOpen
      title={"Liên kết tài khoản — " + item.code}
      size="2xl"
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Đóng
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-slate-950">
        <div className="rounded border border-blue-100 bg-blue-50 p-4 leading-7">
          <strong>{item.name}</strong>
          <p>
            {item.unitName} · Khóa {item.admissionYear}
          </p>
          <p>
            {item.versionCode} · {item.trackName}
          </p>
        </div>
        <p className="leading-6">
          Dành cho tài khoản học viên đã có. Không đổi mật khẩu, email hoặc vai
          trò. Chọn đúng người và hồ sơ; không ghi đè tài khoản của người khác
          hay chuyển phân công CTĐT đang có.
        </p>
        <AdminFeedback
          error={error || accountError || profileError}
          retry={() => {
            setLoadingAccounts(true);
            setLoadingProfiles(true);
            setRefresh((v) => v + 1);
          }}
        />
        <label className="block space-y-2">
          Tìm tài khoản học viên
          <input
            aria-label="Tìm tài khoản để liên kết"
            className={control}
            value={accountSearch}
            maxLength={255}
            disabled={busy}
            onChange={(e) => {
              setAccountSearch(e.target.value);
              setAccountPage(1);
              setLoadingAccounts(true);
            }}
          />
        </label>
        <label className="block space-y-2">
          Tài khoản học viên có sẵn
          <select
            aria-label="Tài khoản học viên để liên kết"
            className={control}
            required
            disabled={busy || loadingAccounts}
            value={account?.id || ""}
            onChange={(e) => {
              setAccount(
                accountOptions.find((a) => a.id === e.target.value) || null,
              );
              setProfile(null);
              setCode("");
              setConfirmed(false);
              setError(null);
            }}
          >
            <option value="">Chọn tài khoản STUDENT đang hoạt động</option>
            {accountOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.username} — {a.fullName}
                {a.studentCode ? " — " + a.studentCode : " — Chưa có hồ sơ"}
              </option>
            ))}
          </select>
        </label>
        <AdminPagination
          meta={accounts?.meta}
          page={accountPage}
          loading={loadingAccounts || busy}
          changePage={(p) => {
            setAccountPage(p);
            setLoadingAccounts(true);
          }}
        />
        <p className="text-xs text-slate-500">
          Chỉ liệt kê tài khoản học viên không có vai trò nhân sự quản lý và
          chưa thuộc lớp quản lý. Hệ thống kiểm tra khoa, khóa và phân công khi
          lưu.
        </p>
        {account && (
          <div className="rounded border border-slate-200 p-3 leading-7">
            <strong>
              {account.username} — {account.fullName}
            </strong>
            <p>{account.email || "Chưa có email"}</p>
            {account.studentId && (
              <p>
                Hồ sơ đã liên kết: {account.studentCode} — {account.studentName}
                . Sử dụng đúng hồ sơ này, không tạo thêm.
              </p>
            )}
          </div>
        )}
        {account && !account.studentId && (
          <>
            <label className="block space-y-2">
              Cách liên kết hồ sơ
              <select
                aria-label="Cách liên kết hồ sơ"
                className={control}
                value={mode}
                disabled={busy}
                onChange={(e) => {
                  setMode(e.target.value);
                  setConfirmed(false);
                }}
              >
                <option value="EXISTING">Chọn hồ sơ học viên có sẵn</option>
                <option value="NEW">Tạo hồ sơ mới cho tài khoản này</option>
              </select>
            </label>
            {mode === "EXISTING" ? (
              <>
                <label className="block space-y-2">
                  Tìm hồ sơ chưa có tài khoản
                  <input
                    aria-label="Tìm hồ sơ để liên kết"
                    className={control}
                    maxLength={255}
                    value={profileSearch}
                    disabled={busy}
                    onChange={(e) => {
                      setProfileSearch(e.target.value);
                      setProfilePage(1);
                      setLoadingProfiles(true);
                    }}
                  />
                </label>
                <label className="block space-y-2">
                  Hồ sơ học viên có sẵn
                  <select
                    aria-label="Hồ sơ học viên để liên kết"
                    className={control}
                    required
                    value={profile?.id || ""}
                    disabled={busy || loadingProfiles}
                    onChange={(e) => {
                      setProfile(
                        profileOptions.find((p) => p.id === e.target.value) ||
                          null,
                      );
                      setConfirmed(false);
                    }}
                  >
                    <option value="">Chọn hồ sơ đúng người</option>
                    {profileOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.studentCode} — {p.fullName} — {p.admissionYear}
                      </option>
                    ))}
                  </select>
                </label>
                <AdminPagination
                  meta={profiles?.meta}
                  page={profilePage}
                  loading={loadingProfiles || busy}
                  changePage={(p) => {
                    setProfilePage(p);
                    setLoadingProfiles(true);
                  }}
                />
                <p className="text-xs leading-6 text-slate-500">
                  Chỉ có hồ sơ ACTIVE chưa gắn tài khoản, đúng khoa/khóa của lớp
                  và không bị phân công sang hướng khác.
                </p>
                {profile && (
                  <p className="rounded bg-amber-50 p-3 leading-7 text-amber-900">
                    Đối chiếu: tài khoản <strong>{account.fullName}</strong> ↔
                    hồ sơ{" "}
                    <strong>
                      {profile.studentCode} — {profile.fullName}
                    </strong>
                    . Chỉ xác nhận khi đã kiểm tra đây là cùng một người.
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="rounded bg-amber-50 p-3 leading-7 text-amber-900">
                  Hồ sơ mới dùng họ tên trong tài khoản:{" "}
                  <strong>{account.fullName}</strong>, khoa và khóa của lớp đang
                  chọn. Nếu đã có hồ sơ đúng người, hãy chọn hồ sơ có sẵn.
                </p>
              </>
            )}
          </>
        )}
        {account && (account.studentId || mode === "NEW" || profile) ? (
          <ExcelOnlyForm
            recordLabel={`${item.code} — ${account.username}`}
            recordKey={`${item.id}:${account.id}:${mode}:${profile?.id || ""}`}
            id="student-account-link"
            onSubmit={save}
            heading="Hồ sơ liên kết tài khoản bằng Excel"
            description="Tài khoản và hồ sơ đã chọn ở trên. Tải mẫu, điền căn cứ xác minh và chọn Có sau khi đã đối chiếu đúng người, đúng lớp. Chỉ sửa dòng 2."
            submitLabel="Xác nhận liên kết tài khoản vào lớp"
            showDependentStep={false}
          >
            {!account.studentId && mode === "NEW" && (
              <label className="block space-y-2">
                Mã học viên mới
                <input
                  aria-label="Mã học viên mới để liên kết"
                  className={control}
                  required
                  pattern="[A-Za-z0-9_.-]+"
                  maxLength={50}
                  disabled={busy}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setConfirmed(false);
                  }}
                />
              </label>
            )}
            <label className="block space-y-2">
              Căn cứ liên kết
              <textarea
                aria-label="Căn cứ xác minh liên kết"
                className={control}
                required
                maxLength={1000}
                rows={2}
                value={reason}
                disabled={busy}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ví dụ: đã đối chiếu mã học viên và danh sách lớp được bàn giao"
              />
            </label>
            <label className="flex items-start gap-3 leading-6">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmed}
                disabled={busy}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Tôi đã xác minh tài khoản, hồ sơ và lớp/CTĐT này thuộc đúng học
              viên.
            </label>
          </ExcelOnlyForm>
        ) : (
          <p className="rounded bg-slate-50 p-3">
            Chọn tài khoản học viên và cách liên kết hồ sơ để tải mẫu Excel.
          </p>
        )}
      </div>
    </Modal>
  );
}
