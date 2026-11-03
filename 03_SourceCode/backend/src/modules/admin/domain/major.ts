export interface MajorQuery {
  page: number;
  limit: number;
  searchTerm?: string;
  status?: "ALL" | "ACTIVE" | "INACTIVE";
  unitId?: string;
}
export interface MajorInput {
  majorCode: string;
  majorName: string;
  unitId: string;
  status: "ACTIVE" | "INACTIVE";
}
export interface MajorItem extends MajorInput {
  id: string;
  unitCode: string;
  unitName: string;
  unitStatus: string;
  programCount: number;
  userScopeCount: number;
  registrationScopeCount: number;
  identityLocked: boolean;
  updatedAt: string;
}
export interface MajorOptions {
  units: { id: string; code: string; name: string }[];
}
