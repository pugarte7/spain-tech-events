// Meetup, two ways. Its event search, through the GraphQL endpoint its own
// site calls (no login): the technology category around each city, every page.
// The search page itself only renders the first results, a different sample
// each day. And a group's own events page, server-rendered with its data
// (communities.mjs). Members (hosts, RSVP avatars) are never read.
const API = "https://www.meetup.com/gql2";
const CITIES = [["Madrid", 40.4168, -3.7038], ["Barcelona", 41.3874, 2.1686], ["Valencia", 39.4699, -0.3763],
  ["Sevilla", 37.3891, -5.9845], ["Málaga", 36.7213, -4.4214], ["Bilbao", 43.263, -2.935],
  ["Zaragoza", 41.6488, -0.8891], ["A Coruña", 43.3623, -8.4115], ["Palma", 39.5696, 2.6502],
  ["Las Palmas", 28.1235, -15.4363]];
// Always inside the technology category (546): a bare keyword search matches
// any group's boilerplate, hiking clubs included. Within it the words barely
// matter, each returns nearly the whole category. Still not trusted as
// tech-only: Meetup files breathwork sessions and coworking days there.
const CATEGORY = "546";
const SEARCHES = ["tech", "AI"];
const PAGE = 100, MAX_PAGES = 5;
const QUERY = `query($filter: EventSearchFilter!, $first: Int, $after: String) {
  eventSearch(filter: $filter, first: $first, after: $after) {
    pageInfo { endCursor hasNextPage }
    edges { node { id title dateTime endTime eventUrl description eventType status rsvpState maxTickets
      going { totalCount } feeSettings { amount currency }
      group { name city state country timezone } venue { name address city state country } } }
  }
}`;
const SPANISH_CLOCK = /^(Europe\/Madrid|Atlantic\/Canary|Africa\/Ceuta)$/;
const REGISTRATION = { JOIN_OPEN: "open", JOIN_APPROVAL: "open", WAITLIST: "waitlist", FULL: "full", CLOSED: "closed", NOT_OPEN_YET: "not_open_yet" };

/** One Meetup event, with its group and venue, as a source record. `city` is
 * the search's, for an event that names no venue. */
function record(e, group, venue, { city = null, trusted = false, source = "meetup" } = {}) {
  const online = e.eventType === "ONLINE" || e.isOnline === true;
  const going = e.going?.totalCount ?? e.rsvps?.totalCount ?? null;
  const fee = e.feeSettings;
  return {
    source, source_id: e.id, title: e.title, url: e.eventUrl, start: e.dateTime, end: e.endTime ?? null,
    city: online ? null : venue.city || city || group.city || null, region_hint: venue.state || group.state || null,
    country: (venue.country || group.country || "").toLowerCase() || null, timezone: group.timezone ?? null,
    venue: online ? null : venue.name || null, address: online ? null : venue.address || null, online,
    organizer: group.name ?? null, description: e.description ?? null,
    free: fee ? false : true, price_min: fee?.amount ?? null, currency: fee?.currency ?? null,
    registration: REGISTRATION[e.rsvpState] ?? null, approval: e.rsvpState === "JOIN_APPROVAL" ? true : null,
    capacity: e.maxTickets || null, attendees: going || null,
    spots_left: e.maxTickets && going != null ? Math.max(0, e.maxTickets - going) : null,
    fallback_type: "meetup", trusted,
  };
}
const listed = (e) => e.title && e.dateTime && e.status !== "CANCELLED";

/** The events in a Meetup page's own data (a group's events page). */
export function parse(html, options = {}) {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("meetup: no __NEXT_DATA__");
  const state = JSON.parse(match[1]).props?.pageProps?.__APOLLO_STATE__ ?? {};
  return Object.entries(state).filter(([key, e]) => key.startsWith("Event:") && listed(e))
    .map(([, e]) => record(e, state[e.group?.__ref] ?? {}, state[e.venue?.__ref] ?? {}, options));
}

/** One page of a search answer as records. A search around a city also returns
 * online events of groups abroad: the group's clock tells where it is. */
export function found(payload, city) {
  if (payload.errors?.length) throw new Error(`meetup: ${payload.errors[0].message}`);
  return (payload.data?.eventSearch?.edges ?? []).map((edge) => edge.node).filter(listed)
    .map((e) => record(e, e.group ?? {}, e.venue ?? {}, { city }))
    .filter((e) => !e.timezone || SPANISH_CLOCK.test(e.timezone));
}

export async function crawl(http) {
  const out = [];
  for (const [city, lat, lon] of CITIES)
    for (const search of SEARCHES) {
      let after = null;
      for (let page = 0; page < MAX_PAGES; page++) {
        const payload = await http.json(API, {}, { query: QUERY, variables: { filter: { query: search, topicCategoryId: CATEGORY, lat, lon }, first: PAGE, after } });
        out.push(...found(payload, city));
        const info = payload.data?.eventSearch?.pageInfo;
        if (!info?.hasNextPage || !info.endCursor) break;
        after = info.endCursor;
      }
    }
  return out;
}
