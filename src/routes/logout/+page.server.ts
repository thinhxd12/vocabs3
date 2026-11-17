import { redirect } from '@sveltejs/kit';
import {
	NEON_AUTH_SESSION_COOKIE_NAME,
	NEON_AUTH_SESSION_DATA_COOKIE_NAME
} from '@neondatabase/auth/server';
import { auth } from '#lib/server/auth.ts';
import type { Actions, PageServerLoad } from './$types';

// Sign-out is POST-only; a direct GET just goes back to the login page.
export const load: PageServerLoad = () => redirect(303, '/login');

export const actions = {
	default: async (event) => {
		try {
			await auth(event).signOut();
		} catch {
			// clear the local cookies even if the upstream call fails
		}

		// The names use the `__Secure-` prefix, so the browser rejects the
		// deletion unless the Secure attribute is present (SvelteKit omits it
		// on localhost by default).
		event.cookies.delete(NEON_AUTH_SESSION_COOKIE_NAME, { path: '/', secure: true });
		event.cookies.delete(NEON_AUTH_SESSION_DATA_COOKIE_NAME, { path: '/', secure: true });

		redirect(303, '/login');
	}
} satisfies Actions;
