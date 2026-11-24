import assert from 'node:assert/strict';
import test from 'node:test';
import { paginate } from './paginate.ts';

/**
 * @typedef {(markup: string, width: number, firstPage: boolean) => number} Measure
 */

/** @type {Measure} */
const measure = (markup) => markup.split(' ').filter(Boolean).length * 10;

test('packs words up to the page height', () => {
	/** @type {Measure} */
	const tall = (markup) => markup.split(' ').filter(Boolean).length * 100;
	assert.deepEqual(paginate('a b c d e f g', 100, 250, tall), [
		'a b',
		'c d',
		'e f',
		'g'
	]);
});

test('empty text still yields two blank sides', () => {
	assert.deepEqual(paginate('   ', 100, 31, measure), ['', '']);
});

test('an odd tail gets a blank verso', () => {
	assert.deepEqual(paginate('a b c', 100, 100, measure), ['a b c', '']);
});

test('a page that exactly fills the height does not take the last word', () => {
	// 10 words at 10px = 100px; the page is 100px, so only 9 fit.
	assert.deepEqual(paginate('a b c d e f g h i j', 100, 100, measure), [
		'a b c d e f g h i',
		'j'
	]);
});

test('a word taller than the page still makes progress', () => {
	assert.deepEqual(paginate('one two', 100, 5, () => 1000), ['one', 'two']);
});

test('the first page is measured with the drop-cap flag', () => {
	/** @type {Measure} */
	const withDropCap = (markup, _width, firstPage) =>
		markup.split(' ').filter(Boolean).length * 10 + (firstPage ? 100 : 0);
	assert.deepEqual(paginate('a b c d', 100, 60, withDropCap), ['a', 'b c d']);
});
