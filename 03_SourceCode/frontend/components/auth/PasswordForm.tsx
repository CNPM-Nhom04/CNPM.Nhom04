"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { authRequest } from "@/lib/services/authService";
const inputStyle = "w-full rounded-lg border border-slate-300 px-3 py-2";
export function PasswordForm({
  mode,
  token = "",
  minimum = 10,
}: {
  mode: "change" | "reset";
  token?: string;
  minimum?: number;
}) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Xác nhận mật khẩu không khớp.");
      return;
    }
    if (new TextEncoder().encode(newPassword).length > 72) {
      setError("Mật khẩu tối đa 72 byte UTF-8.");
      return;
    }
    setBusy(true);
    try {
      const result = await authRequest<{ message: string }>(
        mode === "change" ? "change-password" : "reset-password",
        {
          newPassword,
          confirmPassword,
          ...(mode === "change" ? { oldPassword } : { token }),
        },
      );
      setMessage(result.message);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể thay đổi mật khẩu.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (mode === "reset" && !/^[a-f0-9]{64}$/i.test(token))
    return (
      <div role="alert">
        Liên kết không hợp lệ.{" "}
        <Link href="/quen-mat-khau" className="text-blue-600 underline">
          Yêu cầu liên kết mới
        </Link>
      </div>
    );
  if (message)
    return (
      <div className="space-y-4">
        <p role="status" className="text-green-700">
          {message}
        </p>
        <Link href="/dang-nhap" className="text-blue-600 underline">
          Đăng nhập lại
        </Link>
      </div>
    );
  return (
    <form onSubmit={submit} className="space-y-4">
      {mode === "change" && (
        <div>
          <label htmlFor="oldPassword">Mật khẩu hiện tại</label>
          <input
            id="oldPassword"
            type="password"
            autoComplete="current-password"
            required
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className={inputStyle}
          />
        </div>
      )}
      <div>
        <label htmlFor="newPassword">Mật khẩu mới</label>
        <input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={minimum}
          maxLength={72}
          pattern="(?=.*[A-Za-z])(?=.*[0-9]).+"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputStyle}
        />
      </div>
      <div>
        <label htmlFor="confirmPassword">Xác nhận mật khẩu mới</label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          maxLength={72}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputStyle}
        />
      </div>
      <p className="text-sm text-slate-500">
        Ít nhất {minimum} ký tự, có chữ và số. Sau khi đổi mật khẩu, các phiên
        đăng nhập cũ sẽ hết hiệu lực.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <Button type="submit" isLoading={busy} className="w-full">
        {mode === "change" ? "Đổi mật khẩu" : "Đặt lại mật khẩu"}
      </Button>
      {mode === "reset" && (
        <Link href="/quen-mat-khau" className="block text-sm text-blue-600">
          Yêu cầu liên kết mới
        </Link>
      )}
    </form>
  );
}
