// Ported from the old app so the FSRS page can show meanings on demand.
export type WikiTranslationType = {
	partOfSpeech: string;
	translation: string[];
};

export async function googleTranslation(word: string, apiKey: string): Promise<WikiTranslationType[]> {
	const url = `https://vocabstts.vercel.app/trans?text=${encodeURIComponent(word)}&from=auto&to=vi`;
	const response = await fetch(url, { headers: { "x-api-key": apiKey } });
	if (!response.ok) return [];
	const data: unknown = await response.json();
	if (!isRecord(data)) return [];

	if (isRecord(data.translations)) {
		const translations: WikiTranslationType[] = [];
		for (const [partOfSpeech, items] of Object.entries(data.translations)) {
			if (!Array.isArray(items)) continue;
			const translation: string[] = [];
			for (const item of items) {
				if (isRecord(item) && typeof item.translation === 'string' && item.translation) {
					translation.push(item.translation);
				}
			}
			if (translation.length > 0) translations.push({ partOfSpeech, translation });
		}
		if (translations.length > 0) return translations;
	}

	const text = data.translation;
	if (typeof text !== 'string' || !text) return [];
	if (text.trim().toLowerCase() === word.trim().toLowerCase()) return [];
	return [{ partOfSpeech: 'Translation', translation: [text] }];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
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
		const response = await fetch(`/api/fsrs-lookup?word=${encodeURIComponent(word)}`);
		if (response.ok) {
			const data = await response.json();
			if (isTranslations(data?.translation) && data.translation.length > 0) return data.translation;
		}
	} catch {
		// no translation available
	}
	return [];
}
