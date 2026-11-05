import { Workbook } from "exceljs";
import { ExcelFormsController } from "./excel-forms.module";
describe("Excel-only form transport", () => {
  const controller = new ExcelFormsController();
  const fields = [
    {
      id: "name",
      label: "Tên",
      type: "text",
      value: "Phiên bản trước",
      readonly: false,
      required: true,
    },
    {
      id: "role",
      label: "Vai trò",
      type: "select-one",
      value: "A",
      readonly: false,
      required: true,
      options: [
        { value: "A", label: "Vai trò A" },
        { value: "B", label: "Vai trò B" },
      ],
    },
    {
      id: "password",
      label: "Mật khẩu",
      type: "password",
      value: "must-never-export",
      readonly: false,
      required: false,
    },
  ];
  async function book() {
    const exported = await controller.template({
      context: "/dashboard/item#42",
      fields,
    });
    const chunks = [];
    for await (const c of exported.getStream()) chunks.push(c);
    const workbook = new Workbook();
    await workbook.xlsx.load(Buffer.concat(chunks) as never);
    return workbook;
  }
  async function file(workbook: Workbook) {
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return { buffer, size: buffer.length, originalname: "form.xlsx" };
  }
  it("includes existing data and option codes, excludes passwords, and reads only the new column", async () => {
    const workbook = await book(),
      sheet = workbook.getWorksheet("Du lieu")!;
    expect(sheet.getCell("B2").value).toBe("Phiên bản trước");
    expect(sheet.getCell("C2").value).toBe("Vai trò A");
    expect(sheet.getCell("D2").text).toBe("");
    expect(sheet.getCell("B1").text).toBe("Tên");
    expect(workbook.getWorksheet("Danh sach chon")!.getCell("B3").text).toBe(
      "B",
    );
    expect(workbook.worksheets.at(-1)?.name).toBe("Ví dụ điền đúng");
    expect(
      workbook.getWorksheet("Ví dụ điền đúng")!.getCell("D4").text,
    ).not.toBe("must-never-export");
    sheet.getCell("B2").value = "Phiên bản mới";
    sheet.getCell("C2").value = "Vai trò B";
    const result = await controller.read(await file(workbook));
    expect(result).toMatchObject({
      context: "/dashboard/item#42",
      fields: [
        { id: "name", original: "Phiên bản trước", value: "Phiên bản mới" },
        { id: "role", original: "A", value: "B" },
        { id: "password", original: "", value: "" },
      ],
    });
  });
  it("preserves named-range dropdowns for language choices and labels the day column", async () => {
    const exported = await controller.template({
      context: "/dashboard/admin/cau-hinh",
      fields: [
        {
          id: "ngoaiNguBatBuocThacSi",
          label: "Chuẩn ngoại ngữ Thạc sĩ",
          type: "select-one",
          value: "VSTEP B2 / IELTS 6.0",
          readonly: false,
          required: true,
          options: [
            { value: "VSTEP B2 / IELTS 6.0", label: "VSTEP B2 / IELTS 6.0" },
            { value: "IELTS 6.5", label: "IELTS 6.5" },
          ],
        },
        {
          id: "thoiHanDangKyToiDa",
          label: "Thời hạn đăng ký tối đa (ngày)",
          type: "number",
          value: "14",
          readonly: false,
          required: true,
          min: "1",
          max: "365",
        },
      ],
    });
    const chunks = [];
    for await (const chunk of exported.getStream()) chunks.push(chunk);
    const book = new Workbook();
    await book.xlsx.load(Buffer.concat(chunks) as never);
    const sheet = book.getWorksheet("Du lieu")!;
    expect(sheet.getCell("B2").dataValidation.formulae).toEqual(["LuaChon_1"]);
    expect(book.definedNames.getRanges("LuaChon_1").ranges[0]).toContain(
      "Danh sach chon",
    );
    expect(sheet.getCell("C1").text).toContain("(ngày)");
    sheet.getCell("B2").value = "IELTS 6.5";
    sheet.getCell("C2").value = 15;
    const result = await controller.read(await file(book));
    expect(result.fields).toEqual([
      {
        id: "ngoaiNguBatBuocThacSi",
        original: "VSTEP B2 / IELTS 6.0",
        value: "IELTS 6.5",
      },
      { id: "thoiHanDangKyToiDa", original: "14", value: "15" },
    ]);
  });
  it("rejects formulas and duplicate field keys", async () => {
    const workbook = await book();
    workbook.getWorksheet("Du lieu")!.getCell("B2").value = {
      formula: "1+1",
      result: 2,
    };
    await expect(controller.read(await file(workbook))).rejects.toThrow(
      "công thức",
    );
    const second = await book();
    second.getWorksheet("Du lieu")!.getCell("A3").value = "name";
    await expect(controller.read(await file(second))).rejects.toThrow(
      "chỉ có một dòng",
    );
  });
  it("rejects wrong workbook types and oversized templates", async () => {
    await expect(controller.read(undefined)).rejects.toThrow();
    await expect(
      controller.template({ context: "x", fields: [] }),
    ).rejects.toThrow();
    await expect(
      controller.template({
        context: "x",
        fields: Array(1001).fill(fields[0]),
      }),
    ).rejects.toThrow();
  });
});
