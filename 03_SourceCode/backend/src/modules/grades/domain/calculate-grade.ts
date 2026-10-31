import { BadRequestException } from "@nestjs/common";
import { GradePolicyInput, GradeScores } from "./grade";
export function validatePolicy(p: GradePolicyInput) {
  const weights = [p.attendanceWeight, p.midtermWeight, p.examWeight].map((v) =>
    Math.round(v * 100),
  );
  if (weights.reduce((s, v) => s + v, 0) !== 10000)
    throw new BadRequestException("Tổng trọng số phải bằng 100%.");
}
export function calculateGrade(
  scores: GradeScores,
  p: GradePolicyInput,
): number | null {
  validatePolicy(p);
  const values = [
    scores.attendanceScore,
    scores.midtermScore,
    scores.examScore,
  ];
  const weights = [p.attendanceWeight, p.midtermWeight, p.examWeight];
  // A zero-weight component is optional; unknown values with nonzero weight stay unknown.
  if (values.some((v, i) => v == null && weights[i] > 0)) return null;
  const numerator = values.reduce(
    (sum, v, i) =>
      sum + Math.round((v ?? 0) * 100) * Math.round(weights[i] * 100),
    0,
  );
  const divisor = 10000 * Math.pow(10, 2 - p.decimalPlaces);
  const units =
    p.rounding === "TRUNCATE"
      ? Math.floor(numerator / divisor)
      : Math.floor((2 * numerator + divisor) / (2 * divisor));
  return units / Math.pow(10, p.decimalPlaces);
}
