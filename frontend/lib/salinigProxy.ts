const DEFAULT_BACKEND_BASE = 'http://localhost:8000/api/v1';

function backendBase() {
  return (process.env.SALINIG_API_BASE ?? process.env.NEXT_PUBLIC_SALINIG_API_BASE ?? DEFAULT_BACKEND_BASE)
    .replace(/\/$/, '');
}

function backendHeaders(extra?: HeadersInit) {
  const headers = new Headers(extra);
  const apiKey = process.env.SALINIG_API_KEY ?? process.env.NEXT_PUBLIC_SALINIG_API_KEY;

  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (apiKey && !headers.has('x-api-key')) headers.set('x-api-key', apiKey);

  return headers;
}

export async function proxySalinig(path: string, init?: RequestInit) {
  const response = await fetch(`${backendBase()}${path}`, {
    ...init,
    cache: 'no-store',
    headers: backendHeaders(init?.headers),
  });
  const body = await response.text();
  const contentType = response.headers.get('content-type') ?? 'application/json';

  return new Response(body, {
    status: response.status,
    headers: { 'Content-Type': contentType },
  });
}

export async function proxySalinigStream(path: string, init?: RequestInit) {
  const response = await fetch(`${backendBase()}${path}`, {
    ...init,
    cache: 'no-store',
    headers: backendHeaders(init?.headers),
  });

  return new Response(response.body, {
    status: response.status,
    headers: {
      'Cache-Control': 'no-cache',
      'Content-Type': response.headers.get('content-type') ?? 'text/event-stream',
      'X-Accel-Buffering': 'no',
    },
  });
}
