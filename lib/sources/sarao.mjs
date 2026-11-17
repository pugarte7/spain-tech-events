// Sarao (saraoia.com): a hand-reviewed agenda of in-person AI meetups in
// Spain, published as open data (CC BY 4.0, cite Sarao and link its page of
// the event first). `url` is that page; `register_url` is where to sign up.
import { priceIn } from "../classify.mjs";
const FEED = "https://saraoia.com/eventos.json";

export function parse(feed) {
  return (feed.eventos ?? []).filter((e) => e.ficha && e.inicio).map((e) => {
    const tags = e.etiquetas ?? [], has = (tag) => tags.includes(tag);
    const [price_min, currency] = priceIn(e.precio) ?? [null, null];
    return {
      source: "sarao", source_id: e.ficha, title: e.titulo, url: e.ficha, register_url: e.inscripcion ?? null,
      start: e.inicio, end: e.fin ?? null, city: e.ciudad ?? null, venue: e.lugar ?? null, address: e.lugar ?? null, online: false,
      organizer: e.organiza ?? null, description: e.descripcion ?? null, keywords: `IA ${tags.join(" ")}`,
      free: e.precio === "Gratis" ? true : price_min !== null ? false : null, price_min, currency,
      registration: has("lista de espera") ? "waitlist" : has("agotado") ? "full" : null,
      approval: has("con aprobación") || has("con selección") ? true : null,
      fallback_type: has("hackathon") ? "hackathon" : has("taller práctico") ? "workshop" : "meetup", trusted: true,
    };
  });
}
export const crawl = async (http) => parse(await http.json(FEED));
