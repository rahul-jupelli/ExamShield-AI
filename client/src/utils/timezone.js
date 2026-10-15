/**
 * Timezone utilities for ExamShield AI.
 * Explicitly operates in Asia/Kolkata (Indian Standard Time, UTC+05:30)
 * to prevent timezone drift and browser-locale discrepancies.
 */

export const TIMEZONE = 'Asia/Kolkata';

/**
 * Converts a date string (YYYY-MM-DD) and time string (HH:mm) entered in Asia/Kolkata
 * into an ISO 8601 string with explicit +05:30 offset for timestamptz columns.
 *
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {string} timeStr - 'HH:mm'
 * @returns {string} - 'YYYY-MM-DDTHH:mm:00+05:30'
 */
export function kolkataInputsToIso(dateStr, timeStr) {
  if (!dateStr || !timeStr) return '';
  const cleanDate = dateStr.trim();
  const cleanTime = timeStr.trim().length === 5 ? `${timeStr.trim()}:00` : timeStr.trim();
  return `${cleanDate}T${cleanTime}+05:30`;
}

/**
 * Converts an ISO timestamp into Asia/Kolkata date & time strings for HTML form inputs.
 *
 * @param {string | Date} isoString
 * @returns {{ date: string, time: string }}
 */
export function isoToKolkataInputs(isoString) {
  if (!isoString) return { date: '', time: '' };
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return { date: '', time: '' };

    // Format using Intl.DateTimeFormat in Asia/Kolkata timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(d);
    let year = '', month = '', day = '', hour = '', minute = '';
    for (const p of parts) {
      if (p.type === 'year') year = p.value;
      if (p.type === 'month') month = p.value;
      if (p.type === 'day') day = p.value;
      if (p.type === 'hour') hour = p.value;
      if (p.type === 'minute') minute = p.value;
    }

    return {
      date: `${year}-${month}-${day}`,
      time: `${hour}:${minute}`,
    };
  } catch (err) {
    console.warn('[Timezone] Error parsing ISO string for inputs:', err);
    return { date: '', time: '' };
  }
}

/**
 * Formats an ISO timestamp for display in Asia/Kolkata.
 *
 * @param {string | Date} isoString
 * @param {'full' | 'date' | 'time' | 'short'} [style='full']
 * @returns {string}
 */
export function formatKolkata(isoString, style = 'full') {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';

    let options = {};
    if (style === 'full') {
      options = {
        timeZone: TIMEZONE,
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      };
    } else if (style === 'date') {
      options = {
        timeZone: TIMEZONE,
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      };
    } else if (style === 'time') {
      options = {
        timeZone: TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      };
    } else if (style === 'short') {
      options = {
        timeZone: TIMEZONE,
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      };
    }

    return new Intl.DateTimeFormat('en-IN', options).format(d) + ' IST';
  } catch (err) {
    return '—';
  }
}

/**
 * Returns human-readable relative time difference from now.
 *
 * @param {string | Date} isoString
 * @returns {string}
 */
export function getRelativeTime(isoString) {
  if (!isoString) return '';
  const now = Date.now();
  const target = new Date(isoString).getTime();
  if (isNaN(target)) return '';

  const diffMs = target - now;
  const isFuture = diffMs > 0;
  const absDiffSec = Math.floor(Math.abs(diffMs) / 1000);

  if (absDiffSec < 60) {
    return isFuture ? `in ${absDiffSec}s` : `${absDiffSec}s ago`;
  }
  const absDiffMin = Math.floor(absDiffSec / 60);
  if (absDiffMin < 60) {
    return isFuture ? `in ${absDiffMin}m` : `${absDiffMin}m ago`;
  }
  const absDiffHours = Math.floor(absDiffMin / 60);
  if (absDiffHours < 24) {
    return isFuture ? `in ${absDiffHours}h` : `${absDiffHours}h ago`;
  }
  const absDiffDays = Math.floor(absDiffHours / 24);
  return isFuture ? `in ${absDiffDays}d` : `${absDiffDays}d ago`;
}
