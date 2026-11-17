// Bevy hosts the chapter sites of vendor communities, all with one API: Google
// Developer Groups (DevFests included), CNCF, Atlassian, Salesforce, MuleSoft
// and others. Each lists its published upcoming events worldwide; the ones of
// a chapter in Spain are kept. Signing up needs an account on that site.
const HOSTS = {
  "gdg.community.dev": "Google Developer Groups", "community.cncf.io": "CNCF", "ace.atlassian.com": "Atlassian Community",
  "trailblazercommunitygroups.com": "Salesforce Trailblazer Community", "meetups.mulesoft.com": "MuleSoft Meetups",
  "community.uipath.com": "UiPath Community", "usergroups.snowflake.com": "Snowflake User Groups",
  "usergroups.tableau.com": "Tableau User Groups",
};
const FIELDS = "id,title,chapter,start_date,end_date,url,description_short,event_type_title,audience_type";
const MAX_PAGES = 8;

export function parse(payload, host) {
  return (payload.results ?? []).filter((e) => e.chapter?.country === "ES" && e.url && e.start_date).map((e) => ({
    source: "bevy", source_id: `${host}:${e.id}`, title: e.title, url: e.url, start: e.start_date, end: e.end_date ?? null,
    city: e.chapter.city ?? null, region_hint: e.chapter.state ?? null, venue: null, online: e.audience_type === "VIRTUAL",
    organizer: e.chapter.title ?? HOSTS[host], description: e.description_short ?? null, keywords: HOSTS[host],
    free: /free|gratis/i.test(e.event_type_title ?? "") ? true : /paid/i.test(e.event_type_title ?? "") ? false : null,
    registration: null, account: true, fallback_type: "meetup", trusted: true,
  }));
}

export async function crawl(http) {
  const out = [];
  let failed = 0;
  for (const host of Object.keys(HOSTS)) {
    try {
      let url = `https://${host}/api/event/?status=Live&page_size=500&fields=${FIELDS}`;
      for (let page = 0; url && page < MAX_PAGES; page++) {
        const payload = await http.json(url);
        out.push(...parse(payload, host));
        url = payload.links?.next ?? null;
      }
    } catch { failed += 1; } // one vendor's site down does not lose the others
  }
  if (failed === Object.keys(HOSTS).length) throw new Error("bevy: no host answered");
  return out;
}
