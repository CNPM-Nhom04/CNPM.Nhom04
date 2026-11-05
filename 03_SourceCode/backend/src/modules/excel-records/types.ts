export type Cell = string | number | boolean | null;
export interface Column {
  key: string;
  label: string;
  kind?: "text" | "number" | "bool" | "date";
  choices?: { value: Cell; label: string }[];
  immutable?: boolean;
  readonly?: boolean;
  secret?: boolean;
  default?: Cell;
}
export interface RecordRow {
  id: string;
  label: string;
  values: Record<string, Cell>;
  locked?: string[];
  raw?: any;
}
export interface Adapter {
  title: string;
  columns: Column[];
  load: () => Promise<RecordRow[]>;
  validate: (
    values: Record<string, Cell>,
    row: RecordRow | null,
  ) => Promise<any>;
  save: (values: any, row: RecordRow | null) => Promise<any>;
  notes?: string[];
  lock?: () => Promise<void>;
  seed?: () => Promise<Record<string, Cell> | null>;
}
export interface Account {
  id: string;
  username: string;
  ip: string;
  roles: string[];
  permissions: string[];
}
export async function allPages(
  load: (page: number) => Promise<any>,
): Promise<any[]> {
  const rows = [];
  for (let page = 1; ; page++) {
    const response = await load(page);
    rows.push(...response.data);
    if (rows.length > 5000) throw new Error("Tối đa 5000 bản ghi mỗi file.");
    if (page >= (response.meta?.totalPages || 1)) break;
  }
  return rows;
}
