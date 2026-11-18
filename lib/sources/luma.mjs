// Luma's discover API: the tech and AI categories around each city, plus the
// Madrid and Barcelona city feeds. None is tech-only (the tech category has
// book clubs and happy hours), so every event passes the tech filter.
import { isTech, mirrorText } from "../classify.mjs";
import { lumaSocials } from "../socials.mjs";
const API = "https://api.lu.ma/discover/get-paginated-events";
const CITIES = [["Madrid", 40.4168, -3.7038], ["Barcelona", 41.3874, 2.1686], ["Valencia", 39.4699, -0.3763],
  ["Sevilla", 37.3891, -5.9845], ["Málaga", 36.7213, -4.4214], ["Bilbao", 43.263, -2.935],
  ["Zaragoza", 41.6488, -0.8891], ["A Coruña", 43.3623, -8.4115], ["Palma", 39.5696, 2.6502],
  ["Las Palmas", 28.1235, -15.4363]];
const PLACES = ["discplace-03jiEcS4mvwJuDa", "discplace-WcS4REeayDPXV4n"];
const MAX_PAGES = 6;
const REGISTRATION = { open: "open", waitlist: "waitlist", sold_out: "full", closed: "closed" };

/** A Luma price, { cents, currency } or a bare number of cents, as [amount, currency]. */
const money = (price) => {
  const cents = typeof price === "number" ? price : price?.cents;
  return typeof cents === "number" && cents > 0 ? [cents / 100, String(price?.currency ?? "eur").toUpperCase()] : [null, null];
};

/** One entry of a Luma listing, or the answer of its event endpoints, as a source record. */
export function record(entry, trusted = false) {
  const e = entry.event ?? {}, geo = e.geo_address_info ?? {}, ticket = entry.ticket_info ?? {};
  const online = e.location_type !== "offline";
  const inSpain = geo.country_code === "ES" || /^(spain|españa)$/i.test(geo.country ?? "");
  if (!e.url || !(inSpain || (online && /^(Europe\/Madrid|Atlantic\/Canary)$/.test(e.timezone ?? "")))) return null;
  const [price_min, currency] = money(ticket.price);
  const hidden = geo.mode === "obfuscated";
  return {
    source: "luma", source_id: e.api_id, title: e.name, url: `https://luma.com/${e.url}`,
    start: e.start_at, end: e.end_at, city: geo.city ?? null, region_hint: geo.region ?? null,
    venue: hidden ? null : geo.address ?? null, address: hidden ? null : geo.full_address ?? null,
    lat: hidden ? null : e.coordinate?.latitude ?? null, lon: hidden ? null : e.coordinate?.longitude ?? null, online,
    organizer: entry.calendar?.name ?? entry.hosts?.[0]?.name ?? null, description: mirrorText(entry.description_mirror).trim() || null,
    free: ticket.is_free ?? null, price_min, currency,
    registration: ticket.is_sold_out ? (entry.waitlist_active ? "waitlist" : "full")
      : REGISTRATION[entry.registration_availability] ?? null,
    approval: ticket.require_approval ?? null, spots_left: ticket.spots_remaining ?? null,
    attendees: entry.guest_count || null, socials: lumaSocials(entry.calendar), trusted,
  };
}
export const parse = (payload, trusted) => (payload.entries ?? []).map((entry) => record(entry, trusted)).filter(Boolean);

/** A listing carries no description, so an event whose title and organiser do
 * not say tech ("Stream Forward Barcelona") would be dropped unread: each of
 * those gets its description from its own page. One that cannot be read stays
 * as listed. */
export async function describe(http, records) {
  const seen = new Set();
  for (const event of records) {
    if (event.description || seen.has(event.source_id) || isTech(`${event.title} ${event.organizer ?? ""}`)) continue;
    seen.add(event.source_id);
    try {
      const { data } = await http.json(`https://api.lu.ma/url?url=${encodeURIComponent(event.url.split("/").pop())}`);
      event.description = mirrorText(data?.description_mirror).trim() || null;
    } catch { /* an event removed since the listing */ }
  }
  return records;
}

export async function crawl(http) {
  const feeds = [
    ...CITIES.flatMap(([, lat, lon]) => ["tech", "ai"].map((slug) => `slug=${slug}&latitude=${lat}&longitude=${lon}`)),
    ...PLACES.map((id) => `discover_place_api_id=${id}`),
  ];
  const out = [];
  for (const query of feeds) {
    let cursor = null;
    for (let page = 0; page < MAX_PAGES; page++) {
      const payload = await http.json(`${API}?${query}&pagination_limit=50${cursor ? `&pagination_cursor=${cursor}` : ""}`);
      out.push(...parse(payload));
      if (!payload.has_more || !payload.next_cursor) break;
      cursor = encodeURIComponent(payload.next_cursor);
    }
  }
  return describe(http, out);
}
