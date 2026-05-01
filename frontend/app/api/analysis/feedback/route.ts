import { proxySalinig } from '@/lib/salinigProxy';

export const dynamic = 'force-dynamic';

export function GET() {
  return proxySalinig('/analysis/feedback');
}

export async function POST(request: Request) {
  return proxySalinig('/analysis/feedback', {
    method: 'POST',
    body: await request.text(),
  });
}
