/**
 * Formats a duration expressed in minutes into a human-readable string.
 * Examples: 360 min → "6h 00min" (fr) / "6h 00m" (en), 45 min → "45min" (fr) / "45m" (en)
 */
export function formatDuration(minutes: number, lang: string): string {
  const totalMins = Math.max(0, Math.floor(minutes));
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const paddedM = String(m).padStart(2, '0');

  const minSuffix = lang === 'fr' ? 'min' : 'm';

  if (h > 0) {
    return `${String(h)}h${paddedM}${minSuffix}`;
  }
  return `${paddedM}${minSuffix}`;
}

/**
 * Formats a duration expressed in total seconds into HH:mm:ss format.
 * Used for the daily filtration display (SPECIFICATIONS §6.5).
 * Example: 21600 s → "06:00:00"
 */
export function formatDurationHMS(totalSeconds: number): string {
  const total = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * Formats an ISO date string as a locale-aware short date.
 * Falls back to the raw string if parsing fails.
 * Example: "2024-01-15T10:00:00.000Z" (lang='en') → "Jan 15, 2024"
 */
export function formatDate(isoString: string, lang: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) {
    return isoString;
  }
  return date.toLocaleDateString(lang, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Formats a number with a fixed number of decimal places.
 * Example: formatNumber(7.449, 1) → "7.4"
 */
export function formatNumber(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

/**
 * Formats a ratio (0–1 or larger) as an integer percentage string.
 * Example: formatPercent(1.37) → "137%"
 */
export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
