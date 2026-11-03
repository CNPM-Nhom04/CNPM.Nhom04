import { adminRequest } from "./adminService";
import type { PublicDocument, PublicPage } from "./portalService";
export interface SubscriptionRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  levelName: string;
  majorName: string | null;
  gender: string | null;
  previousMajor: string | null;
  graduationYear: number | null;
  message: string | null;
  status: string;
  revision: number;
  createdAt: string;
  consentedAt: string;
}
export interface DocumentInput {
  title: string;
  category: string;
  summary: string;
  documentUrl: string;
  referenceNumber?: string;
  issuedOn?: string;
  status: string;
}
export const portalAdminService = {
  documents: (q: URLSearchParams, signal?: AbortSignal) =>
    adminRequest<PublicPage<PublicDocument>>("cong-thong-tin/van-ban?" + q, {
      signal,
    }),
  save: (item: PublicDocument | null, body: DocumentInput) =>
    adminRequest<PublicDocument>(
      "cong-thong-tin/van-ban" + (item ? "/" + item.id : ""),
      {
        method: item ? "PUT" : "POST",
        body: JSON.stringify({
          ...body,
          ...(item ? { revision: item.revision } : {}),
        }),
      },
    ),
  remove: (item: PublicDocument) =>
    adminRequest<{ message: string }>(
      "cong-thong-tin/van-ban/" + item.id + "?revision=" + item.revision,
      { method: "DELETE" },
    ),
  subscriptions: (q: URLSearchParams, signal?: AbortSignal) =>
    adminRequest<PublicPage<SubscriptionRecord>>(
      "cong-thong-tin/dang-ky?" + q,
      { signal },
    ),
  contact: (item: SubscriptionRecord) =>
    adminRequest<{ message: string }>(
      "cong-thong-tin/dang-ky/" + item.id + "/da-lien-he",
      { method: "POST", body: JSON.stringify({ revision: item.revision }) },
    ),
};
