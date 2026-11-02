export function radToDeg(rad: number): number {
  if (!Number.isFinite(rad)) return 0;
  const deg = Number(((rad * 180) / Math.PI).toFixed(1));
  return Object.is(deg, -0) ? 0 : deg;
}

export function formatNumber(val: number, precision = 4): string {
  if (!Number.isFinite(val)) return '0';
  const num = Number(val.toFixed(precision));
  return Object.is(num, -0) ? '0' : num.toString();
}

