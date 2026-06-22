import type { Context, Config } from "@netlify/functions";
import { gunzipSync } from "node:zlib";
import { XMLParser } from "fast-xml-parser";

const SOURCES: Record<string, { name: string; flag: string; urls: string[] }> = {
  FR: { name: "France", flag: "🇫🇷", urls: ["https://epgshare01.online/epgshare01/epg_ripper_FR1.xml.gz"] },
  UK: { name: "Royaume-Uni", flag: "🇬🇧", urls: ["https://epgshare01.online/epgshare01/epg_ripper_UK1.xml.gz"] },
  ES: { name: "Espagne", flag: "🇪🇸", urls: ["https://epgshare01.online/epgshare01/epg_ripper_ES1.xml.gz"] },
  IT: { name: "Italie", flag: "🇮🇹", urls: ["https://epgshare01.online/epgshare01/epg_ripper_IT1.xml.gz"] },
  DE: { name: "Allemagne", flag: "🇩🇪", urls: ["https://epgshare01.online/epgshare01/epg_ripper_DE1.xml.gz"] },
};

const TYPE_RULES: { type: string; kw: string[] }[] = [
  { type: "sport",        kw: ["sport", "football", "soccer", "rugby", "tennis", "basket", "cyclisme", "cycling", "golf", "boxe", "boxing", "formula", "f1", "motogp"] },
  { type: "film",         kw: ["film", "movie", "cinéma", "cinema", "long métrage", "feature film", "película", "kino"] },
  { type: "série",        kw: ["série", "series", "serie", "feuilleton", "soap", "drama series", "sitcom"] },
  { type: "info",         kw: ["news", "info", "journal", "actualité", "actualités", "noticias", "nachrichten"] },
  { type: "documentaire", kw: ["documentaire", "documentary", "docu", "reportage", "documental", "dokumentation"] },
  { type: "jeunesse",     kw: ["jeunesse", "enfant", "kids", "children", "cartoon", "dessin animé", "animation"] },
  { type: "divertissement", kw: ["divertissement", "entertainment", "variété", "variety", "talk", "show", "humour", "comedy"] },
  { type: "musique",      kw: ["musique", "music", "concert", "musik"] },
  { type: "culture",      kw: ["culture", "art", "théâtre", "theatre", "opéra", "opera"] },
  { type: "cuisine",      kw: ["cuisine", "cooking", "food", "gastronomie"] },
];

function classify(categories: string[]): string {
  const hay = categories.join(" ").toLowerCase();
  for (const rule of TYPE_RULES) {
    if (rule.kw.some((k) => hay.includes(k))) return rule.type;
  }
  return "autre";
}

function xmltvToISO(t: string | undefined): string | null {
  if (!t) return null;
  const m = t.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/);
  if (!m) return null;
  const [, Y, Mo, D, H, Mi, S = "00", tz = "+0000"] = m;
  const off = `${tz.slice(0, 3)}:${tz.slice(3)}`;
  const d = new Date(`${Y}-${Mo}-${D}T${H}:${Mi}:${S}${off}`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function asArray<T>(x: T | T[] | undefined): T[] {
  return x === undefined || x === null ? [] : Array.isArray(x) ? x : [x];
}

function textOf(node: any): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (typeof node === "object" && "#text" in node) return String(node["#text"]);
  return "";
}

function decode(s: string): string {
  if (!s) return s;
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

type Channel = { id: string; name: string; icon: string | null };
type Programme = {
  channel: string; channelName: string; title: string; desc: string;
  start: string | null; stop: string | null; type: string; categories: string[];
};

async function fetchAndParse(countryCode: string) {
  const src = SOURCES[countryCode];
  if (!src) throw new Error(`Pays non supporté: ${countryCode}`);

  let xml = "";
  let lastErr: unknown = null;
  for (const url of src.urls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; TVGuideEU/1.0)" },
      });
      if (!res.ok) { lastErr = new Error(`HTTP ${res.status}`); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      xml = url.endsWith(".gz") ? gunzipSync(buf).toString("utf-8") : buf.toString("utf-8");
      break;
    } catch (e) { lastErr = e; }
  }
  if (!xml) throw lastErr ?? new Error("Aucune source disponible");

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
    processEntities: false,
  });
  const doc = parser.parse(xml);
  const tv = doc.tv ?? {};

  const channels: Record<string, Channel> = {};
  for (const ch of asArray<any>(tv.channel)) {
    const id = ch["@_id"];
    if (!id) continue;
    const names = asArray<any>(ch["display-name"]).map(textOf).map(decode).filter(Boolean);
    const icon = ch.icon ? (asArray<any>(ch.icon)[0]?.["@_src"] ?? null) : null;
    channels[id] = { id, name: names[0] || id, icon };
  }

  const programmes: Programme[] = [];
  for (const p of asArray<any>(tv.programme)) {
    const channel = p["@_channel"];
    const cats = asArray<any>(p.category).map(textOf).map(decode).filter(Boolean);
    programmes.push({
      channel,
      channelName: channels[channel]?.name || channel,
      title: decode(textOf(asArray<any>(p.title)[0])) || "Sans titre",
      desc: decode(textOf(asArray<any>(p.desc)[0])) || "",
      start: xmltvToISO(p["@_start"]),
      stop: xmltvToISO(p["@_stop"]),
      type: classify(cats),
      categories: cats,
    });
  }

  return {
    country: countryCode, countryName: src.name, flag: src.flag,
    generatedAt: new Date().toISOString(),
    channels: Object.values(channels), programmes,
  };
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const country = (url.searchParams.get("country") || "FR").toUpperCase();

  if (!SOURCES[country]) {
    return Response.json(
      { error: `Pays non supporté. Disponibles: ${Object.keys(SOURCES).join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const data = await fetchAndParse(country);
    return Response.json(data, {
      headers: { "Cache-Control": "public, max-age=600, s-maxage=21600, stale-while-revalidate=86400" },
    });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Erreur EPG" }, { status: 502 });
  }
};

export const config: Config = {
  path: "/api/epg",
};
