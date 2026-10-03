export type BacDaoTao = "ThacSi" | "TienSi";
export type TrangThaiCTDT =
  | "BAN_NHAP"
  | "CHO_DUYET"
  | "DA_BAN_HANH"
  | "YEU_CAU_SUA";
export type HuongDaoTao = "NGHIEN_CUU" | "UNG_DUNG";

export interface HocPhan {
  id: string;
  maHocPhan: string;
  tenHocPhan: string;
  soTinChi: number;
  soTietLT: number;
  soTietTH: number;
  khoiKienThuc: "Chung" | "CoSo" | "ChuyenNganh" | "TotNghiep";
  loaiHocPhan: "BAT_BUOC" | "TU_CHON";
  hocKyDuKien: number;
}

export interface ChuongTrinhDaoTao {
  id: string;
  maCTDT: string;
  tenCTDT: string;
  bacDaoTao: BacDaoTao;
  khoaQuanLy: string;
  khoaTuyenSinh: string;
  tongTinChiYeuCau: number;
  trangThai: TrangThaiCTDT;
  ngayCapNhat: string;
  hocPhanNghienCuu: HocPhan[];
  hocPhanUngDung: HocPhan[];
}
