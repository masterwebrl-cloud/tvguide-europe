import type { Context, Config } from "@netlify/functions";
import { gunzipSync } from "node:zlib";
import { XMLParser } from "fast-xml-parser";

const SOURCES: Record<string, { name: string; flag: string; urls: string[] }> = {
  FR: { name: "France", flag: "🇫🇷", urls: ["https://iptv-epg.org/files/epg-fr.xml.gz"] },
  GB: { name: "Royaume-Uni", flag: "🇬🇧", urls: ["https://iptv-epg.org/files/epg-gb.xml.gz"] },
  ES: { name: "Espagne", flag: "🇪🇸", urls: ["https://iptv-epg.org/files/epg-es.xml.gz"] },
  IT: { name: "Italie", flag: "🇮🇹", urls: ["https://iptv-epg.org/files/epg-it.xml.gz"] },
  DE: { name: "Allemagne", flag: "🇩🇪", urls: ["https://iptv-epg.org/files/epg-de.xml.gz"] },
  BE: { name: "Belgique", flag: "🇧🇪", urls: ["https://iptv-epg.org/files/epg-be.xml.gz"] },
  CH: { name: "Suisse", flag: "🇨🇭", urls: ["https://iptv-epg.org/files/epg-ch.xml.gz"] },
  PL: { name: "Pologne", flag: "🇵🇱", urls: ["https://iptv-epg.org/files/epg-pl.xml.gz"] },
  NL: { name: "Pays-Bas", flag: "🇳🇱", urls: ["https://iptv-epg.org/files/epg-nl.xml.gz"] },
};

const CLASSIFICATION = {
  sport: {
    label: "Sport",
    subtypes: {
      football: { label: "Football", kw: ["football", "soccer", "fútbol", "calcio", "futebol", "voetbal", "piłka nożna", "pied"] },
      rugby: { label: "Rugby", kw: ["rugby"] },
      tennis: { label: "Tennis", kw: ["tennis"] },
      basket: { label: "Basket", kw: ["basket", "basketball", "baloncesto", "pallacanestro", "basketbal"] },
      cyclisme: { label: "Cyclisme", kw: ["cycling", "cyclisme", "ciclismo", "radsport", "wielokolarstwo", "tour", "vuelta", "giro"] },
      golf: { label: "Golf", kw: ["golf"] },
      boxe: { label: "Boxe", kw: ["boxing", "boxe", "boxeo", "pugilato", "boksen", "boks"] },
      f1: { label: "F1", kw: ["formula", "formule 1", "fórmula 1", "formula 1", "grand prix"] },
      motogp: { label: "MotoGP", kw: ["motogp", "moto gp", "motorcycle"] },
      athlétisme: { label: "Athlétisme", kw: ["athletics", "track and field", "atletismo", "atletica", "leichtathletik", "lekkoatletyka"] },
    },
  },
  film: {
    label: "Films",
    subtypes: {
      action: { label: "Action", kw: ["action", "actionfilm", "película de acción", "film d'azione", "actionfilm", "film akcji", "aventure", "adventure", "aventura", "avventura", "western", "oeste"] },
      comédie: { label: "Comédie", kw: ["comedy", "comédie", "comedia", "commedia", "komödie", "komedia", "humour", "humor", "humorismo", "sketch"] },
      drame: { label: "Drame", kw: ["drama", "drame", "drama", "dramma", "drama", "dramat", "romance", "amour", "romantic", "romance", "amor", "amore"] },
      thriller: { label: "Thriller", kw: ["thriller", "suspense", "thriller", "thriller", "thriller", "thriller", "mystery", "mystère", "misterio", "mistero", "mystery"] },
      horreur: { label: "Horreur", kw: ["horror", "horreur", "horror", "orrore", "horror", "horror", "dark", "scary", "macabre"] },
      scifi: { label: "Sci-Fi & Fantastique", kw: ["sci-fi", "science-fiction", "science fiction", "ciencia ficción", "fantascienza", "science-fiction", "science fiction", "fantasy", "fantastique", "fantastical", "fantasia", "surnaturel", "supernatural", "paranormal"] },
      historique: { label: "Historique", kw: ["historical", "history", "historique", "histórico", "storico", "historisch", "historyczny", "période", "period", "época", "guerra", "war", "bataille", "battle", "battaglia"] },
      animation: { label: "Animation", kw: ["animation", "animated", "animé", "animation", "animación", "animazione", "animation", "animacja", "cartoon", "dessin animé", "anime"] },
      famille: { label: "Famille", kw: ["family", "family film", "película familiar", "film per famiglie", "familienfilm", "film familijny", "kids", "children", "jeunesse", "enfant", "niños", "bambini", "kinder"] },
      documentaire: { label: "Documentaire", kw: ["documentary", "documentaire", "documental", "documentario", "dokumentation", "dokument", "docu", "reportage", "reportaje", "reportage"] },
      érotique: { label: "Érotique", kw: ["erotic", "érotique", "erótico", "erotico", "erotisch", "erotyka", "sensuel", "sensual", "sensuale", "sensual", "pornographique", "pornographic", "porn", "adult", "xxx"] },
    },
  },
  série: {
    label: "Séries",
    subtypes: {
      action: { label: "Action", kw: ["action", "actionfilm", "película de acción", "film d'azione", "actionfilm", "film akcji", "aventure", "adventure", "aventura", "avventura"] },
      comédie: { label: "Comédie", kw: ["comedy", "comédie", "comedia", "commedia", "komödie", "komedia", "sitcom", "humour", "humor", "sketch"] },
      drame: { label: "Drame", kw: ["drama", "drame", "drama", "dramma", "drama", "dramat", "romance", "amour", "romantic", "romance", "amor", "amore", "médical", "medical", "medical", "doctor", "hospital"] },
      thriller: { label: "Thriller", kw: ["thriller", "suspense", "thriller", "thriller", "thriller", "thriller", "mystery", "mystère", "misterio", "mistero", "crime", "crimen", "crimine", "kriminal"] },
      scifi: { label: "Sci-Fi & Fantastique", kw: ["sci-fi", "science-fiction", "science fiction", "ciencia ficción", "fantascienza", "science-fiction", "fantasy", "fantastique", "fantastical", "fantasia", "surnaturel", "supernatural", "paranormal", "paranormale"] },
      horreur: { label: "Horreur", kw: ["horror", "horreur", "horror", "orrore", "horror", "horror", "dark", "scary", "macabre", "terreur"] },
      animation: { label: "Animation", kw: ["animation", "animated", "animé", "animation", "animación", "animazione", "animation", "animacja", "cartoon", "anime"] },
      famille: { label: "Famille", kw: ["family", "family film", "película familiar", "film per famiglie", "familienfilm", "film familijny", "kids", "children", "jeunesse", "enfant"] },
      historique: { label: "Historique", kw: ["historical", "history", "historique", "histórico", "storico", "historisch", "historyczny", "période", "period", "época"] },
      érotique: { label: "Érotique", kw: ["erotic", "érotique", "erótico", "erotico", "erotisch", "erotyka", "sensuel", "sensual", "pornographique", "pornographic", "adult", "xxx"] },
    },
  },
  info: {
    label: "Info",
    subtypes: {
      journal: { label: "Journal", kw: ["journal", "news", "journal télévisé", "noticiario", "giornale televisivo", "nachichten", "wiadomości", "actualité", "actualités", "noticias", "notizie"] },
      magazine: { label: "Magazine", kw: ["magazine", "magazine", "magazine", "magazine", "magazin", "magazyn", "reportage", "reportaje", "reportage", "investigation"] },
    },
  },
  documentaire: {
    label: "Documentaire",
    subtypes: {
      nature: { label: "Nature", kw: ["nature", "wildlife", "nature", "natura", "natur", "przyroda", "animaux", "animals", "animales", "animali", "tiere"] },
      histoire: { label: "Histoire", kw: ["history", "histoire", "historia", "storia", "geschichte", "historia"] },
      science: { label: "Science", kw: ["science", "science", "ciencia", "scienza", "wissenschaft", "nauka", "technologie", "technology", "tecnología", "tecnologia"] },
    },
  },
  jeunesse: {
    label: "Jeunesse",
    subtypes: {
      animation: { label: "Dessin animé", kw: ["dessin animé", "animation", "cartoon", "anime", "animación", "animazione", "animation", "animacja", "kids", "children", "enfants"] },
    },
  },
  divertissement: {
    label: "Divertissement",
    subtypes: {
      varieté: { label: "Variété", kw: ["variety", "variété", "variedad", "varietà", "varietät", "różnorodność", "show", "spectacle"] },
      gameshow: { label: "Jeu", kw: ["game show", "game", "jeu", "juego", "gioco", "spiel", "gra", "télé-réalité", "reality", "realidad", "reality", "realtà", "wirklichkeit", "rzeczywistość"] },
      humour: { label: "Humour", kw: ["humor", "humour", "humor", "umorismo", "humor", "humor", "comedy", "comédie", "sketch"] },
    },
  },
  musique: {
    label: "Musique",
    subtypes: {
      concert: { label: "Concert", kw: ["concert", "live", "concierto", "concerto", "konzert", "koncert", "música", "music"] },
    },
  },
};

function classify(categories: string[]): { type: string; subtype: string } {
  const hay = categories.join(" ").toLowerCase();

  for (const [typeKey, typeObj] of Object.entries(CLASSIFICATION)) {
    let found = false;
    if (typeKey === "film" && (hay.includes("film") || hay.includes("movie") || hay.includes("película") || hay.includes("pellicola") || hay.includes("kino"))) found = true;
    else if (typeKey === "sport" && hay.includes("sport")) found = true;
    else if (typeKey === "série" && (hay.includes("série") || hay.includes("series") || hay.includes("serie") || hay.includes("feuilleton") || hay.includes("telenovela"))) found = true;
    else if (typeKey === "info" && (hay.includes("news") || hay.includes("journal") || hay.includes("info") || hay.includes("noticias") || hay.includes("notizie"))) found = true;
    else if (typeKey === "documentaire" && (hay.includes("documentaire") || hay.includes("documentary") || hay.includes("documental") || hay.includes("dokumentation"))) found = true;
    else if (typeKey === "jeunesse" && (hay.includes("enfant") || hay.includes("kids") || hay.includes("jeunesse") || hay.includes("niños") || hay.includes("bambini") || hay.includes("kinder"))) found = true;
    else if (typeKey === "divertissement" && (hay.includes("divertissement") || hay.includes("entertainment") || hay.includes("unterhaltung"))) found = true;
    else if (typeKey === "musique" && (hay.includes("musique") || hay.includes("music") || hay.includes("música"))) found = true;

    if (found) {
      for (const [subtypeKey, subtypeObj] of Object.entries(typeObj.subtypes)) {
        if (subtypeObj.kw.some((k) => hay.includes(k))) {
          return { type: typeKey, subtype: subtypeKey };
        }
      }
      return { type: typeKey, subtype: "autre" };
    }
  }
  return { type: "autre", subtype: "autre" };
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
  start: string | null; stop: string | null; type: string; subtype: string; categories: string[];
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
    const classification = classify(cats);
    programmes.push({
      channel,
      channelName: channels[channel]?.name || channel,
      title: decode(textOf(asArray<any>(p.title)[0])) || "Sans titre",
      desc: decode(textOf(asArray<any>(p.desc)[0])) || "",
      start: xmltvToISO(p["@_start"]),
      stop: xmltvToISO(p["@_stop"]),
      type: classification.type,
      subtype: classification.subtype,
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
