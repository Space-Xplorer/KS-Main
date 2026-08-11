/**
 * Server-side reconciliation across lanes (design doc §4.5).
 *
 * While two lanes are offline they genuinely cannot know about each other, so
 * the same person can be accepted at both. This runs once their records reach
 * the server and settles it: earliest scan wins, every later scan is flagged
 * rather than deleted.
 *
 * Pure and total — no IO, no clock, no ordering assumptions about its input.
 */

export interface ScanRow {
  readonly id: string;
  readonly registrationId: string;
  readonly deviceId: string;
  readonly scannedAt: number;
}

export interface ResolvedScan {
  readonly id: string;
  readonly registrationId: string;
  readonly isDuplicate: boolean;
}

export interface ReconciliationResult {
  readonly scans: readonly ResolvedScan[];
  /** Winning check-in time per registration; what `registrations.checked_in_at` becomes. */
  readonly checkedInAt: ReadonlyMap<string, number>;
  readonly duplicateCount: number;
  /** Registrations scanned at more than one lane — worth a look after the event. */
  readonly contestedRegistrationIds: readonly string[];
}

export function resolveConflicts(scans: readonly ScanRow[]): ReconciliationResult {
  const byRegistration = new Map<string, ScanRow[]>();
  for (const scan of scans) {
    const group = byRegistration.get(scan.registrationId) ?? [];
    group.push(scan);
    byRegistration.set(scan.registrationId, group);
  }

  const resolved: ResolvedScan[] = [];
  const checkedInAt = new Map<string, number>();
  const contested: string[] = [];
  let duplicateCount = 0;

  for (const [registrationId, group] of byRegistration) {
    const ordered = [...group].sort(compareScans);
    const winner = ordered[0]!;

    checkedInAt.set(registrationId, winner.scannedAt);

    if (ordered.length > 1) {
      const devices = new Set(ordered.map((scan) => scan.deviceId));
      // Two scans on one device is a volunteer double-tap; two devices means
      // the lanes genuinely disagreed, which is the interesting case.
      if (devices.size > 1) contested.push(registrationId);
    }

    for (let i = 0; i < ordered.length; i += 1) {
      const isDuplicate = i > 0;
      if (isDuplicate) duplicateCount += 1;
      resolved.push({ id: ordered[i]!.id, registrationId, isDuplicate });
    }
  }

  return {
    scans: resolved,
    checkedInAt,
    duplicateCount,
    contestedRegistrationIds: contested,
  };
}

/**
 * Earliest wins. Ties break on id so the outcome is identical no matter what
 * order rows arrived in — two devices with synchronised clocks really can
 * produce the same millisecond, and reconciliation must not be order-dependent.
 */
function compareScans(a: ScanRow, b: ScanRow): number {
  if (a.scannedAt !== b.scannedAt) return a.scannedAt - b.scannedAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
