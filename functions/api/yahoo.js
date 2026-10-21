/**
 * GitHub Pages Function — proxies Yahoo Finance chart history.
 * Mounted at /api/yahoo (same contract as server.py).
 *
 * Privacy: the request is forwarded to Yahoo and nothing is stored,
 * logged or cached. Only the ticker symbol travels - no cookies, no
 * identifiers, no analytics.
 */
const SYMBOL_RE = /^[A-Za-z0-9.^=-]{1,24}$/;
const PERIOD_YEARS = { '1y': 1, '2y': 2, '5y': 5, '10y': 10, '20y': 20 };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function onRequest({ request }) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get('symbol') || '').trim();
  const period = url.searchParams.get('period') || '5y';

  if (!SYMBOL_RE.test(symbol)) return json({ error: 'Enter a valid Yahoo Finance ticker' }, 400);
  const years = PERIOD_YEARS[period];
  if (!years) return json({ error: 'Unsupported history period' }, 400);

  const end = new Date();
  const start = new Date(end.getTime() - Math.round(years * 365.2425 * 86400000) - 14 * 86400000);
  const query = new URLSearchParams({
    period1: String(Math.floor(start.getTime() / 1000)),
    period2: String(Math.floor(end.getTime() / 1000)),
    interval: '1d',
    includeAdjustedClose: 'true',
    events: 'div,splits',
  });
  const target = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${query}`;

  try {
    const upstream = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
      },
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        // Never cache a market data response: it would keep the queried
        // symbol in the CDN cache.
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (err) {
    return json({ error: 'Could not reach Yahoo Finance' }, 502);
  }
}
