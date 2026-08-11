# Reference — the Python prototype (`chandu_branch`)

Chandu built a working FastAPI prototype on the `chandu_branch` branch that
proved the whole registration → QR → email → scan loop end to end. We are not
merging it (it is a different language and a different architecture), but it
earned real knowledge that must not be lost in the port.

**Branch:** `origin/chandu_branch` · **Last commit:** 2026-08-09
**Status:** local only, never deployed. Kept as reference, not maintained.

---

## What it did

| Route | Behaviour |
|---|---|
| `POST /api/register` | Insert into `participants`, generate QR PNG, queue email |
| `POST /api/verify-attendance` | Look up by `unique_id`, insert into `attendance` |
| `GET /scanner` | Serve a scanner page (HTML embedded as a Python string) |
| `GET /` | Health check |

There was **no registration UI** — `/api/register` was called from outside the
repo. Whatever collected name/email/phone still needs building.

---

## Carry these over — they are hard-won

**1. Scanner feedback the volunteer can act on without looking.**
Distinct tones per outcome, via `AudioContext`: 880 Hz short for success,
440 Hz longer for already-checked-in, 220 Hz longest for error. At a noisy
gate a volunteer hears the result before reading it. Worth reproducing exactly.

**2. A scan debounce.**
`isProcessing` guard plus a 2-second cooldown after each scan. Without it a
camera fires the same QR many times per second. Our `SyncEngine` guards the
sync side and the DB trigger guards duplicates, but the UI still needs this so
the volunteer sees one clear result instead of a flicker.

**3. Manual ID entry as a first-class fallback.**
A text input beside the camera. Cameras fail — cracked lens, dead battery,
someone's screen brightness too low. Do not ship the scanner without it.

**4. Camera permission fallback chain.**
Tries `facingMode: "environment"`, falls back to `"user"` on failure. Cheap,
and it saves a lane from being dead on an unusual device.

**5. The email template.**
Preserved verbatim at [`email-template.html`](./email-template.html). Inline
CID image embedding renders correctly across clients, which is fiddly to get
right — start from this rather than from scratch.

---

## Do NOT carry these over

**1. Online-only check-in.** Every scan was `fetch("/api/verify-attendance")`.
This is precisely the failure mode [the system design](../system-design.md) §4
exists to prevent — at the gate, on a saturated tower, every scan blocks on a
round-trip. Replaced by local HMAC verification against IndexedDB.

**2. Unsigned, guessable QR contents.** The QR held the bare string
`SWAP-1004`. Anyone could type `SWAP-1005` into a free QR generator and walk
in, and the ids were sequential so guessing was trivial. Replaced by the signed
token in `src/core/tokens/`.

**3. Check-then-insert duplicate detection.** `main.py` selected from
`attendance`, then inserted if absent. Two lanes scanning simultaneously both
see "not marked" and both insert. Replaced by the `apply_checkin()` trigger in
the init migration, which resolves atomically in the database.

**4. `venv/` committed to git.** 1,991 files, ~50 MB, including Windows `.pyd`
binaries that cannot run on a Linux host. It *is* in `.gitignore`, but was
committed before that line existed, so git kept tracking it. If that branch is
ever revived: `git rm -r --cached venv`.

**5. Gmail SMTP with a password in env.** Works, but rate-limited and tied to
one person's account. Use Resend, per the design doc.

---

## Data model translation

| Prototype | Now | Why |
|---|---|---|
| `participants` | `registrations` | Registration belongs to an event, not the club |
| `attendance` | `checkin_events` | Every scan is an audit row; duplicates flagged, not dropped |
| `unique_id` (`SWAP-1004`) | `id` (client UUID) | Unguessable, and collision-free across offline devices |
| — | `event_secrets` | Per-event HMAC secret, unreadable by any client |
| status `PRESENT` | `registrations.checked_in_at` | A timestamp answers "when", which a flag cannot |

## Reading the original

```bash
git show origin/chandu_branch:main.py
git show origin/chandu_branch:email_service.py
```
