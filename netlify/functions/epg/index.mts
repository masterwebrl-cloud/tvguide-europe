import type { Config } from "@netlify/functions";
import { gunzipSync } from "node:zlib";
import { XMLParser } from "fast-xml-parser";

const COUNTRIES = [
  "al", "ad", "at", "az", "by", "be", "ba", "bg", "hr", "cy", "cz", "dk", "ee", "fi", "fr", "de", "gr", "hu", "is", "ie", 
  "it", "xk", "lv", "li", "lt", "lu", "mt", "md", "mc", "me", "nl", "no", "pl", "pt", "ro", "ru", "sm", "rs", "sk", "si", "es", 
  "se", "ch", "tr", "ua", "gb", "kz", "uz", "tm", "tj", "kg", "ge", "am", "af", "bd", "bt", "in", "lk", "mv", "np", "pk", 
  "br", "cl", "co", "ec", "gy", "py", "pe", "sr", "uy", "ve", "mx", "bz", "cr", "sv", "gt", "hn", "ni", "pa", "jm", "tt", 
  "bs", "dm", "pr", "ag", "bb", "gd", "mu", "sc", "au", "fj", "nz", "pf", "sb", "vu"
];

const COUNTRY_NAMES: Record<string, string> = {
  fr: "France", gb: "Royaume-Uni", es: "Espagne", it: "Italie", de: "Allemagne", be: "Belgique", ch: "Suisse", pl: "Pologne", nl: "Pays-Bas",
  at: "Autriche", cz: "Tchéquie", dk: "Danemark", fi: "Finlande", gr: "Grèce", hu: "Hongrie", is: "Islande", ie: "Irlande", pt: "Portugal",
  ro: "Roumanie", se: "Suède", no: "Norvège", tr: "Turquie", ua: "Ukraine", ru: "Russie", by: "Biélorussie", kz: "Kazakhstan", br: "Brésil",
  mx: "Mexique", ar: "Argentine", cl: "Chili", co: "Colombie", pe: "Pérou", ve: "Venezuela", in: "Inde", pk: "Pakistan", au: "Australie",
  nz: "Nouvelle-Zélande", jp: "Japon", kr: "Corée du Sud", cn: "Chine", th: "Thaïlande", my: "Malaisie", sg: "Singapour", id: "Indonésie",
  ph: "Philippines", vn: "Vietnam", eg: "Égypte", sa: "Arabie Saoudite", ae: "Émirats Arabes", il: "Israël", ng: "Nigéria", za: "Afrique du Sud",
  ke: "Kenya", us: "États-Unis", ca: "Canada", al: "Albanie", ad: "Andorre", ba: "Bosnie", bg: "Bulgarie", hr: "Croatie", cy: "Chypre",
  ee: "Estonie", lv: "Lettonie", li: "Liechtenstein", lt: "Lituanie", lu: "Luxembourg", mt: "Malte", md: "Moldavie", mc: "Monaco",
  me: "Monténégro", sk: "Slovaquie", si: "Slovénie", sm: "Saint-Marin", rs: "Serbie", xk: "Kosovo", az: "Azerbaïdjan", am: "Arménie",
  ge: "Géorgie", uz: "Ouzbékistan", tm: "Turkménistan", tj: "Tadjikistan", kg: "Kirghizistan", af: "Afghanistan", bd: "Bangladesh",
  bt: "Bhoutan", lk: "Sri Lanka", mv: "Maldives", np: "Népal", ec: "Équateur", gy: "Guyana", py: "Paraguay", sr: "Suriname", uy: "Uruguay",
  bz: "Belize", cr: "Costa Rica", sv: "El Salvador", gt: "Guatemala", hn: "Honduras", ni: "Nicaragua", pa: "Panama", jm: "Jamaïque",
  tt: "Trinité-et-Tobago", bs: "Bahamas", dm: "Dominique", pr: "Porto Rico", ag: "Antigua-et-Barbuda", bb: "Barbade", gd: "Grenade",
  mu: "Maurice", sc: "Seychelles", fj: "Fidji", pf: "Polynésie française", sb: "Îles Salomon", vu: "Vanuatu"
};

const COUNTRY_FLAGS: Record<string, string> = {
  fr: "🇫🇷", gb: "🇬🇧", es: "🇪🇸", it: "🇮🇹", de: "🇩🇪", be: "🇧🇪", ch: "🇨🇭", pl: "🇵🇱", nl: "🇳🇱",
  at: "🇦🇹", cz: "🇨🇿", dk: "🇩🇰", fi: "🇫🇮", se: "🇸🇪", no: "🇳🇴", pt: "🇵🇹", gr: "🇬🇷", hu: "🇭🇺",
  ro: "🇷🇴", bg: "🇧🇬", sk: "🇸🇰", si: "🇸🇮", hr: "🇭🇷", ba: "🇧🇦", rs: "🇷🇸", me: "🇲🇪", ua: "🇺🇦",
  ru: "🇷🇺", tr: "🇹🇷", by: "🇧🇾", kz: "🇰🇿", br: "🇧🇷", mx: "🇲🇽", ar: "🇦🇷", cl: "🇨🇱", co: "🇨🇴",
  pe: "🇵🇪", ve: "🇻🇪", in: "🇮🇳", pk: "🇵🇰", au: "🇦🇺", nz: "🇳🇿", jp: "🇯🇵", kr: "🇰🇷", cn: "🇨🇳",
  th: "🇹🇭", my: "🇲🇾", sg: "🇸🇬", id: "🇮🇩", ph: "🇵🇭", vn: "🇻🇳", eg: "🇪🇬", sa: "🇸🇦", ae: "🇦🇪",
  il: "🇮🇱", ng: "🇳🇬", za: "🇿🇦", ke: "🇰🇪", us: "🇺🇸", ca: "🇨🇦"
};

function classifyChannel(channelName: string): { type: string; icon: string } {
  const name = channelName.toLowerCase().trim();
  if (/\b(sport|sports|sportv|espn|bein|eurosport|sky sport|fox sport|nbc sport|rai sport|equipe|deporte|deportes|football|futbol|fußball|calcio|tennis|nfl|nba|f1|formula|motogp|premier league|champions league|ligue 1|serie a|bundesliga|laliga)\b/i.test(name)) return { type: "sport", icon: "⚽" };
  if (/\b(cinema|cinéma|cine|movies?|filme?|kino|sky cinema|canal\+? cinema|action|aventure|thriller|cinemax|moviestar|hollywood|fox movies|paramount|warner)\b/i.test(name)) return { type: "cinema", icon: "🎬" };
  if (/\b(news|info|infos|actu|cnn|bbc news|bfm|france info|euronews|sky news|fox news|al jazeera|wiadomości|tg|noticias|nachrichten|24h|breaking|journal)\b/i.test(name)) return { type: "info", icon: "📰" };
  if (/\b(adult|adulte|adults|adultos|erotic|érotique|erotik|erotico|porn|porno|playboy|hustler|xxx|brazzers|spice|private|venus)\b/i.test(name)) return { type: "adulte", icon: "🔞" };
  if (/\b(disney|nick|nickelodeon|cartoon|kids|enfants|gulli|tiji|piwi|baby|junior|disney channel|teletoon|nick jr|baby tv|pokemon|dzieci|infantil|niños)\b/i.test(name)) return { type: "jeunesse", icon: "🧒" };
  if (/\b(mtv|mcm|music|musique|musical|nrj|virgin|trace|vh1|melody|stingray|musica|musik)\b/i.test(name)) return { type: "musique", icon: "🎵" };
  if (/\b(discovery|national geographic|nat geo|natgeo|histoire|history|geo|geographic|earth|planet|wildlife|nature|animal|animaux|science|documentaire|documentary|dokument)\b/i.test(name)) return { type: "documentaire", icon: "🌍" };
  if (/\b(tv5|euronews|france 24|deutsche welle|dw|al jazeera|cnn international|bbc world|rt|rfi|nhk world|cgtn|press tv)\b/i.test(name)) return { type: "international", icon: "🌐" };
  if (/\b(comedy|comédie|humour|humor|entertainment|divertissement|reality|nrj12|tf1 séries|w9|c8|6ter|tmc|tf x|paris première|fashion tv|fashion)\b/i.test(name)) return { type: "divertissement", icon: "🎭" };
  return { type: "generaliste", icon: "📺" };
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
  if (typeof node === "object" && "#text" in node) return String(node["#text"]);
  return "";
}

function decode(s: string): string {
  if (!s) return s;
  return s.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

const EROTIC_CATEGORIES = ["erotic", "erotica", "porn", "adult", "xxx", "érotique", "pornographique", "porno", "adulte", "erótico", "erotismo", "adultos", "erotico", "erotici", "erotismo", "adulti", "erotisch", "erotik", "erotikfilm", "erotiek", "volwassenen", "erotyka", "erotyczny", "эротика", "erotický", "erotikus", "erotic", "еротичен", "erotski", "erotik", "erotisk", "erotikk", "erootika", "erotika", "ερωτικό", "erotik", "إثارة", "إباحي", "ארוטי", "成人", "色情", "アダルト", "성인", "อีโรติก", "dewasa", "khiêu dâm", "वयस्क", "প্রাপ্তবয়স্ক"];

const WORLDCUP_TITLES = ["world cup", "fifa world cup", "wc 2026", "coupe du monde", "mondial", "cdm 2026", "copa mundial", "mundial", "coppa del mondo", "mondiali", "weltmeisterschaft", "wm 2026", "fußball-wm", "wereldkampioenschap", "wk 2026", "mistrzostwa świata", "mś 2026", "copa do mundo", "чемпионат мира", "чм 2026", "чемпіонат світу", "mistrovství světa", "ms 2026", "világbajnokság", "vb 2026", "campionatul mondial", "световно първенство", "svjetsko prvenstvo", "svetsko prvenstvo", "svetovno prvenstvo", "vm 2026", "mm 2026", "παγκόσμιο κύπελλο", "dünya kupası", "كأس العالم", "גביע העולם", "世界杯", "ワールドカップ", "월드컵", "ฟุตบอลโลก", "piala dunia", "विश्व कप", "বিশ্বকাপ"];

const EXCLUSIONS = ["dessin animé", "cartoon", "animated", "anime", "kids", "children", "kinder", "dibujos animados", "cartone animato", "kreskówka"];

function isEroticProgram(title: string, cats: string[]): boolean {
  const titleLower = title.toLowerCase();
  if (EXCLUSIONS.some(kw => titleLower.includes(kw))) return false;
  const catsLower = cats.map(c => c.toLowerCase()).join(" ");
  return EROTIC_CATEGORIES.some(kw => catsLower.includes(kw));
}

function isWorldCupMatch(title: string, desc: string, cats: string[]): boolean {
  const titleLower = title.toLowerCase();
  const descLower = desc.toLowerCase();
  const catsLower = cats.map(c => c.toLowerCase()).join(" ");
  const isSport = catsLower.includes("sport") || catsLower.includes("fußball") || catsLower.includes("football") || catsLower.includes("soccer") || catsLower.includes("fútbol") || catsLower.includes("calcio");
  if (!isSport) return false;
  if (EXCLUSIONS.some(kw => titleLower.includes(kw))) return false;
  const text = `${titleLower} ${descLower}`;
  return WORLDCUP_TITLES.some(kw => text.includes(kw));
}

// ─── TIMEOUT par pays (5 secondes max) ───
async function fetchEPG(countryCode: string, timeoutMs = 5000) {
  try {
    const url = `https://iptv-epg.org/files/epg-${countryCode}.xml.gz`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: controller.signal
    });
    clearTimeout(timeout);
    
    if (!res.ok) return { erotica: [], worldcup: [], error: `HTTP ${res.status}` };
    
    const buf = Buffer.from(await res.arrayBuffer());
    const xml = gunzipSync(buf).toString("utf-8");
    
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", trimValues: true, processEntities: false });
    const doc = parser.parse(xml);
    const tv = doc.tv ?? {};
    
    const now = Date.now();
    const channels: Record<string, string> = {};
    
    for (const ch of asArray<any>(tv.channel)) {
      const id = ch["@_id"];
      if (!id) continue;
      const names = asArray<any>(ch["display-name"]).map(textOf).map(decode).filter(Boolean);
      channels[id] = names[0] || id;
    }
    
    const erotica: any[] = [];
    const worldcup: any[] = [];
    
    for (const p of asArray<any>(tv.programme)) {
      const start = p["@_start"];
      const stop = p["@_stop"];
      if (!start || !stop) continue;
      
      const startTime = xmltvToISO(start);
      const stopTime = xmltvToISO(stop);
      if (!startTime || !stopTime) continue;
      
      const startMs = new Date(startTime).getTime();
      const stopMs = new Date(stopTime).getTime();
      if (!(startMs <= now && now < stopMs)) continue;
      
      const channelId = p["@_channel"];
      const channelName = channels[channelId] || channelId;
      const channelClass = classifyChannel(channelName);
      
      const title = decode(textOf(asArray<any>(p.title)[0])) || "Sans titre";
      const desc = decode(textOf(asArray<any>(p.desc)[0])) || "";
      const cats = asArray<any>(p.category).map(textOf).map(decode).filter(Boolean);
      
      const prog = { 
        channel: channelName, 
        channelType: channelClass.type,
        channelIcon: channelClass.icon,
        title, desc, start: startTime, stop: stopTime 
      };
      
      if (isEroticProgram(title, cats)) erotica.push(prog);
      if (isWorldCupMatch(title, desc, cats)) worldcup.push(prog);
    }
    
    return { erotica, worldcup };
  } catch (e: any) {
    return { erotica: [], worldcup: [], error: e?.message || "Erreur" };
  }
}

// ─── CHARGEMENT PAR BATCH ───
async function fetchInBatches(codes: string[], batchSize = 5) {
  const allErotica: any[] = [];
  const allWorldcup: any[] = [];
  const errors: string[] = [];
  
  for (let i = 0; i < codes.length; i += batchSize) {
    const batch = codes.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(cc => fetchEPG(cc)));
    
    batch.forEach((cc, idx) => {
      const result = results[idx];
      if (result.error) errors.push(`${cc}: ${result.error}`);
      
      result.erotica.forEach((p: any) => {
        allErotica.push({ ...p, country: cc, countryName: COUNTRY_NAMES[cc] || cc.toUpperCase(), flag: COUNTRY_FLAGS[cc] || "🌍" });
      });
      result.worldcup.forEach((p: any) => {
        allWorldcup.push({ ...p, country: cc, countryName: COUNTRY_NAMES[cc] || cc.toUpperCase(), flag: COUNTRY_FLAGS[cc] || "🌍" });
      });
    });
  }
  
  return { erotica: allErotica, worldcup: allWorldcup, errors };
}

export default async (req: Request) => {
  try {
    const url = new URL(req.url);
    const countriesParam = url.searchParams.get("countries") || "";
    
    if (!countriesParam) {
      return Response.json({
        countries: COUNTRIES.map(cc => ({
          code: cc,
          name: COUNTRY_NAMES[cc] || cc.toUpperCase(),
          flag: COUNTRY_FLAGS[cc] || "🌍"
        }))
      }, { headers: { "Cache-Control": "public, max-age=3600" } });
    }
    
    const selectedCountries = countriesParam.split(",").filter(c => COUNTRIES.includes(c));
    if (selectedCountries.length === 0) {
      return Response.json({ error: "Aucun pays valide", erotica: [], worldcup: [] }, { status: 200 });
    }
    
    // ⚡ Chargement par batch de 5 pays
    const { erotica, worldcup, errors } = await fetchInBatches(selectedCountries, 5);
    
    return Response.json({
      generatedAt: new Date().toISOString(),
      countriesProcessed: selectedCountries.length,
      errors: errors.length,
      erotica: erotica.sort((a, b) => a.start.localeCompare(b.start)),
      worldcup: worldcup.sort((a, b) => a.start.localeCompare(b.start))
    }, { 
      headers: { "Cache-Control": "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400" } 
    });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Erreur serveur", erotica: [], worldcup: [] }, { status: 200 });
  }
};

export const config: Config = { path: "/api/monde-live" };
