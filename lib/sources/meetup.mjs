// Meetup's pages are server-rendered with their data: the search page (the
// technology category and a few keywords per city, first page of each) and a
// group's own events page. Members in a page's state (hosts, RSVP avatars)
// are never read.
const CITIES = ["Madrid", "Barcelona", "Valencia", "Sevilla", "Málaga", "Bilbao", "Zaragoza"];
const SEARCHES = [["categoryId=546", true], ["keywords=AI", false], ["keywords=software", false], ["keywords=hackathon", false]];
const REGISTRATION = { JOIN_OPEN: "open", JOIN_APPROVAL: "open", WAITLIST: "waitlist", FULL: "full", CLOSED: "closed", NOT_OPEN_YET: "not_open_yet" };

/** The events in a Meetup page. `city` is the search's, for a result that names
 * no venue; a group page names the venue and the group's own city. */
export function parse(html, { city = null, trusted = false, source = "meetup" } = {}) {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("meetup: no __NEXT_DATA__");
  const state = JSON.parse(match[1]).props?.pageProps?.__APOLLO_STATE__ ?? {};
  return Object.entries(state).filter(([key, e]) => key.startsWith("Event:") && e.title && e.dateTime && e.status !== "CANCELLED").map(([, e]) => {
    const group = state[e.group?.__ref] ?? {}, venue = state[e.venue?.__ref] ?? {};
    const online = e.eventType === "ONLINE" || e.isOnline === true;
    const going = e.going?.totalCount ?? e.rsvps?.totalCount ?? null;
    const fee = e.feeSettings;
    return {
      source, source_id: e.id, title: e.title, url: e.eventUrl, start: e.dateTime, end: e.endTime ?? null,
      city: online ? null : venue.city ?? city ?? group.city ?? null, region_hint: venue.state ?? group.state ?? null,
      country: (venue.country ?? group.country ?? "").toLowerCase() || null,
      venue: online ? null : venue.name ?? null, address: online ? null : venue.address ?? null, online,
      organizer: group.name ?? null, description: e.description ?? null,
      free: fee ? false : true, price_min: fee?.amount ?? null, currency: fee?.currency ?? null,
      registration: REGISTRATION[e.rsvpState] ?? null, approval: e.rsvpState === "JOIN_APPROVAL" ? true : null,
      capacity: e.maxTickets || null, attendees: going || null,
      spots_left: e.maxTickets && going != null ? Math.max(0, e.maxTickets - going) : null,
      fallback_type: "meetup", trusted,
    };
  });
}

export async function crawl(http) {
  const out = [];
  for (const city of CITIES)
    for (const [search, trusted] of SEARCHES) {
      const url = `https://www.meetup.com/find/?location=es--${encodeURIComponent(city)}&source=EVENTS&${search}`;
      out.push(...parse(await http.text(url), { city, trusted }));
    }
  return out;
}
