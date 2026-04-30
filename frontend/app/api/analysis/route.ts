import { proxySalinig } from '@/lib/salinigProxy';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return proxySalinig('/analysis/', {
    method: 'POST',
    body: await request.text(),
  });
}
