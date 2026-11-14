// Tiempo de juego: horas transcurridas desde el 1 de enero de 2033, 00:00.
export const START_MS = Date.UTC(2033, 0, 1, 0, 0, 0);
export const HOURS_PER_DAY = 24;

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function dateOf(hour: number): Date {
  return new Date(START_MS + hour * 3600 * 1000);
}

export function yearOf(hour: number): number {
  return dateOf(hour).getUTCFullYear();
}

export function formatDate(hour: number, withHour = false): string {
  const d = dateOf(hour);
  const base = `${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
  return withHour ? `${String(d.getUTCHours()).padStart(2, '0')}:00, ${base}` : base;
}

export function formatShortDate(hour: number): string {
  const d = dateOf(hour);
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatMonth(hour: number): string {
  const d = dateOf(hour);
  return `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function hourOfDate(iso: string): number {
  // iso: 'AAAA-MM-DD'
  const [y, m, d] = iso.split('-').map(Number);
  return (Date.UTC(y, m - 1, d) - START_MS) / 3600000;
}

export function isNewMonth(hour: number): boolean {
  const d = dateOf(hour);
  return d.getUTCDate() === 1 && d.getUTCHours() === 0;
}

export function days(n: number): number {
  return n * HOURS_PER_DAY;
}

export function formatDays(d: number): string {
  const n = Math.max(0, Math.ceil(d));
  return n === 1 ? '1 día' : `${n} días`;
}
