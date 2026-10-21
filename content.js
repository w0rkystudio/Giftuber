(() => {
  "use strict";

  const COLS = 3;

  // Tenor medya kimliği = 11 karakter çekirdek + "AAAA" + biçim harfi (M = tinygif).
  // Kodda "_" ve "-" yerine "." ve "~" kullanılır: YouTube _italik_ ve -üstü çizili-
  // biçimlendirmesinde bu karakterleri siliyor, yanına yazı eklenince kod bozuluyordu.
  const encodeId = (id) => id.replace(/_/g, ".").replace(/-/g, "~");
  const decodeId = (code) => code.replace(/\./g, "_").replace(/~/g, "-");
  const tenorSrc = (code) => {
    const id = decodeId(code);
    return `https://media.tenor.com/${id.length === 11 ? id + "AAAAM" : id}/tenor.gif`;
  };

  // Yorumlarda tanınan GIF kodları/bağlantıları -> gösterilecek GIF adresi
  const MATCHERS = [
    {
      // Giftuber kodu: [gif:X3bBf.OHMMw] (1.0.0'daki [gif:X3bBf_OHMMw] de okunur)
      re: /\[gif:([A-Za-z0-9_.~-]{8,24})\]/,
      src: tenorSrc,
    },
    {
      // media.tenor.com/<id>/x.gif, media1.tenor.com/m/<id>/x.gif
      re: /(?:https?:\/\/)?media\d*\.tenor\.com\/(?:m\/)?([A-Za-z0-9_-]{10,})\/[\w.%-]*\.(?:gif|webp)/,
      src: (id) => `https://media.tenor.com/${id.length === 16 ? id.slice(0, -1) + "M" : id}/tenor.gif`,
    },
    {
      // i.giphy.com/ID.gif, media2.giphy.com/media/ID/giphy.gif, giphy.com/gifs/slug-ID
      re: /(?:https?:\/\/)?(?:i\.giphy\.com\/(?:media\/)?|media\d*\.giphy\.com\/media\/(?:v1\.[^\/\s]+\/)?|(?:www\.)?giphy\.com\/(?:gifs|embed)\/(?:[\w-]*-)?)([A-Za-z0-9]{6,})(?:\.gif|\.webp|\/giphy\.(?:gif|webp)|\/\w+\.(?:gif|webp))?/,
      src: (id) => `https://i.giphy.com/${id}.gif`,
    },
  ];
  const ANY_RE = new RegExp(MATCHERS.map((m) => `(?:${m.re.source})`).join("|"), "g");

  // Yoruma yazılacak kod (bağlantı değil): [gif:<çekirdek kimlik>]
  function shareCode(url) {
    const m = MATCHERS[1].re.exec(url);
    if (!m) return url;
    const core = /^([A-Za-z0-9_-]{11})AAAA[A-Za-z]$/.exec(m[1]);
    return `[gif:${encodeId(core ? core[1] : m[1])}]`;
  }

  const el = (tag, cls, props) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (props) Object.assign(n, props);
    return n;
  };

  /* ---------------- Picker ---------------- */

  const cache = new Map(); // "q|pos" -> {items, next}
  let panel = null;
  let state = null;

  function buildPanel() {
    panel = el("div", "gt-panel");
    const search = el("input", "gt-search", {
      type: "text",
      placeholder: "Tenor'da ara",
      spellcheck: false,
    });
    const scroller = el("div", "gt-scroll");
    const grid = el("div", "gt-grid");
    const cols = [];
    for (let i = 0; i < COLS; i++) grid.appendChild((cols[i] = el("div", "gt-col")));
    const sentinel = el("div", "gt-sentinel");
    const msg = el("div", "gt-msg");
    const credit = el("div", "gt-credit", { textContent: "Via Tenor" });
    scroller.append(grid, msg, sentinel);
    panel.append(search, scroller, credit);
    document.body.appendChild(panel);

    let t;
    search.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => reset(search.value.trim()), 250);
    });
    search.addEventListener("keydown", (e) => {
      e.stopPropagation(); // YouTube kısayollarını tetiklemesin
      if (e.key === "Escape") closePanel();
    });
    panel.addEventListener("mousedown", (e) => e.stopPropagation());

    new IntersectionObserver(
      (entries) => entries[0].isIntersecting && loadMore(),
      { root: scroller, rootMargin: "400px" }
    ).observe(sentinel);

    state = { search, scroller, cols, heights: [0, 0, 0], msg, q: "", pos: "", count: 0, done: false, busy: false, gen: 0, target: null, anchor: null };
  }

  function reset(q) {
    state.gen++;
    state.q = q;
    state.pos = "";
    state.count = 0;
    state.done = false;
    state.busy = false;
    state.heights = [0, 0, 0];
    state.cols.forEach((c) => c.replaceChildren());
    state.msg.textContent = "";
    state.scroller.scrollTop = 0;
    loadMore();
  }

  function fetchPage(q, pos) {
    const key = `${q}|${pos}`;
    if (cache.has(key)) return Promise.resolve(cache.get(key));
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "gifs", q, pos }, (res) => {
        if (chrome.runtime.lastError || !res?.ok) return reject(new Error(res?.error || "msg"));
        cache.set(key, res);
        resolve(res);
      });
    });
  }

  async function loadMore() {
    if (!state || state.busy || state.done) return;
    state.busy = true;
    const gen = state.gen;
    try {
      const res = await fetchPage(state.q, state.pos);
      if (gen !== state.gen) return;
      res.items.forEach(addTile);
      state.count += res.items.length;
      state.pos = res.next;
      if (!res.items.length || !res.next) state.done = true;
      if (!state.count) state.msg.textContent = "GIF bulunamadı.";
    } catch {
      if (gen !== state.gen) return;
      state.msg.textContent = "GIF'ler yüklenemedi.";
      state.done = true;
    } finally {
      if (gen === state.gen) state.busy = false;
    }
    // Liste kısa kaldıysa (sentinel hâlâ görünür) devam et
    const s = state.scroller;
    if (gen === state.gen && !state.done && s.scrollHeight - s.scrollTop - s.clientHeight < 400) loadMore();
  }

  function addTile(g) {
    const [w, h] = g.dims[0] && g.dims[1] ? g.dims : [100, 100];
    const i = state.heights.indexOf(Math.min(...state.heights));
    state.heights[i] += h / w;
    const tile = el("button", "gt-tile", { type: "button", title: g.title });
    tile.style.aspectRatio = `${w} / ${h}`;
    tile.appendChild(el("img", "", { src: g.thumb, loading: "lazy", decoding: "async", alt: "" }));
    tile.addEventListener("click", () => pick(g.url));
    state.cols[i].appendChild(tile);
  }

  function pick(url) {
    const box = state.target;
    closePanel();
    const ed = box && box.querySelector("#contenteditable-root, [contenteditable='true']");
    if (!ed) return;
    ed.focus();
    const sel = getSelection();
    const range = document.createRange();
    range.selectNodeContents(ed);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    // YouTube editördeki <img class="emoji"> öğelerini gönderirken alt yazısına çeviriyor
    // (convertHrefToAtMentionAndImgToEmoji_). GIF'i böyle eklersek kutuda yazı değil GIF
    // görünür, gönderilen yorumda ise [gif:...] kodu olur.
    const img = el("img", "emoji gt-inline-gif", { src: url, alt: shareCode(url), draggable: false });
    const needSpace = ed.textContent && !/\s$/.test(ed.textContent);
    const html = (needSpace ? " " : "") + img.outerHTML + " ";
    // execCommand YouTube'un input dinleyicilerini tetikler (Yorum yap butonu aktifleşir)
    if (!document.execCommand("insertHTML", false, html)) {
      if (needSpace) range.insertNode(document.createTextNode(" "));
      range.collapse(false);
      range.insertNode(img);
      range.setStartAfter(img);
      range.insertNode(document.createTextNode(" "));
      ed.dispatchEvent(new InputEvent("input", { bubbles: true }));
    }
  }

  function position() {
    if (!panel || !state.anchor) return;
    const r = state.anchor.getBoundingClientRect();
    const pw = panel.offsetWidth;
    const ph = panel.offsetHeight;
    let top = r.bottom + 6;
    if (top + ph > innerHeight - 8 && r.top - ph - 6 > 8) top = r.top - ph - 6;
    panel.style.top = `${Math.max(8, top)}px`;
    panel.style.left = `${Math.max(8, Math.min(r.left, innerWidth - pw - 8))}px`;
  }

  function openPanel(anchor, box) {
    if (!panel) buildPanel();
    if (panel.classList.contains("gt-open") && state.anchor === anchor) return closePanel();
    state.anchor = anchor;
    state.target = box;
    panel.classList.add("gt-open");
    position();
    state.search.focus();
    if (!state.count && !state.busy) reset(state.search.value.trim());
  }

  function closePanel() {
    panel?.classList.remove("gt-open");
    if (state) state.anchor = null;
  }

  addEventListener("mousedown", (e) => {
    if (panel?.classList.contains("gt-open") && !e.target.closest?.(".gt-btn")) closePanel();
  });
  addEventListener("resize", position);
  addEventListener("scroll", position, true);
  addEventListener("yt-navigate-start", closePanel);

  /* ---------------- "Gifs" butonu ---------------- */

  function injectButton(box) {
    if (box.querySelector(".gt-btn")) return;
    const btn = el("button", "gt-btn", { type: "button", textContent: "Gifs" });
    btn.addEventListener("mousedown", (e) => e.preventDefault()); // editör odağını koru
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openPanel(btn, box);
    });
    const emoji = box.querySelector("#emoji-button");
    const footer = box.querySelector("#footer");
    if (emoji && emoji.parentElement) emoji.after(btn);
    else if (footer) footer.prepend(btn);
    else {
      const ed = box.querySelector("#contenteditable-root, [contenteditable='true']");
      if (!ed) return;
      (box.querySelector("#creation-box") || ed.parentElement).after(btn);
    }
  }

  // Yedek: YouTube kutunun yapısını değiştirirse, odaklanılan yorum editörünün altına ekle
  addEventListener(
    "focusin",
    (e) => {
      const ed = e.composedPath?.()[0];
      if (!(ed instanceof HTMLElement) || !ed.isContentEditable) return;
      if (!ed.closest("ytd-comments, ytd-engagement-panel-section-list-renderer, ytd-comment-simplebox-renderer, ytd-commentbox, #comments")) return;
      const box = ed.closest("ytd-commentbox") || ed.parentElement?.parentElement || ed.parentElement;
      if (box) injectButton(box);
    },
    true
  );

  /* ---------------- Yorumlardaki GIF'leri göster ---------------- */

  function gifSrc(text) {
    for (const m of MATCHERS) {
      const r = m.re.exec(text);
      if (r) return m.src(r[1]);
    }
    return null;
  }

  function gifSrcFromUrl(u) {
    try {
      const url = new URL(u, location.href);
      if (/youtube\.com$/.test(url.hostname) && url.pathname === "/redirect") u = url.searchParams.get("q") || u;
    } catch {}
    return gifSrc(u);
  }

  function gifImg(src) {
    const img = el("img", "gt-gif", { src, loading: "lazy", decoding: "async", alt: "GIF" });
    img.addEventListener("error", () => img.remove());
    return img;
  }

  function renderComment(node) {
    if (node.dataset.gtSig === node.textContent) return;
    let changed = false;

    for (const a of node.querySelectorAll("a[href]")) {
      const src = gifSrcFromUrl(a.href) || gifSrc(a.textContent);
      if (!src) continue;
      a.replaceWith(gifImg(src));
      changed = true;
    }

    // Yorumun tüm metninde ara: YouTube metni birden fazla <span>'e bölebiliyor
    // (biçimlendirme, bağlantı, hashtag), kod tek bir metin düğümünde olmayabilir.
    const texts = [];
    let full = "";
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let t; (t = walker.nextNode()); ) {
      texts.push({ t, start: full.length });
      full += t.nodeValue;
    }
    const locate = (pos, isEnd) => {
      for (let i = texts.length - 1; i >= 0; i--) {
        const { t, start } = texts[i];
        if (isEnd ? start < pos : start <= pos) return [t, Math.min(pos - start, t.nodeValue.length)];
      }
      return null;
    };
    // Sondan başa: öndeki eşleşmelerin konumları bozulmasın
    for (const m of [...full.matchAll(ANY_RE)].reverse()) {
      const src = gifSrc(m[0]);
      const a = locate(m.index, false);
      const b = locate(m.index + m[0].length, true);
      if (!src || !a || !b) continue;
      const range = document.createRange();
      range.setStart(a[0], a[1]);
      range.setEnd(b[0], b[1]);
      range.deleteContents();
      range.insertNode(gifImg(src));
      changed = true;
    }

    if (changed) node.classList.add("gt-has-gif");
    node.dataset.gtSig = node.textContent;
  }

  /* ---------------- Gözlemci ---------------- */

  let queued = false;
  function scan() {
    queued = false;
    document.querySelectorAll("ytd-commentbox").forEach(injectButton);
    document
      .querySelectorAll("ytd-comment-view-model #content-text, ytd-comment-renderer #content-text, ytd-backstage-post-renderer #content-text")
      .forEach(renderComment);
  }
  const schedule = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(scan);
    }
  };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  schedule();
})();
