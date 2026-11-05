import Link from "next/link";
import { ArrowUpRight, Building2 } from "lucide-react";
import type { PublicProgram } from "@/lib/services/portalService";
export function ProgramCard({
  program,
  index = 0,
}: {
  program: PublicProgram;
  index?: number;
}) {
  return (
    <article className="group flex h-full flex-col border border-slate-200 bg-white transition-colors hover:border-emerald-500">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">
          {program.levelName}
        </span>
        <span className="text-xs text-slate-500">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="text-xs font-semibold text-slate-500">
          {program.sourceMajorCode || program.code} · {program.versionCode}
        </p>
        <h3 className="mb-4 mt-3 text-xl font-bold leading-8 text-slate-900">
          <Link
            href={"/chuong-trinh-dao-tao/" + program.id}
            className="hover:text-emerald-700"
          >
            {program.name}
          </Link>
        </h3>
        <p className="mb-5 flex items-start gap-2 text-sm leading-6 text-slate-600">
          <Building2 size={17} className="mt-1 shrink-0" />
          {program.unitName}
        </p>
        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="text-sm text-slate-500">
            {program.cohortYear
              ? `Khóa ${program.cohortYear}`
              : "Chưa công bố niên khóa"}
          </span>
          <Link
            aria-label={"Xem chương trình " + program.name}
            href={"/chuong-trinh-dao-tao/" + program.id}
            className="flex items-center gap-2 text-sm font-bold text-emerald-700"
          >
            Xem chi tiết <ArrowUpRight size={18} />
          </Link>
        </div>
      </div>
    </article>
  );
}
