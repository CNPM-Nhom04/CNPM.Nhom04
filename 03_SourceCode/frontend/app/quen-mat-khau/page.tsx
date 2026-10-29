"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { authRequest } from "@/lib/services/authService";
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await authRequest<{ message: string }>("forgot-password", {
        email: email.trim(),
      });
      setMessage(result.message);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể gửi yêu cầu.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border bg-white p-8 space-y-5">
        <h1 className="text-2xl font-bold">Quên mật khẩu</h1>
        <p className="text-sm text-slate-500">
          Nhập email đã đăng ký với hệ thống để nhận liên kết đặt lại mật khẩu.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <label htmlFor="email">Email đã đăng ký</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            maxLength={255}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
          />
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="text-sm text-green-700">
              {message}
            </p>
          )}
          <Button type="submit" isLoading={busy} className="w-full">
            Gửi liên kết đặt lại mật khẩu
          </Button>
        </form>
        <Link href="/dang-nhap" className="block text-sm text-blue-600">
          Quay lại đăng nhập
        </Link>
      </div>
    </main>
  );
}
 
