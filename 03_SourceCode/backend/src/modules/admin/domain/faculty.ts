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
export interface FacultyQuery {
  searchTerm?: string;
  status?: string;
  page: number;
  limit: number;
}
