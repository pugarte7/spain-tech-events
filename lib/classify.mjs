// What an event is, read from its own text: kind, topics, region, tech or not.
export const norm = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// First match wins, so the order is from most to least specific.
const TYPES = [
  ["hackathon", /hackath?on|hackaton|\bhack ?(day|night|week|fest)|datathon|ideathon|vibeathon|buildathon|game ?jam|\bctf\b|\bhack[a-z]*\b(?=.*\b(edition|20\d\d)\b)/],
  ["conference", /summit|conference|congreso|\bconf\b|[a-z]conf\b|devfest|kubecon|world congress|jornadas?|forum\b|foro\b|demo day|\bdays?\b europe|devopsdays|saturday/],
  ["workshop", /workshop|taller|bootcamp|masterclass|hands[- ]on|\bcurso\b|\bcourse\b|training|formacion|\blab\b|office hours|open day/],
  ["talk", /charla|\btalks?\b|webinar|ponencia|fireside|\bpanel\b|mesa redonda|keynote|presentacion|ama\b/],
  ["networking", /networking|afterwork|after work|drinks|\bsocial\b|\bpub\b|cafe|coffee|breakfast|desayuno|cena|dinner|mixer/],
  ["meetup", /meet ?up|quedada|encuentro|community|comunidad/],
];
export const TYPE_NAMES = [...TYPES.map(([name]) => name), "event"];

const TOPICS = {
  ai: /\b(ai|ia|llms?|genai|gen ai|machine learning|ml|deep learning|agents?|agentes?|claude|openai|chatgpt|gpt|copilot|rag|mcp|inteligencia artificial|artificial intelligence|mlops|nlp|computer vision|vibe ?coding)\b/,
  data: /\b(data|datos|analytics|big data|sql|dbt|databricks|snowflake|spark|kafka|bi|data ?science|data engineering|postgres(ql)?)\b/,
  web: /\b(javascript|typescript|react|vue|angular|svelte|node(js)?|frontend|front-end|css|html|web ?dev|next\.?js|wordpress|php|laravel|symfony|django|rails)\b/,
  mobile: /\b(android|ios|swift|kotlin|flutter|react native|mobile)\b/,
  cloud: /\b(cloud|aws|azure|gcp|kubernetes|k8s|docker|devops|sre|platform engineering|serverless|terraform|observability|cloud ?native|infra(structure)?)\b/,
  security: /\b(security|seguridad|ciberseguridad|cybersecurity|hacking|pentest(ing)?|owasp|infosec|ctf|red team)\b/,
  blockchain: /\b(blockchain|crypto|cripto|web3|ethereum|bitcoin|solana|defi|nft)\b/,
  product: /\b(product management|product manager|producto digital|ux|ui|design system|diseno de producto|product design|agile|scrum|no-?code|low-?code)\b/,
  startups: /\b(startups?|founders?|emprend\w+|venture|vc|inversores?|investors?|pitch|demo day|saas|fundrais\w+)\b/,
  gamedev: /\b(game ?dev|videojuegos?|unity|unreal|godot|game jam|gaming)\b/,
  languages: /\b(python|java|golang|rust|scala|elixir|c\+\+|\.net|dotnet|c#|ruby|clojure|haskell|kotlin)\b/,
  hardware: /\b(iot|hardware|robotic[as]?|arduino|raspberry|semiconductor\w*|chips?|embedded|quantum|cuantic\w+|drones?|3d printing)\b/,
};
export const TOPIC_NAMES = Object.keys(TOPICS);

const GENERIC_TECH = /\b(tech|tecnolog\w+|software|developers?|desarrollador\w*|programa(cion|dor\w*)|coding|codigo|\bcode\b|engineer\w*|ingenier\w+ (de )?(software|datos)|open ?source|hackers?|devs?|api|geeks?|informatic\w+)\b/;
const NOT_TECH = /\b(dj|tech house|techno|speed dating|cuffing|yoga|tantra|wine|vino|kids|ninos|ninas|philosophy|filosofia|emotional intelligence|language exchange|intercambio de idiomas)\b/;

/** ISO 3166-2:ES autonomous community codes, by city. */
const CITIES = {
  MD: "madrid|mostoles|alcobendas|getafe|leganes|pozuelo de alarcon|las rozas|alcala de henares|tres cantos|boadilla del monte",
  CT: "barcelona|hospitalet|badalona|sabadell|terrassa|girona|lleida|tarragona|reus|sant cugat|mataro|cerdanyola",
  VC: "valencia|alicante|alacant|castellon|elche|elx|paterna|gandia",
  AN: "sevilla|seville|malaga|granada|cordoba|cadiz|jerez de la frontera|almeria|huelva|jaen|marbella",
  PV: "bilbao|bilbo|san sebastian|donostia|vitoria|vitoria-gasteiz|gasteiz",
  GA: "a coruna|la coruna|coruna|vigo|santiago de compostela|ourense|lugo|pontevedra",
  AR: "zaragoza|huesca|teruel",
  AS: "oviedo|gijon|aviles",
  CL: "valladolid|salamanca|leon|burgos|segovia|avila|zamora|palencia|soria",
  CM: "toledo|albacete|ciudad real|guadalajara|cuenca",
  CN: "las palmas|las palmas de gran canaria|santa cruz de tenerife|tenerife|la laguna",
  IB: "palma|palma de mallorca|mallorca|ibiza|eivissa|menorca",
  MC: "murcia|cartagena",
  NC: "pamplona|iruna",
  CB: "santander",
  EX: "badajoz|caceres|merida",
  RI: "logrono",
};
export const REGIONS = {
  MD: "Madrid", CT: "Cataluña", VC: "Comunidad Valenciana", AN: "Andalucía", PV: "País Vasco", GA: "Galicia",
  AR: "Aragón", AS: "Asturias", CL: "Castilla y León", CM: "Castilla-La Mancha", CN: "Canarias",
  IB: "Baleares", MC: "Murcia", NC: "Navarra", CB: "Cantabria", EX: "Extremadura", RI: "La Rioja",
};
const REGION_ALIASES = {
  CT: "catalunya|catalonia|cataluna", VC: "valencian community|comunitat valenciana|comunidad valenciana",
  AN: "andalucia|andalusia", PV: "pais vasco|basque country|euskadi", MD: "comunidad de madrid|community of madrid",
  IB: "illes balears|islas baleares|balearic islands", CN: "canary islands|islas canarias|canarias",
  CL: "castilla y leon|castile and leon", CM: "castilla-la mancha|castile-la mancha", AS: "principado de asturias|asturias",
  NC: "navarra|navarre", MC: "region de murcia", GA: "galicia", AR: "aragon", CB: "cantabria", EX: "extremadura", RI: "la rioja",
};
const lookup = (table) => new Map(Object.entries(table).flatMap(([code, names]) => names.split("|").map((n) => [n, code])));
const BY_CITY = lookup(CITIES);
const BY_REGION = new Map([...lookup(REGION_ALIASES), ...Object.entries(REGIONS).map(([code, name]) => [norm(name), code]),
  ...Object.keys(REGIONS).map((code) => [code.toLowerCase(), code])]);

/** Region code of a city, a region name or a code; null when unknown. */
export function regionOf(...places) {
  for (const place of places) {
    const key = norm(place).replace(/,.*$/, "").trim();
    if (!key) continue;
    const code = BY_CITY.get(key) ?? BY_REGION.get(key);
    if (code) return code;
  }
  return null;
}
const SPAIN_WORDS = new RegExp(`\\b(spain|espana|${[...BY_CITY.keys()].join("|")})\\b`);
export const mentionsSpain = (text) => SPAIN_WORDS.test(norm(text));

export function typeOf(text, fallback = "event") {
  const t = norm(text);
  return TYPES.find(([, re]) => re.test(t))?.[0] ?? fallback;
}
export function topicsOf(text) {
  const t = norm(text);
  return TOPIC_NAMES.filter((name) => TOPICS[name].test(t));
}
export function isTech(text) {
  const t = norm(text);
  if (NOT_TECH.test(t)) return false;
  return GENERIC_TECH.test(t) || TYPES[0][1].test(t) || TOPIC_NAMES.some((name) => TOPICS[name].test(t));
}

const MADRID_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" });
/** The day in Spain of an ISO date or date-time. */
export const dayOf = (iso) => (!iso ? null : /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : MADRID_DAY.format(new Date(iso)));

const CITY_IN_TEXT = new RegExp(`\\b(${[...BY_CITY.keys()].sort((a, b) => b.length - a.length).join("|")})\\b`);
/** Region of the first Spanish city a free-text place names. */
export const regionIn = (text) => BY_CITY.get(norm(text).match(CITY_IN_TEXT)?.[1]) ?? null;
