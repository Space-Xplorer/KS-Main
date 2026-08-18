"use client";

import { useEffect, useRef, useState } from "react";

import { CoordinateForm } from "./coordinate-form";
import { isWithinTolerance, type Coordinates } from "./coordinates";
import { LaunchSequence } from "./launch-sequence";
import { StarChart, type Guess } from "./star-chart";

export function EscapeRoomClient() {
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [won, setWon] = useState(false);
  const nextId = useRef(0);

  useEffect(() => {
    if (!won) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [won]);

  function handleSubmit(coords: Coordinates) {
    if (won) return;
    const hit = isWithinTolerance(coords);
    const id = nextId.current;
    nextId.current += 1;
    setGuesses((prev) => [...prev, { id, coords, hit }]);
    if (hit) {
      window.setTimeout(() => setWon(true), 700);
    }
  }

  return (
    <>
      <main className="relative mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
        <p className="kicker">Kakşyā Śāstra · Deep Space Program</p>
        <h1 className="font-display mt-3 text-4xl text-starlight sm:text-5xl">
          Return Vector Lock
        </h1>
        <p className="text-haze mt-4 max-w-xl text-sm leading-relaxed sm:text-base">
          Contact was lost. The last transmission placed the crew off-world and
          off-course — the only way home is the return vector your clues have pointed
          you toward. Enter the coordinates as decimal degrees and lock them in. Wrong
          locks cost nothing; the console will take as many attempts as it needs.
        </p>

        <div className="mt-10">
          <CoordinateForm disabled={won} onSubmit={handleSubmit} />
        </div>

        <div className="mt-8">
          <StarChart guesses={guesses} />
        </div>
      </main>
      {won && <LaunchSequence />}
    </>
  );
}
