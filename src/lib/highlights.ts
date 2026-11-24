/** One row of the `highlights` table: a saved Kindle highlight. */
export type Highlight = {
	id: string;
	authors: string;
	bookTile: string;
	content: string;
	dateOfCreation: string;
	like: number;
	location: string;
	page: number;
	type: string;
	note: string;
};

/** Stable lookup key so the same book hits the cache across clippings. */
export function bookInfoKey(bookTile: string, authors: string): string {
	const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
	return `${normalize(bookTile)}::${normalize((authors ?? '').split(';')[0])}`;
}

/** The slice of a book's catalogue record the info page can show. */
export type BookDetailType = {
	title: string | null;
	authors: string[];
	coverImage: string | null;
	rating: string | null;
	numberOfRatings: string | null;
	numberOfReviews: string | null;
	series: string | null;
	genres: string[];
	description: string | null;
	firstPublished: string | null;
	numberOfPages: string | null;
};

export type BookDetail = BookDetailType;

/** One flip page: the text printed on its two sides. */
export type BookPageContentType = {
	id: number;
	flip: boolean;
	front: string;
	back: string;
};

export type BookPageContent = BookPageContentType;

/** Only these tags are meaningful in a Kindle highlight; no attributes are kept. */
const ALLOWED_TAGS = new Set(['p', 'cite', 'br']);

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * Allowlist rather than deny-list: anything not `<p>`, `<cite>` or `<br>` is
 * dropped, and the text around it is escaped before it reaches `{@html}`.
 */
export function sanitizeHighlightHtml(html: string): string {
	const tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
	let result = '';
	let last = 0;

	for (const match of html.matchAll(tags)) {
		result += escapeHtml(html.slice(last, match.index));
		const name = match[1].toLowerCase();
		if (ALLOWED_TAGS.has(name)) {
			result += match[0].startsWith('</')
				? `</${name}>`
				: name === 'br'
					? '<br>'
					: `<${name}>`;
		}
		last = match.index + match[0].length;
	}

	return result + escapeHtml(html.slice(last));
}

export const safeHighlightHtml = sanitizeHighlightHtml;
