import type { APIRoute } from 'astro';
import { getPublicStats } from '../../lib/umami';

export const prerender = false;

export const GET: APIRoute = async () => {
  const stats = await getPublicStats();

  if (!stats.ok) {
    return new Response(JSON.stringify(stats), {
      status: 503,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  return new Response(JSON.stringify(stats), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
};
