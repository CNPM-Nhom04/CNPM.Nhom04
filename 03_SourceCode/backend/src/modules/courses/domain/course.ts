export interface CourseActor {
  id: string;
  username: string;
  canManage: boolean;
  ip: string;
}
export interface CourseQuery {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  unitId?: string;
}
export interface CourseVersionInput {
  courseName: string;
  englishName?: string;
  credits: number;
  theoryHours: number;
  practiceHours: number;
  description?: string;
  effectiveFrom: string;
  effectiveTo?: string;
}
export interface CreateCourseInput extends CourseVersionInput {
  courseCode: string;
  unitId: string;
}
export interface RevisionInput extends CourseVersionInput {
  expectedLatestVersionId: string;
}
export abstract class CourseRepository {
  abstract list(query: CourseQuery, actor: CourseActor): Promise<any>;
  abstract units(actor: CourseActor): Promise<any>;
  abstract detail(id: string, actor: CourseActor): Promise<any>;
  abstract create(input: CreateCourseInput, actor: CourseActor): Promise<any>;
  abstract revise(
    id: string,
    input: RevisionInput,
    actor: CourseActor,
  ): Promise<any>;
  abstract activate(
    id: string,
    versionId: string,
    actor: CourseActor,
  ): Promise<any>;
  abstract setStatus(
    id: string,
    status: string,
    expectedStatus: string,
    actor: CourseActor,
  ): Promise<any>;
}
