import { DataSource } from "typeorm";
import { MysqlAdminRepository } from "./admin.repository";
import { Actor, CategoryItem } from "../domain/admin.repository";
describe("category workbook differential updates", () => {
  const actor = { id: "1", permission: "MASTERDATA_MANAGE" } as Actor;
  const original: CategoryItem = {
    id: "KHOA_QUAN_LY:1",
    maDanhMuc: "FIT",
    tenDanhMuc: "Khoa CNTT",
    loaiDanhMuc: "KHOA_QUAN_LY",
    moTa: "Cũ",
    trangThai: true,
  };
  function setup(current = original) {
    const query = jest.fn(async (sql: string) =>
      sql.includes("WHERE unit_code=") ? [] : [{ id: "1" }],
    );
    const manager = { query },
      transaction = jest.fn(async (fn) => fn(manager));
    const repository = new MysqlAdminRepository({
      transaction,
    } as unknown as DataSource);
    jest.spyOn(repository as any, "getCategory").mockResolvedValue(current);
    const save = jest
      .spyOn(repository, "saveCategory")
      .mockResolvedValue(current);
    return { repository, save, transaction, manager };
  }
  it("does not write unchanged rows", async () => {
    const { repository, save } = setup();
    expect(
      await repository.importCategories(
        [{ id: original.id, original, input: original }],
        actor,
        true,
      ),
    ).toMatchObject({ updated: 0, unchanged: 1 });
    expect(save).not.toHaveBeenCalled();
  });
  it("changes only edited fields and preserves concurrent changes in other cells", async () => {
    const { repository, save, manager, transaction } = setup({
      ...original,
      moTa: "Người khác đã sửa",
    });
    await repository.importCategories(
      [
        {
          id: original.id,
          original,
          input: { ...original, tenDanhMuc: "Tên mới" },
        },
      ],
      actor,
      true,
    );
    expect(save).toHaveBeenCalledWith(
      original.id,
      expect.objectContaining({
        tenDanhMuc: "Tên mới",
        moTa: "Người khác đã sửa",
      }),
      actor,
      manager,
    );
    expect(transaction).toHaveBeenCalledTimes(1);
  });
  it("rejects overlapping edits before writing and prevents category type changes", async () => {
    const { repository, save } = setup({
      ...original,
      tenDanhMuc: "Tên người khác sửa",
    });
    await expect(
      repository.importCategories(
        [
          {
            id: original.id,
            original,
            input: { ...original, tenDanhMuc: "Tên mới" },
          },
        ],
        actor,
        true,
      ),
    ).rejects.toThrow("đã được người khác sửa");
    expect(save).not.toHaveBeenCalled();
    await expect(
      repository.importCategories(
        [
          {
            id: original.id,
            original,
            input: { ...original, loaiDanhMuc: "BAC_DAO_TAO" },
          },
        ],
        actor,
        true,
      ),
    ).rejects.toThrow("đổi loại");
  });
  it("previews changes without writes and treats repeated identical input as unchanged", async () => {
    const { repository, save } = setup();
    expect(
      (
        await repository.importCategories(
          [
            {
              id: original.id,
              original,
              input: { ...original, tenDanhMuc: "Tên mới" },
            },
          ],
          actor,
          false,
        )
      ).updated,
    ).toBe(1);
    expect(save).not.toHaveBeenCalled();
    const replay = setup({ ...original, tenDanhMuc: "Tên mới" });
    expect(
      (
        await replay.repository.importCategories(
          [
            {
              id: original.id,
              original,
              input: { ...original, tenDanhMuc: "Tên mới" },
            },
          ],
          actor,
          true,
        )
      ).unchanged,
    ).toBe(1);
    expect(replay.save).not.toHaveBeenCalled();
  });
  it("reuses the existing category writer without opening a second transaction", async () => {
    const { repository, save, manager, transaction } = setup();
    save.mockRestore();
    jest
      .spyOn(repository as any, "getCategory")
      .mockReset()
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce(original)
      .mockResolvedValue({ ...original, tenDanhMuc: "Tên mới" });
    jest.spyOn(repository as any, "audit").mockResolvedValue(undefined);
    await repository.importCategories(
      [
        {
          id: original.id,
          original,
          input: { ...original, tenDanhMuc: "Tên mới" },
        },
      ],
      actor,
      true,
    );
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE organizational_units SET"),
      ["FIT", "Tên mới", "Cũ", "ACTIVE", "1"],
    );
  });
  it("rejects a caller missing catalog permission", async () => {
    const { repository } = setup();
    await expect(
      repository.importCategories(
        [],
        { ...actor, permission: "USER_MANAGE" },
        true,
      ),
    ).rejects.toThrow("quyền");
  });
});
