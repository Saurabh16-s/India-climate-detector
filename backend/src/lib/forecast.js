// Open-Meteo is free for non-commercial use and needs no API key.
export async function getForecast({ lat, lon }) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: 'precipitation_sum',
    forecast_days: '5',
    timezone: 'Asia/Kolkata',
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
  return (await res.json()).daily; // { time: [...], precipitation_sum: [...] }
}
