const STORAGE_KEY = "ks-device-id";

/**
 * A stable id for this browser/device, persisted across reloads.
 *
 * This is what appears as `device_id` on every check-in row and is what lets
 * reconciliation answer "which physical phone never synced" (design doc §4.4
 * runbook). Regenerating it on every load would make that audit trail useless.
 */
export function getDeviceId(): string {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const id = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, id);
  return id;
}
