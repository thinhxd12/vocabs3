import { fail } from '@sveltejs/kit';
import { parseKindleEntries, readKindleClipping } from '@darylserrano/kindle-clippings';
import {
	deleteHighlight,
	getHighlightById,
	getHighlightState,
	insertHighlights,
	saveHighlight,
	setCurrentHighlight,
	setLike,
	setNote
} from '#lib/server/db/highlights.ts';
import type { Actions, PageServerLoad } from './$types';

const MAX_CLIPPINGS = 2_000_000;

function text(form: FormData, name: string, max: number, allowEmpty = false): string {
	const value = form.get(name);
	if (typeof value !== 'string') throw new Error(`${name} must be text`);
	const trimmed = value.trim();
	if (!allowEmpty && trimmed.length === 0) throw new Error(`${name} is required`);
	if (trimmed.length > max) throw new Error(`${name} is too long`);
	return trimmed;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'Something went wrong';
}

export const load: PageServerLoad = async () => getHighlightState();

export const actions: Actions = {
	select: async ({ request }) => {
		try {
			const form = await request.formData();
			const id = text(form, 'id', 100);
			await setCurrentHighlight(id);
			const highlight = await getHighlightById(id);
			if (!highlight) return fail(404, { error: 'Highlight not found' });
			return { highlight };
		} catch (error) {
			return fail(400, { error: errorMessage(error) });
		}
	},

	save: async ({ request }) => {
		try {
			const form = await request.formData();
			const id = text(form, 'id', 100);
			const like = Number(form.get('like'));
			if (!Number.isInteger(like) || like < 0) throw new Error('like must be a non-negative integer');

			await saveHighlight({
				id,
				bookTile: text(form, 'bookTile', 20_000),
				authors: text(form, 'authors', 20_000),
				dateOfCreation: text(form, 'dateOfCreation', 20_000),
				content: text(form, 'content', 200_000),
				like
			});

			const highlight = await getHighlightById(id);
			if (!highlight) return fail(404, { error: 'Highlight not found' });
			return { highlight };
		} catch (error) {
			return fail(400, { error: errorMessage(error) });
		}
	},

	insert: async ({ request }) => {
		try {
			const form = await request.formData();
			const content = text(form, 'content', MAX_CLIPPINGS);
			const entries = parseKindleEntries(readKindleClipping(content));
			if (entries.length === 0) throw new Error('No highlights found in that text');

			const count = await insertHighlights(
				entries.map((entry) => ({
					authors: entry.authors,
					bookTile: entry.bookTile,
					page: entry.page,
					location: entry.location,
					dateOfCreation: entry.dateOfCreation,
					content: entry.content,
					type: entry.type
				}))
			);
			return { count };
		} catch (error) {
			return fail(422, { error: errorMessage(error) });
		}
	},

	like: async ({ request }) => {
		try {
			const form = await request.formData();
			const id = text(form, 'id', 100);
			const delta = form.get('delta') === '-1' ? -1 : 1;
			await setLike(id, delta);
			const highlight = await getHighlightById(id);
			return { like: highlight?.like ?? 0 };
		} catch (error) {
			return fail(400, { error: errorMessage(error) });
		}
	},

	note: async ({ request }) => {
		try {
			const form = await request.formData();
			const id = text(form, 'id', 100);
			const note = text(form, 'note', 20_000, true);
			await setNote(id, note);
			return { note };
		} catch (error) {
			return fail(400, { error: errorMessage(error) });
		}
	},

	delete: async ({ request }) => {
		try {
			const form = await request.formData();
			await deleteHighlight(text(form, 'id', 100));
			return { deleted: true };
		} catch (error) {
			return fail(400, { error: errorMessage(error) });
		}
	}
};
