import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const EXPECTED_ROWS = 360;
const csvPath = join(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'src',
	'lib',
	'data',
	'pomodoro_table_rows.csv'
);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	throw new Error(
		'DATABASE_URL is not set. Run: node --env-file=.env scripts/import-pomodoro.mjs'
	);
}

const lines = readFileSync(csvPath, 'utf8').split(/\r?\n/);
if (lines.at(-1) === '') lines.pop();
if (lines.shift()?.trim() !== 'date,time') {
	throw new Error(`Unexpected CSV header in ${csvPath}; expected "date,time"`);
}

const seenDates = new Set();
const rows = lines.map((line, index) => {
	const lineNumber = index + 2;
	const fields = line.split(',');
	if (fields.length !== 2) {
		throw new Error(`Line ${lineNumber}: expected 2 fields, got ${fields.length}`);
	}

	const date = fields[0].trim();
	const time = fields[1].trim();

	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		throw new Error(`Line ${lineNumber}: invalid date "${date}" (expected YYYY-MM-DD)`);
	}
	const parsed = new Date(`${date}T00:00:00Z`);
	if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
		throw new Error(`Line ${lineNumber}: "${date}" is not a real calendar date`);
	}
	if (seenDates.has(date)) {
		throw new Error(`Line ${lineNumber}: duplicate date "${date}"`);
	}
	seenDates.add(date);

	if (!/^\d+$/.test(time) || Number(time) <= 0) {
		throw new Error(`Line ${lineNumber}: invalid time "${time}" (expected a positive integer)`);
	}

	return [date, Number(time)];
});

if (rows.length !== EXPECTED_ROWS) {
	throw new Error(`Expected ${EXPECTED_ROWS} data rows, got ${rows.length}`);
}

const sql = neon(databaseUrl);
const placeholders = rows.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');

// One statement; 720 params is far below PostgreSQL's 65535 parameter limit.
const inserted = await sql.query(
	`INSERT INTO pomodoro (date, time) VALUES ${placeholders} ON CONFLICT (date) DO NOTHING RETURNING date`,
	rows.flat()
);

console.log(
	`Inserted ${inserted.length} of ${rows.length} rows into pomodoro (${rows.length - inserted.length} already existed).`
);
