import { fail, redirect } from '@sveltejs/kit';
import { LOGIN_EMAIL } from '$app/env/private';
import { auth } from '#lib/server/auth.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	let signedIn = false;

	try {
		const { data } = await auth(event).getSession();
		signedIn = Boolean(data?.session);
	} catch {
		// Auth is unreachable; still show the form.
	}

	if (signedIn) {
		redirect(303, '/');
	}
};

export const actions = {
	default: async (event) => {
		const password = (await event.request.formData()).get('password');

		if (typeof password !== 'string' || password.length === 0) {
			return fail(400, { error: 'Enter your password.' });
		}

		try {
			const { error } = await auth(event).signIn.email({
				email: LOGIN_EMAIL,
				password,
				rememberMe: true
			});

			if (error) {
				if (error.status >= 500) {
					return fail(503, { error: 'Sign-in is unavailable right now.' });
				}

				return fail(400, { error: 'Incorrect password.' });
			}
		} catch {
			return fail(503, { error: 'Sign-in is unavailable right now.' });
		}

		redirect(303, '/');
	}
} satisfies Actions;
