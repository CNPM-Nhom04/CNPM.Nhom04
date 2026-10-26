import { getAllCourses } from "@/lib/services/courseService";
import DanhMucHocPhanContent from "./DanhMucHocPhanContent";
import { connection } from "next/server";

export default async function DanhMucHocPhanPage() {
  await connection();

  // Lấy dữ liệu thực tế từ database thông qua service chung
  const hocPhanList = await getAllCourses();

  return <DanhMucHocPhanContent initialData={hocPhanList} />;
}
