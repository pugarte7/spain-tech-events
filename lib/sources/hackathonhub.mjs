// Hackathon Hub publishes its upcoming events for machines at /llms-full.txt:
// one "## Title" block each, with "- **Field:** value" lines.
export function parse(text) {
  return text.split(/\n## /).slice(1).flatMap((block) => {
    const field = (name) => block.match(new RegExp(`^- \\*\\*${name}:\\*\\* (.*)$`, "m"))?.[1]?.trim() ?? null;
    const location = field("Location"), url = field("URL"), [start, end] = (field("Date") ?? "").split(" — ");
    if (!url || !start || !/, ES$/.test(location ?? "")) return [];
    const description = block.split(/\n\n/).slice(1).join(" ").trim();
    return [{
      source: "hackathonhub", source_id: url, title: block.split("\n")[0].trim(), url, start, end: end ?? null,
      city: location.split(",")[0].trim(), venue: null, online: field("Format") === "online",
      organizer: null, description: [field("Tags"), description].filter(Boolean).join(". "),
      free: null, registration: null, fallback_type: "hackathon", trusted: true,
    }];
  });
}
export const crawl = async (http) => parse(await http.text("https://hackathonhub.eu/llms-full.txt"));
