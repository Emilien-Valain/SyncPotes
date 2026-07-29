# SyncPotes — Design Brief / Handoff Prompt

> Copy everything below the line into Claude (design) to generate and validate the app's design.

---

You are designing **SyncPotes**, a web app for a group of friends to find when
everyone is free to hang out. ("Potes" = French slang for "buddies.") Design for
**mobile-first** — friends coordinate on their phones — but it must scale
gracefully to desktop. Support **light and dark themes**.

I want the **coolest, most distinctive design possible** — not a templated
dashboard. This should feel like a warm, playful, social tool made for friends,
not a corporate scheduling product. Be bold with layout, motion, and the hero
moment (the availability heatmap). Avoid generic SaaS defaults.

## What the app does (and its ethos)

Someone creates a **Poll** ("let's find a time"), shares a link, and friends join
it. Each friend either **connects Google Calendar** (we read only free/busy time,
never event titles or reasons) or **paints their availability by hand**. The app
then shows a live **heatmap of who is free**, by name, across the organizer's
chosen dates and hours.

**Core privacy ethos to express visually:** we show *who* is free, never *why*
anyone is busy. The product is discreet and trustworthy. Reasons/titles are never
read — make users *feel* that safety in the UI (e.g. reassuring copy on the Google
connect step).

**Signature rule — the Threshold:** the heatmap only shows time slots where at
least **K people** are free (K set by the organizer). Slots below K are hidden
entirely, so the grid surfaces only *times worth acting on*, never one person's
lonely free gap. This filtering is central to the whole feel — design the grid
around "show me the good overlaps," not "show me everything."

**Live, no closing:** the heatmap updates as more friends join; it just gets
better over time. There is no "close poll" step.

**Read-only handoff:** SyncPotes shows the overlap; humans then coordinate in
their group chat. v1 has NO voting, NO notifications, NO "book it," NO calendar
event creation. Don't design those.

## Vocabulary (use these exact terms in the UI)

- **Poll** — a bounded "find a time" session (not "meeting/event").
- **Availability** — who is free per slot, shown by name.
- **Threshold (K)** — min free people for a slot to appear.
- **Organizer** — created the Poll, set its parameters.
- **Participant** — joined via the link; either Google-connected or manual.

## Screens & states to design (all of them)

1. **Landing / Create a Poll (Organizer).** A friendly, low-friction form:
   - Poll name (e.g. "Apéro this week")
   - Candidate **dates** (a range or hand-picked days)
   - **Daily window** (e.g. 6pm–11pm) — this kills the "everyone's free at 3am"
     problem; make it feel natural
   - **Timezone** (defaults to organizer's)
   - **Threshold K** (defaults to expected headcount; adjustable) — explain it in
     plain, warm language
   - Big obvious "Create" action.

2. **Poll created / Share.** Shows the unguessable share link with a delightful
   copy/share moment (this is how friends get in — make sharing feel great).

3. **Join a Poll (Participant landing, opened from the link).** Shows the Poll
   name and a clear fork:
   - **"Connect Google Calendar"** — primary path. Include a reassuring
     privacy line ("We only see when you're busy — never what you're doing").
     Design a "connecting…" state and a "connected ✓" state.
   - **"Add my availability manually"** — secondary path. Prompt for a **display
     name**, then let them **paint free/busy** directly on the grid.

4. **The Heatmap (the hero screen).** The core of the app:
   - Rows/columns of **1-hour slots** across the chosen dates and daily window.
   - Each visible slot shows **who is free, by name** (only slots meeting the
     Threshold appear; sub-threshold slots are visibly suppressed/dimmed/absent).
   - Intensity/color encodes **how many** are free (more free = hotter/stronger).
   - Distinguish **Google-connected** participants from **manual** ones with a
     subtle marker (so the group knows which entries are calendar-backed).
   - **Live-updating** feel as participants join.
   - Design the **"best slots" affordance** — the standout times should pop.
   - Works on a phone (a full week × evening grid on a small screen is the key
     responsive challenge — solve it elegantly, e.g. day-focused view + swipe).

5. **Participant list.** Who has joined so far; connected vs manual; count vs the
   Threshold ("4 joined · showing slots where ≥3 are free").

6. **Empty / waiting states.**
   - Poll just created, nobody joined yet.
   - Joined but no slot yet meets the Threshold ("no strong overlaps yet — nudge
     more friends to join").

7. **Edge / system states.**
   - Google connection failed or consent revoked — friendly recovery.
   - Poll **expired** (Polls auto-delete 7 days after their window) — a gentle
     "this poll has expired" screen.

## What I want you to validate / push on

- Does the **heatmap** instantly communicate "who's free + which times are worth
  it," especially on mobile? This is make-or-break.
- Is the **join flow** (Google vs manual) frictionless enough that a
  privacy-shy or non-Google friend still participates?
- Does the UI **earn trust** around the "we never see why you're busy" promise?
- Is the **Threshold** concept legible to a non-technical friend without a manual?
- Overall: does it feel **fun and social**, like something you'd happily drop into
  a group chat — not like a work tool?

Deliver the full set of screens and key states above, a cohesive visual system
(color, type, motion), and both light and dark themes. Make the heatmap
unforgettable.
