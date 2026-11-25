import { defineMiddleware } from 'astro:middleware';
import { getAdminSession } from './lib/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  const isAdminPage = pathname === '/admin' || pathname.startsWith('/admin/');
  const isAdminSignIn = pathname === '/admin/signin';
  const isAdminApi = pathname.startsWith('/api/admin/');
  const isPrivateArea =
    isAdminPage ||
    pathname === '/keystatic' ||
    pathname.startsWith('/keystatic/') ||
    pathname.startsWith('/api/');

  if (isAdminPage && !isAdminSignIn) {
    const session = getAdminSession(context.cookies);
    if (!session) {
      return context.redirect('/admin/signin', 302);
    }
  }

  if (isAdminApi) {
    const session = getAdminSession(context.cookies);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      });
    }

    const method = context.request.method.toUpperCase();
    if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
      const origin = context.request.headers.get('origin');
      if (!origin || origin !== context.url.origin) {
        return new Response(JSON.stringify({ error: 'Invalid origin' }), {
          status: 403,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'X-Robots-Tag': 'noindex, nofollow',
          },
        });
      }
    }
  }

  const response = await next();

  if (isPrivateArea) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  return response;
});
