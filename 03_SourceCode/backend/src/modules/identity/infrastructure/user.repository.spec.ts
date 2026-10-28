import { Repository } from "typeorm";
import { UserRepository } from "./user.repository";
import { User } from "../domain/user.entity";
describe("User identity resolution", () => {
  const orm = { find: jest.fn(), findOne: jest.fn() };
  const repository = new UserRepository(orm as unknown as Repository<User>);
  it("rejects an identifier shared across one username and another email", async () => {
    orm.find.mockResolvedValue([{ id: "1" }, { id: "2" }]);
    await expect(
      repository.findByUsernameOrEmail("shared@example.invalid"),
    ).resolves.toBeNull();
    orm.find.mockResolvedValue([{ id: "2" }]);
    await expect(
      repository.findByUsernameOrEmail("unique@example.invalid"),
    ).resolves.toEqual({ id: "2" });
  });
  it("uses only the email column for password recovery", async () => {
    orm.findOne.mockResolvedValue({ id: "2" });
    await expect(
      repository.findByEmail("owner@example.invalid"),
    ).resolves.toEqual({ id: "2" });
    expect(orm.findOne).toHaveBeenCalledWith({
      where: { email: "owner@example.invalid" },
    });
  });
});
