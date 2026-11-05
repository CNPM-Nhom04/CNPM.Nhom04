"use client";
import { useState } from "react";
import Link from "next/link";
import type { PublicProgramDetail as Detail } from "@/lib/services/portalService";
export function PublicProgramDetail({ program }: { program: Detail }) {
  const [active, setActive] = useState(program.tracks[0]?.id || "");
  const track = program.tracks.find((t) => t.id === active);
  return (
    <>
      <div className="grid gap-4 border-y border-slate-200 py-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Bậc đào tạo", program.levelName],
          ["Ngành", program.majorName],
          ["Đơn vị quản lý", program.unitName],
          ["Phiên bản", program.versionCode],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
              {label}
            </p>
            <p className="font-semibold leading-6">{value}</p>
          </div>
        ))}
      </div>
      {program.description && (
        <p className="mt-7 whitespace-pre-line text-sm leading-8 text-slate-600">
          {program.description}
        </p>
      )}
      <dl className="my-8 grid gap-3 text-sm sm:grid-cols-2">
        {[
          [
            "Niên khóa",
            program.cohortYear ? String(program.cohortYear) : "Chưa công bố",
          ],
          ["Thời gian đào tạo", program.duration],
          ["Số quyết định", program.decisionNumber],
          ["Ngày ban hành", program.decisionDate],
          ["Hiệu lực từ", program.effectiveFrom],
          ["Hiệu lực đến", program.effectiveTo],
        ].map(([name, value]) => (
          <div className="flex gap-3" key={name}>
            <dt className="min-w-32 text-slate-500">{name}</dt>
            <dd>{value || "Chưa có thông tin"}</dd>
          </div>
        ))}
      </dl>
      {program.sourceUrl && (
        <section className="mb-8 rounded-xl border bg-emerald-50/50 p-5 space-y-3 text-sm">
          <h2 className="font-bold">Chương trình công bố trên AGU</h2>
          {program.sourceTotalCredits != null && (
            <p>
              Tổng tín chỉ theo nguồn:{" "}
              <strong>{program.sourceTotalCredits} TC</strong>.
            </p>
          )}
          <div className="flex gap-4 text-emerald-800 underline">
            <a href={program.sourceUrl} target="_blank" rel="noreferrer">
              Xem nội dung gốc
            </a>
            {program.sourceDocumentUrl && (
              <a
                href={program.sourceDocumentUrl}
                target="_blank"
                rel="noreferrer"
              >
                Mở tài liệu CTĐT
              </a>
            )}
          </div>
        </section>
      )}
      <h2 className="mb-5 text-2xl font-bold">Khung chương trình đào tạo</h2>
      <div
        className="mb-6 flex flex-wrap gap-3"
        role="group"
        aria-label="Chọn hướng đào tạo"
      >
        {program.tracks.map((t) => (
          <button
            key={t.id}
            aria-pressed={active === t.id}
            onClick={() => setActive(t.id)}
            className={
              "rounded border px-5 py-3 text-sm font-semibold " +
              (active === t.id
                ? "border-emerald-700 bg-emerald-700 text-white"
                : "border-slate-200 bg-white text-slate-700")
            }
          >
            {t.name}
          </button>
        ))}
      </div>
      {track ? (
        <>
          <p className="mb-4 rounded border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
            Định mức hướng: <strong>{track.credits} tín chỉ</strong>. Danh sách
            có thể gồm nhiều môn tự chọn; tổng tín chỉ danh sách có thể lớn hơn
            định mức.
          </p>
          <div className="mb-6 flex flex-wrap gap-3">
            {track.groups.map((g) => (
              <div
                key={g.id}
                className="border border-slate-200 px-4 py-3 text-sm"
              >
                <strong>
                  {g.code} — {g.name}
                </strong>
                <p className="mt-1 text-xs text-slate-500">
                  Tối thiểu {g.minimumCredits} TC
                  {g.maximumCredits != null
                    ? " · Tối đa " + g.maximumCredits + " TC"
                    : ""}
                </p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto border border-slate-200">
            <table className="w-full min-w-[750px] text-left text-sm">
              <thead className="bg-[#f2f6ef]">
                <tr>
                  {[
                    "Mã học phần",
                    "Tên học phần",
                    "TC",
                    "Nhóm",
                    "Tính chất",
                    "Học kỳ",
                    "Tiên quyết",
                  ].map((h) => (
                    <th className="p-4" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {track.courses.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="p-4 font-semibold text-emerald-800">
                      {c.code}
                    </td>
                    <td className="p-4">
                      {c.name}
                      <p className="mt-1 text-xs text-slate-500">
                        v{c.versionNo} · LT {c.theoryHours} / TH{" "}
                        {c.practiceHours} tiết
                      </p>
                    </td>
                    <td className="p-4">{c.credits}</td>
                    <td className="p-4">{c.groupCode}</td>
                    <td className="p-4">
                      {c.requirementType === "REQUIRED"
                        ? "Bắt buộc"
                        : "Tự chọn"}
                    </td>
                    <td className="p-4">{c.semester ?? "Chưa xếp"}</td>
                    <td className="p-4">{c.prerequisites || "—"}</td>
                  </tr>
                ))}
                {!track.courses.length && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      Chưa có học phần trong hướng này.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="border border-dashed border-slate-200 p-6 text-slate-500">
          Chưa có hướng đào tạo đang hoạt động được công bố.
        </p>
      )}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 bg-[#f2f6ef] p-6">
        <div>
          <h2 className="font-bold">Bạn cần thêm thông tin về chương trình?</h2>
          <p className="mt-2 text-sm text-slate-500">
            Đăng ký để được liên hệ và tư vấn.
          </p>
        </div>
        <Link
          href="/dang-ky-thong-tin"
          className="rounded bg-emerald-700 px-5 py-3 text-sm font-semibold text-white"
        >
          Đăng ký nhận thông tin
        </Link>
      </div>
    </>
  );
}
