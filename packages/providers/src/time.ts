/** Provider-local MTR times have no offset; Hong Kong is UTC+08 all year. */
export function parseSourceTime(value: string | undefined): string | null {
  if (!value) return null;
  const hkt = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
  const offset = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
  const normalized = hkt.test(value) ? `${value.replace(' ', 'T')}+08:00` : value;
  if (!offset.test(normalized)) return null;
  // Date.parse accepts impossible dates such as February 30 by rolling into March.
  const [year, month, day] = normalized.slice(0, 10).split('-').map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (
    calendar.getUTCFullYear() !== year ||
    calendar.getUTCMonth() !== month - 1 ||
    calendar.getUTCDate() !== day
  )
    return null;
  const [hour, minute, second] = normalized.slice(11, 19).split(':').map(Number);
  if (hour > 23 || minute > 59 || second > 59) return null;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}
