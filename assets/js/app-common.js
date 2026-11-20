/* NOA Labs · utilidades compartidas por las apps demo */
window.NL = (function(){
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const ars = n => "$" + Math.round(n).toLocaleString("es-AR");
  const nf = (n, k = 1) => Number(n).toLocaleString("es-AR", {minimumFractionDigits:k, maximumFractionDigits:k});
  const fmtD = d => d.toLocaleDateString("es-AR", {day:"2-digit", month:"2-digit", year:"numeric"});
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const pill = (st, txt) => `<span class="pill ${st}">${esc(txt)}</span>`;
  function toast(msg){ const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2800); }
  function flash(el){ if (!el) return; el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 800); }

  /* ventana modal con formulario: fields = [{id,label,type,options,value,min}] */
  function form(title, fields, submitLabel, onSubmit){
    const bg = document.createElement("div"); bg.className = "modal-bg";
    bg.innerHTML = `<form class="modal" novalidate><h2>${esc(title)}</h2>${fields.map(f => `<label class="f" for="mf-${f.id}">${esc(f.label)}${
      f.type === "select" ? `<select id="mf-${f.id}">${f.options.map(o => `<option value="${esc(o.v)}" ${o.v == f.value ? "selected" : ""}>${esc(o.t)}</option>`).join("")}</select>`
      : `<input id="mf-${f.id}" type="${f.type || "text"}" value="${esc(f.value ?? "")}" ${f.min != null ? `min="${f.min}"` : ""} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ""}>`}</label>`).join("")}
      <p class="err" id="mf-err" aria-live="polite"></p><div class="row"><button type="button" class="b g" data-x>Cancelar</button><button type="submit" class="b o">${esc(submitLabel)}</button></div></form>`;
    document.body.appendChild(bg);
    const close = () => bg.remove();
    bg.addEventListener("click", e => { if (e.target === bg || e.target.hasAttribute("data-x")) close(); });
    document.addEventListener("keydown", function k(e){ if (e.key === "Escape"){ close(); document.removeEventListener("keydown", k); } });
    const frm = bg.querySelector("form"); const first = frm.querySelector("input,select"); first && first.focus();
    frm.addEventListener("input", () => bg.querySelector("#mf-err").textContent = "");
    frm.addEventListener("submit", e => {
      e.preventDefault();
      const vals = Object.fromEntries(fields.map(f => [f.id, bg.querySelector("#mf-" + f.id).value.trim()]));
      const err = onSubmit(vals);
      if (err) bg.querySelector("#mf-err").textContent = err; else close();
    });
  }

  /* gráfico de líneas */
  const COLORS = ["#E8772E","#0E1830","#2E8FD0","#24946A"];
  function line(series, {labels, w = 640, h = 230, lim = 0, warn = 0, unit = "", min0 = true, fmt = v => v} = {}){
    const pad = {l:44, r:14, t:16, b:26};
    const all = series.flat().concat(lim ? [lim * 1.12] : []);
    let max = Math.max(...all) * 1.08, min = min0 ? 0 : Math.min(...all) * .92;
    const X = i => pad.l + i / (labels.length - 1) * (w - pad.l - pad.r), Y = v => pad.t + (1 - (v - min) / (max - min)) * (h - pad.t - pad.b);
    let g = ""; const ticks = 5;
    for (let k = 0; k <= ticks; k++){ const v = min + (max - min) * k / ticks; g += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#EDF0F4"/><text x="${pad.l - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="10" fill="#8A93A4">${fmt(v)}</text>`; }
    const every = Math.ceil(labels.length / 12);
    labels.forEach((m, i) => { if (i % every === 0 || i === labels.length - 1) g += `<text x="${X(i)}" y="${h - 8}" text-anchor="middle" font-size="10" fill="#8A93A4">${m}</text>`; });
    if (lim){
      g += `<rect x="${pad.l}" y="${pad.t}" width="${w - pad.l - pad.r}" height="${Math.max(0, Y(lim) - pad.t)}" fill="rgba(229,83,61,.06)"/>`;
      g += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(lim)}" y2="${Y(lim)}" stroke="#E5533D" stroke-dasharray="5 5" stroke-width="1.5"/><text x="${w - pad.r}" y="${Y(lim) - 5}" text-anchor="end" font-size="10.5" fill="#C2412D">LÍMITE ${nf(lim)} ${unit}</text>`;
    }
    if (warn){ g += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(warn)}" y2="${Y(warn)}" stroke="#E0A21B" stroke-dasharray="3 5" stroke-width="1.2"/>${w > 500 ? `<text x="${w - pad.r}" y="${Y(warn) - 5}" text-anchor="end" font-size="10.5" fill="#B0800F">ALERTA ${nf(warn)}</text>` : ""}`; }
    series.forEach((s, j) => {
      const pts = s.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
      if (j === 0 && series.length === 1) g += `<polygon points="${X(0)},${Y(min)} ${pts} ${X(s.length - 1)},${Y(min)}" fill="rgba(232,119,46,.12)"/>`;
      g += `<polyline points="${pts}" fill="none" stroke="${COLORS[j]}" stroke-width="${j ? 1.8 : 2.6}" stroke-linejoin="round"/>`;
      g += `<circle cx="${X(s.length - 1)}" cy="${Y(s[s.length - 1])}" r="${j ? 3 : 4.5}" fill="${COLORS[j]}"/>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img">${g}</svg>`;
  }
  /* barras: data = [{l, a, b?}] apiladas (a abajo, b arriba) */
  function bars(data, {w = 560, h = 200, colors = ["#0E1830","#E8772E"], fmt = v => v} = {}){
    const pad = {l:44, r:8, t:12, b:26};
    const max = Math.max(...data.map(d => d.a + (d.b || 0))) * 1.12;
    const bw = (w - pad.l - pad.r) / data.length, Y = v => pad.t + (1 - v / max) * (h - pad.t - pad.b);
    let g = "";
    for (let k = 0; k <= 4; k++){ const v = max * k / 4; g += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#EDF0F4"/><text x="${pad.l - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="10" fill="#8A93A4">${fmt(v)}</text>`; }
    data.forEach((d, i) => {
      const x = pad.l + i * bw + bw * .2, bwi = bw * .6;
      g += `<rect x="${x}" y="${Y(d.a)}" width="${bwi}" height="${Y(0) - Y(d.a)}" rx="3" fill="${d.hi ? "#E8772E" : colors[0]}"/>`;
      if (d.b) g += `<rect x="${x}" y="${Y(d.a + d.b)}" width="${bwi}" height="${Y(d.a) - Y(d.a + d.b)}" rx="3" fill="${colors[1]}"/>`;
      g += `<text x="${x + bwi / 2}" y="${h - 8}" text-anchor="middle" font-size="10.5" fill="#8A93A4">${esc(d.l)}</text>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img">${g}</svg>`;
  }

  /* enrutador de vistas por #hash, con barra lateral y menú móvil */
  function router(views, labels, render, start){
    const side = $$(".side .nav"), mnav = $(".mnav");
    if (mnav) mnav.innerHTML = Object.keys(labels).map(k => `<button type="button" data-v="${k}">${labels[k]}</button>`).join("");
    const state = {v:start, arg:null};
    function go(v, arg, push = true){
      state.v = v; state.arg = arg;
      const key = views[v] && views[v].parent || v;
      $$(".side .nav, .mnav button").forEach(b => b.classList.toggle("act", b.dataset.v === key));
      if (push && labels[v]) history.replaceState(null, "", "#" + v);
      render(v, arg); window.scrollTo({top:0});
    }
    $$(".side .nav, .mnav button").forEach(b => b.addEventListener("click", () => go(b.dataset.v)));
    window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (labels[h] && h !== state.v) go(h, null, false); });
    const h = location.hash.slice(1);
    go(labels[h] ? h : start, null, false);
    return go;
  }

  /* simulador de WhatsApp */
  function whatsapp(root, {name, av, sub = "Cuenta de empresa", start = [22, 47]}){
    root.innerHTML = `<div class="wa"><div class="wa-head"><div class="wa-av">${esc(av)}</div><div><b>${esc(name)}</b><small>${esc(sub)}</small></div></div>
      <div class="wa-chat" aria-live="polite"></div><div class="wa-opts"></div>
      <form class="wa-input"><input aria-label="Escribí un mensaje" placeholder="Escribí como si fueras un cliente" autocomplete="off"><button aria-label="Enviar">➤</button></form></div>`;
    const box = $(".wa-chat", root), opts = $(".wa-opts", root), frm = $(".wa-input", root), inp = $("input", frm);
    let t = start[0] * 60 + start[1]; let onText = null;
    const clock = () => `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
    function say(text, who){
      const d = document.createElement("div"); d.className = "msg " + who; d.textContent = text;
      if (who !== "sys"){ const ts = document.createElement("span"); ts.className = "ts"; ts.innerHTML = clock() + (who === "me" ? "<b>✓✓</b>" : ""); d.appendChild(ts); }
      box.appendChild(d); box.scrollTop = box.scrollHeight;
    }
    function bot(text, delay = 750){ return new Promise(r => { const d = document.createElement("div"); d.className = "msg biz typing"; d.textContent = "escribiendo…"; box.appendChild(d); box.scrollTop = box.scrollHeight; setTimeout(() => { d.remove(); t++; say(text, "biz"); r(); }, delay); }); }
    function options(list, handler){
      opts.innerHTML = list.length ? `<p>Tocá un mensaje o escribí el tuyo</p>` : "";
      list.forEach(o => { const b = document.createElement("button"); b.type = "button"; b.className = "opt"; b.textContent = o.label; if (o.disabled) b.setAttribute("aria-disabled", "true");
        b.onclick = () => { if (o.disabled) return; say(o.label, "me"); handler(o); }; opts.appendChild(b); });
    }
    frm.addEventListener("submit", e => { e.preventDefault(); const v = inp.value.trim(); if (!v) return; inp.value = ""; say(v, "me"); onText && onText(v); });
    return {say, bot, options, onText: fn => onText = fn, clear: () => box.innerHTML = ""};
  }
  /* reloj de la demo: arranca en una hora fija y avanza un poco con cada acción, para que todo sea coherente */
  let clk = 18 * 60 + 55;
  const setClock = (h, m) => clk = h * 60 + m;
  const now = () => { clk += 1 + Math.floor(Math.random() * 3); return `${String(Math.floor(clk / 60) % 24).padStart(2, "0")}:${String(clk % 60).padStart(2, "0")}`; };
  const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return {$, $$, esc, ars, nf, fmtD, addDays, pill, toast, flash, form, line, bars, router, whatsapp, norm, now, setClock};
})();
