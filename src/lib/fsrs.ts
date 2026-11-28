import { createEmptyCard, fsrs, type Card, type FSRSParameters } from "ts-fsrs";
import { v7 as uuidv7 } from "uuid";

// FSRS-6 defaults pinned here so server and client schedule identically.
export const DEFAULT_FSRS_PARAMS = {
  request_retention: 0.9,
  maximum_interval: 36500,
  enable_fuzz: true,
  enable_short_term: true,
  learning_steps: ["6m"],
  relearning_steps: ["6m"],
  w: [
    0.161149263381958, 0.9829344749450684, 1.7532583475112915,
    6.305800914764404, 6.498642921447754, 0.7430603504180908,
    3.0528388023376465, 0.0010000000474974513, 1.6967015266418457,
    0.14875493943691254, 0.6964629292488098, 1.4745129346847534,
    0.06259484589099884, 0.25659847259521484, 1.655496597290039,
    0.5223161578178406, 1.635328769683838, 0.579133152961731,
    0.11777027696371078, 0.07477118074893951, 0.15746261179447174,
  ],
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
    card: createEmptyCard(),
  };
}
