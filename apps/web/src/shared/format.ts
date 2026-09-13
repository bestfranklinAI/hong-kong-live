const timeFormat = new Intl.DateTimeFormat('en-HK', {
  timeZone: 'Asia/Hong_Kong',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
export function hkTime(iso: string | null | undefined): string {
  return iso && Number.isFinite(Date.parse(iso))
    ? timeFormat.format(new Date(iso))
    : 'Time unavailable';
}

const sourceFormat = new Intl.DateTimeFormat('en-HK', {
  timeZone: 'Asia/Hong_Kong',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
export function hkSourceTime(iso: string | null | undefined): string {
  return iso && Number.isFinite(Date.parse(iso))
    ? `${sourceFormat.format(new Date(iso))} HKT`
    : 'Unknown';
}
