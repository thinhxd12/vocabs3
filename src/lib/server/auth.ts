import {
	createAuthServer,
	extractNeonAuthCookies,
	NEON_AUTH_SESSION_COOKIE_NAME
} from '@neondatabase/auth/server';
import { NEON_AUTH_COOKIE_SECRET, NEON_AUTH_URL } from '$app/env/private';
import type { RequestEvent } from '@sveltejs/kit';

const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export function auth(event: Pick<RequestEvent, 'cookies' | 'request' | 'url'>) {
	return createAuthServer({
		baseUrl: NEON_AUTH_URL,
		cookieSecret: NEON_AUTH_COOKIE_SECRET,
		context: () => ({
			getCookies: () => extractNeonAuthCookies(event.request.headers.get('cookie') ?? ''),
			setCookie: (name, value, options) => {
				const session =
					name === NEON_AUTH_SESSION_COOKIE_NAME &&
					value !== '' &&
					options.maxAge !== 0;

				event.cookies.set(name, value, {
					...options,
					path: options.path ?? '/',
					...(session
						? {
								maxAge: SESSION_MAX_AGE,
								expires: new Date(Date.now() + SESSION_MAX_AGE * 1000)
							}
						: {})
				});
			},
			getHeader: (name) => event.request.headers.get(name),
			getOrigin: () => event.url.origin,
			getFramework: () => 'sveltekit'
		})
	});
}
