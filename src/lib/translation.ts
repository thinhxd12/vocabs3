// Ported from the old app so the FSRS page can show meanings on demand.
export type WikiTranslationType = {
	partOfSpeech: string;
	translation: string[];
};

export async function googleTranslation(word: string): Promise<WikiTranslationType[]> {
	const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=vi&q=${encodeURIComponent(word)}`;
	const response = await fetch(url);
	if (!response.ok) return [];
	const data = await response.json();
	const text = data?.[0]?.[0];
	return typeof text === 'string' && text ? [{ partOfSpeech: 'Translation', translation: [text] }] : [];
}

function isTranslations(value: unknown): value is WikiTranslationType[] {
	return (
		Array.isArray(value) &&
		value.every(
			(item) =>
				typeof item?.partOfSpeech === 'string' &&
				Array.isArray(item.translation) &&
				item.translation.every((definition: unknown) => typeof definition === 'string')
		)
	);
}

export async function getTranslation(word: string): Promise<WikiTranslationType[]> {
	try {
		const response = await fetch(`/api/dictionary?word=${encodeURIComponent(word)}`);
		if (response.ok) {
			const data = await response.json();
			if (isTranslations(data?.translations) && data.translations.length > 0) return data.translations;
		}
	} catch {
		// fall back to Google below
	}
	return googleTranslation(word);
}
