import { getAllCourses } from "@/lib/services/courseService";
import DanhMucHocPhanContent from "./DanhMucHocPhanContent";

export default async function DanhMucHocPhanPage() {
  // Lấy dữ liệu thực tế từ database thông qua service chung
  const hocPhanList = await getAllCourses();

  return <DanhMucHocPhanContent initialData={hocPhanList} />;
}
