// Meetup's search page, server-rendered: the technology category and a few
// keyword searches per city. First page of each only. Members in the page's
// state (RSVP avatars) are never read.
const CITIES = ["Madrid", "Barcelona", "Valencia", "Sevilla", "Málaga", "Bilbao", "Zaragoza"];
const SEARCHES = [["categoryId=546", true], ["keywords=AI", false], ["keywords=software", false], ["keywords=hackathon", false]];
const REGISTRATION = { JOIN_OPEN: "open", JOIN_APPROVAL: "open", WAITLIST: "waitlist", FULL: "full", CLOSED: "closed", NOT_OPEN_YET: "not_open_yet" };

export function parse(html, city, trusted) {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("meetup: no __NEXT_DATA__");
  const state = JSON.parse(match[1]).props?.pageProps?.__APOLLO_STATE__ ?? {};
  return Object.entries(state).filter(([key]) => key.startsWith("Event:")).map(([, e]) => {
    const online = e.eventType === "ONLINE";
    return {
      source: "meetup", source_id: e.id, title: e.title, url: e.eventUrl, start: e.dateTime, end: null,
      // The search is by city and the result names no venue: the city is the search's.
      city: online ? null : city, venue: null, online,
      organizer: state[e.group?.__ref]?.name ?? null, description: e.description ?? null,
      free: e.feeSettings ? false : true, registration: REGISTRATION[e.rsvpState] ?? null,
      approval: e.rsvpState === "JOIN_APPROVAL" ? true : null,
      spots_left: e.maxTickets && e.rsvps?.totalCount != null ? Math.max(0, e.maxTickets - e.rsvps.totalCount) : null,
      attendees: e.rsvps?.totalCount || null, fallback_type: "meetup", trusted,
    };
  });
}

export async function crawl(http) {
  const out = [];
  for (const city of CITIES)
    for (const [search, trusted] of SEARCHES) {
      const url = `https://www.meetup.com/find/?location=es--${encodeURIComponent(city)}&source=EVENTS&${search}`;
      out.push(...parse(await http.text(url), city, trusted));
    }
  return out;
}
