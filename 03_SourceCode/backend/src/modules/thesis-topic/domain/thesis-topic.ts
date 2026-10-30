export const TOPIC_STATUSES = [
  "CHO_DUYET",
  "DANG_THUC_HIEN",
  "TU_CHOI",
  "HOAN_THANH",
  "DA_HUY",
] as const;
export interface TopicActor {
  id: string;
  username: string;
  permissions: string[];
  ip: string;
}
export interface TopicQuery {
  page: number;
  limit: number;
  searchTerm?: string;
  selectedStatus?: string;
  unitId?: string;
  status?: string;
}
export interface TopicInput {
  assignmentId: string;
  supervisorId: string;
  title: string;
  description?: string;
}
export interface TopicChange {
  revision: number;
  supervisorId?: string;
  title?: string;
  description?: string;
  note?: string;
  reference?: string;
}
export interface SupervisorInput {
  unitId: string;
  code: string;
  fullName: string;
  institution?: string;
  qualification?: string;
  email?: string;
}
export abstract class TopicRepository {
  abstract list(q: TopicQuery, a: TopicActor): Promise<any>;
  abstract students(q: TopicQuery, a: TopicActor): Promise<any>;
  abstract supervisors(q: TopicQuery, a: TopicActor): Promise<any>;
  abstract units(a: TopicActor): Promise<any>;
  abstract detail(id: string, a: TopicActor): Promise<any>;
  abstract create(input: TopicInput, a: TopicActor): Promise<any>;
  abstract change(
    id: string,
    action: string,
    input: TopicChange,
    a: TopicActor,
  ): Promise<any>;
  abstract createSupervisor(
    input: SupervisorInput,
    a: TopicActor,
  ): Promise<any>;
  abstract supervisorStatus(
    id: string,
    status: string,
    expectedStatus: string,
    a: TopicActor,
  ): Promise<any>;
}
