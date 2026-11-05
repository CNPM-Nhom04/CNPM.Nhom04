export function isAllowedItRequirement(value: string): boolean {
  return !/^(?:MOS|ICDL|A\s*1)$/i.test(value.trim());
}
