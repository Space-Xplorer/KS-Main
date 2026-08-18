"use client";

import { useId, useState, type SubmitEvent } from "react";

import type { Coordinates } from "./coordinates";

export function CoordinateForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (coords: Coordinates) => void;
}) {
  const latId = useId();
  const lonId = useId();
  const [latInput, setLatInput] = useState("");
  const [lonInput, setLonInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;

    if (latInput.trim() === "" || lonInput.trim() === "") {
      setError("Enter both latitude and longitude.");
      return;
    }

    const lat = Number(latInput);
    const lon = Number(lonInput);

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      setError("Coordinates must be numbers — decimal degrees.");
      return;
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setError("Latitude runs -90 to 90, longitude -180 to 180.");
      return;
    }

    setError(null);
    onSubmit({ lat, lon });
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <label htmlFor={latId} className="flex flex-1 flex-col gap-1.5">
          <span className="kicker">Latitude</span>
          <input
            id={latId}
            type="number"
            step="any"
            inputMode="decimal"
            placeholder="e.g. 51.5074"
            value={latInput}
            onChange={(event) => setLatInput(event.target.value)}
            disabled={disabled}
            autoComplete="off"
            className="border-edge-bright bg-deep text-starlight tabular focus:border-plasma w-full rounded-md border px-3 py-2.5 font-mono text-sm outline-none disabled:opacity-40"
          />
        </label>

        <label htmlFor={lonId} className="flex flex-1 flex-col gap-1.5">
          <span className="kicker">Longitude</span>
          <input
            id={lonId}
            type="number"
            step="any"
            inputMode="decimal"
            placeholder="e.g. -0.1278"
            value={lonInput}
            onChange={(event) => setLonInput(event.target.value)}
            disabled={disabled}
            autoComplete="off"
            className="border-edge-bright bg-deep text-starlight tabular focus:border-plasma w-full rounded-md border px-3 py-2.5 font-mono text-sm outline-none disabled:opacity-40"
          />
        </label>

        <button
          type="submit"
          disabled={disabled}
          className="bg-starlight text-void hover:bg-plasma shrink-0 rounded-md px-7 py-2.5 font-mono text-[0.78rem] tracking-[0.18em] uppercase transition-colors disabled:pointer-events-none disabled:opacity-40"
        >
          Lock vector
        </button>
      </div>
      {error && <p className="text-signal mt-2.5 font-mono text-xs">{error}</p>}
    </form>
  );
}
