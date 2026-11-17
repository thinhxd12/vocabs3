import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_URL: { description: 'The database connection string.' },
	NEON_AUTH_URL: { description: 'The Neon Auth base URL.' },
	NEON_AUTH_COOKIE_SECRET: { description: 'Signs the Neon Auth session cache cookie.' },
	LOGIN_EMAIL: { description: 'The account email used by the password-only login.' }
});
