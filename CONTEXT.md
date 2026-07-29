# SyncPotes

A tool for a group of friends to find when everyone is available, by syncing
their calendars. It reveals *who* is free at each time, but never *why* anyone
is busy — event contents are deliberately never read or shown.

## Language

**Availability**:
The view of who is free at each time slot, shown by name (e.g. "Émilien and Léa
are free Saturday 2–4pm"). Identity is visible; the reason for any busy time is
not.
_Avoid_: Anonymous availability (the product shows names — only event *content*
is hidden)

**Busy block**:
A single interval of time in which one named person is unavailable, derived from
their calendar. The interval is used; its title/content is never read.
_Avoid_: Event, appointment (implies the content/title we deliberately do not read)

**Poll**:
A bounded "let's find a time" session that someone creates over a specific
window and shares by link; friends join it to contribute their availability.
_Avoid_: Meeting, event, session

**Threshold**:
The minimum number of free people a time slot must have before it is shown at
all. Slots below the Threshold are hidden entirely — the point is to surface
only times worth acting on, not every gap in one person's calendar.
_Avoid_: Quorum, minimum

**Organizer**:
The person who creates a Poll and sets its parameters (dates, daily window,
timezone, Threshold). No special ongoing powers beyond creation.
_Avoid_: Admin, owner, host

**Participant**:
Anyone who has joined a Poll via its link and contributed availability, either
by connecting Google (calendar-backed) or by painting slots manually
(self-declared). Participants see the same live named grid.
_Avoid_: Member, user, attendee, guest
