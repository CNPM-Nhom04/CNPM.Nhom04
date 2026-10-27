import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { JwtAuthGuard } from "../../identity/presentation/jwt-auth.guard";
import { REPORT_REPOSITORY } from "../domain/report";
import { ReportsService } from "../application/reports.service";
import { ReportsController } from "./reports.controller";

describe("Reports HTTP", () => {
  let app: INestApplication;
  const repository = {
    findAll: jest.fn().mockResolvedValue([]),
    getSummary: jest.fn().mockResolvedValue({
      tongChuongTrinh: 0,
      tongHocVien: 0,
      tongHocPhan: 24,
      tyLeHoanThanh: 0,
    }),
    getDegrees: jest
      .fn()
      .mockResolvedValue([{ value: "MASTER", label: "Thạc sĩ" }]),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        ReportsService,
        { provide: REPORT_REPOSITORY, useValue: repository },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it("validates and transforms query parameters through HTTP", async () => {
    const response = await request(app.getHttpServer())
      .get("/bao-cao")
      .query({
        page: "2",
        limit: "10",
        searchTerm: "  CNTT  ",
        selectedDegree: "Thạc sĩ",
      })
      .expect(200);
    expect(repository.findAll).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 2,
        limit: 10,
        searchTerm: "CNTT",
        selectedDegree: "Thạc sĩ",
      }),
      10,
      10,
    );
    expect(response.body.meta).toEqual({
      page: 2,
      limit: 10,
      total: 0,
      totalPages: 0,
    });
  });

  it.each([
    { page: 0 },
    { page: "abc" },
    { page: 1.5 },
    { limit: 101 },
    { limit: 0 },
    { searchTerm: "a".repeat(256) },
    { selectedDegree: ["MASTER", "BACHELOR"] },
  ])("rejects invalid query %j", async (query) => {
    await request(app.getHttpServer()).get("/bao-cao").query(query).expect(400);
  });

  it("returns summary and degree options", async () => {
    const summary = await request(app.getHttpServer())
      .get("/bao-cao/thong-ke")
      .expect(200);
    expect(summary.body.tyLeHoanThanh).toBe(0);
    const degrees = await request(app.getHttpServer())
      .get("/bao-cao/bac-dao-tao")
      .expect(200);
    expect(degrees.body).toEqual([{ value: "MASTER", label: "Thạc sĩ" }]);
  });

  it("downloads an XLSX attachment", async () => {
    await request(app.getHttpServer())
      .get("/bao-cao/xuat-excel")
      .expect(200)
      .expect("Content-Type", /spreadsheetml.sheet/)
      .expect(
        "Content-Disposition",
        'attachment; filename="Bao_Cao_Tong_Hop_CTDT_SDH.xlsx"',
      );
  });
});
