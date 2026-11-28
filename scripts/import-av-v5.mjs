import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { gunzipSync } from 'node:zlib';
import { neon } from '@neondatabase/serverless';

const BATCH_SIZE = 500;
const sourcePath = process.argv[2];
if (!sourcePath || !existsSync(sourcePath)) {
	throw new Error('Usage: node --env-file=.env scripts/import-av-v5.mjs <path to _av_v5.db>');
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	throw new Error('DATABASE_URL is not set. Run: node --env-file=.env scripts/import-av-v5.mjs <path>');
}

const ENTITIES = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
	hellip: '…'
};

function decodeEntities(text) {
	return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|hellip);/gi, (full, token) => {
		if (token[0] !== '#') return ENTITIES[token.toLowerCase()] ?? full;
		const code = token[1].toLowerCase() === 'x'
			? Number.parseInt(token.slice(2), 16)
			: Number.parseInt(token.slice(1), 10);
		return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : full;
	});
}

function plainText(html) {
	return decodeEntities(html.replace(/<[^>]*>/g, ' '))
		.replace(/#+(?:\s*\.\s*#+)*/g, '')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^\d+\.(?!\d)\s*/, '');
}

function decodeAv(av) {
	if (!av) return '';
	const blob = Buffer.from(av);
	let html;
	if (blob.length >= 3 && blob[0] === 0x09 && blob[1] === 0x09 && blob[2] === 0x09) {
		const input = blob.subarray(3);
		const out = Buffer.from(input);
		const half = Math.floor(input.length / 2);
		const bound = half + 14;
		for (let i = 0; i < half * 2; i += 2) {
			if (i <= bound) {
				const swapped = out[i];
				out[i] = out[i + 1];
				out[i + 1] = swapped;
			}
		}
		if (input.length % 2 === 1) out[out.length - 1] = input[input.length - 1];
		html = gunzipSync(out).toString('utf8');
	} else {
		html = blob.toString('utf8');
	}
	return html
		.replace(/<d1/g, '<div class="')
		.replace(/<a1/g, '<a href="')
		.replace(/<s1/g, '<span class="')
		.replace(/<d3>/g, '</div></div></div>')
		.replace(/<s2>/g, '</span></span>');
}

function extractMeaning(av) {
	try {
		const html = decodeAv(av);
		const cut = html.search(/<h4>\s*family word\s*<\/h4>/i);
		const body = cut < 0 ? html : html.slice(0, cut);
		const entries = [];
		let current = null;
		let hasSense = false;
		for (const match of body.matchAll(/<div\b[^>]*\bclass\s*=\s*["']([^"']*)["'][^>]*>/gi)) {
			const classes = match[1].split(/\s+/);
			const isHeading = classes.includes('ub') || classes.includes('b');
			const isSense = classes.includes('m') || classes.includes('dm') || classes.includes('im');
			if (!isHeading && !isSense) continue;
			const rest = body.slice(match.index + match[0].length);
			const next = rest.search(/<div\b/i);
			const text = plainText(next < 0 ? rest : rest.slice(0, next));
			if (!text) continue;
			if (isHeading) {
				const partOfSpeech = text.toLowerCase();
				current = entries.find((entry) => entry.partOfSpeech === partOfSpeech);
				if (!current) {
					current = { partOfSpeech, translation: [] };
					entries.push(current);
				}
			} else {
				hasSense = true;
				if (!current) {
					current = { partOfSpeech: 'Nghĩa', translation: [] };
					entries.push(current);
				}
				current.translation.push(text);
			}
		}
		return hasSense ? entries.filter((entry) => entry.translation.length > 0) : [];
	} catch {
		return [];
	}
}

const source = new DatabaseSync(sourcePath, { readOnly: true });
let decoded = 0;
let fallback = 0;
const rows = source
	.prepare("SELECT word, pro, mean, av FROM av WHERE mean IS NOT NULL AND trim(mean) <> ''")
	.all()
	.map(({ word, pro, mean, av }) => {
		const extracted = extractMeaning(av);
		if (extracted.length > 0) decoded++;
		else fallback++;
		return {
			word: word.trim().normalize('NFC').toLowerCase(),
			pro: pro && pro.trim() ? pro : null,
			mean: JSON.stringify(extracted.length > 0 ? extracted : mean)
		};
	})
	.filter((row) => row.word !== '');
source.close();

const sql = neon(databaseUrl);
await sql.query('DROP TABLE IF EXISTS dictionary_v5');
await sql.query('CREATE TABLE dictionary_v5 (word text PRIMARY KEY, pro text, mean jsonb NOT NULL)');

for (let i = 0; i < rows.length; i += BATCH_SIZE) {
	const batch = rows.slice(i, i + BATCH_SIZE);
	const placeholders = batch.map((_, n) => `($${n * 3 + 1}, $${n * 3 + 2}, $${n * 3 + 3})`).join(', ');
	await sql.query(
		`INSERT INTO dictionary_v5 (word, pro, mean) VALUES ${placeholders} ON CONFLICT (word) DO NOTHING`,
		batch.flatMap((row) => [row.word, row.pro, row.mean])
	);
	console.log(`Imported ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
}

const [{ count: staged }] = await sql.query('SELECT count(*)::int AS count FROM dictionary_v5');
if (rows.length === 0 || staged !== rows.length) {
	throw new Error(`Refusing to swap dictionary: source ${rows.length} rows${rows.length === 0 ? ' (empty source)' : ''}, staged ${staged} rows`);
}
await sql.transaction([
	sql`DROP TABLE IF EXISTS dictionary`,
	sql`ALTER TABLE dictionary_v5 RENAME TO dictionary`
]);
const [{ count: total }] = await sql.query('SELECT count(*)::int AS count FROM dictionary');
console.log(`dictionary: ${total} rows (staged ${staged}, source ${rows.length}, decoded ${decoded}, fallback ${fallback})`);
