"use client";
import { Modal } from "@/components/ui/Modal";
import { ExcelRecordsPanel } from "@/components/excel/ExcelRecordsPanel";
export function MajorImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  return (
    <Modal
      isOpen
      title="Ngành đào tạo · Excel có dữ liệu hiện tại"
      size="2xl"
      onClose={onClose}
    >
      <ExcelRecordsPanel
        resource="majors"
        onImported={(result) => onImported(result.created + result.updated)}
      />
    </Modal>
  );
}
