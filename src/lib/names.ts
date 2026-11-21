// Name trainer (Phase 4): flashcards with simple spaced repetition, and a pick-the-name quiz.
// Pure functions only, so they can be unit-tested (scripts/test-names.ts). Progress lives on the
// phone (localStorage), never in the database: it's personal and not worth collecting.

export type Person = { id: number; first_name: string; last_name: string; nickname: string | null };

/**
 * What the card shows, and what you have to recall.
 *   * With a nickname: "Nicky" → the full name.
 *   * Otherwise: the first name → the family name (what roll call and staff use).
 * People with neither a nickname nor a family name can't be quizzed.
 */
export type Card = { id: number; cue: string; answer: string; full: string; last: string; kind: "nickname" | "first" };

export function fullNameOf(p: Pick<Person, "first_name" | "last_name">) {
  return [p.first_name, p.last_name].map((s) => s.trim()).filter(Boolean).join(" ");
}

export function toCard(p: Person): Card | null {
  const nick = p.nickname?.trim();
  const full = fullNameOf(p);
  const last = p.last_name.trim();
  if (nick) return { id: p.id, cue: nick, answer: full, full, last, kind: "nickname" };
  if (!last) return null;
  return { id: p.id, cue: p.first_name.trim(), answer: last, full, last, kind: "first" };
}

export function deckOf(people: Person[]): Card[] {
  return people.map(toCard).filter((c): c is Card => c !== null);
}

// Spaced repetition: Leitner boxes counted in turns (cards seen), not days, because a role-holder
// trains in short bursts before their turn. A card you miss comes back in 2 turns; each correct
// answer moves it up a box and doubles the gap.
export type Progress = Record<number, { box: number; due: number }>;
export type TrainerState = { turn: number; progress: Progress };

export const MAX_BOX = 5;

export function emptyState(): TrainerState {
  return { turn: 0, progress: {} };
}

/** The card to show next: the most overdue one; unseen cards count as due now, in roster order. */
export function nextCard(deck: Card[], state: TrainerState, avoidId?: number): Card | null {
  if (deck.length === 0) return null;
  const dueOf = (c: Card) => state.progress[c.id]?.due ?? state.turn;
  const pool = deck.length > 1 && avoidId !== undefined ? deck.filter((c) => c.id !== avoidId) : deck;
  let best = pool[0];
  for (const c of pool) if (dueOf(c) < dueOf(best)) best = c;
  return best;
}

export function grade(state: TrainerState, cardId: number, correct: boolean): TrainerState {
  const turn = state.turn + 1;
  const prev = state.progress[cardId]?.box ?? 0;
  const box = correct ? Math.min(prev + 1, MAX_BOX) : 1;
  const due = turn + (correct ? 2 ** box : 2);
  return { turn, progress: { ...state.progress, [cardId]: { box, due } } };
}

/** How many cards reached the top two boxes ("you know these"). */
export function learned(deck: Card[], state: TrainerState) {
  return deck.filter((c) => (state.progress[c.id]?.box ?? 0) >= MAX_BOX - 1).length;
}

/** Drops progress for people no longer on the roster, and anything malformed from storage. */
export function cleanState(raw: unknown, deck: Card[]): TrainerState {
  if (!raw || typeof raw !== "object") return emptyState();
  const r = raw as { turn?: unknown; progress?: unknown };
  const turn = typeof r.turn === "number" && Number.isFinite(r.turn) && r.turn >= 0 ? Math.floor(r.turn) : 0;
  const ids = new Set(deck.map((c) => c.id));
  const progress: Progress = {};
  if (r.progress && typeof r.progress === "object") {
    for (const [k, v] of Object.entries(r.progress as Record<string, unknown>)) {
      const id = Number(k);
      const p = v as { box?: unknown; due?: unknown };
      if (ids.has(id) && typeof p?.box === "number" && typeof p?.due === "number") {
        progress[id] = { box: Math.max(1, Math.min(MAX_BOX, Math.floor(p.box))), due: Math.floor(p.due) };
      }
    }
  }
  return { turn, progress };
}

// Quiz ("practice mode"): show the cue, pick the answer from up to 4 options.
// Options never repeat, and a distractor is never also a right answer: two people can share a
// first name, so "Noa" accepts the family name of either Noa.

export type Question = { card: Card; options: string[]; correct: Set<string> };

/** rand: a function returning [0, 1), injectable for tests. */
export function makeQuestion(deck: Card[], card: Card, rand: () => number = Math.random): Question {
  const sameCue = deck.filter((c) => c.kind === card.kind && c.cue === card.cue);
  const correct = new Set(sameCue.map((c) => c.answer));
  // Distractors come from everyone in the deck, in the same shape as the answer.
  const pool = card.kind === "nickname" ? deck.map((c) => c.full) : deck.map((c) => c.last).filter(Boolean);
  const candidates = [...new Set(pool)].filter((a) => !correct.has(a));
  const distractors = shuffle(candidates, rand).slice(0, 3);
  return { card, options: shuffle([card.answer, ...distractors], rand), correct };
}

export function shuffle<T>(items: T[], rand: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
