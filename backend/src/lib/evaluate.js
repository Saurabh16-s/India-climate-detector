// Decides whether a district needs an alert right now.
//  - Flood districts: heavy rain in the 5-day forecast. Thresholds are the
//    IMD daily rainfall categories (heavy 64.5 mm, very heavy 115.6 mm).
//  - Drought districts: one advisory per year when the monsoon starts (June).
//    A real drought forecast needs a better signal than a rain forecast.
export const HEAVY_MM = 64.5;
export const VERY_HEAVY_MM = 115.6;
export const RANK = { season: 1, heavy: 1, very_heavy: 2 };
export const COOLDOWN_HOURS = { season: 90 * 24, heavy: 72, very_heavy: 72 };

const istMonth = (now) =>
  Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', month: 'numeric' }).format(now));

export function evaluate(dist, forecast, now = new Date()) {
  if (dist.hazard === 'Flood') {
    const days = forecast?.time ?? [];
    const mm = forecast?.precipitation_sum ?? [];
    let max = 0;
    let day = null;
    for (let i = 0; i < Math.min(5, days.length); i++) {
      if (mm[i] != null && mm[i] > max) {
        max = mm[i];
        day = days[i];
      }
    }
    if (max >= VERY_HEAVY_MM) return { level: 'very_heavy', mm: max, day };
    if (max >= HEAVY_MM) return { level: 'heavy', mm: max, day };
    return null;
  }
  return istMonth(now) === 6 ? { level: 'season' } : null;
}

// Skip if this district was alerted recently at the same or a higher level.
export function shouldSend(level, state, nowMs = Date.now()) {
  if (!state) return true;
  const withinCooldown = nowMs - state.sentAt < COOLDOWN_HOURS[state.level] * 3600_000;
  return !(withinCooldown && RANK[level] <= RANK[state.level]);
}
