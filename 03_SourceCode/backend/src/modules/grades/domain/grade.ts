export interface GradeActor {
  id: string;
  username: string;
  canManage: boolean;
  ip: string;
}
export interface GradeQuery {
  page: number;
  limit: number;
  searchTerm?: string;
  resultStatus?: string;
  state?: string;
  offeringId?: string;
}
export interface GradePolicyInput {
  revision: number;
  attendanceWeight: number;
  midtermWeight: number;
  examWeight: number;
  passingScore: number;
  decimalPlaces: number;
  rounding: "HALF_UP" | "TRUNCATE";
  reference: string;
}
export interface GradeScores {
  attendanceScore?: number | null;
  midtermScore?: number | null;
  examScore?: number | null;
}
export interface GradeWrite extends GradeScores {
  revision?: number;
  registrationId?: string;
  note: string;
  reference: string;
}
export interface LegacyWrite {
  revision: number;
  grade?: string | null;
  resultStatus: "PASSED" | "FAILED" | "INCOMPLETE" | "EXEMPTED";
  passedDate?: string | null;
  note: string;
  reference: string;
}
export abstract class GradeRepository {
  abstract list(q: GradeQuery, a: GradeActor): Promise<any>;
  abstract detail(id: string, a: GradeActor): Promise<any>;
  abstract classes(q: GradeQuery, a: GradeActor): Promise<any>;
  abstract registrations(q: GradeQuery, a: GradeActor): Promise<any>;
  abstract policy(id: string, a: GradeActor): Promise<any>;
  abstract savePolicy(
    id: string,
    b: GradePolicyInput,
    a: GradeActor,
  ): Promise<any>;
  abstract create(b: GradeWrite, a: GradeActor): Promise<any>;
  abstract update(id: string, b: GradeWrite, a: GradeActor): Promise<any>;
  abstract action(
    id: string,
    action: string,
    b: GradeWrite,
    a: GradeActor,
  ): Promise<any>;
  abstract legacy(id: string, b: LegacyWrite, a: GradeActor): Promise<any>;
}
