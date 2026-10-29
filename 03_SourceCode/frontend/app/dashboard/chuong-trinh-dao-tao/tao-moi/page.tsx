import { Suspense } from "react";
import { ProgramForm } from "@/components/programs/ProgramForm";
export default function CreateProgramPage() {
  return (
    <Suspense fallback={<p>Đang tải form CTĐT...</p>}>
      <ProgramForm />
    </Suspense>
  );
}
