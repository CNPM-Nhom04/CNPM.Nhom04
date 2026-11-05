export function normalizeTrainingDuration(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const text = value.trim();
  if (!text) return "";
  const match = /^(\d+(?:[.,]\d{1,2})?)(?:\s*năm)?$/i.exec(text);
  if (!match || Number(match[1].replace(",", ".")) <= 0) return text;
  return Number(match[1].replace(",", ".")) + " năm";
}
