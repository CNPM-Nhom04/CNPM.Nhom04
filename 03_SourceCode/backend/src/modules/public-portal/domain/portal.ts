export interface PortalQuery {
  page: number;
  limit: number;
  search?: string;
  levelId?: string;
  category?: string;
  status?: string;
}
export interface SubscriptionInput {
  familyName: string;
  givenName: string;
  email: string;
  phone: string;
  levelId: string;
  majorId?: string;
  gender?: string;
  previousMajor?: string;
  graduationYear?: number;
  message?: string;
  consent: boolean;
}
export interface PublicDocumentInput {
  title: string;
  category: string;
  summary: string;
  documentUrl: string;
  referenceNumber?: string;
  issuedOn?: string;
  status: string;
  revision?: number;
}
export interface PortalActor {
  id: string;
  username: string;
  ip: string;
}
export abstract class PortalRepository {
  abstract options(): Promise<unknown>;
  abstract programs(query: PortalQuery): Promise<unknown>;
  abstract program(id: string): Promise<unknown>;
  abstract documents(query: PortalQuery, admin?: boolean): Promise<unknown>;
  abstract saveDocument(
    id: string | null,
    input: PublicDocumentInput,
    actor: PortalActor,
  ): Promise<unknown>;
  abstract deleteDocument(
    id: string,
    revision: number,
    actor: PortalActor,
  ): Promise<unknown>;
  abstract subscribe(input: SubscriptionInput): Promise<void>;
  abstract subscriptions(query: PortalQuery): Promise<unknown>;
  abstract contact(
    id: string,
    revision: number,
    actor: PortalActor,
  ): Promise<unknown>;
}
