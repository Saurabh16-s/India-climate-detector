import { esc } from './http.js';

const DISCLAIMER =
  'This is an automated message based on a model forecast and a historical risk ranking. It is not an official warning. ' +
  'For official alerts see IMD (https://mausam.imd.gov.in) and NDMA (https://ndma.gov.in).';

export function buildAlert(dist, result, unsubscribeUrl) {
  const where = `${dist.name}, ${dist.state}`;
  let subject;
  let lines;
  if (dist.hazard === 'Flood') {
    const kind = result.level === 'very_heavy' ? 'Very heavy' : 'Heavy';
    subject = `${kind} rain forecast for ${where}`;
    lines = [
      `${where} is ranked #${dist.rank} of ${dist.total} for flood risk in ${dist.state} in this tracker.`,
      `The forecast shows about ${Math.round(result.mm)} mm of rain on ${result.day}, which IMD classes as ${kind.toLowerCase()} rainfall.`,
      'If you live near a river, keep an eye on local flood updates over the next few days.',
    ];
  } else {
    subject = `Monsoon season: ${where} is a drought-prone district`;
    lines = [
      `${where} is ranked #${dist.rank} of ${dist.total} for drought risk in ${dist.state} in this tracker.`,
      'The monsoon (June to September) is when rainfall matters most for the year, so this is a good time to check local rainfall updates and water plans.',
    ];
  }
  const text = [...lines, '', DISCLAIMER, '', `Unsubscribe: ${unsubscribeUrl}`].join('\n');
  const html =
    lines.map((l) => `<p>${esc(l)}</p>`).join('') +
    `<p style="color:#6b7280;font-size:12px">${esc(DISCLAIMER)}</p>` +
    `<p style="font-size:12px"><a href="${esc(unsubscribeUrl)}">Unsubscribe</a></p>`;
  return { subject, text, html };
}
