import { proxySalinigStream } from '@/lib/salinigProxy';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return proxySalinigStream('/analysis/stream', {
    method: 'POST',
    body: await request.text(),
  });
}
