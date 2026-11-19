// The home page: Bit walks a visitor through connecting the MCP and what to ask it.
// One screen per step; every step is an entry in STEPS and its words in T.
const MCP = "https://spaintechevents.com/mcp";
const REPO = "https://github.com/pugarte7/spain-tech-events";
const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);

// --- Bit's face (face.js) ----------------------------------------------------
const face = { mouth: null, eyes: null };

function drawFace() {
  const rows = FACE.sprite.map((row) => [...row]);
  for (const look of [face.mouth, face.eyes])
    for (const [y, x, px] of FACE.looks[look] ?? []) [...px].forEach((c, i) => { rows[y][x + i] = c; });
  let out = "";
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      let end = x;
      while (end < row.length && row[end] === row[x]) end++;
      if (row[x] !== ".") out += `<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${FACE.fill[row[x]]}"/>`;
      x = end;
    }
  });
  $("face").innerHTML = out;
}

function blink() {
  if (still) return;
  setTimeout(() => {
    if (!face.eyes) {
      face.eyes = "blink"; drawFace();
      setTimeout(() => { if (face.eyes === "blink") { face.eyes = null; drawFace(); } }, 130);
    }
    blink();
  }, 2200 + Math.random() * 2600);
}

function react(look, ms = 600) {
  if (still) return;
  face.eyes = look; drawFace();
  setTimeout(() => { if (face.eyes === look) { face.eyes = null; drawFace(); } }, ms);
}

// --- Words -------------------------------------------------------------------
const T = {
  es: {
    progress: "Progreso", steps: ["Idioma", "El MCP", "Conectar", "Preguntar"],
    back: "Atrás", restart: "Empezar de nuevo", copy: "Copiar", copied: "Copiado", copyFail: "Cópialo a mano",
    hello: "Hola, soy Bit.\nEste MCP le da a tu agente de IA los eventos tech de España, del KubeCon al meetup mensual de un grupo de usuarios. Y te apunta.",
    start: "Empezar",
    know: "¿Sabes usar un MCP?", yes: "Sí", no: "No",
    what: "Un MCP conecta tu agente (Claude, Codex, Cursor…) con datos y herramientas de fuera.\nEste no pide cuenta ni instalar nada.",
    whatNext: "¿Cómo lo conecto?",
    agent: "¿Qué agente usas?", other: "Otro",
    setup: {
      claude: "Pega esto en tu terminal y abre Claude Code.",
      codex: "Pega esto en tu terminal y abre Codex.",
      cursor: "Añade esto a ~/.cursor/mcp.json y reinicia Cursor.",
      other: "Pega este enlace en el chat de tu agente y dile que se conecte.",
    },
    setupDone: "Hecho",
    link: "Entonces solo necesitas esto.\nAñádelo como servidor MCP, o pégaselo a tu agente en el chat.",
    linkDone: "Ya está conectado",
    topics: "¿Qué le quieres pedir?",
    finish: "Terminar", more: "Otra cosa",
    cards: { find: "Buscar eventos", signup: "Apuntarme", cfp: "Dar una charla" },
    topic: {
      find: "Cada mañana lee Luma, Meetup, Eventbrite y las agendas de las comunidades.\nPídele por tema, tipo, ciudad, fechas, precio o tamaño.",
      signup: "Lee el formulario del evento y lo rellena con su navegador cuando le dices que sí.\nPagar, iniciar sesión y los CAPTCHA son cosa tuya.",
      cfp: "Las conferencias que aceptan propuestas de charla llevan el enlace y la fecha límite.",
    },
    uses: "Tu agente usa",
    prompts: {
      find: ["¿Qué meetups de IA hay en Barcelona esta semana?",
        "Búscame hackathons gratis en Madrid en los próximos dos meses.",
        "¿Qué eventos nuevos han aparecido desde ayer?"],
      signup: ["Apúntame a los meetups gratis de IA de esta semana en Barcelona que tengan plazas.",
        "Apúntame al próximo evento de ciberseguridad en Málaga."],
      cfp: ["¿Qué conferencias en España tienen abierto el call for papers?",
        "¿A qué conferencias de datos puedo proponer una charla?"],
    },
    done: "Eso es todo.\nSi te sirve, una estrella en GitHub ayuda a que lo encuentre más gente.",
    star: "Dejar una estrella",
  },
  en: {
    progress: "Progress", steps: ["Language", "The MCP", "Connect", "Ask"],
    back: "Back", restart: "Start over", copy: "Copy", copied: "Copied", copyFail: "Copy it by hand",
    hello: "Hi, I'm Bit.\nThis MCP gives your AI agent the tech events in Spain, from KubeCon to a user group's monthly meetup. And it signs you up.",
    start: "Start",
    know: "Have you used an MCP?", yes: "Yes", no: "No",
    what: "An MCP connects your agent (Claude, Codex, Cursor…) to outside data and tools.\nThis one needs no account and nothing installed.",
    whatNext: "How do I connect it?",
    agent: "Which agent do you use?", other: "Other",
    setup: {
      claude: "Paste this into your terminal and open Claude Code.",
      codex: "Paste this into your terminal and open Codex.",
      cursor: "Add this to ~/.cursor/mcp.json and restart Cursor.",
      other: "Paste this link into your agent's chat and tell it to connect.",
    },
    setupDone: "Done",
    link: "Then this is all you need.\nAdd it as an MCP server, or paste it into your agent's chat.",
    linkDone: "It's connected",
    topics: "What do you want to ask it?",
    finish: "Finish", more: "Something else",
    cards: { find: "Find events", signup: "Sign me up", cfp: "Give a talk" },
    topic: {
      find: "Every morning it reads Luma, Meetup, Eventbrite and the communities' own agendas.\nAsk by topic, type, city, dates, price or size.",
      signup: "It reads the event's form and fills it in with its browser once you say yes.\nPaying, signing in and CAPTCHAs are yours.",
      cfp: "Conferences that take talk proposals carry the link and the deadline.",
    },
    uses: "Your agent uses",
    prompts: {
      find: ["What AI meetups are on in Barcelona this week?",
        "Find me free hackathons in Madrid in the next two months.",
        "What new events have appeared since yesterday?"],
      signup: ["Sign me up for this week's free AI meetups in Barcelona that still have places.",
        "Sign me up for the next security event in Málaga."],
      cfp: ["Which conferences in Spain have an open call for papers?",
        "Which data conferences can I propose a talk to?"],
    },
    done: "That's all.\nIf it helps you, a star on GitHub helps more people find it.",
    star: "Leave a star",
  },
};

const AGENTS = [
  ["claude", "Claude Code", `claude mcp add --transport http spain-tech-events ${MCP}`],
  ["codex", "Codex", `codex mcp add spain-tech-events --url ${MCP}`],
  ["cursor", "Cursor", JSON.stringify({ mcpServers: { "spain-tech-events": { url: MCP } } }, null, 2)],
];
const TOPICS = {
  find: ["find_events", "list_filters"],
  signup: ["event_registration", "registration_guide", "report_registration"],
  cfp: ["find_events"],
};

// --- Building blocks ---------------------------------------------------------
const state = { lang: null, step: "lang", arg: null, trail: [] };
let t = T.es;

function el(tag, props = {}, ...kids) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...kids);
  return node;
}
const button = (label, to, arg, tone = "") =>
  el("button", { type: "button", className: `btn ${tone}`.trim(), textContent: label, onclick: () => go(to, arg) });

async function copyText(text, btn) {
  let ok = true;
  try { await navigator.clipboard.writeText(text); } catch { ok = false; }
  btn.textContent = ok ? t.copied : t.copyFail;
  btn.className = `copy-btn ${ok ? "ok" : "err"}`;
  if (ok) react("wink");
  setTimeout(() => { btn.textContent = t.copy; btn.className = "copy-btn"; }, 1600);
}
function copyBox(text, code = true) {
  const btn = el("button", { type: "button", className: "copy-btn", textContent: t.copy });
  btn.onclick = () => copyText(text, btn);
  return el("div", { className: "copy" }, el(code ? "pre" : "p", { className: "copy-text", textContent: text }), btn);
}

// The line appears letter by letter over an invisible copy of itself, so the
// bubble has its final size from the first frame.
let typing = null;
function say(text, big) {
  clearInterval(typing);
  const line = $("say");
  line.className = big ? "say big" : "say";
  $("say-sr").textContent = text;
  const shown = document.createTextNode(still ? text : "");
  const ghost = el("span", { className: "ghost", textContent: still ? "" : text });
  line.replaceChildren(shown, ghost);
  face.mouth = null;
  if (still) return drawFace();
  let n = 0;
  const finish = () => {
    clearInterval(typing); typing = null;
    shown.data = text; ghost.textContent = "";
    face.mouth = null; drawFace();
  };
  typing = setInterval(() => {
    n += 2;
    if (n >= text.length) return finish();
    shown.data = text.slice(0, n); ghost.textContent = text.slice(n);
    face.mouth = n % 8 < 4 ? "open" : null; drawFace();
  }, 28);
  $("bubble").onclick = () => typing && finish();
}

// --- Steps: each returns [line, big?, extra nodes, choice nodes] -------------
const STEPS = {
  lang: () => ["¿Español o inglés?\nSpanish or English?", true, [], [
    el("button", { type: "button", className: "btn", textContent: "Español", lang: "es", onclick: () => setLang("es") }),
    el("button", { type: "button", className: "btn btn--aqua", textContent: "English", lang: "en", onclick: () => setLang("en") }),
  ]],
  hello: () => [t.hello, false, [], [button(t.start, "know")]],
  know: () => [t.know, true, [], [button(t.no, "what", null, "btn--paper"), button(t.yes, "link", null, "btn--grass")]],
  what: () => [t.what, false, [], [button(t.whatNext, "agent")]],
  agent: () => [t.agent, true, [], [
    ...AGENTS.map(([id, name]) => button(name, "setup", id, "btn--paper")),
    button(t.other, "setup", "other", "btn--paper"),
  ]],
  setup: (id) => {
    const agent = AGENTS.find((a) => a[0] === id);
    return [t.setup[id], false, [copyBox(agent ? agent[2] : MCP)], [button(t.setupDone, "topics")]];
  },
  link: () => [t.link, false, [copyBox(MCP)], [button(t.linkDone, "topics")]],
  topics: () => [t.topics, true, [], [
    ...Object.keys(TOPICS).map((id) => button(t.cards[id], "topic", id, "btn--paper")),
    button(t.finish, "done", null, "btn--sunset"),
  ]],
  topic: (id) => [t.topic[id], false, [
    ...t.prompts[id].map((q) => copyBox(q, false)),
    el("div", { className: "tools" }, el("span", { textContent: t.uses }),
      ...TOPICS[id].map((name) => el("code", { className: "badge", textContent: name }))),
  ], [button(t.finish, "done", null, "btn--paper"), button(t.more, "topics")]],
  done: () => [t.done, false, [], [
    button(t.more, "topics", null, "btn--paper"),
    el("a", { className: "btn btn--sunset", href: REPO, target: "_blank", rel: "noopener", textContent: t.star }),
  ]],
};
const STAGE = { lang: 0, hello: 1, know: 1, what: 1, agent: 2, setup: 2, link: 2, topics: 3, topic: 3, done: 3 };

function render(focus = true) {
  const [line, big, extra, choices] = STEPS[state.step](state.arg);
  say(line, big);
  if (state.step === "topics" || state.step === "done") react("glad", 900);
  $("extra").replaceChildren(...extra);
  $("choices").replaceChildren(...choices);
  const at = STAGE[state.step], finished = state.step === "done";
  $("steps").replaceChildren(...t.steps.map((name, i) => {
    const li = el("li", { className: i < at || finished ? "done" : i === at ? "now" : "" }, String(i + 1));
    if (state.lang) li.append(el("span", { textContent: name }));
    if (i === at && !finished) li.setAttribute("aria-current", "step");
    return li;
  }));
  $("steps").setAttribute("aria-label", t.progress);
  $("back").hidden = !state.trail.length;
  $("restart").hidden = !state.trail.length;
  $("back").textContent = `← ${t.back}`;
  $("restart").textContent = t.restart;
  if (!still) {
    const bubble = $("bubble");
    bubble.classList.remove("pop"); void bubble.offsetWidth; bubble.classList.add("pop");
  }
  if (focus) $("choices").querySelector(".btn:last-child")?.focus({ preventScroll: true });
}

function go(step, arg = null) {
  state.trail.push([state.step, state.arg]);
  Object.assign(state, { step, arg });
  render();
  window.scrollTo({ top: 0 });
}
function setLang(lang) {
  state.lang = lang; t = T[lang];
  document.documentElement.lang = lang;
  go("hello");
}

$("back").onclick = () => {
  const [step, arg] = state.trail.pop();
  Object.assign(state, { step, arg });
  if (step === "lang") state.lang = null;
  render();
};
$("restart").onclick = () => {
  Object.assign(state, { step: "lang", arg: null, trail: [], lang: null });
  render();
};

const asked = new URLSearchParams(location.search).get("lang");
drawFace(); blink();
if (T[asked]) { state.lang = asked; t = T[asked]; document.documentElement.lang = asked; state.step = "hello"; }
render(false);
