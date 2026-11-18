// What an event is, read from its own text: kind, topics, keywords, place,
// price and size. Shared by scripts/events.mjs, which stores these in
// data/events.json, and api/mcp.js, which filters on them. Not a Vercel
// Function: files starting with _ in api/ are not served.
import { CITIES, PLACES, REGION_NAMES, keywordsOf, plainWords, regionsOf } from "./_classify.js";

export { keywordsOf };
export const norm = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// --- Kind ----------------------------------------------------------------------------

// First match wins, so the order is from most to least specific.
const TYPES = [
  ["hackathon", /hackath?on|hackaton|\bhack ?(day|night|week|fest)|datathon|ideathon|vibeathon|buildathon|game ?jam|\bctf\b|\bhack[a-z]*\b(?=.*\b(edition|20\d\d)\b)/],
  ["conference", /summit|conference|congreso|congress|\bconf\b|[a-z]conf\b|[a-z]con\b(?=( europe| 20\d\d|\.tech|$))|\bcon\b(?=( 20\d\d|$))|devfest|kubecon|jornadas?|forum\b|foro\b|demo day|\bdays?\b europe|devopsdays|saturday|bootcamp (\w+ ){0,4}20\d\d|\bexpo\b|tech show|\bfest\b|codemotion|[a-z]camp\b|spring i\/o/],
  ["workshop", /workshop|taller|bootcamp|masterclass|hands[- ]on|\bcurso\b|\bcourse\b|training|formacion|\blab\b|office hours|open day|\bkata\b|coding dojo|codelab|study group/],
  ["talk", /charla|\btalks?\b|webinar|ponencia|fireside|\bpanel\b|mesa redonda|keynote|presentacion|ama\b|lightning/],
  ["networking", /networking|afterwork|after work|drinks|\bbeers?\b|cervezas|\bsocial\b|\bpub\b|cafe|coffee|breakfast|desayuno|cena|dinner|mixer|brunch/],
  ["meetup", /meet ?up|quedada|encuentro|community|comunidad|user group|\bgdg\b/],
];
export const TYPE_NAMES = [...TYPES.map(([name]) => name), "event"];
export function typeOf(text, fallback = "event") {
  const t = norm(text);
  return TYPES.find(([, re]) => re.test(t))?.[0] ?? fallback;
}

// --- Topics --------------------------------------------------------------------------

// Coarse subjects, for browsing; the fine vocabulary is _classify.js KEYWORDS.
const TOPICS = {
  ai: /\b(ai|ia|llms?|genai|gen ai|machine learning|ml|deep learning|agents?|agentes?|claude|openai|chatgpt|gpt|gemini|copilot|rag|mcp|inteligencia artificial|artificial intelligence|mlops|nlp|computer vision|vibe ?coding)\b/,
  data: /\b(data|datos|analytics|big data|sql|dbt|databricks|snowflake|spark|kafka|power bi|business intelligence|tableau|data ?science|data engineering|postgres(ql)?)\b/,
  web: /\b(javascript|typescript|react|vue|angular|svelte|node(js)?|frontend|front-end|css|html|web ?dev|next\.?js|wordpress|drupal|php|laravel|symfony|django|rails)\b/,
  mobile: /\b(android|ios|swift|kotlin|flutter|react native|mobile)\b/,
  cloud: /\b(cloud|aws|azure|gcp|google cloud|kubernetes|k8s|docker|devops|sre|platform engineering|serverless|terraform|observability|cloud ?native|infra(structure)?)\b/,
  security: /\b(security|seguridad|ciberseguridad|cybersecurity|hacking|pentest(ing)?|owasp|infosec|ctf|red team)\b/,
  blockchain: /\b(blockchain|crypto|cripto|web3|ethereum|bitcoin|solana|defi|nft)\b/,
  product: /\b(product management|product manager|product (leaders?|people|ops)|producto digital|ux|ui|design system|diseno de producto|product design|agile|scrum|kanban|no-?code|low-?code|power platform|salesforce|atlassian|jira)\b/,
  startups: /\b(startups?|founders?|emprend\w+|venture|vc|inversores?|investors?|pitch|demo day|saas|fundrais\w+)\b/,
  gamedev: /\b(game ?dev|game (creators|developers|designers?)|videojuegos?|unity|unreal|godot|game jam|gaming)\b/,
  // .NET, C# and C++ start or end on a symbol, where \b does not hold.
  languages: /\b(python|java|golang|rust|scala|elixir|dotnet\w*|ruby|clojure|haskell|kotlin|spring)\b|(^|[^a-z0-9])(\.net|c#|c\+\+)(?![a-z0-9])/,
  hardware: /\b(iot|hardware|robotic[as]?|arduino|raspberry|semiconductor\w*|chips?|embedded|quantum|cuantic\w+|drone?s?|3d printing|space ?tech|aerospace)\b/,
};
export const TOPIC_NAMES = Object.keys(TOPICS);
export function topicsOf(text) {
  const t = norm(text);
  return TOPIC_NAMES.filter((name) => TOPICS[name].test(t));
}

const GENERIC_TECH = /\b(tech|tecnolog\w+|software|developers?|desarrollador\w*|programa(cion|dor\w*)|coding|codigo|\bcode\b|engineer\w*|ingenier\w+ (de )?(software|datos)|open ?source|hackers?|devs?|api|geeks?|informatic\w+|github|gitlab|codex|finops|devfest|cyber(?!punk)\w*|[a-z]*jug|pydata|linux|(fin|ed|health|deep|legal|prop|climate|clean|gov|insur|reg)tech|techies|xr|realidad (virtual|aumentada)|a11y|accesibilidad web|qa|testing|e-?commerce|opentelemetry|gophers?|go (ug|user group|meetup)|nis2|make(r)?spaces?)\b/;
const NOT_TECH = /\b(dj|tech house|techno|speed dating|cuffing|yoga|tantra|wine|vino|kids|ninos|ninas|philosophy|filosofia|emotional intelligence|language exchange|intercambio de idiomas)\b/;
/** A Luma rich-text document as plain text. */
export function mirrorText(node) {
  if (!node || typeof node !== "object") return "";
  const inner = (node.content ?? []).map(mirrorText).join("");
  return node.type === "text" ? node.text ?? "" : /paragraph|heading|list_item|bullet_list/.test(node.type ?? "") ? `${inner}\n` : inner;
}

export function isTech(text) {
  const t = norm(text);
  if (NOT_TECH.test(t)) return false;
  return GENERIC_TECH.test(t) || TYPES[0][1].test(t) || TOPIC_NAMES.some((name) => TOPICS[name].test(t));
}

// --- Places --------------------------------------------------------------------------

/** Region name as shown: the first of _classify.js REGION_NAMES. */
export const REGIONS = Object.fromEntries(Object.entries(REGION_NAMES).map(([code, names]) => [code, names.split(",")[0].trim()]));
// Towns events happen in that _classify.js, written for job postings, does not list.
const MORE_CITIES = {
  MD: "Madrid, Móstoles, Leganés, Alcalá de Henares, Boadilla del Monte, Villaviciosa de Odón, Fuenlabrada, Aranjuez",
  CT: "L'Hospitalet de Llobregat/Hospitalet, Badalona, Reus, Mataró, Cerdanyola del Vallès/Cerdanyola, Manresa, Vic, Granollers, Caldes de Malavella, Castelldefels, Vilanova i la Geltrú",
  VC: "Paterna, Gandia, Sant Vicent del Raspeig, Castelló de la Plana/Castellón de la Plana, Benidorm",
  AN: "Fuengirola, Benalmádena, Torremolinos, Jerez de la Frontera, Estepona, Algeciras",
  AS: "Avilés, Asturias, Langreo, Mieres", CN: "La Laguna/San Cristóbal de La Laguna", MU: "Murcia",
  IB: "Maó/Mahón", CL: "Ponferrada", CM: "Talavera de la Reina", GA: "Ferrol", RI: "La Rioja", NC: "Tudela", CB: "Torrelavega",
};
const split = (text, sep) => String(text ?? "").split(sep).map((x) => x.trim()).filter(Boolean);
const EXTRA = Object.entries(MORE_CITIES).flatMap(([code, list]) => split(list, ",").flatMap((group) =>
  split(group, "/").map((name) => [plainWords(name), code, split(group, "/")[0]])));
const codes = Object.keys(REGIONS).map((code) => [code.toLowerCase(), code]);
const BY_NAME = new Map([...codes, ...[...PLACES, ...EXTRA].map(([name, code]) => [name, code])]);
const REGION_ONLY = new Map([...codes, ...PLACES.filter(([, , city]) => city === null).map(([name, code]) => [name, code])]);
const inText = (text) => {
  const where = ` ${plainWords(text)} `;
  return EXTRA.find(([name]) => where.includes(` ${name} `))?.[1] ?? regionsOf(text)[0] ?? null;
};

/** Region code of a city, a region name or a code, the first that is known. */
export function regionOf(...places) {
  for (const place of places) {
    const code = BY_NAME.get(plainWords(String(place ?? "").replace(/,.*$/, "")));
    if (code) return code;
  }
  return null;
}
/** Region of the first Spanish place a free text names. */
export const regionIn = (text) => (text ? inText(text) : null);
/** Region code of a region's own name or code ("Andalucía", "AN", "Madrid"); null for a city. */
export const regionNamed = (place) => REGION_ONLY.get(plainWords(place)) ?? null;
export const mentionsSpain = (text) => /\b(spain|espana)\b/.test(norm(text)) || inText(text) !== null;
export { CITIES };

// --- Time ----------------------------------------------------------------------------

const MADRID_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" });
/** The day in Spain of an ISO date or date-time. */
export const dayOf = (iso) => (!iso ? null : /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : MADRID_DAY.format(new Date(iso)));

/** "2027-05-12T09:00" on a time zone's clock as an ISO date-time with its offset. */
export function localIso(local, timeZone = "Europe/Madrid") {
  if (!local) return null;
  if (/(Z|[+-]\d{2}:\d{2})$/.test(local) || !local.includes("T")) return local;
  const full = local.length === 16 ? `${local}:00` : local;
  const zone = new Intl.DateTimeFormat("en", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(new Date(`${full}Z`)).find((p) => p.type === "timeZoneName").value;
  return full + (zone.match(/[+-]\d{2}:\d{2}/)?.[0] ?? "+00:00");
}

// --- Price and size ------------------------------------------------------------------

/** The first price a text states, "5 €", "Desde 30 € + IVA", "11,32 €": [amount, currency] or null. */
export function priceIn(text) {
  const m = String(text ?? "").match(/(€|\$|£)\s*(\d{1,5}(?:[.,]\d{1,2})?)|(\d{1,5}(?:[.,]\d{1,2})?)\s*(€|eur\b|euros?\b|\$|usd\b|£|gbp\b)/i);
  if (!m) return null;
  const sign = m[1] ?? m[4], amount = m[2] ?? m[3];
  return [Number(amount.replace(",", ".")), /€|eur/i.test(sign) ? "EUR" : /\$|usd/i.test(sign) ? "USD" : "GBP"];
}

export const SIZES = ["small", "medium", "large", "xl", "massive"];
const SIZE_FROM = [0, 50, 200, 1000, 10000];
/** small under 50 people, medium under 200, large under 1,000, xl under 10,000, massive beyond. */
export const sizeOf = (people) => (people == null ? null : SIZES[SIZE_FROM.findLastIndex((from) => people >= from)]);

// Events whose scale is public knowledge and that no source gives a head count
// for: the order of magnitude of past editions, never a figure.
const KNOWN_SCALE = [
  [/\bmwc\b|mobile world congress|\b4yfn\b|integrated systems europe|\bise 20\d\d|smart city expo|^kubecon|tech show madrid|south summit/, "massive"],
  [/codemotion madrid|t3chfest|commit conf|pycon ?es|spring i\/o|openexpo|talent land|digital enterprise show|valencia digital summit|aws summit|google cloud summit|big data spain|lambda world|jbcnconf|sonar\+d/, "xl"],
];
export const knownScale = (title) => KNOWN_SCALE.find(([re]) => re.test(norm(title)))?.[1] ?? null;
