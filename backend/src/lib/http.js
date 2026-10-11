export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

// Small standalone HTML page. `button` adds a POST form (so email link
// scanners that only GET links cannot confirm or unsubscribe anyone).
export const page = (statusCode, title, message, button) => ({
  statusCode,
  headers: { 'content-type': 'text/html; charset=utf-8' },
  body: `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:15vh auto;padding:0 20px;color:#16181d">
<h1 style="font-size:22px">${esc(title)}</h1>
<p style="color:#444;line-height:1.5">${esc(message)}</p>
${button ? `<form method="post"><button style="font:inherit;padding:10px 18px;border:0;border-radius:8px;background:#d62828;color:#fff;cursor:pointer">${esc(button)}</button></form>` : ''}
</body>`,
});
