// Ported from the old app so the FSRS page can show meanings on demand.
export type WikiTranslationType = {
	partOfSpeech: string;
	translation: string[];
};

async function googleTranslation(word: string): Promise<WikiTranslationType[]> {
	const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=vi&q=${encodeURIComponent(word)}`;
	const response = await fetch(url);
	if (!response.ok) return [];
	const data = await response.json();
	const text = data?.[0]?.[0];
	return typeof text === 'string' && text ? [{ partOfSpeech: 'Translation', translation: [text] }] : [];
}

export async function getTranslation(word: string): Promise<WikiTranslationType[]> {
	const url = `https://dict.minhqnd.com/api/v1/lookup?word=${encodeURIComponent(word)}&lang=en&def_lang=vi`;
	const response = await fetch(url);
	if (response.ok) {
		const data = await response.json().catch(() => null);
		const meanings = data?.results?.[0]?.meanings;
		if (Array.isArray(meanings)) {
			const grouped = new Map<string, WikiTranslationType>();
			for (const item of meanings) {
				if (!item || typeof item.pos !== 'string' || typeof item.definition !== 'string') continue;
				const entry: WikiTranslationType = grouped.get(item.pos) ?? {
					partOfSpeech: item.pos,
					translation: []
				};
				entry.translation.push(item.definition);
				grouped.set(item.pos, entry);
			}
			const result = [...grouped.values()];
			if (result.length) return result;
		}
	}
	return googleTranslation(word);
}
