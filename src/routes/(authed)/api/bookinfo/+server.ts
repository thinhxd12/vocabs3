import { json } from '@sveltejs/kit';
import { load, type CheerioAPI } from 'cheerio';
import { SECRET_FIRECRAWL_KEY } from '$app/env/private';
import { bookInfoKey, type BookDetailType } from '#lib/highlights.ts';
import type { RequestHandler } from './$types';

const GOODREADS = 'https://www.goodreads.com';
const CACHE_MS = 1000 * 60 * 60 * 48;
const cache = new Map<string, { value: BookDetailType | null; expires: number }>();

type BookSearch = {
	title: string | null;
	authors: string[];
	goodreadsId: string | null;
	numberOfRatings: string | null;
};

const orNull = (value: string) => value.trim() || null;
const ratingCount = (value: string | null) => Number((value ?? '').replace(/,/g, '')) || 0;

async function getHtml(pageUrl: string): Promise<string> {
	const response = await fetch('https://api.firecrawl.dev/v2/scrape', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${SECRET_FIRECRAWL_KEY}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			url: pageUrl,
			onlyMainContent: false,
			maxAge: CACHE_MS,
			formats: ['html']
		}),
		signal: AbortSignal.timeout(20_000)
	});
	if (!response.ok) throw new Error(`Firecrawl responded with ${response.status}`);
	const body = (await response.json()) as { data?: { html?: unknown } };
	const html = body.data?.html;
	if (typeof html !== 'string' || !html) throw new Error('Firecrawl returned no HTML');
	return html;
}

function parseSearch(html: string, author: string): string | null {
	const $ = load(html);
	const results: BookSearch[] = [];
	$('div.Book').each((_index, element) => {
		const $el = $(element);
		const href = $el.find('.Book__content a').attr('href');
		const detailsUrl = href ? new URL(href, GOODREADS).toString() : null;
		results.push({
			title: orNull($el.find('.Book__content').text()) ?? null,
			authors: [$el.find('.BookAuthors').text().trim()],
			goodreadsId: detailsUrl?.match(/\/show\/(\d+)/)?.[1] ?? null,
			numberOfRatings: orNull($el.find('.BookStats__counts > span').first().text())
		});
	});
	results.sort((a, b) => ratingCount(b.numberOfRatings) - ratingCount(a.numberOfRatings));
	const wanted = author.toLowerCase();
	const match = results.find((book) =>
		book.authors.some((name) => name.toLowerCase().includes(wanted))
	);
	return (match ?? results[0])?.goodreadsId ?? null;
}

function parseDetails(html: string): BookDetailType {
	const $: CheerioAPI = load(html);
	const detail: BookDetailType = {
		title: null,
		authors: [],
		coverImage: null,
		rating: null,
		numberOfRatings: null,
		numberOfReviews: null,
		series: null,
		genres: [],
		description: null,
		firstPublished: null,
		numberOfPages: null
	};

	const titleSection = $('.BookPageTitleSection__title');
	const series = titleSection.find('h3.Text__italic a').text().trim();
	detail.series = orNull(series);
	detail.title = orNull(series ? titleSection.find('h1[data-testid="bookTitle"]').text() : titleSection.text());

	$('.ContributorLinksList .ContributorLink').each((_index, element) => {
		const name = orNull($(element).text().replace(/\s+/g, ' '));
		if (name) detail.authors.push(name);
	});

	const ratingText = orNull($('.RatingStatistics__rating').first().text());
	const rating = Number(ratingText);
	// A crawl with no usable rating can yield "NaN"; never send that to the UI.
	detail.rating = ratingText && Number.isFinite(rating) && rating >= 0 && rating <= 5 ? ratingText : null;
	const stats = $('.RatingStatistics__meta').first().text();
	detail.numberOfRatings = orNull(stats.match(/(\d+(?:,\d+)*)\s+ratings/)?.[1] ?? '');
	detail.numberOfReviews = orNull(stats.match(/(\d+(?:,\d+)*)\s+reviews/)?.[1] ?? '');

	const cover = $('.BookCover__image img.ResponsiveImage').attr('src');
	detail.coverImage = cover ? new URL(cover, GOODREADS).toString() : null;

	$('.BookPageMetadataSection__genres .Button__labelItem').each((_index, element) => {
		const genre = $(element).text().trim();
		if (genre && genre !== '...show all') detail.genres.push(genre);
	});

	detail.description = orNull(
		$('.BookPageMetadataSection__description .TruncatedContent__text').first().text()
	);
	detail.numberOfPages = orNull(
		$('p[data-testid="pagesFormat"]').text().match(/(\d+)\s*pages/)?.[1] ?? ''
	);
	detail.firstPublished = orNull(
		$('p[data-testid="publicationInfo"]').text().match(/First published\s+(.+)/)?.[1] ?? ''
	);

	return detail;
}

export const GET: RequestHandler = async ({ url }) => {
	const query = (url.searchParams.get('query') ?? '').trim();
	const author = (url.searchParams.get('author') ?? '').trim();
	if (!query || query.length > 200 || author.length > 200) {
		return json({ error: 'Invalid book query' }, { status: 400 });
	}

	const key = bookInfoKey(query, author);
	const cached = cache.get(key);
	if (cached) {
		if (cached.expires > Date.now()) {
			return cached.value
				? json(cached.value)
				: json({ error: 'Book not found' }, { status: 404 });
		}
		cache.delete(key);
	}

	try {
		const searchUrl = new URL('/search', GOODREADS);
		searchUrl.search = new URLSearchParams({
			utf8: '✓',
			q: query,
			search_type: 'books'
		}).toString();

		const id = parseSearch(await getHtml(searchUrl.toString()), author);
		const info = id ? parseDetails(await getHtml(`${GOODREADS}/book/show/${id}`)) : null;
		cache.set(key, { value: info, expires: Date.now() + CACHE_MS });
		return info
			? json(info)
			: json({ error: 'Book not found' }, { status: 404 });
	} catch {
		return json({ error: 'Book metadata lookup failed' }, { status: 502 });
	}
};
