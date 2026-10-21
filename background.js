// Tenor'un web sitesinin kendi kullandığı herkese açık istemci ayarını (tenor.com
// sayfasındaki <script id="data">) çalışma anında okur; kullanıcıdan anahtar istemez.

const API = "https://tenor.googleapis.com/v2";
const CONFIG_PAGES = ["https://tenor.com/gifapi", "https://tenor.com/"];
const CONFIG_TTL = 12 * 60 * 60 * 1000;

let configPromise = null;

async function readConfig(force) {
  if (!force) {
    const { tenorCfg } = await chrome.storage.local.get("tenorCfg");
    if (tenorCfg && Date.now() - tenorCfg.at < CONFIG_TTL) return tenorCfg;
  }
  for (const page of CONFIG_PAGES) {
    try {
      const html = await (await fetch(page, { credentials: "omit" })).text();
      const m = html.match(/<script id="data"[^>]*>([^<]+)<\/script>/);
      if (!m) continue;
      const data = JSON.parse(atob(m[1].trim()));
      if (!data.API_V2_KEY) continue;
      const cfg = { key: data.API_V2_KEY, client: data.API_V2_CLIENT_KEY || "tenor_web", at: Date.now() };
      await chrome.storage.local.set({ tenorCfg: cfg });
      return cfg;
    } catch {}
  }
  throw new Error("config");
}

function getConfig(force) {
  if (force || !configPromise) {
    configPromise = readConfig(force).catch((e) => {
      configPromise = null;
      throw e;
    });
  }
  return configPromise;
}

async function search(q, pos, retried) {
  const cfg = await getConfig(retried);
  const p = new URLSearchParams({
    key: cfg.key,
    client_key: cfg.client,
    limit: "30",
    contentfilter: "medium",
    media_filter: "nanogif,nanowebp,tinygif",
  });
  if (q) p.set("q", q);
  if (pos) p.set("pos", pos);
  const r = await fetch(`${API}/${q ? "search" : "featured"}?${p}`, { credentials: "omit" });
  if (!r.ok) {
    if (!retried && (r.status === 400 || r.status === 401 || r.status === 403)) return search(q, pos, true);
    throw new Error("http " + r.status);
  }
  const j = await r.json();
  return {
    next: j.next || "",
    items: (j.results || [])
      .map((g) => {
        const f = g.media_formats || {};
        const thumb = f.nanowebp || f.nanogif || f.tinygif;
        const send = f.tinygif || f.nanogif;
        if (!thumb || !send) return null;
        return { title: g.content_description || g.title || "", thumb: thumb.url, dims: thumb.dims || [100, 100], url: send.url };
      })
      .filter(Boolean),
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type !== "gifs") return;
  search(msg.q || "", msg.pos || "").then(
    (res) => reply({ ok: true, ...res }),
    (e) => reply({ ok: false, error: String(e.message || e) })
  );
  return true;
});

// Arka plan uyanır uyanmaz ayarı hazırla, ilk açılış hızlı olsun
getConfig().catch(() => {});
