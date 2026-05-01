import { proxySalinig } from '@/lib/salinigProxy';

export const dynamic = 'force-dynamic';

export function GET() {
  return proxySalinig('/analysis/saved');
}

export async function POST(request: Request) {
  return proxySalinig('/analysis/saved', {
    method: 'POST',
    body: await request.text(),
  });
}
