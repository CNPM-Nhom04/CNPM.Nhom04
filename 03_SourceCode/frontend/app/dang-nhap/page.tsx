"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || "Đăng nhập thất bại.");
      }
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(
        next?.startsWith("/dashboard/") ? next : "/dashboard/bao-ve-luan-van",
      );
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể đăng nhập.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-5 rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <h1 className="text-2xl font-bold text-slate-900">Đăng nhập</h1>
        <p className="text-sm text-slate-500">
          Sử dụng tài khoản cán bộ đào tạo, hội đồng hoặc quản trị viên.
        </p>
        <div className="space-y-2">
          <label htmlFor="identifier">Tên đăng nhập hoặc email</label>
          <input
            id="identifier"
            required
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            className="w-full rounded-lg border border-slate-300 p-2"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="password">Mật khẩu</label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-300 p-2"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <Button type="submit" isLoading={loading} className="w-full">
          Đăng nhập
        </Button>
      </form>
    </main>
  );
}
