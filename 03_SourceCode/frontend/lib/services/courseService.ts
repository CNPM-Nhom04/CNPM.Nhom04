import { prisma } from "@/lib/db";

// 1. Lấy toàn bộ danh sách học phần kèm phiên bản mới nhất
export async function getAllCourses() {
  try {
    const rawCourses = await prisma.courses.findMany({
      include: {
        course_versions: {
          orderBy: { version_no: "desc" },
          take: 1,
        },
        organizational_units: true,
      },
      orderBy: { created_at: "desc" },
    });

    return rawCourses.map((c) => {
      const latestVersion = c.course_versions[0];
      return {
        id: c.id.toString(),
        maHocPhan: c.course_code,
        tenHocPhan: latestVersion?.course_name || "Chưa cập nhật tên",
        soTinChi: latestVersion ? Number(latestVersion.credits) : 3,
        loaiHocPhan: "BAT_BUOC" as const,
        khoiKienThuc:
          c.organizational_units?.unit_name || "Kiến thức chuyên ngành",
        moTa: latestVersion?.description || "",
      };
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách học phần:", error);
    return [];
  }
}

// 2. Hàm thêm học phần mới với đầy đủ các trường bắt buộc của Prisma
export async function createCourseData(data: {
  courseCode: string;
  courseName: string;
  credits: number;
  description?: string;
  unitId?: bigint | number; // ID đơn vị quản lý nếu có
}) {
  try {
    // Lấy đại diện một organizational_unit mặc định nếu chưa truyền unitId
    let unitId = data.unitId;
    if (!unitId) {
      const defaultUnit = await prisma.organizational_units.findFirst();
      if (!defaultUnit) {
        throw new Error(
          "Vui lòng tạo ít nhất một đơn vị quản lý (organizational_units) trong database trước.",
        );
      }
      unitId = defaultUnit.id;
    }

    // Bước 1: Tạo record trong bảng courses kèm kết nối unit bắt buộc
    const newCourse = await prisma.courses.create({
      data: {
        course_code: data.courseCode,
        owning_unit_id: BigInt(unitId),
      },
    });

    // Bước 2: Tạo record phiên bản kèm trường effective_from bắt buộc
    const newVersion = await prisma.course_versions.create({
      data: {
        course_id: newCourse.id,
        version_no: 1,
        course_name: data.courseName,
        credits: data.credits,
        description: data.description || "",
        status: "DRAFT",
        effective_from: new Date(), // Gán ngày hiệu lực hiện tại
      },
    });

    return { success: true, data: { newCourse, newVersion } };
  } catch (error: any) {
    console.error("Lỗi khi tạo học phần:", error);
    return { success: false, error: error.message };
  }
}
