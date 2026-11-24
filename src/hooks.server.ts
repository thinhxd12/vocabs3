import { error, isHttpError, isRedirect, redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { auth } from '#lib/server/auth.ts';

export const handle: Handle = async ({ event, resolve }) => {
	const isProtected = event.route.id?.startsWith('/(authed)') ?? false;
	const isLogin = event.route.id === '/login';

	event.locals.sessionExpiresAt = null;

	if (isProtected) {
		try {
			const { data, error: authError } = await auth(event).getSession();

			if (authError) {
				error(503, 'Authentication unavailable');
			}

			if (!data?.session) {
				redirect(303, '/login');
			}

			event.locals.sessionExpiresAt = new Date(data.session.expiresAt).getTime();
		} catch (e) {
			if (isHttpError(e) || isRedirect(e)) throw e;
			error(503, 'Authentication unavailable');
		}
	}

	const response = await resolve(event);

	// Radar frames are immutable and cacheable; don't force no-store on them.
	if ((isProtected || isLogin) && event.route.id !== '/(authed)/api/radar') {
		response.headers.set('cache-control', 'no-store');
	}

	return response;
};
