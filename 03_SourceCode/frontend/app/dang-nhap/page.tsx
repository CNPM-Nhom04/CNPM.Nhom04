"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
      const result = await response.json();
      if (result.user?.mustChangePassword) {
        router.replace("/doi-mat-khau");
      } else {
        const next = new URLSearchParams(window.location.search).get("next");
        let target =
          result.user?.role === "ADMIN"
            ? "/dashboard/admin/nguoi-dung"
            : "/dashboard";
        if (next) {
          try {
            const parsed = new URL(next, window.location.origin);
            if (
              parsed.origin === window.location.origin &&
              (parsed.pathname === "/dashboard" ||
                parsed.pathname.startsWith("/dashboard/") ||
                parsed.pathname === "/doi-mat-khau")
            )
              target = parsed.pathname + parsed.search;
          } catch {
            /* Invalid return URLs use the default authorized landing page. */
          }
        }
        router.replace(target);
      }
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Không thể đăng nhập.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-5 rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Đăng nhập</h1>
          <p className="mt-2 text-sm text-slate-500">
            Đăng nhập tài khoản hệ thống để sử dụng các chức năng được phân
            quyền.
          </p>
        </div>
        <div className="space-y-2">
          <label htmlFor="identifier" className="text-sm font-medium">
            Tên đăng nhập hoặc email
          </label>
          <input
            id="identifier"
            autoComplete="username"
            required
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            Mật khẩu
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <Link
          href="/quen-mat-khau"
          className="block text-sm text-blue-600 underline"
        >
          Quên mật khẩu?
        </Link>
        <Button type="submit" isLoading={loading} className="w-full">
          Đăng nhập
        </Button>
      </form>
    </main>
  );
}
