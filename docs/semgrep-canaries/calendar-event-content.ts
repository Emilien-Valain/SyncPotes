// CANARY — every line below must trip `no-calendar-event-content`.
declare const cal: { events: Record<string, (...a: unknown[]) => unknown> };

// googleapis SDK shape
export const sdkList = () => cal.events.list({ calendarId: "primary" });
export const sdkGet = () => cal.events.get({ eventId: "x" });

// raw REST shape — how this codebase actually talks to Google
export const restCalendarEvents = (t: string) =>
  fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    headers: { Authorization: `Bearer ${t}` },
  });
export const restEvents = () => fetch("https://www.googleapis.com/calendar/v3/events");

// scopes broader than freebusy
export const readonlyScope = "https://www.googleapis.com/auth/calendar.readonly";
export const eventsScope = "https://www.googleapis.com/auth/calendar.events";
export const bareScope = "https://www.googleapis.com/auth/calendar";
