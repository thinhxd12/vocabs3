import { createEmptyCard, fsrs, type Card, type FSRSParameters } from 'ts-fsrs';
import { v7 as uuidv7 } from 'uuid';

// FSRS-6 defaults pinned here so server and client schedule identically.
export const DEFAULT_FSRS_PARAMS = {
	request_retention: 0.9,
	maximum_interval: 36500,
	enable_fuzz: true,
	enable_short_term: true,
	learning_steps: ['9m'],
	relearning_steps: ['6m'],
	w: [
		0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796,
		1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542
	]
} satisfies Partial<FSRSParameters>;

export type Word = {
	id: string;
	word: string;
	createdAt: string;
	card: Card;
};

export const createScheduler = () => fsrs(DEFAULT_FSRS_PARAMS);

export function newWord(word: string): Word {
	return {
		id: uuidv7(),
		word,
		createdAt: new Date().toISOString(),
		card: createEmptyCard()
	};
}
