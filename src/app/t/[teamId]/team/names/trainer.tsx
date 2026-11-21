"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { strings } from "@/lib/strings";
import { Button } from "@/components/ui";
import { buttonClass } from "@/components/button-class";
import {
  cleanState,
  deckOf,
  emptyState,
  grade,
  learned,
  makeQuestion,
  nextCard,
  type Person,
  type Question,
  type TrainerState,
} from "@/lib/names";

const n = strings.names;
type Mode = "cards" | "quiz";

// Progress stays on this phone only. Storage can throw (private mode, quotas): then we just don't save.
function load(key: string): unknown {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}
function save(key: string, state: TrainerState) {
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function NameTrainer({ teamId, people }: { teamId: number; people: Person[] }) {
  const deck = useMemo(() => deckOf(people), [people]);
  const key = `roma:names:${teamId}`;
  const [state, setState] = useState<TrainerState>(emptyState);
  const [mode, setMode] = useState<Mode>("cards");
  const [lastId, setLastId] = useState<number | undefined>(undefined);
  const [revealed, setRevealed] = useState(false);
  const [question, setQuestion] = useState<Question | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    // Read saved progress after mount (the server render can't see localStorage).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(cleanState(load(key), deck));
  }, [key, deck]);

  const card = nextCard(deck, state, lastId);

  // Questions are built on tap (options are shuffled, so never during the server render).
  function newQuestion(avoidId?: number) {
    const c = nextCard(deck, state, avoidId);
    setQuestion(c ? makeQuestion(deck, c) : null);
    setPicked(null);
  }

  if (deck.length === 0) {
    return <p className="text-base text-ink-2">{n.emptyDeck}</p>;
  }

  function answer(correct: boolean) {
    if (!card) return;
    const next = grade(state, card.id, correct);
    setState(next);
    save(key, next);
    setLastId(card.id);
    setRevealed(false);
  }

  function pick(option: string) {
    if (!question || picked !== null) return;
    setPicked(option);
    const next = grade(state, question.card.id, question.correct.has(option));
    setState(next);
    save(key, next);
  }

  function nextQuestion() {
    if (question) setLastId(question.card.id);
    newQuestion(question?.card.id);
  }

  function reset() {
    const fresh = emptyState();
    setState(fresh);
    save(key, fresh);
    setLastId(undefined);
    setRevealed(false);
    setPicked(null);
    setQuestion(null);
    setMode("cards");
  }

  const known = learned(deck, state);

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label={n.modeLabel} className="grid grid-cols-2 gap-2">
        {(["cards", "quiz"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setRevealed(false);
              if (m === "quiz") newQuestion(lastId);
              else {
                setPicked(null);
                setQuestion(null);
              }
            }}
            className={buttonClass(mode === m ? "primary" : "outline")}
          >
            {m === "cards" ? n.cards : n.quiz}
          </button>
        ))}
      </div>

      <p className="text-sm text-ink-2" aria-live="polite">
        {n.progress(known, deck.length)}
      </p>

      {mode === "cards" && card ? (
        <div className="rounded-[var(--radius-control)] border border-rule bg-paper p-5 text-center">
          <p className="text-sm font-bold text-ink-2">{card.kind === "nickname" ? n.whoIsNick : n.whatFamily}</p>
          <p className="mt-2 text-[2rem] font-extrabold leading-tight">{card.cue}</p>
          {revealed ? (
            <>
              <p className="mt-3 text-xl font-bold text-now-ink">{card.full}</p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button variant="danger" onClick={() => answer(false)}>
                  <X aria-hidden size={18} />
                  {n.missed}
                </Button>
                <Button variant="primary" onClick={() => answer(true)}>
                  <Check aria-hidden size={18} />
                  {n.knew}
                </Button>
              </div>
            </>
          ) : (
            <Button variant="outline" className="mt-5 w-full" onClick={() => setRevealed(true)}>
              {n.reveal}
            </Button>
          )}
        </div>
      ) : null}

      {mode === "quiz" && question ? (
        <div className="rounded-[var(--radius-control)] border border-rule bg-paper p-5">
          <p className="text-center text-sm font-bold text-ink-2">
            {question.card.kind === "nickname" ? n.whoIsNick : n.whatFamily}
          </p>
          <p className="mt-2 text-center text-[2rem] font-extrabold leading-tight">{question.card.cue}</p>
          <ul className="mt-4 flex flex-col gap-2">
            {question.options.map((o) => {
              const isRight = question.correct.has(o);
              const shown = picked !== null;
              const tone = !shown
                ? "outline"
                : isRight
                  ? "primary"
                  : o === picked
                    ? "danger"
                    : "outline";
              return (
                <li key={o}>
                  <button
                    type="button"
                    disabled={shown}
                    onClick={() => pick(o)}
                    className={buttonClass(tone, "w-full disabled:opacity-100")}
                  >
                    {o}
                  </button>
                </li>
              );
            })}
          </ul>
          {picked !== null ? (
            <div className="mt-4">
              <p role="status" className={`text-center text-base font-bold ${question.correct.has(picked) ? "text-present-ink" : "text-absent-ink"}`}>
                {question.correct.has(picked) ? n.right : n.wrong(question.card.full)}
              </p>
              <Button variant="primary" className="mt-3 w-full" onClick={nextQuestion}>
                {n.next}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="text-xs text-ink-2">{n.privacy}</p>
      <div>
        <Button variant="quiet" onClick={reset}>
          {n.reset}
        </Button>
      </div>
    </div>
  );
}
