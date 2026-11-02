export function radToDeg(rad: number): number {
  return Number.isFinite(rad) ? Number(((rad * 180) / Math.PI).toFixed(1)) : 0;
}

export function formatNumber(val: number, precision = 4): string {
  if (!Number.isFinite(val)) return '0';
  const fixed = val.toFixed(precision);
  return Number(fixed).toString();
}

