
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

// ── a link to a closed fold opens it ─────────────────────────────────────────
// The AOR page folds each area (closed, so it scrolls fast); its index table links to the folds
// by id, and a jump to a closed one would land on a single line.
(function(){
  function openTarget(){
    var id = decodeURIComponent(location.hash.slice(1));
    var el = id && document.getElementById(id);
    if (el && el.tagName === "DETAILS" && !el.open) { el.open = true; el.scrollIntoView(); }
  }
  window.addEventListener("hashchange", openTarget);
  openTarget();
})();

// ── compare units ────────────────────────────────────────────────────────────
// Asked for 2026-09-26; reworked the same night on the team's word ("at the top as an entry
// instead of a popup"). Click a unit's row (anywhere but a link) to pick it. Picked units are
// pinned as rows at the TOP of every stat table on the page, in that table's own columns, with
// the better value in each column in gold. A page whose unit tables have no stat columns (a
// faction's recruit tables, a unit's own page) gets the same rows in a small table at the top
// of the page instead. Picks live in localStorage, so they follow the reader between pages; a
// unit not in this table is built from units/compare.json (gen-ris-unit-pages.js).
// Written without backticks, dollar-braces or backslashes: this script sits inside a template
// literal.
(function(){
  var KEY = "ris-compare", MAX = 6, UNIT = /(^|[/])units[/]([a-z0-9_]+)[.](md|html)([#?]|$)/;
  var js = document.querySelector('script[src*="wiki.js"]');
  var ROOT = js ? js.getAttribute("src").split("wiki.js")[0] : "/";
  var EXT = /[.]html$/.test(location.pathname) || location.protocol === "file:" ? ".html" : ".md";
  var main = document.querySelector("main");
  if (!main) return;
  var data = null, loading = null;
  function picks(){ try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function save(p){ try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }
  // A shared comparison: ?compare=unit1,unit2 in the address sets the picks (asked for
  // 2026-09-29, so a comparison can be posted as a link).
  var shared = /[?&]compare=([^&#]*)/.exec(location.search);
  if (shared) save(decodeURIComponent(shared[1]).split(",").filter(function(s){ return /^[a-z0-9_]+$/.test(s); }).slice(0, MAX));
  function shareLink(){ return location.origin + location.pathname + "?compare=" + picks().join(","); }
  function load(){
    if (!loading) loading = fetch(ROOT + "units/compare.json").then(function(r){ return r.json(); })
      .then(function(d){ data = d; return d; }).catch(function(){ data = {}; return data; });
    return loading;
  }
  function esc(t){ return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  function toggle(slug){
    var p = picks(), i = p.indexOf(slug);
    if (i >= 0) p.splice(i, 1); else { p.push(slug); if (p.length > MAX) p.shift(); }
    save(p); render();
  }
  // Column heading -> [compare.json key, better: 1 higher, -1 lower, 0 neither, suffix]
  var COLS = { "class": ["cls", 0], "men": ["men", 0], "attack": ["attack", 1], "charge": ["charge", 1],
    "charge bonus": ["charge", 1], "defence": ["def", 1], "armour": ["armour", 1], "shield": ["shield", 1],
    "morale": ["morale", 1], "hit points": ["hp", 1], "cost": ["cost", -1], "upkeep": ["upkeep", -1],
    "range": ["range", 1], "ammunition": ["ammo", 1], "turns": ["turns", -1] };
  // The columns the page-top table shows when a page has no stat table of its own.
  var PANEL = [["", "card"], ["Unit", "unit"], ["Class", "class"], ["Men", "men"], ["Attack", "attack"], ["Charge", "charge"],
    ["Defence", "defence"], ["Armour", "armour"], ["Shield", "shield"], ["Morale", "morale"], ["Hit points", "hit points"],
    ["Range", "range"], ["Cost", "cost"], ["Upkeep", "upkeep"]];
  function numOf(t){ var s = String(t).replace(/[^0-9.-]/g, ""); return s === "" || s === "-" ? null : parseFloat(s); }
  function fmt(v, key){ return v == null ? "" : typeof v === "number" ? v.toLocaleString("en-US") + (key === "cost" || key === "upkeep" ? " dn" : "") : esc(v); }

  // Tables: which rows are units, and which have stat columns to pin into.
  var slugIn = function(el){
    var links = el.querySelectorAll("a[href]");
    for (var i = 0; i < links.length; i++){ var m = UNIT.exec(links[i].getAttribute("href")); if (m) return m[2]; }
    return null;
  };
  // plainTables: unit tables with no stat columns (a faction's recruit tables); lastTbl: the
  // table the reader last picked from, where the comparison is shown.
  var statTables = [], plainTables = [], lastTbl = null, any = false;
  main.querySelectorAll("table").forEach(function(tbl){
    if (tbl.closest(".cmp-panel")) return;
    var tb = tbl.tBodies[0];
    if (!tb) return;
    var perRow = 0;
    [].slice.call(tb.rows).forEach(function(tr){
      var cells = [].slice.call(tr.cells), slugs = {};
      cells.forEach(function(td){ var s = slugIn(td); if (s) slugs[s] = 1; });
      var n = Object.keys(slugs).length;
      if (!n) return;
      any = true;
      if (n === 1) { tr.setAttribute("data-unit", Object.keys(slugs)[0]); tr.title = "Click to compare"; perRow++; return; }
      // A row holding several units side by side (a dealt table) is picked per cell.
      var cur = null;
      cells.forEach(function(td){ cur = slugIn(td) || cur; if (cur) { td.setAttribute("data-unit", cur); td.title = "Click to compare"; } });
    });
    var head = tbl.tHead && tbl.tHead.rows[0];
    if (!perRow || !head) return;
    var heads = [].slice.call(head.cells).map(function(th){ return th.textContent.trim().toLowerCase(); });
    if (heads.some(function(h){ return COLS[h] && COLS[h][1]; })) statTables.push({ tbl: tbl, heads: heads });
    else plainTables.push(tbl);
  });
  if (!any && !UNIT.test(location.pathname)) return;

  // One pinned row: the table's own row for the unit when it has one, else one built from
  // compare.json in the table's columns. Cells are marked with the key they show.
  function pinRow(slug, heads, own){
    var d = data && data[slug], tr;
    if (own) tr = own.cloneNode(true);
    else {
      tr = document.createElement("tr");
      heads.forEach(function(h, i){
        var td = document.createElement("td"), c = COLS[h];
        if (h === "" && i === 0) td.innerHTML = '<a href="' + ROOT + "units/" + slug + EXT + '"><img src="' + ROOT + "cards/" + slug + '.png" alt="" width="35" height="48" onerror="this.remove()"></a>';
        else if (h === "unit") td.innerHTML = '<a href="' + ROOT + "units/" + slug + EXT + '">' + esc(d ? d.n : slug) + "</a>";
        else if (c && d) { td.innerHTML = fmt(d[c[0]], c[0]); if (typeof d[c[0]] === "number") td.className = "right"; }
        tr.appendChild(td);
      });
    }
    tr.removeAttribute("title");
    tr.className = "cmp-pin";
    tr.setAttribute("data-pin", slug);
    tr.removeAttribute("data-unit");
    [].slice.call(tr.cells).forEach(function(td){ td.removeAttribute("data-unit"); td.removeAttribute("title"); });
    // The remove button goes after the unit's name.
    var nameCell = [].slice.call(tr.cells).filter(function(td){ return slugIn(td) && !td.querySelector("img"); })[0] || tr.cells[1] || tr.cells[0];
    var x = document.createElement("button");
    x.type = "button"; x.className = "cmp-x"; x.title = "Stop comparing"; x.textContent = "×"; x.setAttribute("data-unit", slug);
    nameCell.appendChild(x);
    return tr;
  }
  // Gold for the best value in each column of the pinned rows.
  function markBest(rows, heads){
    heads.forEach(function(h, i){
      var c = COLS[h];
      if (!c || !c[1] || rows.length < 2) return;
      var vals = rows.map(function(r){ return r.cells[i] ? numOf(r.cells[i].textContent) : null; });
      var nums = vals.filter(function(v){ return v != null; });
      if (nums.length < 2 || nums.every(function(v){ return v === nums[0]; })) return;
      var best = c[1] > 0 ? Math.max.apply(null, nums) : Math.min.apply(null, nums);
      rows.forEach(function(r, k){ if (vals[k] === best && r.cells[i]) r.cells[i].classList.add("cmp-best"); });
    });
  }
  function capRow(n, cols){
    var tr = document.createElement("tr");
    tr.className = "cmp-pin cmp-cap";
    tr.innerHTML = '<td colspan="' + cols + '"><b>Comparing ' + n + " unit" + (n === 1 ? "" : "s") + "</b>"
      + (n < 2 ? " <span>Click another unit’s row to add it.</span>" : " <span>Gold is the better value.</span>")
      + ' <button type="button" class="cmp-clear">Clear</button>'
      + (n > 1 ? ' <button type="button" class="cmp-share" title="Copy a link to this comparison">Share</button>' : "") + '</td>';
    return tr;
  }
  var panel = null;
  function render(){
    var p = picks();
    main.querySelectorAll("[data-unit]").forEach(function(el){ if (!el.classList.contains("cmp-x")) el.classList.toggle("cmp-on", p.indexOf(el.getAttribute("data-unit")) >= 0); });
    var btn = document.querySelector(".cmp-btn");
    if (btn) btn.textContent = p.indexOf(btn.getAttribute("data-unit")) >= 0 ? "Stop comparing this unit" : "Compare with another unit";
    main.querySelectorAll("tr.cmp-pin").forEach(function(tr){ tr.remove(); });
    if (panel) { panel.remove(); panel = null; }
    if (!p.length) return;
    if (!data) { load().then(render); return; }
    if (statTables.length) {
      statTables.forEach(function(t){
        var tb = t.tbl.tBodies[0], rows = [];
        p.forEach(function(slug){
          var own = tb.querySelector('tr[data-unit="' + slug + '"]');
          if (own || data[slug]) rows.push(pinRow(slug, t.heads, own));
        });
        markBest(rows, t.heads);
        var first = tb.firstChild;
        tb.insertBefore(capRow(rows.length, t.heads.length), first);
        rows.forEach(function(r){ tb.insertBefore(r, first); });
        // A clear break between the compared rows and the table they came from.
        var sep = document.createElement("tr");
        sep.className = "cmp-pin cmp-sep";
        sep.innerHTML = '<td colspan="' + t.heads.length + '">All units</td>';
        tb.insertBefore(sep, first);
      });
      return;
    }
    // No stat table here: the same rows in a small table of their own, as the first row of the
    // unit table the reader is picking from (a faction's recruit table), so it shows where they
    // click; on a page with no unit table (a unit's own page), under the title.
    var heads = PANEL.map(function(c){ return c[1] === "card" ? "" : c[1]; });
    var rows = p.filter(function(s){ return data[s]; }).map(function(s){ return pinRow(s, heads, null); });
    markBest(rows, heads);
    panel = document.createElement("div");
    panel.className = "cmp-panel";
    panel.innerHTML = '<table><thead><tr>' + PANEL.map(function(c){ return "<th>" + c[0] + "</th>"; }).join("") + "</tr></thead><tbody></tbody></table>";
    var tb = panel.querySelector("tbody");
    tb.appendChild(capRow(rows.length, PANEL.length));
    rows.forEach(function(r){ tb.appendChild(r); });
    var host = plainTables.indexOf(lastTbl) >= 0 ? lastTbl : plainTables[0];
    var hb = host && host.tBodies[0];
    if (hb) {
      var cols = host.tHead && host.tHead.rows[0] ? host.tHead.rows[0].cells.length : (hb.rows[0] ? hb.rows[0].cells.length : 1);
      var hold = document.createElement("tr");
      hold.className = "cmp-pin cmp-hold";
      var td = document.createElement("td");
      td.colSpan = cols; td.appendChild(panel); hold.appendChild(td);
      var sep = document.createElement("tr");
      sep.className = "cmp-pin cmp-sep";
      sep.innerHTML = '<td colspan="' + cols + '">All units</td>';
      hb.insertBefore(sep, hb.firstChild);
      hb.insertBefore(hold, sep);
      panel = null;   // removed with its row
      return;
    }
    var top = btn || main.querySelector("h1");
    if (top) top.insertAdjacentElement("afterend", panel); else main.insertBefore(panel, main.firstChild);
  }
  document.addEventListener("click", function(e){
    var t = e.target;
    if (t.classList && t.classList.contains("cmp-x")) { e.preventDefault(); toggle(t.getAttribute("data-unit")); return; }
    if (t.classList && t.classList.contains("cmp-clear")) { save([]); render(); return; }
    if (t.classList && t.classList.contains("cmp-share")) {
      var url = shareLink();
      var done = function(){ t.textContent = "Link copied"; setTimeout(function(){ t.textContent = "Share"; }, 1800); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function(){ prompt("Link to this comparison", url); });
      else prompt("Link to this comparison", url);
      return;
    }
    var el = t.closest && t.closest("[data-unit]");
    if (!el || el.closest(".cmp-pin") || el.classList.contains("cmp-btn") || t.closest("a, button, input, select, summary")) return;
    lastTbl = el.closest("table");
    toggle(el.getAttribute("data-unit"));
  });
  // A unit's own page: a button under the title.
  var own = UNIT.exec(location.pathname), h1 = main.querySelector("h1");
  if (own && h1) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "cmp-btn"; b.setAttribute("data-unit", own[2]);
    b.addEventListener("click", function(){ toggle(own[2]); });
    h1.insertAdjacentElement("afterend", b);
  }
  if (any && !picks().length) {
    var t0 = main.querySelector("table tbody [data-unit]");
    var hint = document.createElement("p");
    hint.className = "cmp-hint"; hint.textContent = "Tip: click a unit’s row (not its name) to pin it to the top of the table and compare it with others.";
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

window.RIS_REMASTERED = ["acarnania","achaea","acragas","aetolia","antigonid","ardiaei","argos","asti","athens","bactria","bessi","bithynia","boeotia","bosporan","bruttians","byzantium","cabyle","cappadocia","capua","chersonesus","chios","chrysaoria","cilicians","cius","cyrene","cyzicus","daesitiates","dardania","delmatae","dentheletae","egypt","elis","emporion","epirus","gortyn","heraclea_pontica","histri","histria","iapodes","illyrian_kingdom","issa","italics","knossos","kydonia","labeatae","liburni","lucanians","lycia","lysiad","lyttos","maedi","mamertines","massalia","megalopolis","messapians","messene","miletus","odrysians","olbia","paeonia","paphlagonia","pentapolis","pergamon","picentes","pontus","priene","ptolemaic","ptolemaic_rebels","rhodes","roman_rebels_1","roman_rebels_2","roman_senate","romans_julii","samnites","sarsinates","seleucid","seleucid_rebels","seleucid_rebels2","selge","sinope","slave","sparta","syracuse","taras","thessaly","trapezus","triballi","volsinii"];
// ── remastered factions: a red (R) after the name ────────────────────────────
// Appended to the site's wiki.js by build-ris-wiki-site.js, after window.RIS_REMASTERED (the
// faction tokens gen-ris-faction-pages.js wrote to factions/remastered.json). Every link to a
// remastered faction's page, on any page, gets the tag after its text, and so does the title
// of the faction's own page. Tables that redraw themselves (the sortable views, the compare
// rows) are watched, so their links are tagged too. Links with no text (an emblem alone) and
// the menu are left alone.
(function(){
  var list = window.RIS_REMASTERED || [];
  if (!list.length) return;
  var set = {};
  list.forEach(function(f){ set[f] = 1; });
  var FAC = /(^|\/)factions\/([a-z0-9_]+)\.(md|html)([#?]|$)/;
  function tag(){
    var t = document.createElement("span");
    t.className = "rm-tag";
    t.title = "Remastered: This faction has been remastered by the Mod team";
    t.textContent = "(R)";
    return t;
  }
  function run(root){
    root.querySelectorAll('a[href*="factions/"]').forEach(function(a){
      if (a.getAttribute("data-rm") || a.closest("nav, .crumb, .top")) return;
      var m = FAC.exec(a.getAttribute("href"));
      a.setAttribute("data-rm", "1");
      if (!m || !set[m[2]] || !a.textContent.trim()) return;
      var next = a.nextSibling;
      if (next && next.nodeType === 1 && next.classList.contains("rm-tag")) return;
      a.parentNode.insertBefore(tag(), next);
    });
  }
  var main = document.querySelector("main") || document.body;
  run(main);
  var own = FAC.exec(location.pathname), h1 = main.querySelector("h1");
  if (own && set[own[2]] && h1 && !h1.querySelector(".rm-tag")) h1.appendChild(tag());
  var queued = false;
  new MutationObserver(function(){
    if (queued) return;
    queued = true;
    requestAnimationFrame(function(){ queued = false; run(main); });
  }).observe(main, { childList: true, subtree: true });
})();

// ── hover previews ───────────────────────────────────────────────────────────
// Appended to the site's wiki.js by build-ris-wiki-site.js (asked for 2026-09-29, then "add
// more of those hover over windows"). Pointing at a link shows a small card of what is behind
// it. Units and factions have their own layout (units/compare.json, factions/preview.json);
// every other page family (regions, settlements, buildings down to the level, trade goods,
// traits, retinue, reforms, beliefs, cultures, sizes, revolts, mercenary pools, region tags)
// uses previews/<family>.json, built from the pages themselves (lib/pagePreviews.js). Each file
// is fetched once, on the first hover of its kind. Not on touch screens, where there is no hover.
(function(){
  if (window.matchMedia && matchMedia("(hover: none)").matches) return;
  var js = document.querySelector('script[src*="wiki.js"]');
  var ROOT = js ? js.getAttribute("src").split("wiki.js")[0] : "/";
  var FAMS = "units|factions|regions|settlements|buildings|goods|traits|ancillaries|reforms|religions|cultures|sizes|revolts|mercenaries|tags";
  var RE = new RegExp("(^|/)(" + FAMS + ")/([^/#?]+)\\.(md|html)(#([^?]*))?$");
  var KIND = { regions: "Region", settlements: "Settlement", buildings: "Building", goods: "Trade good", traits: "Trait",
    ancillaries: "Retinue", reforms: "Reform", religions: "Belief", cultures: "Culture", sizes: "Settlement size",
    revolts: "Revolt", mercenaries: "Mercenary pool", tags: "Region tag" };
  var data = {}, loading = {};
  function load(kind){
    if (data[kind] || loading[kind]) return loading[kind] || Promise.resolve(data[kind]);
    var file = kind === "units" ? "units/compare.json" : kind === "factions" ? "factions/preview.json" : "previews/" + kind + ".json";
    loading[kind] = fetch(ROOT + file).then(function(r){ return r.ok ? r.json() : {}; })
      .catch(function(){ return {}; }).then(function(d){ data[kind] = d; return d; });
    return loading[kind];
  }
  function esc(t){ return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  function num(v){ return typeof v === "number" ? v.toLocaleString("en-US") : v; }
  function rowsHtml(rows){
    return rows && rows.length ? "<table>" + rows.map(function(s){ return "<tr><th>" + esc(s[0]) + "</th><td>" + esc(num(s[1])) + "</td></tr>"; }).join("") + "</table>" : "";
  }
  var tip = document.createElement("div");
  tip.className = "hov";
  tip.hidden = true;
  document.body.appendChild(tip);

  function unitHtml(slug, d){
    var stats = [["Men", d.men], ["Attack", d.attack], ["Charge", d.charge], ["Defence", d.def], ["Morale", d.morale],
      ["Hit points", d.hp], ["Range", d.range], ["Cost", d.cost != null ? num(d.cost) + " dn" : null], ["Upkeep", d.upkeep != null ? num(d.upkeep) + " dn" : null]]
      .filter(function(s){ return s[1] != null && s[1] !== ""; });
    return '<div class="hov-h"><img src="' + ROOT + 'cards/' + slug + '.png" alt="" width="35" height="48" onerror="this.remove()">'
      + '<div><b>' + esc(d.n) + '</b><small>' + esc([d.cls, d.cat, d.merc ? "mercenary" : ""].filter(Boolean).join(" · ")) + '</small></div></div>'
      + rowsHtml(stats) + (d.abil && d.abil.length ? '<p>' + esc(d.abil.join(" · ")) + "</p>" : "");
  }
  function factionHtml(tok, d){
    return '<div class="hov-h">' + (d.e ? '<img src="' + ROOT + 'symbols/' + tok + '.png" alt="" width="44" height="44">' : "")
      + '<div><b>' + esc(d.n) + (d.r ? ' <span class="rm-tag">(R)</span>' : "") + "</b><small>" + esc(d.c || "") + "</small></div></div>"
      + rowsHtml([["Difficulty", d.d], ["Settlements", d.s], ["Faction units", d.u]].filter(function(s){ return s[1] != null; }));
  }
  function pageHtml(kind, d){
    // A map is shown across the card; an icon or card sits beside the title.
    var map = d.i && /maps\//.test(d.i), icon = d.i && !map;
    return '<div class="hov-h">' + (icon ? '<img src="' + ROOT + d.i + '" alt="" class="hov-ic" onerror="this.remove()">' : "")
      + "<div><b>" + esc(d.t) + "</b><small>" + esc([KIND[kind], d.k].filter(Boolean).join(" · ")) + "</small></div></div>"
      + (map ? '<img src="' + ROOT + d.i + '" alt="" class="hov-map" onerror="this.remove()">' : "")
      + (d.p ? "<p>" + esc(d.p) + "</p>" : "") + rowsHtml(d.r);
  }
  var current = null, timer = null;
  function place(e){
    var x = e.clientX + 16, y = e.clientY + 16, w = tip.offsetWidth, h = tip.offsetHeight;
    if (x + w > innerWidth - 8) x = e.clientX - w - 12;
    if (y + h > innerHeight - 8) y = e.clientY - h - 12;
    tip.style.left = Math.max(8, x) + "px"; tip.style.top = Math.max(8, y) + "px";
  }
  document.addEventListener("mouseover", function(e){
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || a === current || a.closest("nav, .top, .hov")) return;
    var m = RE.exec(a.getAttribute("href"));
    if (!m || (m[2] === "factions" && m[3] === "non-playable")) return;
    var kind = m[2], page = decodeURIComponent(m[3]), anchor = m[6] ? decodeURIComponent(m[6]) : "";
    current = a;
    clearTimeout(timer);
    timer = setTimeout(function(){
      load(kind).then(function(d){
        if (current !== a || !d) return;
        var html = "";
        if (kind === "units") { if (d[page]) html = unitHtml(page, d[page]); }
        else if (kind === "factions") { if (d[page]) html = factionHtml(page, d[page]); }
        else { var v = (anchor && d[page + "#" + anchor]) || d[page]; if (v) html = pageHtml(kind, v); }
        if (!html) return;
        tip.innerHTML = html;
        tip.hidden = false;
        place(e);
      });
    }, 250);
  });
  document.addEventListener("mousemove", function(e){ if (!tip.hidden) place(e); });
  document.addEventListener("mouseout", function(e){
    if (!current) return;
    var to = e.relatedTarget;
    if (to && current.contains(to)) return;
    current = null; clearTimeout(timer); tip.hidden = true;
  });
})();
