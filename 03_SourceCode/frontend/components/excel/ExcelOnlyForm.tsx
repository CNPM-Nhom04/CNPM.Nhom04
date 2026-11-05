"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormHTMLAttributes,
} from "react";
import { flushSync } from "react-dom";
import { ExcelRecordsPanel, type RecordsResult } from "./ExcelRecordsPanel";
import { Button } from "@/components/ui";
type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type Field = {
  id: string;
  label: string;
  type: string;
  value: string;
  readonly: boolean;
  required: boolean;
  options?: { value: string; label: string }[];
  min?: string;
  max?: string;
  step?: string;
  minLength?: number;
  maxLength?: number;
};
type Uploaded = {
  context: string;
  fields: { id: string; original: string; value: string }[];
};
function controls(form: HTMLElement): Control[] {
  return [
    ...form.querySelectorAll<Control>(
      "input:not([type=hidden]):not([type=file]),select,textarea",
    ),
  ];
}
function value(input: Control) {
  return input instanceof HTMLInputElement && input.type === "checkbox"
    ? String(input.checked)
    : input.value;
}
function describe(form: HTMLElement): Field[] {
  const used = new Map<string, number>();
  const text = (label: Element | null | undefined) => {
    if (!label) return "";
    const copy = label.cloneNode(true) as Element;
    copy
      .querySelectorAll("input,select,textarea,button")
      .forEach((node) => node.remove());
    return copy.textContent?.trim() || "";
  };
  return controls(form).map((input, i) => {
    const label =
      text(input.labels?.[0]) ||
      input.getAttribute("aria-label") ||
      text(
        input
          .closest("div.space-y-1\\.5,div.space-y-2,div.space-y-1")
          ?.querySelector("label"),
      ) ||
      input.getAttribute("placeholder") ||
      input.name ||
      input.id ||
      `Trường ${i + 1}`;
    let hash = 2166136261;
    for (const char of label + ":" + input.type)
      hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    const base = input.id || input.name || `field-${(hash >>> 0).toString(16)}`;
    const count = used.get(base) || 0;
    used.set(base, count + 1);
    return {
      id: count ? `${base}-${count + 1}` : base,
      label,
      type: input.type,
      value: value(input),
      readonly:
        input.matches(":disabled") || ("readOnly" in input && input.readOnly),
      required: input.required,
      min: input.getAttribute("min") ?? undefined,
      max: input.getAttribute("max") ?? undefined,
      step: input.getAttribute("step") ?? undefined,
      minLength: input.getAttribute("minlength")
        ? Number(input.getAttribute("minlength"))
        : undefined,
      maxLength: input.getAttribute("maxlength")
        ? Number(input.getAttribute("maxlength"))
        : undefined,
      options:
        input instanceof HTMLSelectElement
          ? [...input.options].map((o) => ({ value: o.value, label: o.text }))
          : undefined,
    };
  });
}
async function check(r: Response) {
  if (!r.ok) {
    const b = await r.json().catch(() => null);
    throw new Error(
      Array.isArray(b?.message)
        ? b.message.join("\n")
        : b?.message || "Không xử lý được Excel.",
    );
  }
  return r;
}
// All fields retain their original React state and domain validation; Excel is the editing surface.
export function ExcelOnlyForm({
  children,
  onSubmit,
  id,
  recordKey = "",
  recordLabel,
  resource,
  baseId,
  onImported,
  heading = "Thêm / sửa bằng Excel",
  description = "Mẫu chứa dữ liệu phiên bản hiện có. Sửa trực tiếp các ô ở dòng dữ liệu, tải lên và kiểm tra các trường thay đổi trước khi lưu. Sheet “Ví dụ điền đúng” ở cuối file có mẫu để đối chiếu.",
  templateLabel = "Tải mẫu có dữ liệu trước đó",
  submitLabel = "Áp dụng Excel và lưu",
  downloadFilename = "Mau_du_lieu.xlsx",
  showDependentStep = true,
  ...props
}: FormHTMLAttributes<HTMLFormElement> & {
  resource?: string;
  baseId?: string;
  onImported?: (result: RecordsResult) => void;
  recordLabel?: string;
  recordKey?: string;
  heading?: string;
  description?: string;
  templateLabel?: string;
  submitLabel?: string;
  downloadFilename?: string;
  showDependentStep?: boolean;
}) {
  const generated = useId();
  const formId = id || `excel-${generated.replaceAll(":", "")}`;
  const form = useRef<HTMLFormElement>(null),
    fieldsRoot = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState("");
  const [uploaded, setUploaded] = useState<Uploaded | null>(null),
    [changes, setChanges] = useState<
      { id: string; label: string; before: string; after: string }[]
    >([]);
  const allowSubmit = useRef(false),
    baseline = useRef<Field[]>([]);
  const context = () =>
    `${window.location.pathname}${window.location.search}#${id || "form"}:${recordKey}:${form.current?.closest("[role=dialog]")?.getAttribute("aria-label") || ""}`;
  useEffect(() => {
    const buttons = [
      ...document.querySelectorAll<HTMLButtonElement>("button[form]"),
    ].filter((b) => b.getAttribute("form") === formId);
    const previous = buttons.map((b) => b.style.display);
    buttons.forEach((b) => {
      b.style.display = "none";
    });
    const root = fieldsRoot.current;
    const observer = new MutationObserver(() => {
      setFeedback(
        root?.querySelector("[role=alert],[role=status]")?.textContent || "",
      );
    });
    if (root)
      observer.observe(root, {
        subtree: true,
        childList: true,
        characterData: true,
      });
    return () => {
      observer.disconnect();
      buttons.forEach((b, i) => {
        b.style.display = previous[i];
      });
    };
  }, [formId]);
  useEffect(() => {
    setUploaded(null);
    setChanges([]);
    setError("");
    baseline.current = [];
  }, [recordKey]);
  async function template() {
    if (!fieldsRoot.current) return;
    setBusy(true);
    setError("");
    setUploaded(null);
    try {
      const fields = describe(fieldsRoot.current);
      baseline.current = fields;
      const r = await check(
        await fetch("/api/excel-forms/template", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            context: context(),
            fields,
            recordLabel:
              recordLabel ||
              form.current
                ?.closest("[role=dialog]")
                ?.getAttribute("aria-label") ||
              heading,
          }),
        }),
      );
      const url = URL.createObjectURL(await r.blob()),
        a = document.createElement("a");
      a.href = url;
      a.download = downloadFilename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được mẫu.");
    } finally {
      setBusy(false);
    }
  }
  async function read(file?: File) {
    if (!file || !fieldsRoot.current) return;
    setBusy(true);
    setError("");
    setUploaded(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const data = (await (
        await check(
          await fetch("/api/excel-forms/read", { method: "POST", body }),
        )
      ).json()) as Uploaded;
      if (data.context !== context())
        throw new Error(
          "File không thuộc đúng màn hình/bản ghi này. Hãy tải lại mẫu.",
        );
      const fields = describe(fieldsRoot.current),
        lookup = new Map(fields.map((f) => [f.id, f]));
      const changed = [];
      for (const row of data.fields) {
        const field = lookup.get(row.id);
        if (!field)
          throw new Error("Cấu trúc dữ liệu đã đổi. Hãy tải lại mẫu.");
        const current = field.type === "password" ? "" : field.value;
        if (row.original !== current)
          throw new Error(
            `${field.label}: dữ liệu gốc đã thay đổi. Hãy tải mẫu mới để tránh ghi đè.`,
          );
        if (field.readonly && row.value !== row.original)
          throw new Error(`${field.label}: trường chỉ đọc.`);
        if (row.value !== row.original) {
          if (
            field.options &&
            !field.options.some((o) => o.value === row.value)
          )
            throw new Error(
              `${field.label}: dùng mã trong sheet Danh sach chon.`,
            );
          if (
            field.type === "checkbox" &&
            !["true", "false"].includes(row.value)
          )
            throw new Error(`${field.label}: nhập true hoặc false.`);
          changed.push({
            id: row.id,
            label: field.label,
            before: field.type === "password" ? "••••" : row.original,
            after: field.type === "password" ? "••••" : row.value,
          });
        }
      }
      baseline.current = fields;
      setChanges(changed);
      setUploaded(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đọc được Excel.");
    } finally {
      setBusy(false);
    }
  }
  async function apply(save: boolean) {
    if (!uploaded || !fieldsRoot.current || !form.current) return;
    setBusy(true);
    setError("");
    try {
      const current = describe(fieldsRoot.current);
      for (const original of baseline.current) {
        const now = current.find((f) => f.id === original.id);
        if (now && now.value !== original.value)
          throw new Error(
            "Dữ liệu trên màn hình đã thay đổi sau khi kiểm tra. Hãy tải mẫu mới.",
          );
      }
      for (const row of uploaded.fields) {
        const all = describe(fieldsRoot.current),
          index = all.findIndex((f) => f.id === row.id),
          field = all[index],
          input = controls(fieldsRoot.current)[index];
        const before = baseline.current.find((item) => item.id === row.id);
        if (
          field &&
          before &&
          (field.label !== before.label || field.type !== before.type)
        )
          throw new Error(
            "Cấu trúc trường phụ thuộc đã đổi. Tải lại mẫu để bổ sung dữ liệu.",
          );
        if (!field || !input || field.readonly || value(input) === row.value)
          continue;
        flushSync(() => {
          if (input instanceof HTMLInputElement && input.type === "checkbox") {
            if (input.checked !== (row.value === "true")) input.click();
          } else {
            const prototype =
              input instanceof HTMLSelectElement
                ? HTMLSelectElement.prototype
                : input instanceof HTMLTextAreaElement
                  ? HTMLTextAreaElement.prototype
                  : HTMLInputElement.prototype;
            Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(
              input,
              row.value,
            );
            input.dispatchEvent(
              new Event(
                input instanceof HTMLSelectElement ? "change" : "input",
                { bubbles: true },
              ),
            );
          }
        });
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
      }
      const now = describe(fieldsRoot.current);
      if (now.some((f) => !uploaded.fields.some((row) => row.id === f.id))) {
        setUploaded(null);
        throw new Error(
          "Lựa chọn vừa thay đổi đã tạo trường phụ thuộc mới. Tải lại mẫu để bổ sung trước khi lưu.",
        );
      }
      for (const changed of changes) {
        const expected = uploaded.fields.find((item) => item.id === changed.id);
        const actual = now.find((item) => item.id === changed.id);
        if (!expected || !actual || actual.value !== expected.value)
          throw new Error(
            "Một trường phụ thuộc chưa nhận được giá trị. Tải lại mẫu sau khi danh sách tải xong.",
          );
      }
      const invalid = save
        ? controls(fieldsRoot.current).find(
            (input) => !input.matches(":disabled") && !input.checkValidity(),
          )
        : undefined;
      if (invalid)
        throw new Error(
          `${now[controls(fieldsRoot.current).indexOf(invalid)]?.label}: ${invalid.validationMessage}`,
        );
      setUploaded(null);
      if (save) {
        allowSubmit.current = true;
        form.current.requestSubmit();
        allowSubmit.current = false;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không áp dụng được dữ liệu.");
      setUploaded(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      {...props}
      id={formId}
      ref={form}
      noValidate
      onSubmit={(event) => {
        if (!allowSubmit.current) {
          event.preventDefault();
          return;
        }
        onSubmit?.(event);
      }}
    >
      {resource ? (
        <ExcelRecordsPanel
          resource={resource}
          focus={recordKey}
          baseId={baseId}
          onImported={onImported}
        />
      ) : (
        <div className="rounded-xl border bg-blue-50/40 p-4 space-y-3 text-sm">
          <p className="font-semibold">{heading}</p>
          <p className="text-slate-600">{description}</p>
          <div className="flex flex-wrap gap-3 items-center">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={template}
            >
              {templateLabel}
            </Button>
            <input
              type="file"
              accept=".xlsx"
              aria-label="Nhập Excel dữ liệu"
              disabled={busy}
              onChange={(e) => {
                void read(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          {busy && <p role="status">Đang xử lý Excel…</p>}
          {error && (
            <p role="alert" className="text-red-700 whitespace-pre-line">
              {error}
            </p>
          )}
          {feedback && (
            <p role="status" className="whitespace-pre-line">
              {feedback}
            </p>
          )}
          {uploaded && (
            <div className="space-y-3">
              <p>
                {changes.length} trường thay đổi. Các trường khác được giữ
                nguyên.
              </p>
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr>
                      <th className="p-2">Thông tin</th>
                      <th className="p-2">Trước</th>
                      <th className="p-2">Sau</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changes.map((f) => (
                      <tr key={f.id} className="border-t">
                        <td className="p-2">{f.label}</td>
                        <td className="p-2 whitespace-pre-wrap">
                          {f.before || "—"}
                        </td>
                        <td className="p-2 whitespace-pre-wrap">
                          {f.after || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button
                type="button"
                disabled={busy || !changes.length}
                onClick={() => void apply(true)}
              >
                {submitLabel}
              </Button>
              {showDependentStep && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void apply(false)}
                >
                  Áp dụng để bổ sung trường phụ thuộc
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      <div ref={fieldsRoot} hidden>
        {children}
      </div>
    </form>
  );
}
