"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  FileCheck,
  Users,
  UploadCloud,
} from "lucide-react";
import { Button, Input, Badge } from "@/components/ui";
import { ProgramFeedback } from "@/components/programs/ProgramFeedback";
import {
  programService,
  type ProgramRecord,
  type ReviewInput,
} from "@/lib/services/programService";
const blank: ReviewInput = {
  hoiDongThamDinh: "",
  chuTichHoidong: "",
  thuKhao: "",
  ngayHop: "",
  ketLuan: "DAT_DIEU_KIEN",
  yKienDongGop: "",
  soBienBan: "",
};
export default function ProgramReviewPage() {
  const { id } = useParams<{ id: string }>(),
    router = useRouter(),
    fileInput = useRef<HTMLInputElement>(null);
  const [program, setProgram] = useState<ProgramRecord | null>(null),
    [form, setForm] = useState<ReviewInput>({ ...blank });
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState<Error | null>(null),
    [message, setMessage] = useState(""),
    [version, setVersion] = useState(0),
    [file, setFile] = useState<File | null>(null);
  const canReview =
    !!program?.permissions.canApprove &&
    ["SUBMITTED", "REVIEWING"].includes(program.status);
  useEffect(() => {
    const controller = new AbortController();
    programService
      .detail(id, controller.signal)
      .then((item) => {
        if (!controller.signal.aborted) {
          setProgram(item);
          setError(null);
          if (item.review) setForm(item.review);
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason
              : new Error("Không thể tải hồ sơ."),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, version]);
  function chooseFile(candidate: File | undefined) {
    setError(null);
    setMessage("");
    if (!candidate) return;
    if (
      candidate.size === 0 ||
      candidate.size > 25 * 1024 * 1024 ||
      !/[.](pdf|docx)$/i.test(candidate.name)
    ) {
      setError(new Error("Chỉ nhận PDF/DOCX có nội dung, tối đa 25MB."));
      return;
    }
    setFile(candidate);
  }
  async function upload() {
    if (!program || !file || !canReview) return;
    setUploading(true);
    setError(null);
    setMessage("");
    try {
      const document = await programService.upload(program.id, file);
      setProgram((current) =>
        current
          ? { ...current, documents: [...current.documents, document] }
          : null,
      );
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setMessage("Đã tải tài liệu lên hồ sơ.");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason : new Error("Không thể tải file."),
      );
    } finally {
      setUploading(false);
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!program || saving || uploading || !canReview) return;
    if (file) {
      setError(new Error("Hãy tải tệp đã chọn lên trước khi lưu kết luận."));
      return;
    }
    if (
      !confirm(
        form.ketLuan === "DAT_DIEU_KIEN"
          ? "Phê duyệt và ban hành CTĐT? Phiên bản sẽ được khóa chỉnh sửa."
          : "Xác nhận trả hồ sơ về để chỉnh sửa?",
      )
    )
      return;
    setSaving(true);
    setError(null);
    try {
      await programService.review(program, form);
      router.push("/dashboard/chuong-trinh-dao-tao");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason : new Error("Không thể lưu kết luận."),
      );
    } finally {
      setSaving(false);
    }
  }
  const textFields: {
    key: Exclude<keyof ReviewInput, "ketLuan" | "yKienDongGop">;
    label: string;
    required: boolean;
    type?: string;
    max: number;
  }[] = [
    {
      key: "hoiDongThamDinh",
      label: "Tên hội đồng / ban thẩm định",
      required: true,
      max: 255,
    },
    {
      key: "chuTichHoidong",
      label: "Chủ tịch hội đồng",
      required: true,
      max: 255,
    },
    { key: "thuKhao", label: "Thư ký khoa học", required: true, max: 255 },
    {
      key: "soBienBan",
      label: "Số biên bản họp hội đồng",
      required: false,
      max: 150,
    },
    {
      key: "ngayHop",
      label: "Ngày tổ chức thẩm định",
      required: true,
      type: "date",
      max: 10,
    },
  ];
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      <div className="bg-white p-5 rounded-xl border flex justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Quay lại
          </Button>
          <div>
            <h1 className="text-lg font-bold">Xét Duyệt & Thẩm Định CTĐT</h1>
            <p className="text-xs text-slate-500">
              {program?.maCTDT} — {program?.tenCTDT}
            </p>
          </div>
        </div>
        {program && <Badge variant="pending">{program.statusLabel}</Badge>}
      </div>
      <ProgramFeedback
        error={error}
        message={message}
        retry={() => {
          setLoading(true);
          setVersion((value) => value + 1);
        }}
      />
      {loading && <p role="status">Đang tải hồ sơ...</p>}
      {!loading && program && !canReview && (
        <p className="text-sm text-amber-700">
          Hồ sơ không ở trạng thái được xét duyệt hoặc bạn không có quyền xét
          duyệt. Người gửi không được tự duyệt hồ sơ.
        </p>
      )}
      {program && (
        <Link
          className="inline-block text-sm text-blue-600 underline"
          href={`/dashboard/chuong-trinh-dao-tao/${program.id}/build`}
        >
          Xem thông tin và cấu trúc tín chỉ
        </Link>
      )}
      <form onSubmit={save}>
        <fieldset
          disabled={loading || saving || uploading || !canReview}
          className="space-y-6"
        >
          <section className="bg-white rounded-xl border overflow-hidden">
            <h2 className="p-4 bg-slate-50 flex gap-2 font-semibold items-center">
              <Users className="h-4 w-4" />
              1. Thành phần Hội đồng Thẩm định
            </h2>
            <div className="p-6 grid md:grid-cols-2 gap-5">
              {textFields.map((field) => (
                <div
                  key={field.key}
                  className={
                    "space-y-1.5 " +
                    (field.key === "hoiDongThamDinh" ? "md:col-span-2" : "")
                  }
                >
                  <label
                    htmlFor={field.key}
                    className="text-xs font-bold text-slate-700"
                  >
                    {field.label}
                    {field.required && " *"}
                  </label>
                  <Input
                    id={field.key}
                    required={field.required}
                    maxLength={field.max}
                    type={field.type || "text"}
                    value={form[field.key]}
                    onChange={(event) =>
                      setForm({ ...form, [field.key]: event.target.value })
                    }
                  />
                </div>
              ))}
            </div>
          </section>
          <section className="bg-white rounded-xl border overflow-hidden">
            <h2 className="p-4 bg-slate-50 flex gap-2 font-semibold items-center">
              <FileCheck className="h-4 w-4" />
              2. Kết luận & Biên bản thẩm định
            </h2>
            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="conclusion" className="text-xs font-bold">
                  Kết luận của hội đồng *
                </label>
                <select
                  id="conclusion"
                  value={form.ketLuan}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      ketLuan: event.target.value as ReviewInput["ketLuan"],
                    })
                  }
                  className="w-full border rounded-lg h-10 px-3 text-sm"
                >
                  <option value="DAT_DIEU_KIEN">
                    Đạt điều kiện (Phê duyệt và ban hành)
                  </option>
                  <option value="YEU_CAU_SUA_DOI">
                    Yêu cầu chỉnh sửa, bổ sung
                  </option>
                  <option value="KHONG_DAT">Không đạt (trả hồ sơ)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="comments" className="text-xs font-bold">
                  Ý kiến / lý do của hội đồng{" "}
                  {form.ketLuan !== "DAT_DIEU_KIEN" && "*"}
                </label>
                <textarea
                  id="comments"
                  rows={4}
                  maxLength={10000}
                  required={form.ketLuan !== "DAT_DIEU_KIEN"}
                  value={form.yKienDongGop}
                  onChange={(event) =>
                    setForm({ ...form, yKienDongGop: event.target.value })
                  }
                  className="w-full border rounded-lg p-3 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="minutes-file" className="text-xs font-bold">
                  Tài liệu đính kèm
                </label>
                <div
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (canReview && !saving && !uploading)
                      chooseFile(event.dataTransfer.files[0]);
                  }}
                  className="border-2 border-dashed rounded-xl p-6 text-center space-y-2"
                >
                  <UploadCloud className="h-8 w-8 text-slate-400 mx-auto" />
                  <p className="text-sm">
                    Kéo thả biên bản hoặc chọn tệp từ máy
                  </p>
                  <input
                    id="minutes-file"
                    ref={fileInput}
                    type="file"
                    accept=".pdf,.docx"
                    className="block mx-auto max-w-full text-sm"
                    onChange={(event) => chooseFile(event.target.files?.[0])}
                  />
                  <p className="text-xs text-slate-500">
                    PDF, DOCX tối đa 25MB. Tài liệu phải được tải lên trước khi
                    lưu kết luận.
                  </p>
                </div>
                {file && (
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setFile(null);
                          if (fileInput.current) fileInput.current.value = "";
                        }}
                      >
                        Bỏ chọn
                      </Button>
                      <Button
                        type="button"
                        isLoading={uploading}
                        onClick={upload}
                      >
                        Tải lên hồ sơ
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 bg-slate-50 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Hủy bỏ
              </Button>
              <Button type="submit" isLoading={saving} disabled={!!file}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Lưu Kết Luận Thẩm Định
              </Button>
            </div>
          </section>
        </fieldset>
      </form>
      {!!program?.documents.length && (
        <section className="bg-white rounded-xl border p-5 space-y-2">
          <h2 className="font-bold text-sm">Tài liệu đã lưu</h2>
          {program.documents.map((document) => (
            <a
              key={document.id}
              className="block text-sm text-blue-600 underline"
              href={`/api/chuong-trinh-dao-tao/${program.id}/tai-lieu/${document.id}`}
            >
              {document.name}
            </a>
          ))}
        </section>
      )}
    </div>
  );
}
