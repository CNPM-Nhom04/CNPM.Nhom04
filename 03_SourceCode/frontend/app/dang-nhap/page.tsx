"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
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
        throw new Error(result.message);
      }
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(
        next?.startsWith("/dashboard/")
          ? next
          : "/dashboard/chuong-trinh-dao-tao",
      );
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Đăng nhập thất bại.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="min-h-screen flex justify-center items-center bg-slate-50 p-6">
      <form
        onSubmit={submit}
        className="bg-white border rounded-xl p-8 space-y-5 w-full max-w-md"
      >
        <h1 className="text-xl font-bold">Đăng nhập hệ thống</h1>
        <div>
          <label htmlFor="identifier" className="text-sm">
            Tên đăng nhập hoặc email
          </label>
          <Input
            id="identifier"
            required
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="password" className="text-sm">
            Mật khẩu
          </label>
          <Input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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
