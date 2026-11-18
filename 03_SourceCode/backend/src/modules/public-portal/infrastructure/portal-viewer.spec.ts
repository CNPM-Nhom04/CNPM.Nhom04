import { DataSource } from "typeorm";
import { PortalQuery } from "../domain/portal";
import { MysqlPortalRepository } from "./portal.repository";

describe("Public catalog organizational unit", () => {
  const activeUser = {
    account_status: "ACTIVE",
    deleted_at: null,
    unitId: "6",
    isAdmin: 0,
  };
  function setup(responses: unknown[][]) {
    const query = jest.fn();
    responses.forEach((response) => query.mockResolvedValueOnce(response));
    const db = {
      transaction: (_level: string, run: (manager: unknown) => unknown) =>
        run({ query }),
    } as unknown as DataSource;
    return { repo: new MysqlPortalRepository(db), query };
  }
  const filters = { page: 1, limit: 20 } as PortalQuery;

  it("allows a student linked directly to a school to browse scoped published programs", async () => {
    const { repo, query } = setup([
      [activeUser],
      [],
      [{ id: "6", name: "Trường Đại học An Giang" }],
      [{ id: "42", name: "Khoa học cây trồng" }],
      [{ total: 1 }],
    ]);
    const result = await repo.programs(filters, "student");
    expect(result.view).toEqual({
      mode: "UNIT",
      facultyId: "6",
      facultyName: "Trường Đại học An Giang",
    });
    expect(result.data).toHaveLength(1);
    for (const [sql, params] of query.mock.calls.slice(3)) {
      expect(sql).toContain("v.status='PUBLISHED'");
      expect(sql).toContain("fc.ancestor_id=?");
      expect(params[0]).toBe("6");
    }
  });

  it("keeps a department account within its nearest faculty rather than widening to the school", async () => {
    const { repo, query } = setup([
      [activeUser],
      [{ id: "9", name: "Khoa Nông nghiệp" }],
      [],
      [{ total: 0 }],
    ]);
    const result = await repo.programs(filters, "student");
    expect(result.view.mode).toBe("FACULTY");
    expect(query.mock.calls[2][1][0]).toBe("9");
    expect(query).toHaveBeenCalledTimes(4);
  });

  it("does not grant unrestricted access when the account has no organizational unit", async () => {
    const { repo, query } = setup([
      [{ ...activeUser, unitId: null }],
      [],
      [{ total: 0 }],
    ]);
    const result = await repo.programs(filters, "student");
    expect(result.view.mode).toBe("UNASSIGNED");
    expect(query.mock.calls[1][0]).toContain("AND 1=0");
  });

  it("does not use an inactive or missing unit as a valid scope", async () => {
    const { repo } = setup([[activeUser], [], [], [], [{ total: 0 }]]);
    expect((await repo.programs(filters, "student")).view.mode).toBe(
      "UNASSIGNED",
    );
  });

  it("applies the same school scope when opening a program detail", async () => {
    const { repo, query } = setup([
      [activeUser],
      [],
      [{ id: "6", name: "AGU" }],
      [],
    ]);
    await expect(repo.program("999", "student")).rejects.toThrow(
      "không thuộc đơn vị",
    );
    expect(query.mock.calls[3][0]).toContain("fc.ancestor_id=?");
    expect(query.mock.calls[3][1]).toEqual(["999", "6"]);
  });

  it("still rejects disabled accounts", async () => {
    const { repo } = setup([[{ ...activeUser, account_status: "LOCKED" }]]);
    await expect(repo.programs(filters, "student")).rejects.toThrow(
      "không còn hoạt động",
    );
  });
});
