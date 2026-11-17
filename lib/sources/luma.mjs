// Luma's discover API: the tech and AI categories around each city, plus the
// Madrid and Barcelona city feeds (any topic, so those pass the tech filter).
const API = "https://api.lu.ma/discover/get-paginated-events";
const CITIES = [["Madrid", 40.4168, -3.7038], ["Barcelona", 41.3874, 2.1686], ["Valencia", 39.4699, -0.3763],
  ["Sevilla", 37.3891, -5.9845], ["Málaga", 36.7213, -4.4214], ["Bilbao", 43.263, -2.935],
  ["Zaragoza", 41.6488, -0.8891], ["A Coruña", 43.3623, -8.4115], ["Palma", 39.5696, 2.6502],
  ["Las Palmas", 28.1235, -15.4363]];
const PLACES = ["discplace-03jiEcS4mvwJuDa", "discplace-WcS4REeayDPXV4n"];
const MAX_PAGES = 6;
const REGISTRATION = { open: "open", waitlist: "waitlist", sold_out: "full", closed: "closed" };

export function parse(payload, trusted) {
  return (payload.entries ?? []).flatMap((entry) => {
    const e = entry.event ?? {}, geo = e.geo_address_info ?? {}, ticket = entry.ticket_info ?? {};
    const online = e.location_type !== "offline";
    const inSpain = geo.country_code === "ES" || /^(spain|españa)$/i.test(geo.country ?? "");
    if (!e.url || !(inSpain || (online && /^(Europe\/Madrid|Atlantic\/Canary)$/.test(e.timezone ?? "")))) return [];
    return [{
      source: "luma", source_id: e.api_id, title: e.name, url: `https://luma.com/${e.url}`,
      start: e.start_at, end: e.end_at, city: geo.city ?? null, region_hint: geo.region ?? null,
      venue: geo.mode === "obfuscated" ? null : geo.address ?? null, online,
      organizer: entry.calendar?.name ?? entry.hosts?.[0]?.name ?? null, description: null,
      free: ticket.is_free ?? null,
      registration: ticket.is_sold_out ? (entry.waitlist_active ? "waitlist" : "full")
        : REGISTRATION[entry.registration_availability] ?? null,
      approval: ticket.require_approval ?? null, spots_left: ticket.spots_remaining ?? null,
      attendees: entry.guest_count || null, trusted,
    }];
  });
}

export async function crawl(http) {
  const feeds = [
    ...CITIES.flatMap(([, lat, lon]) => ["tech", "ai"].map((slug) => [`slug=${slug}&latitude=${lat}&longitude=${lon}`, true])),
    ...PLACES.map((id) => [`discover_place_api_id=${id}`, false]),
  ];
  const out = [];
  for (const [query, trusted] of feeds) {
    let cursor = null;
    for (let page = 0; page < MAX_PAGES; page++) {
      const payload = await http.json(`${API}?${query}&pagination_limit=50${cursor ? `&pagination_cursor=${cursor}` : ""}`);
      out.push(...parse(payload, trusted));
      if (!payload.has_more || !payload.next_cursor) break;
      cursor = encodeURIComponent(payload.next_cursor);
    }
  }
  return out;
}
