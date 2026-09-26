
// Theme choice persists across pages; the OS preference is the default.
(function(){
  var k="ris-wiki-theme", s=localStorage.getItem(k);
  if(s) document.documentElement.setAttribute("data-theme", s);
  document.getElementById("theme").addEventListener("click", function(){
    var cur = document.documentElement.getAttribute("data-theme");
    if(!cur) cur = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    var next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(k, next);
  });
  // "/" focuses search, as on every docs site.
  document.addEventListener("keydown", function(e){
    if(e.key === "/" && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)){
      e.preventDefault(); document.querySelector('.top input').focus();
    }
  });

  // ── hover one entry, not the whole row, in a dealt table ───────────────────
  // A group starts at a cell marked "grp" (or at the row's first cell), and runs to the next.
  (function(){
    var lit = [];
    function clear(){ lit.forEach(function(c){ c.classList.remove("hl"); }); lit = []; }
    document.addEventListener("mouseover", function(e){
      var td = e.target.closest && e.target.closest(".tw.multi td");
      clear();
      if (!td) return;
      var cells = Array.prototype.slice.call(td.parentNode.children);
      var i = cells.indexOf(td), a = i, b = i;
      while (a > 0 && !cells[a].classList.contains("grp")) a--;
      while (b + 1 < cells.length && !cells[b + 1].classList.contains("grp")) b++;
      for (var k = a; k <= b; k++) { cells[k].classList.add("hl"); lit.push(cells[k]); }
    });
  })();

  // ── deal the tables to the window that is actually open ────────────────────
  // The server decides how many copies of a narrow table fit across the page from an ESTIMATE of
  // a width it cannot know. On a window narrower than the estimate assumes, three lists that
  // were meant to sit side by side do not, and the page is wrong for the person reading it. So
  // the server's answer is only the starting position: here it is measured and redone, and
  // redone again when the window changes.
  //
  // Reads in one pass and writes in one pass. There are pages here carrying 156 tables, and
  // interleaving a measurement with a rebuild per table would force 156 reflows; setting them
  // all flat, then reading all the widths, then rebuilding all, costs two.
  (function deal(){
    var tws = [].slice.call(document.querySelectorAll(".tw[data-cols]")).filter(function(t){ return !t.closest(".nodeal"); });
    if (!tws.length) return;

    function capture(tw){
      var t = tw.querySelector("table");
      if (!t || !t.tHead || !t.tBodies[0]) return null;
      var cols = +tw.getAttribute("data-cols"), up = +tw.getAttribute("data-up") || 1;
      var hc = t.tHead.rows[0].cells, head = [], klass = [];
      for (var k = 0; k < cols; k++) {
        head.push(hc[k] ? hc[k].innerHTML : "");
        // The alignment class lives on every cell of a column; take it from the heading, and
        // drop "grp", which marks where a GROUP starts and is re-applied when dealing.
        klass.push(hc[k] ? hc[k].className.replace(/grp/, "").trim() : "");
      }
      var rows = [];
      [].forEach.call(t.tBodies[0].rows, function(r){
        for (var g = 0; g < up; g++) {
          var cells = [], any = false;
          for (var k = 0; k < cols; k++) {
            var c = r.cells[g * cols + k];
            cells.push(c ? c.innerHTML : "");
            if (c && c.innerHTML.replace(/s|&nbsp;/g, "")) any = true;
          }
          // Padding cells from the previous deal are dropped rather than kept as blank rows.
          if (any) rows.push(cells);
        }
      });
      return { t: t, cols: cols, head: head, klass: klass, rows: rows };
    }

    function render(d, up){
      var cell = function(tag, html, k, first){
        var c = (d.klass[k] + (first && k === 0 ? " grp" : "")).trim();
        return "<" + tag + (c ? ' class="' + c + '"' : "") + ">" + html + "</" + tag + ">";
      };
      var th = "", g, k, r;
      for (g = 0; g < up; g++) for (k = 0; k < d.cols; k++) {
        // A group with no row in it gets blank headings — not a repeat of them over nothing.
        th += cell("th", g < d.rows.length ? d.head[k] : "", k, g > 0);
      }
      var body = "", n = Math.ceil(d.rows.length / up);
      for (r = 0; r < n; r++) {
        body += "<tr>";
        for (g = 0; g < up; g++) {
          var row = d.rows[r * up + g];
          for (k = 0; k < d.cols; k++) body += cell("td", row ? row[k] : "", k, g > 0);
        }
        body += "</tr>";
      }
      d.t.tHead.rows[0].innerHTML = th;
      d.t.tBodies[0].innerHTML = body;
    }

    var state = [];
    tws.forEach(function(tw){
      var d = capture(tw);
      if (d && d.rows.length) { state.push({ tw: tw, d: d, up: 0, one: 0 }); }
    });
    if (!state.length) return;

    function layout(first){
      if (first) {
        state.forEach(function(s){ render(s.d, 1); s.tw.classList.remove("multi"); });
        // One read pass, after one write pass.
        state.forEach(function(s){
          s.one = s.d.t.offsetWidth;
          s.avail = (s.tw.parentNode && s.tw.parentNode.clientWidth) || s.one;
        });
      } else {
        state.forEach(function(s){ s.avail = (s.tw.parentNode && s.tw.parentNode.clientWidth) || s.one; });
      }
      state.forEach(function(s){
        // 7px is what a group costs beyond its own columns: its first cell takes 1.1rem of left
        // padding where the others take .7rem.
        var up = Math.max(1, Math.min(4, Math.floor(s.avail / (s.one + 7)) || 1));
        if (up === s.up) return;              // nothing to rebuild at this width
        s.up = up;
        render(s.d, up);
        s.tw.classList.toggle("multi", up > 1);
        s.tw.classList.toggle("scroll", s.one > s.avail);
      });
    }

    layout(true);
    var timer = null, was = window.innerWidth;
    window.addEventListener("resize", function(){
      if (window.innerWidth === was) return;   // a vertical-only resize changes nothing here
      was = window.innerWidth;
      clearTimeout(timer);
      timer = setTimeout(function(){ layout(false); }, 120);
    });
  })();

  // The jump strip marks where you are. On a page of 22 sections the strip otherwise tells you
  // where you could go and nothing about where you have got to, and the strip itself scrolls
  // sideways — so the current entry is brought into view rather than left off the end of it.
  //
  // IntersectionObserver rather than a scroll handler: a scroll handler on a 4,000-row page
  // fires on every frame and has to measure each heading, which is what made the pointer
  // stutter on the big tables before. This does the work only when a heading crosses the line.
  var strip = document.querySelector(".jump");
  if (strip && window.IntersectionObserver) {
    var links = {}, order = [], seen = {};
    Array.prototype.forEach.call(strip.querySelectorAll("a"), function(a){
      var id = decodeURIComponent(a.getAttribute("href").slice(1));
      links[id] = a; order.push(id);
    });
    var mark = function(){
      var active = null;
      for (var i = 0; i < order.length; i++) if (seen[order[i]]) active = order[i];
      Array.prototype.forEach.call(strip.querySelectorAll("a.on"), function(a){ a.classList.remove("on"); });
      if (active && links[active]) {
        links[active].classList.add("on");
        var a = links[active], l = a.offsetLeft, r = l + a.offsetWidth;
        if (l < strip.scrollLeft || r > strip.scrollLeft + strip.clientWidth) {
          strip.scrollTo({ left: Math.max(0, l - strip.clientWidth / 3), behavior: "smooth" });
        }
      }
    };
    // The trigger line sits just under the bar. A heading counts as reached once its top passes
    // it, and stops counting when it scrolls back below — so "active" is the last one crossed.
    var top = parseFloat(getComputedStyle(document.body).getPropertyValue("--topbar")) || 3.1;
    var px = top * parseFloat(getComputedStyle(document.documentElement).fontSize || 16);
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){ seen[e.target.id] = e.boundingClientRect.top < px + 8; });
      mark();
    }, { rootMargin: (-Math.round(px) - 8) + "px 0px 0px 0px", threshold: 0 });
    order.forEach(function(id){ var el = document.getElementById(id); if (el) io.observe(el); });
  }
})();

// ── compare units ────────────────────────────────────────────────────────────
// Asked for 2026-09-26: click any two units and see them side by side in a box at the top.
// A click on a unit's row (anywhere but a link) picks it; a unit's own page has a button. The
// picks live in localStorage, so one can come from the roster and one from a faction page. The
// numbers are units/compare.json (gen-ris-unit-pages.js), fetched on the first pick. Written
// without backticks, dollar-braces or backslashes: this script sits inside a template literal.
(function(){
  var KEY = "ris-compare", MAX = 4, UNIT = /(^|[/])units[/]([a-z0-9_]+)[.](md|html)([#?]|$)/;
  var js = document.querySelector('script[src*="wiki.js"]');
  var ROOT = js ? js.getAttribute("src").split("wiki.js")[0] : "/";
  var EXT = /[.]html$/.test(location.pathname) || location.protocol === "file:" ? ".html" : ".md";
  var data = null, loading = null;
  function picks(){ try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function save(p){ try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }
  function load(){
    if (data || loading) return loading;
    loading = fetch(ROOT + "units/compare.json").then(function(r){ return r.json(); }).then(function(d){ data = d; return d; })
      .catch(function(){ data = {}; return data; });
    return loading;
  }
  function esc(t){ return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  function toggle(slug){
    var p = picks(), i = p.indexOf(slug);
    if (i >= 0) p.splice(i, 1); else { p.push(slug); if (p.length > MAX) p.shift(); }
    save(p); render();
  }
  // Rows: [label, key, which way is better (1 higher, -1 lower, 0 neither), suffix]
  var ROWS = [["Class", "cls", 0], ["Men", "men", 0], ["Attack", "attack", 1], ["Charge bonus", "charge", 1],
    ["Secondary attack", "sec", 1], ["Weapon", "type", 0], ["Range", "range", 1], ["Ammunition", "ammo", 1],
    ["Defence", "def", 1], ["Armour", "armour", 1], ["Defence skill", "skill", 1], ["Shield", "shield", 1],
    ["Hit points", "hp", 1], ["Morale", "morale", 1], ["Discipline", "disc", 0], ["Training", "train", 0],
    ["Mount", "mount", 0], ["Cost", "cost", -1, " dn"], ["Upkeep", "upkeep", -1, " dn"], ["Turns to recruit", "turns", -1],
    ["In battle", "abil", 0]];
  var box = document.createElement("div");
  box.className = "cmp"; box.hidden = true;
  document.body.appendChild(box);
  function render(){
    var p = picks();
    document.querySelectorAll("main [data-unit]").forEach(function(el){ el.classList.toggle("cmp-on", p.indexOf(el.getAttribute("data-unit")) >= 0); });
    var btn = document.querySelector(".cmp-btn");
    if (btn) btn.textContent = p.indexOf(btn.getAttribute("data-unit")) >= 0 ? "Remove from comparison" : "Compare with another unit";
    if (!p.length) { box.hidden = true; return; }
    box.hidden = false;
    if (!data) { box.innerHTML = '<div class="cmp-h">Loading…</div>'; load().then(render); return; }
    var us = p.map(function(s){ return [s, data[s]]; }).filter(function(x){ return x[1]; });
    var head = '<div class="cmp-h"><b>Comparing ' + us.length + ' unit' + (us.length === 1 ? "" : "s") + '</b>'
      + (us.length < 2 ? ' <span>Click another unit’s row, or use the button on a unit’s page.</span>' : "")
      + '<button type="button" class="cmp-min" title="Fold">' + (box.classList.contains("folded") ? "Show" : "Fold") + '</button>'
      + '<button type="button" class="cmp-clear">Clear</button></div>';
    var cols = us.map(function(x){
      return '<th><a href="' + ROOT + 'units/' + x[0] + EXT + '"><img src="' + ROOT + 'cards/' + x[0] + '.png" alt="" width="35" height="48" onerror="this.remove()"> '
        + esc(x[1].n) + '</a> <button type="button" class="cmp-x" data-unit="' + x[0] + '" title="Remove">×</button></th>';
    }).join("");
    var body = ROWS.map(function(r){
      var vals = us.map(function(x){ var v = x[1][r[1]]; return Array.isArray(v) ? (v.length ? v.join(" · ") : null) : v; });
      if (vals.every(function(v){ return v == null; })) return "";
      var nums = vals.filter(function(v){ return typeof v === "number"; });
      var best = r[2] && nums.length > 1 ? (r[2] > 0 ? Math.max.apply(null, nums) : Math.min.apply(null, nums)) : null;
      var allSame = nums.length > 1 && nums.every(function(v){ return v === nums[0]; });
      return '<tr><th>' + r[0] + '</th>' + vals.map(function(v){
        var good = best != null && !allSame && v === best;
        return '<td' + (good ? ' class="cmp-best"' : "") + '>' + (v == null ? "—" : esc(typeof v === "number" ? v.toLocaleString("en-US") + (r[3] || "") : v)) + '</td>';
      }).join("") + '</tr>';
    }).join("");
    box.innerHTML = head + '<div class="cmp-scroll"><table><thead><tr><th></th>' + cols + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }
  box.addEventListener("click", function(e){
    var t = e.target;
    if (t.classList.contains("cmp-x")) toggle(t.getAttribute("data-unit"));
    else if (t.classList.contains("cmp-clear")) { save([]); render(); }
    else if (t.classList.contains("cmp-min")) { box.classList.toggle("folded"); t.textContent = box.classList.contains("folded") ? "Show" : "Fold"; }
  });
  // Every table row that leads to a unit page can be picked.
  var any = false;
  // A row holding several units side by side (a dealt table) is picked per cell: each cell
  // belongs to the unit linked in it or in the nearest cell before it.
  var slugIn = function(el){
    var links = el.querySelectorAll("a[href]");
    for (var i = 0; i < links.length; i++){ var m = UNIT.exec(links[i].getAttribute("href")); if (m) return m[2]; }
    return null;
  };
  document.querySelectorAll("main table tbody tr").forEach(function(tr){
    var cells = [].slice.call(tr.children), slugs = {};
    cells.forEach(function(td){ var s = slugIn(td); if (s) slugs[s] = 1; });
    var n = Object.keys(slugs).length;
    if (!n) return;
    any = true;
    if (n === 1) { tr.setAttribute("data-unit", Object.keys(slugs)[0]); tr.title = "Click to compare"; return; }
    var cur = null;
    cells.forEach(function(td){ cur = slugIn(td) || cur; if (cur) { td.setAttribute("data-unit", cur); td.title = "Click to compare"; } });
  });
  document.addEventListener("click", function(e){
    var el = e.target.closest && e.target.closest("[data-unit]");
    if (!el || el.closest(".cmp") || el.classList.contains("cmp-btn") || e.target.closest("a, button, input, select, summary")) return;
    toggle(el.getAttribute("data-unit"));
  });
  // A unit's own page: a button under the title.
  var own = UNIT.exec(location.pathname);
  var h1 = document.querySelector("main h1");
  if (own && h1 && own[2] !== "index") {
    var b = document.createElement("button");
    b.type = "button"; b.className = "cmp-btn"; b.setAttribute("data-unit", own[2]);
    b.addEventListener("click", function(){ toggle(own[2]); });
    h1.insertAdjacentElement("afterend", b);
  }
  if (any && !picks().length) {
    var t0 = document.querySelector("main table tbody [data-unit]");
    var hint = document.createElement("p");
    hint.className = "cmp-hint"; hint.textContent = "Tip: click a unit’s row (not its name) to compare it with another.";
    var tbl = t0 && t0.closest("table"), host = tbl && (tbl.closest(".tw") || tbl);
    if (host && host.parentNode) host.parentNode.insertBefore(hint, host);
  }
  render();
})();

// ── static-export additions ──────────────────────────────────────────────────
(function(){
  var base = window.RIS_BASE || "";
  var form = document.querySelector(".top form");
  if (form) {
    var input = form.querySelector("input");
    // On a web host the plain GET works: search.html?q=… . Under file:// a form GET does not
    // reliably carry a query string, so the submit is intercepted and the term travels in the
    // hash, which every browser keeps. search.html reads whichever arrived.
    form.addEventListener("submit", function(e){
      var q = (input && input.value || "").trim();
      if (!q) { e.preventDefault(); return; }
      if (location.protocol === "file:") {
        e.preventDefault();
        location.href = base + "search.html#q=" + encodeURIComponent(q);
      }
    });
  }
})();

// ── team menu, fetched at view time ──────────────────────────────────────────
// wiki-notes/menu.json is written by the CI sync from the wiki page "Site-Menu": sections
// and links the team adds without a rebuild. A section whose heading matches one already in
// the menu gets the links appended; any other heading becomes a new section at the end.
(function () {
  try {
    if (location.protocol === "file:" || typeof fetch !== "function") return;
    var nav = document.querySelector("nav.side");
    if (!nav) return;
    var base = window.RIS_BASE || "";
    var here = decodeURIComponent(location.pathname);
    fetch(base + "wiki-notes/menu.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (menu) {
        if (!menu || !menu.length) return;
        var heads = Array.prototype.slice.call(nav.querySelectorAll("h4"));
        menu.forEach(function (sec) {
          var items = (sec.items || []).filter(function (it) { return it && it.href && it.label; });
          var h = null;
          heads.forEach(function (x) { if (x.textContent.trim().toLowerCase() === String(sec.heading).trim().toLowerCase()) h = x; });
          var anchor = null;
          if (!h) {
            h = document.createElement("h4");
            h.textContent = sec.heading;
            nav.appendChild(h);
            heads.push(h);
          } else {
            anchor = h.nextElementSibling;
            while (anchor && anchor.tagName === "A") anchor = anchor.nextElementSibling;
          }
          items.forEach(function (it) {
            var a = document.createElement("a");
            var ext = String(it.href).toLowerCase().indexOf("http") === 0 && String(it.href).indexOf("://") > 0;
            a.href = ext ? it.href : base + it.href.split("/").map(encodeURIComponent).join("/") + ".html";
            a.textContent = it.label;
            if (ext) { a.target = "_blank"; a.rel = "noopener"; }
            else if (here.slice(-(it.href.length + 5)) === it.href + ".html") a.className = "on";
            nav.insertBefore(a, anchor);
          });
        });
      })
      .catch(function () {});
  } catch (e) { /* the menu is an extra; never break the page for it */ }
})();

// ── team notes, fetched at view time ─────────────────────────────────────────
// A note written on the GitHub wiki reaches this site through a CI job that CANNOT rebuild
// the site: the 222 MB of RIS source a rebuild needs lives on rtris.org, which a GitHub
// runner cannot reach. So the job publishes each note as a small pre-rendered fragment and
// the page fetches its own when it loads. wiki-notes/index.json lists which pages have one,
// so a page with no note makes no second request, and the whole thing is skipped when a full
// local rebuild has already merged the note into the HTML.
(function () {
  try {
    if (location.protocol === "file:") return;              // an offline copy is a snapshot
    if (document.getElementById("team-notes")) return;      // a rebuild already merged it
    var main = document.querySelector("main");
    if (!main || typeof fetch !== "function") return;

    // Declared here, not borrowed: the shell's own copy lives inside a different IIFE, so
    // reading it from this one is a ReferenceError — which this block's try/catch swallows,
    // leaving no console error and a page that simply never shows its note.
    var base = window.RIS_BASE || "";
    var rootPath = new URL(base || "./", location.href).pathname;
    var here = decodeURIComponent(location.pathname);
    if (here.indexOf(rootPath) !== 0) return;
    var key = here.slice(rootPath.length).replace(/.html?$/, "");
    if (!key || key === "index") key = "README";

    fetch(base + "wiki-notes/index.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (idx) {
        if (!idx || !idx[key]) return null;
        return fetch(base + "wiki-notes/" + String(idx[key]).split("/").map(encodeURIComponent).join("/") + ".html", { cache: "no-cache" });
      })
      .then(function (r) { return r && r.ok ? r.text() : null; })
      .then(function (html) {
        if (!html) return;
        // A team page: the fragment IS the page, as last saved on the wiki. Keep the trail,
        // replace the rest.
        if (key.indexOf("team/") === 0) {
          var crumb = main.querySelector(".crumb");
          main.innerHTML = "";
          if (crumb) main.appendChild(crumb);
          var body = document.createElement("div");
          body.className = "lede";
          body.innerHTML = html;
          main.appendChild(body);
          return;
        }
        var sec = document.createElement("section");
        sec.className = "sec";
        sec.innerHTML = '<h2 id="team-notes">Team notes</h2>' + html;
        main.appendChild(sec);
        var jump = document.querySelector(".jump");
        if (jump && !jump.querySelector('a[href="#team-notes"]')) {
          var a = document.createElement("a");
          a.href = "#team-notes";
          a.textContent = "Team notes";
          jump.appendChild(a);
        }
      })
      .catch(function () {});   // a missing notes folder is normal, not an error
  } catch (e) {}
})();
