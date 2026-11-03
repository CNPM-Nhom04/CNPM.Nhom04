import { adminRequest, type PageResult } from "./adminService";
export interface FacultyInput {
  code: string;
  name: string;
  description: string;
  status: "ACTIVE" | "INACTIVE";
}
export interface FacultyItem extends FacultyInput {
  id: string;
  parentId: string | null;
  parentName: string | null;
  updatedAt: string;
  majorCount: number;
  programCount: number;
  childCount: number;
  referenceCount: number;
}
export const facultyService = {
  list: (params: URLSearchParams, signal?: AbortSignal) =>
    adminRequest<PageResult<FacultyItem>>("khoa?" + params, { signal }),
  save: (item: FacultyItem | null, input: FacultyInput) =>
    adminRequest<FacultyItem>(item ? "khoa/" + item.id : "khoa", {
      method: item ? "PUT" : "POST",
      body: JSON.stringify({
        ...input,
        ...(item ? { expectedUpdatedAt: item.updatedAt } : {}),
      }),
    }),
  remove: (item: FacultyItem) =>
    adminRequest<{ message: string }>(
      "khoa/" +
        item.id +
        "?" +
        new URLSearchParams({ expectedUpdatedAt: item.updatedAt }),
      { method: "DELETE" },
    ),
};
