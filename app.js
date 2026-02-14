// ================== CONFIG ==================
const CATEGORIES = [
  { name: "ڕۆمان", file: "roman.json" },
  { name: "چیرۆک", file: "cherok.json" },
  { name: "ئابووری", file: "aburi.json" },
  { name: "وەرزشی", file: "warzshi.json" },
  { name: "فەلسەفی", file: "falsafi.json" },
  { name: "ئەدەبی", file: "adabi.json" },
  { name: "مێژوویی", file: "mezhuy.json" },
  { name: "ئایینی", file: "ayne.json" },
  { name: "هونەری", file: "hunari.json" },
  { name: "ئەفسانە", file: "afsana.json" },
  { name: "تەکنەلۆژیا", file: "taknologya.json" },
  { name: "گەشەپێدان", file: "gashapedan.json" },
  { name: "کۆمەڵایەتی", file: "komalayati.json" },
  { name: "منداڵان", file: "mndalan.json" },
  { name: "هەمەڕەنگ", file: "hamarang.json" },
  { name: "زمانەکان", file: "zmanakan.json" },
  { name: "زانستی", file: "zansti.json" },
  { name: "سیاسی", file: "syasi.json" },
  { name: "بادینی", file: "badini.json" },
  { name: "دەروونزانی", file: "darwnzani.json" },
  { name: "جوگرافیا", file: "jugrafya.json" },
    { name: "پزیشکی", file: "pezeshki.json" },

];

const BASE = "https://raw.githubusercontent.com/sahanddler/json/main/";

// ================== HELPERS ==================
function qs(key) {
  return new URLSearchParams(location.search).get(key);
}

function pick(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
}

function normalizeArray(data) {
  if (Array.isArray(data)) return data;
  const candidates = ["books", "data", "items", "results", "list", "roman"];
  for (const k of candidates) {
    if (data && Array.isArray(data[k])) return data[k];
  }
  if (data && typeof data === "object") {
    const vals = Object.values(data);
    if (vals.length && vals.every(v => typeof v === "object")) return vals;
  }
  return [];
}

function ensureHttp(url) {
  if (!url) return "";
  let u = String(url).trim();

  if (/^www\./i.test(u)) u = "https://" + u;
  if (/^https?:\/\//i.test(u)) return u;
  if (/^raw\.githubusercontent\.com/i.test(u)) return "https://" + u;
  if (/^drive\.google\.com/i.test(u)) return "https://" + u;

  return u;
}

// ================== GOOGLE DRIVE ==================
function getDriveId(url) {
  if (!url) return "";
  const u = String(url);
  let m = u.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = u.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = u.match(/uc\?id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return "";
}

function driveLinks(url) {
  const id = getDriveId(url);
  if (!id) return { view: ensureHttp(url), download: ensureHttp(url) };
  return {
    view: `https://drive.google.com/file/d/${id}/view`,
    download: `https://drive.google.com/uc?export=download&id=${id}`
  };
}

// ================== BOOK MAPPING ==================
function resolveLinks(book) {
  const onlineRaw = pick(book, [
    "online","read","view","viewer",
    "url_view","link_view","drive_view",
    "open","link" // 🔥 THIS FIX
  ]);

  const downloadRaw = pick(book, [
    "download","dl","pdf","file","url",
    "link","bookUrl","book_url","drive","drive_link"
  ]);

  let online = ensureHttp(onlineRaw);
  let download = ensureHttp(downloadRaw);

  const driveCandidate = online || download;
  if (driveCandidate && driveCandidate.includes("drive.google.com")) {
    const d = driveLinks(driveCandidate);
    if (!online) online = d.view;
    if (!download) download = d.download;
  }

  return { online, download };
}


function mapBook(book) {
  const title = pick(book, ["title", "name", "book_name", "bookTitle", "t"]) || "Untitled";
  const author = pick(book, ["author", "writer", "by", "book_author", "a"]) || "Unknown";
  const image = ensureHttp(pick(book, ["image", "img", "cover", "poster", "thumbnail", "photo"]));
  const description = pick(book, ["description", "desc", "info", "about", "summary", "bio"]) || "";

  const { online, download } = resolveLinks(book);

  return {
    raw: book,
    title,
    author,
    image,
    description,
    online,
    download
  };
}

// ================== FETCH (FAST + CACHED) ==================
async function fetchBooks(file, force = false){
  const cacheKey = "books_cache_" + file;
  const timeKey  = "books_time_" + file;
  const TTL = 5 * 60 * 1000; // 5 minutes

  const now = Date.now();
  const cached = localStorage.getItem(cacheKey);
  const savedTime = Number(localStorage.getItem(timeKey));

  // ✅ Use cache if valid and not forced
  if (!force && cached && savedTime && (now - savedTime) < TTL) {
    return JSON.parse(cached);
  }

  // 🔄 Fetch fresh data
  const url = BASE + file + "?r=" + now; // break GitHub cache safely
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) throw new Error("HTTP " + res.status);

  const data = await res.json();
  const books = normalizeArray(data).map(mapBook);

  // 💾 Save cache
  localStorage.setItem(cacheKey, JSON.stringify(books));
  localStorage.setItem(timeKey, now);

  return books;
}
