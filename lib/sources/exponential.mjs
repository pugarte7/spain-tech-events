// Exponential Fellowship's events page lists its upcoming events, each a Luma
// link; Luma's own record of the event gives the time and place.
import { parse as lumaEntries } from "./luma.mjs";
const PAGE = "https://www.goexponential.org/events";

/** Luma slugs of the upcoming events in the page's embedded data. */
export function slugs(html) {
  const flight = [...html.matchAll(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)<\/script>/g)].map(([, chunk]) => chunk).join("")
    .replace(/\\"/g, '"');
  const upcoming = flight.match(/"upcoming":\[([\s\S]*?)\],"past":/)?.[1] ?? "";
  return [...new Set([...upcoming.matchAll(/"href":"https:\/\/(?:lu\.ma|luma\.com)\/([\w-]+)"/g)].map(([, slug]) => slug))];
}

export async function crawl(http) {
  const out = [];
  for (const slug of slugs(await http.text(PAGE))) {
    const { kind, data } = await http.json(`https://api.lu.ma/url?url=${slug}`);
    if (kind !== "event" || !data?.event) continue;
    const entry = { ...data, registration_availability: data.registration_availability ?? "open" };
    out.push(...lumaEntries({ entries: [entry] }, true).map((e) => ({
      ...e, source: "exponential", organizer: "Exponential Fellowship", registration: data.ticket_info ? e.registration : null,
    })));
  }
  return out;
}
