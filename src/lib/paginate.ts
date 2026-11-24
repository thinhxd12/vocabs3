/** Measures the rendered height of a candidate page at the given text width. */
export type Measure = (markup: string, width: number, firstPage: boolean) => number;

/**
 * Splits text into page-sized blocks by binary search: ~log2(words) layout
 * measurements per page instead of one per word. An odd tail gets a blank
 * verso so every sheet has two sides.
 */
export function paginate(
	text: string,
	width: number,
	height: number,
	measure: Measure
): string[] {
	const words = text.trim().split(/\s+/).filter(Boolean);
	const maxHeight = Math.max(60, height);
	const maxWidth = Math.max(60, width);
	const blocks: string[] = [];
	let start = 0;

	while (start < words.length) {
		const firstPage = blocks.length === 0;
		let low = start + 1;
		let high = words.length;
		let best = start + 1;

		while (low <= high) {
			const mid = (low + high) >> 1;
			if (measure(words.slice(start, mid).join(' '), maxWidth, firstPage) < maxHeight) {
				best = mid;
				low = mid + 1;
			} else {
				high = mid - 1;
			}
		}

		blocks.push(words.slice(start, best).join(' '));
		start = best;
	}

	if (blocks.length === 0) blocks.push('');
	if (blocks.length % 2 !== 0) blocks.push('');
	return blocks;
}
