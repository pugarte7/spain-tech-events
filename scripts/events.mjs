// data/events.json: upcoming tech events in Spain, from every source in
// lib/sources. Run daily; the MCP server (api/mcp.js) searches the file, which
// Vercel serves at /api/v1/events.json.
//
//     node scripts/events.mjs --out data/events.json   # crawl everything, as the daily workflow does
//     node scripts/events.mjs --only luma,mlh          # some sources, into _site/
//
// What is stored of an event is what a person needs to decide and sign up:
// what it is (type, topics, keywords read from its text as api/_classify.js
// reads a job posting), when, where, what it costs, how many people, and the
// link to register. Descriptions are cut short; nothing about any attendee.
//
// A source that fails never fails the run: its events still upcoming in the
// previous index (the --out file, or EVENTS_PREVIOUS_URL) are carried over
// and the source is reported as stale. first_seen is the day an event first
// entered the index, carried from the previous one. No event at all exits 1.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { client } from "../lib/http.mjs";
import { REGIONS, dayOf, isTech, keywordsOf, knownScale, norm, regionIn, regionOf, sizeOf, topicsOf, typeOf } from "../lib/classify.mjs";
import { SOURCES } from "../lib/sources/index.mjs";

export const VERSION = 2;
const DESCRIPTION_MAX = 400;
const plain = (s) => String(s ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const clip = (s) => {
  const text = plain(s);
  return !text ? null : text.length > DESCRIPTION_MAX ? `${text.slice(0, DESCRIPTION_MAX - 1)}…` : text;
};
const number = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** A source's record as the index stores it, or null when it is not a tech event. */
export function normalize(raw) {
  if (!raw.title || !raw.start || !raw.url) return null;
  const description = plain(raw.description);
  const text = `${raw.title} ${raw.organizer ?? ""} ${description} ${raw.keywords ?? ""}`;
  // An unfiltered feed's event is tech when its title or organiser says so, or
  // its description touches two topics: one stray "startup" in a blurb is not enough.
  if (!raw.trusted && !(isTech(`${raw.title} ${raw.organizer ?? ""}`) || (isTech(text) && topicsOf(text).length >= 2))) return null;
  const region = regionOf(raw.city, raw.region_hint) ?? regionIn(raw.place_text) ?? regionIn(raw.address);
  const attendees = number(raw.attendees), capacity = number(raw.capacity);
  const people = Math.max(attendees ?? 0, capacity ?? 0) || null;
  const price = number(raw.price_min);
  return {
    id: createHash("sha1").update(`${raw.source}:${raw.source_id}`).digest("hex").slice(0, 10),
    title: plain(raw.title), type: typeOf(raw.title, raw.fallback_type ?? "event"),
    topics: topicsOf(text), keywords: keywordsOf(raw.title, `${description} ${raw.keywords ?? ""}`),
    date: dayOf(raw.start), start: raw.start, end: raw.end ?? null,
    city: raw.city ?? null, region, region_name: REGIONS[region] ?? null,
    venue: raw.venue ?? null, address: raw.address ?? null, lat: number(raw.lat), lon: number(raw.lon),
    online: Boolean(raw.online), organizer: raw.organizer ?? null, description: clip(description),
    free: raw.free ?? (price ? false : null), price_min: price, currency: price ? raw.currency ?? "EUR" : null,
    // How many people: who has signed up so far and the room's limit, as the
    // source gives them; size is their order of magnitude, or a past edition's.
    attendees, capacity, size: sizeOf(people) ?? knownScale(raw.title), size_basis: people ? "source" : knownScale(raw.title) ? "past editions" : null,
    registration: raw.registration ?? null, approval: raw.approval ?? null, spots_left: number(raw.spots_left),
    account_required: raw.account ?? null,
    cfp_url: raw.cfp_url ?? null, cfp_end: raw.cfp_end ?? null,
    url: raw.url, register_url: raw.register_url ?? raw.url, source: raw.source, also: [], first_seen: null,
  };
}

/** One key for the spellings of a link: lu.ma and luma.com, www, a query, a slash. */
export const linkKey = (url) => (!url ? null : url.replace(/^https?:\/\/(www\.)?/, "").replace(/^lu\.ma\//, "luma.com/").replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase());

const titleWords = (title) => new Set(norm(title).replace(/\b20\d\d\b/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 2));
/** Two titles naming one event: "HackEPS" and "HackEPS 2026", or the same words reordered. */
function sameTitle(a, b) {
  const [x, y] = [titleWords(a.title), titleWords(b.title)];
  const shared = [...x].filter((w) => y.has(w)).length;
  if (shared > 0 && shared / (x.size + y.size - shared) >= 0.6) return true;
  // A directory names a conference in two words ("Devfest Lleida"); the
  // organiser's own page adds a tagline. Between two organisers' pages the
  // longer title is another event, a talk at that conference.
  return shared >= 2 && shared === Math.min(x.size, y.size) && (DIRECTORIES.has(a.source) || DIRECTORIES.has(b.source));
}
/** One organiser, one starting minute: the same event under a translated title. */
const sameSlot = (a, b) => a.organizer && norm(a.organizer) === norm(b.organizer) && a.start.includes("T") && b.start.includes("T")
  && Date.parse(a.start) === Date.parse(b.start);
const DIRECTORIES = new Set(["developers.events", "confs.tech", "dev.events", "eventos.wiki", "hackathonhub", "mlh", "wordcamp", "conference-sites"]);

// What the first record of an event takes from a later one even when it has its
// own: the live figures of the place people sign up beat a directory's guess.
const FILL = ["description", "organizer", "venue", "address", "lat", "lon", "end", "free", "price_min", "currency", "attendees",
  "capacity", "registration", "approval", "spots_left", "account_required", "cfp_url", "cfp_end", "city", "region", "region_name"];

/** One record per event: same link or sign-up link, or the same day and city under one title.
 * The first seen wins (callers pass sources in precedence order) and takes
 * what it lacks from the others, whose links it keeps in `also`. */
export function dedupe(events) {
  const byUrl = new Map(), byDay = new Map(), out = [];
  for (const event of events) {
    const day = byDay.get(event.date) ?? byDay.set(event.date, []).get(event.date);
    const links = [event.url, event.register_url].map(linkKey).filter(Boolean);
    const first = links.map((k) => byUrl.get(k)).find(Boolean) ?? day.find((e) => (!e.city || !event.city || norm(e.city) === norm(event.city))
      && e.online === event.online && (sameTitle(e, event) || sameSlot(e, event)));
    if (!first) {
      out.push(event);
      day.push(event);
      links.forEach((k) => byUrl.set(k, event));
      continue;
    }
    links.forEach((k) => byUrl.has(k) || byUrl.set(k, first));
    if (![first.url, first.register_url, ...first.also].map(linkKey).includes(linkKey(event.url))) first.also.push(event.url);
    // A directory's page is not where one signs up: a later source's own link is.
    if (first.register_url === first.url && event.register_url && linkKey(event.register_url) !== linkKey(first.url)
        && first.source !== "luma" && first.source !== "meetup") first.register_url = event.register_url;
    for (const field of FILL) if (first[field] == null && event[field] != null) first[field] = event[field];
    for (const field of ["topics", "keywords"]) first[field] = [...new Set([...first[field], ...event[field]])];
    if (first.type === "event" && event.type !== "event") first.type = event.type;
    const people = Math.max(first.attendees ?? 0, first.capacity ?? 0) || null;
    if (people) [first.size, first.size_basis] = [sizeOf(people), "source"];
    else if (!first.size && event.size) [first.size, first.size_basis] = [event.size, event.size_basis];
  }
  return out;
}

export const upcoming = (event, today) => dayOf(event.end ?? event.start) >= today;

async function previousIndex(out) {
  try {
    if (process.env.EVENTS_PREVIOUS_URL) return await (await fetch(process.env.EVENTS_PREVIOUS_URL)).json();
    if (existsSync(out)) return JSON.parse(readFileSync(out, "utf8"));
  } catch { /* no previous index: nothing to carry over */ }
  return null;
}

export async function build({ only = null, http = client(), now = new Date(), previous = null, sources = SOURCES } = {}) {
  const today = dayOf(now.toISOString());
  const names = Object.keys(sources).filter((name) => !only || only.includes(name));
  const report = {};
  const results = await Promise.all(names.map(async (name) => {
    try {
      const raw = await sources[name].crawl(http, now);
      const events = raw.map(normalize).filter((e) => e && upcoming(e, today));
      report[name] = { read: raw.length, events: events.length };
      return events;
    } catch (error) {
      const stale = (previous?.events ?? []).filter((e) => e.source === name && upcoming(e, today));
      report[name] = { read: 0, events: stale.length, error: String(error.message ?? error), stale: true };
      return stale;
    }
  }));
  const seen = new Map((previous?.events ?? []).flatMap((e) => [[e.id, e.first_seen], [linkKey(e.url), e.first_seen]]));
  const events = dedupe(results.flat()).sort((a, b) => a.date.localeCompare(b.date) || Date.parse(a.start) - Date.parse(b.start));
  for (const event of events) event.first_seen = seen.get(event.id) ?? seen.get(linkKey(event.url)) ?? event.first_seen ?? today;
  return { version: VERSION, generated_at: now.toISOString(), count: events.length, sources: report, events };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : null);
  const out = arg("--out") ?? "_site/api/v1/events.json";
  const index = await build({ only: arg("--only")?.split(","), previous: await previousIndex(out) });
  console.table(index.sources);
  if (!index.count) {
    console.error("No events read: nothing written.");
    process.exit(1);
  }
  mkdirSync(dirname(out), { recursive: true });
  // One event per line: the daily commit's diff is the events that changed.
  writeFileSync(out, JSON.stringify(index).replace(/\{"id":/g, '\n{"id":') + "\n");
  console.log(`${index.count} events -> ${out}`);
}
