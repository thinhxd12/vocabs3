import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({ expiresAt: locals.sessionExpiresAt });
