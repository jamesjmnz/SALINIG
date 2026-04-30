import { proxySalinig } from '@/lib/salinigProxy';

export const dynamic = 'force-dynamic';

export function GET() {
  return proxySalinig('/analysis/options');
}
