export type Coordinates = {
  readonly lat: number;
  readonly lon: number;
};

/**
 * The only wiring between the physical escape-room clues and this page.
 * Set these to the coordinates the clues resolve to before the event, and
 * pick a tolerance forgiving enough for a finger on a phone screen but tight
 * enough that a wild guess doesn't win.
 *
 * Placeholder below is the VNRVJIET campus, Hyderabad.
 */
export const TARGET_COORDINATES: Coordinates = { lat: 17.4239, lon: 78.4738 };
export const TOLERANCE_KM = 250;

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two lat/lon points, in kilometres. */
export function haversineDistanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Converts a click position on an equirectangular chart — fractions of the
 * chart's width/height, each in [0, 1] — into a lat/lon pair.
 */
export function fractionToCoordinates(
  xFraction: number,
  yFraction: number,
): Coordinates {
  const x = Math.min(1, Math.max(0, xFraction));
  const y = Math.min(1, Math.max(0, yFraction));
  return {
    lon: x * 360 - 180,
    lat: 90 - y * 180,
  };
}

export function isWithinTolerance(guess: Coordinates): boolean {
  return haversineDistanceKm(guess, TARGET_COORDINATES) <= TOLERANCE_KM;
}

export function formatLat(lat: number): string {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}`;
}

export function formatLon(lon: number): string {
  return `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`;
}
