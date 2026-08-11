# Runbook — Pre-event device provisioning

**Who this is for:** whoever is running the door.
**When:** 30–60 minutes before doors open, while you still have good network.
**Why it exists:** the code cannot silently guarantee this. If a device skips
provisioning it will look fine right up until it is offline at the gate, and
then reject every pass. See [system design](../system-design.md) §4.4.

---

## Before you leave for the venue

- [ ] Confirm the event exists in the admin dashboard and `registration_open`
      is set correctly.
- [ ] Confirm a **fresh signing secret** was generated for this event. Never
      reuse a secret from a previous event or a previous year.
- [ ] Decide device roles: how many scanner lanes (2–3), how many walk-in desks.
- [ ] Bring a **hotspot**. Venue wifi is not a plan. This is for provisioning,
      not for running the event.
- [ ] Charge everything. Camera + screen-on for two hours is brutal on battery.
      Bring power banks.

## On each device, on good network

Do this on **every** scanner and **every** walk-in desk, one at a time.

- [ ] Open the app and sign in as a volunteer with event-staff access.
- [ ] Open the device's assigned screen (`/scan` or `/walkin`).
- [ ] Wait for **"Provisioned ✓"**. This means it has:
      - pulled the pre-registered attendee list,
      - pulled the event signing secret,
      - let the service worker cache the app shell.
- [ ] Note the **device id** shown on screen. Write it on tape, stick it on the
      phone. When reconciliation says "lane-2 never synced", you need to know
      which physical phone that was.

## Prove it actually works offline — do not skip this

- [ ] Put the device in **aeroplane mode**.
- [ ] Scan a test QR. It must resolve instantly, with no spinner.
- [ ] Scan the **same** QR again. It must say already checked in.
- [ ] Turn networking back on. Press **Sync Now**. Pending count must reach 0.

A device that has not passed this test is not ready, no matter what the screen
says.

## During the event

- [ ] Every 15–20 minutes, glance at the pending-sync badge on each device.
- [ ] If a device shows a growing pending count, walk it to the hotspot and
      press Sync Now. Nothing is lost while it waits — it is queued locally —
      but a shorter sync gap means fewer cross-lane duplicates.
- [ ] Walk-in attendees: tell them to **screenshot the QR on the spot**. Do not
      assume they will have signal five minutes later to reopen anything.

## After doors close

- [ ] Bring every device back onto good network and press Sync Now until the
      pending count is 0 on all of them. **Do this before anyone goes home.**
- [ ] Open the admin reconciliation view and check:
      - every device has reported in,
      - flagged duplicates look explainable,
      - the total roughly matches the door count.
- [ ] Rotate or retire the event signing secret.

---

## If something goes wrong

**A device shows "not provisioned" at the gate.**
Move it to the hotspot and reload. If it will not provision, take it out of the
lane — an unprovisioned scanner rejects every pass and will create a queue.

**A genuine attendee is rejected as "unknown".**
Usually means they registered at another walk-in desk that has not synced yet.
It is not a forgery. Sync both devices, or register them again at this desk —
a duplicate registration is recoverable afterwards; turning someone away is not.

**A device dies mid-event.**
Its unsynced check-ins are in that phone's IndexedDB. Charge it and sync it
later — the data is not lost unless the browser storage is cleared. Do not
uninstall, clear site data, or "reset" the browser on that device.
