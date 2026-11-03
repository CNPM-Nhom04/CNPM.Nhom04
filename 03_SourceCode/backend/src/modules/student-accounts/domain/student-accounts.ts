export const ACCOUNT_IMPORT_PERMISSIONS = [
  "USER_MANAGE",
  "ROLE_SCOPE_MANAGE",
  "STUDENT_ACCOUNT_IMPORT",
];
export interface AccountActor {
  id: string;
  username: string;
  ip: string;
}
export interface ClassQuery {
  page: number;
  limit: number;
  searchTerm?: string;
  status?: string;
}
export interface ClassInput {
  code: string;
  name: string;
  trackId: string;
  admissionYear: number;
}
export interface LinkStudentAccount {
  userId: string;
  studentId?: string;
  studentCode?: string;
  revision: number;
  confirmed: boolean;
  reason: string;
}
export interface ClassUpdate {
  name: string;
  status: "ACTIVE" | "INACTIVE";
  revision: number;
}
export interface ClassItem {
  id: string;
  code: string;
  name: string;
  trackId: string;
  trackCode: string;
  trackName: string;
  versionCode: string;
  programName: string;
  unitId: string;
  unitName: string;
  admissionYear: number;
  status: string;
  revision: number;
  memberCount: number;
}
export interface AccountImportRow {
  rowNumber: number;
  studentCode: string;
  fullName: string;
  email: string;
  username: string;
  errors: string[];
  mode?: "CREATE_PROFILE" | "LINK_PROFILE";
  studentId?: string;
}
export interface PreparedStudentAccount {
  row: AccountImportRow;
  passwordHash: string;
  passwordLength: number;
}
export interface AccountImportLimits {
  maxFileBytes: number;
  maxRows: number;
  passwordMinLength: number;
}
export abstract class StudentAccountsRepository {
  abstract linkAccounts(id: string, q: ClassQuery): Promise<unknown>;
  abstract linkProfiles(id: string, q: ClassQuery): Promise<unknown>;
  abstract link(
    id: string,
    input: LinkStudentAccount,
    actor: AccountActor,
  ): Promise<unknown>;
  abstract limits(): Promise<AccountImportLimits>;
  abstract options(): Promise<unknown>;
  abstract list(q: ClassQuery): Promise<unknown>;
  abstract detail(id: string): Promise<ClassItem>;
  abstract create(input: ClassInput, actor: AccountActor): Promise<ClassItem>;
  abstract update(
    id: string,
    input: ClassUpdate,
    actor: AccountActor,
  ): Promise<ClassItem>;
  abstract remove(
    id: string,
    revision: number,
    actor: AccountActor,
  ): Promise<void>;
  abstract members(id: string, q: ClassQuery): Promise<unknown>;
  abstract check(
    id: string,
    rows: AccountImportRow[],
    revision: number,
  ): Promise<AccountImportRow[]>;
  abstract commit(
    id: string,
    accounts: PreparedStudentAccount[],
    revision: number,
    fileHash: string,
    actor: AccountActor,
    fileBytes: number,
  ): Promise<number>;
}
