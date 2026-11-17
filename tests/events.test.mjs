import assert from "node:assert/strict";
import { test } from "node:test";
import { handle } from "../api/mcp.js";
import { dayOf, isTech, regionIn, regionOf, topicsOf, typeOf } from "../lib/classify.mjs";
import { dates } from "../lib/sources/devpost.mjs";
import { parse as hackathonhub } from "../lib/sources/hackathonhub.mjs";
import { madridIso, parse as hackbarna } from "../lib/sources/hackbarna.mjs";
import { parse as luma } from "../lib/sources/luma.mjs";
import { season } from "../lib/sources/mlh.mjs";
import { parse as ote } from "../lib/sources/ote.mjs";
import { parse as sarao } from "../lib/sources/sarao.mjs";
import { parse as saraos } from "../lib/sources/saraos.mjs";
import { dedupe, normalize, upcoming } from "../scripts/events.mjs";

test("classify", () => {
  assert.equal(typeOf("HackEPS 2026"), "hackathon");
  assert.equal(typeOf("DevFest Zaragoza 2026"), "conference");
  assert.equal(typeOf("Taller de Kubernetes"), "workshop");
  assert.equal(typeOf("Cena con founders"), "networking", "the Spanish word 'con' is not a conference");
  assert.deepEqual(topicsOf("Agentes de IA en AWS"), ["ai", "cloud"]);
  assert.ok(isTech("Lightning Talks: Java 27"));
  assert.ok(!isTech("TUESDAY I TECH HOUSE DJ SET"));
  assert.equal(regionOf("Móstoles"), "MD");
  assert.equal(regionOf(null, "Catalunya"), "CT");
  assert.equal(regionOf("Seville"), "AN");
  assert.equal(regionIn("Talent Garden Madrid"), "MD");
  assert.equal(dayOf("2026-11-17T23:30:00.000Z"), "2026-11-18", "the day is Spain's, not UTC's");
});

test("devpost dates", () => {
  assert.deepEqual(dates("Nov 21, 2026"), ["2026-11-21", "2026-11-21"]);
  assert.deepEqual(dates("Sep 06 - 07, 2019"), ["2019-09-06", "2019-09-07"]);
  assert.deepEqual(dates("Nov 01 - Dec 26, 2026"), ["2026-11-01", "2026-12-26"]);
  assert.deepEqual(dates("Dec 20, 2026 - Jan 05, 2027"), ["2026-12-20", "2027-01-05"]);
  assert.deepEqual(dates("soon"), [null, null]);
});

test("mlh season starts in July", () => {
  assert.equal(season(new Date("2026-11-16")), 2027);
  assert.equal(season(new Date("2027-03-01")), 2027);
});

const lumaEntry = (over = {}) => ({
  event: { api_id: "evt-1", name: "Claude Meetup", url: "abc", start_at: "2026-12-01T18:00:00.000Z", end_at: "2026-12-01T20:00:00.000Z",
    location_type: "offline", timezone: "Europe/Madrid", geo_address_info: { city: "Barcelona", country_code: "ES", region: "Catalunya" }, ...over },
  calendar: { name: "AI BCN" }, ticket_info: { is_free: true, is_sold_out: false, spots_remaining: 12 }, registration_availability: "open", guest_count: 40,
});

test("luma keeps Spain only", () => {
  const [event] = luma({ entries: [lumaEntry(), lumaEntry({ api_id: "evt-2", geo_address_info: { city: "Lisbon", country_code: "PT" } })] }, true);
  assert.equal(event.url, "https://luma.com/abc");
  assert.equal(event.registration, "open");
  assert.equal(event.spots_left, 12);
  assert.equal(luma({ entries: [lumaEntry(), lumaEntry({ geo_address_info: { country_code: "PT" } })] }, true).length, 1);
});

test("hackathonhub and saraos pages", () => {
  const hub = hackathonhub("# Hub\n\n## MERGE Hackathon Madrid\n\n- **Date:** 2026-11-27 — 2026-11-29\n- **Location:** Madrid, ES\n- **Format:** onsite\n- **URL:** https://hackathonhub.eu/events/merge\n\nBuild things.\n\n## Paris Hack\n\n- **Date:** 2026-11-27\n- **Location:** Paris, FR\n- **URL:** https://hackathonhub.eu/events/paris\n");
  assert.equal(hub.length, 1);
  assert.deepEqual([hub[0].title, hub[0].start, hub[0].end, hub[0].city], ["MERGE Hackathon Madrid", "2026-11-27", "2026-11-29", "Madrid"]);
  const page = '<svg class="lucide lucide-map-pin"></svg></span><p class="x">Asturias</p></div><h1 class="y"><a href="/@asc">Asturias Software Crafters</a></h1>' +
    '<li><a class="c" href="/@asc/events/charla-1"><div><p class="s"><time dateTime="2026-12-11T17:30:00.000Z">vie</time></p><p class="t">Charla &amp; pizza</p></div></a></li>';
  assert.deepEqual(saraos(page, "asc").map((e) => [e.title, e.organizer, e.city, e.url]),
    [["Charla & pizza", "Asturias Software Crafters", "Asturias", "https://saraos.tech/@asc/events/charla-1"]]);
});

const raw = (over = {}) => ({ source: "luma", source_id: "1", title: "Kubernetes Night", url: "https://luma.com/k8s", start: "2026-12-01T18:00:00.000Z",
  city: "Madrid", trusted: true, ...over });

test("normalize, filter and dedupe", () => {
  assert.equal(normalize(raw({ trusted: false, title: "Cata de vinos" })), null);
  assert.equal(normalize(raw({ trusted: false, title: "Coworking day", description: "For founders." })), null, "one stray topic in a blurb is not tech");
  const event = normalize(raw());
  assert.deepEqual([event.type, event.topics, event.region, event.date], ["event", ["cloud"], "MD", "2026-12-01"]);
  const merged = dedupe([event, normalize(raw({ source: "meetup", source_id: "9", url: "https://meetup.com/k8s", title: "Kubernetes night!", organizer: "CNCF Madrid" }))]);
  assert.equal(merged.length, 1);
  assert.deepEqual([merged[0].url, merged[0].also, merged[0].organizer], ["https://luma.com/k8s", ["https://meetup.com/k8s"], "CNCF Madrid"]);
  assert.ok(upcoming(event, "2026-12-01") && !upcoming(event, "2026-12-02"));
});

test("mcp", () => {
  const index = { generated_at: "2026-11-16T05:00:00Z", sources: {}, events: [
    normalize(raw()), normalize(raw({ source_id: "2", url: "https://luma.com/hack", title: "HackBCN", city: "Barcelona", fallback_type: "hackathon", start: "2026-12-05" })),
    normalize(raw({ source_id: "3", url: "https://luma.com/on", title: "Rust online talk", city: null, online: true, start: "2026-12-06" })) ] };
  const call = (name, args = {}) => handle(index, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }).result;
  assert.equal(handle(index, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }).result.protocolVersion, "2025-06-18");
  assert.equal(handle(index, { jsonrpc: "2.0", method: "notifications/initialized" }), null);
  assert.deepEqual(handle(index, { jsonrpc: "2.0", id: 1, method: "tools/list" }).result.tools.map((t) => t.name), ["find_events", "list_filters"]);
  const from = "2026-11-16";
  assert.equal(call("find_events", { from }).structuredContent.total, 3);
  assert.deepEqual(call("find_events", { from, type: "hackathon" }).structuredContent.events.map((e) => e.title), ["HackBCN"]);
  assert.deepEqual(call("find_events", { from, region: "Cataluña" }).structuredContent.events.map((e) => e.title), ["HackBCN"]);
  assert.deepEqual(call("find_events", { from, region: "madrid", query: "kubernetes" }).structuredContent.events.map((e) => e.city), ["Madrid"]);
  assert.equal(call("find_events", { from, region: "Barcelona" }).structuredContent.total, 1, "a city is that city");
  assert.equal(call("find_events", { from, region: "CT" }).structuredContent.total, 1);
  assert.equal(call("find_events", { from, online: "true" }).structuredContent.total, 1);
  assert.equal(call("find_events", { from, to: "2026-12-01" }).structuredContent.total, 1);
  assert.equal(call("find_events", { from: "2026-12-06" }).structuredContent.total, 1);
  assert.ok(call("find_events", { type: "party" }).isError);
  assert.ok(call("find_events", { region: "Narnia" }).isError);
  assert.deepEqual(call("list_filters").structuredContent.regions, { MD: { name: "Madrid", events: 1 }, CT: { name: "Cataluña", events: 1 } });
  assert.equal(handle(index, { jsonrpc: "2.0", id: 1, method: "nope" }).error.code, -32601);
});

test("hackbarna ical", () => {
  assert.equal(madridIso("20261116T150000"), "2026-11-16T15:00:00+01:00");
  assert.equal(madridIso("20260716T150000"), "2026-07-16T15:00:00+02:00");
  const [event] = hackbarna("BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:1@x\r\nDTSTART;TZID=Europe/Madrid:20261116T150000\r\nDTEND;TZID=Europe/Madrid:20261116T180000\r\n" +
    "SUMMARY:Hacking Wi-Fi\\, p\r\n ortales\r\nSTATUS:CONFIRMED\r\nLOCATION:Cibernàrium\\, Barcelona\r\nDESCRIPTION:Organiser: MWC\\n\\nTaller.\\n\\nhttps://digest.hackbarna.com/es/events/x?utm=1\r\n" +
    "URL:https://digest.hackbarna.com/es/events/x?utm_source=a\r\nORGANIZER;CN=MWC Barcelona:mailto:a@b.c\r\nEND:VEVENT\r\nEND:VCALENDAR");
  assert.deepEqual([event.title, event.url, event.start, event.organizer, event.venue, event.description],
    ["Hacking Wi-Fi, portales", "https://digest.hackbarna.com/es/events/x", "2026-11-16T15:00:00+01:00", "MWC Barcelona", "Cibernàrium, Barcelona", "Taller."]);
});

test("sarao and opentechevents feeds", () => {
  const [ai] = sarao({ eventos: [{ titulo: "Claude Build Workshop", ficha: "https://saraoia.com/evento/x", ciudad: "Madrid", inicio: "2026-12-01T19:00:00+01:00",
    organiza: "Women in Tech", precio: "Gratis", etiquetas: ["taller práctico", "con aprobación", "agotado", "lista de espera"], inscripcion: "https://luma.com/k8s" }] });
  assert.deepEqual([ai.free, ai.registration, ai.approval, ai.fallback_type, ai.register_url], [true, "waitlist", true, "workshop", "https://luma.com/k8s"]);
  const [conf] = ote({ events: [{ id: "https://eventos.wiki/ote/1", name: "Codemotion Madrid 2027", startDate: "2027-05-12T09:00", endDate: "2027-05-13T18:30", timezone: "Europe/Madrid",
    url: "https://eventos.wiki/events/2027/codemotion", attendanceMode: "in-person", status: "scheduled", tags: ["IA", "Frontend"],
    location: { venue: "La Nave", address: { street: "C. Cifuentes, 5, 28021 Madrid", region: "Madrid", country: "ES" } }, organizers: [{ name: "Codemotion" }],
    source: { url: "https://www.meetup.com/x/events/1/" } }, { name: "Gone", startDate: "2027-01-01T10:00", status: "cancelled" }] }, "eventos.wiki");
  assert.deepEqual([conf.start, conf.end, conf.organizer, conf.register_url], ["2027-05-12T09:00:00+02:00", "2027-05-13T18:30:00+02:00", "Codemotion", "https://www.meetup.com/x/events/1/"]);
  const event = normalize(conf);
  assert.deepEqual([event.region, event.type, event.topics], ["MD", "event", ["ai", "web"]]);
  // Sarao's page and Luma's are one event: the sign-up link is the match.
  const merged = dedupe([normalize(ai), normalize(raw({ title: "Madrid | Claude Build Workshop: Women", url: "https://lu.ma/k8s", registration: "open", spots_left: 3 }))]);
  assert.equal(merged.length, 1);
  assert.deepEqual([merged[0].url, merged[0].register_url, merged[0].also, merged[0].spots_left], ["https://saraoia.com/evento/x", "https://luma.com/k8s", [], 3]);
});
