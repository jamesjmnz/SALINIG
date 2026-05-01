import { proxySalinig } from '@/lib/salinigProxy';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{
    reportId: string;
  }>;
}

export async function GET(_: Request, context: RouteContext) {
  const { reportId } = await context.params;
  return proxySalinig(`/analysis/saved/${reportId}`);
}
