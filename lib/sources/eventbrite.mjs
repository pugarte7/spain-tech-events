// Eventbrite's search pages list their results as schema.org JSON-LD.
import { jsonLd } from "../http.mjs";
const SEARCHES = ["spain/tech", "spain/hackathon", "spain--madrid/tech", "spain--barcelona/tech", "spain/inteligencia-artificial"];
const PAGES = 2;

export function parse(html) {
  return jsonLd(html).filter((d) => d["@type"] === "ItemList").flatMap((list) => list.itemListElement ?? []).flatMap(({ item }) => {
    const address = item?.location?.address ?? {};
    const online = /online/i.test(item?.eventAttendanceMode ?? "") || item?.location?.["@type"] === "VirtualLocation";
    if (!item?.url || (address.addressCountry !== "ES" && !online)) return [];
    return [{
      source: "eventbrite", source_id: item.url.match(/-(\d+)(?:\?|$)/)?.[1] ?? item.url, title: item.name,
      url: item.url.split("?")[0], start: item.startDate, end: item.endDate ?? null,
      city: address.addressLocality ?? null, region_hint: address.addressRegion ?? null,
      venue: item.location?.name ?? null, online, organizer: null,
      description: item.description === item.name ? null : item.description ?? null,
      free: null, registration: null, trusted: false,
    }];
  });
}

export async function crawl(http) {
  const out = [];
  for (const search of SEARCHES)
    for (let page = 1; page <= PAGES; page++) {
      const found = parse(await http.text(`https://www.eventbrite.es/d/${search}/?page=${page}`));
      out.push(...found);
      if (found.length < 15) break;
    }
  return out;
}
