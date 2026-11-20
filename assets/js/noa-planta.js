/* NOA Planta · demo funcional (mantenimiento industrial) */
(function(){
  const root = document, view = document.getElementById("view");
  const TODAY = new Date(2026, 10, 20);
  const MONTHS = ["Dic","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov"];
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const fmtD = d => d.toLocaleDateString("es-AR", {day:"2-digit", month:"2-digit", year:"numeric"});
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const nf = (n, k = 1) => n.toLocaleString("es-AR", {minimumFractionDigits:k, maximumFractionDigits:k});
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

  const AREAS = [
    {id:"REC", name:"Recepción y molienda", x:20, y:20, w:300, h:200},
    {id:"PRO", name:"Proceso", x:340, y:20, w:400, h:200},
    {id:"FRI", name:"Cámaras de frío", x:760, y:20, w:220, h:200},
    {id:"SER", name:"Servicios (agua, aire, vapor)", x:20, y:240, w:300, h:200},
    {id:"EMP", name:"Envasado y despacho", x:340, y:240, w:640, h:200}
  ];
  // tag, nombre, área, tipo, marca/modelo, kW, rpm, criticidad, límite vib (mm/s), base, tendencia final, frecuencia PM (días), días desde último PM, horas
  const RAW = [
    ["REC-CV-01","Cinta transportadora principal","REC","Cinta transportadora","SEW · motorreductor KA97",30,1480,"A",7.1,2.1,2.3,30,12,18420],
    ["REC-TR-01","Trituradora de mandíbulas","REC","Trituradora","Metso · C80",55,1470,"A",7.1,3.2,3.4,60,41,9850],
    ["REC-BOM-01","Bomba de alimentación","REC","Bomba centrífuga","KSB · Etanorm 65-200",22,2950,"B",4.5,1.6,1.7,90,35,21100],
    ["PRO-AG-01","Agitador tanque de reacción 1","PRO","Agitador","SEW · R87 + motor WEG",15,1460,"A",4.5,1.4,1.5,60,22,16300],
    ["PRO-AG-02","Agitador tanque de reacción 2","PRO","Agitador","SEW · R87 + motor WEG",15,1460,"A",4.5,1.5,1.6,60,64,16120],
    ["PRO-BOM-02","Bomba de proceso","PRO","Bomba centrífuga","KSB · MegaCPK 80-250",37,2960,"A",4.5,1.9,5.2,90,80,24870],
    ["PRO-BOM-03","Bomba dosificadora de reactivo","PRO","Bomba dosificadora","Grundfos · DME 150",4,1450,"B",4.5,0.9,1.0,180,70,8800],
    ["PRO-FIL-01","Bomba de filtro prensa","PRO","Bomba de diafragma","WEG · W22 11 kW",11,1465,"B",4.5,2.0,2.2,90,15,12650],
    ["PRO-VEN-01","Ventilador de extracción de gases","PRO","Ventilador","WEG · W22 45 kW",45,980,"A",7.1,3.0,6.0,60,58,20410],
    ["FRI-CMP-01","Compresor de frío cámara 1","FRI","Compresor de tornillo","Bitzer · CSH6553",37,2950,"A",4.5,1.8,1.9,90,40,15200],
    ["FRI-CMP-02","Compresor de frío cámara 2","FRI","Compresor de tornillo","Bitzer · CSH6553",37,2950,"A",4.5,1.7,3.9,90,95,15890],
    ["FRI-EVA-01","Evaporador cámara 1","FRI","Ventilador evaporador","Güntner · GACC",3,1400,"B",4.5,1.1,1.2,60,30,14100],
    ["SER-CMP-03","Compresor de aire","SER","Compresor de tornillo","Atlas Copco · GA45",45,2960,"A",4.5,2.2,2.4,30,26,26300],
    ["SER-BOM-04","Bomba de agua de servicio","SER","Bomba centrífuga","Grundfos · NB 65-200",18.5,2950,"B",4.5,1.5,1.6,90,20,19750],
    ["SER-CAL-01","Ventilador de caldera de vapor","SER","Ventilador","WEG · W22 7,5 kW",7.5,2900,"A",4.5,1.3,1.4,30,33,11900],
    ["EMP-MOT-01","Envasadora automática","EMP","Envasadora","Siemens · 1LE1 7,5 kW",7.5,1450,"B",4.5,1.2,1.3,60,18,7300],
    ["EMP-CV-02","Cinta de despacho","EMP","Cinta transportadora","SEW · KA67",5.5,1440,"C",7.1,1.4,1.5,90,50,9600],
    ["EMP-AE-01","Autoelevador eléctrico","EMP","Autoelevador","Toyota · 8FBE18",9,0,"C",0,0,0,180,120,3120]
  ];
  const POINTS = ["LA H","LA V","LOA H"];
  const EQ = RAW.map(r => {
    const [tag,name,area,type,brand,kw,rpm,crit,lim,base,end,freq,since,hours] = r;
    const vib = lim ? POINTS.map((p, j) => MONTHS.map((m, i) => {
      const k = i / 11, f = j === 0 ? 1 : j === 1 ? .78 : .86;
      const trend = base + (end - base) * Math.pow(k, 2.2);
      return Math.max(.3, +(trend * f + (rnd() - .5) * .25 * base).toFixed(2));
    })) : null;
    return {tag,name,area,type,brand,kw,rpm,crit,lim,freq,hours,last:addDays(TODAY, -since),vib,state:tag === "PRO-AG-02" ? "En mantenimiento" : "Operativo"};
  });
  const vibNow = e => e.vib ? Math.max(...e.vib.map(s => s[11])) : 0;
  const vibSt = e => !e.lim ? "na" : vibNow(e) >= e.lim ? "crit" : vibNow(e) >= e.lim * .8 ? "warn" : "ok";
  const nextPM = e => addDays(e.last, e.freq);
  const pmSt = e => { const d = (nextPM(e) - TODAY) / 864e5; return d < 0 ? "crit" : d <= 7 ? "warn" : "ok"; };
  const byTag = t => EQ.find(e => e.tag === t);
  const areaName = id => AREAS.find(a => a.id === id).name;

  const REP = [
    {c:"RP-0012", d:"Rodamiento SKF 6312-2Z/C3", s:2, m:4, u:"Pañol A · E2", eq:["PRO-BOM-02","REC-BOM-01"]},
    {c:"RP-0013", d:"Rodamiento SKF 6309-2Z/C3", s:6, m:4, u:"Pañol A · E2", eq:["PRO-BOM-02","SER-BOM-04"]},
    {c:"RP-0021", d:"Sello mecánico 45 mm", s:1, m:2, u:"Pañol A · E4", eq:["PRO-BOM-02"]},
    {c:"RP-0030", d:"Acople elástico Rex Omega E20", s:3, m:2, u:"Pañol B · E1", eq:["PRO-VEN-01","REC-CV-01"]},
    {c:"RP-0034", d:"Correa en V SPB 2500", s:8, m:6, u:"Pañol B · E3", eq:["PRO-VEN-01"]},
    {c:"RP-0041", d:"Filtro de aceite compresor tornillo", s:3, m:4, u:"Pañol A · E6", eq:["FRI-CMP-01","FRI-CMP-02"]},
    {c:"RP-0042", d:"Aceite POE 32 · bidón 20 L", s:5, m:3, u:"Depósito lubricantes", eq:["FRI-CMP-01","FRI-CMP-02"]},
    {c:"RP-0050", d:"Kit separador aire/aceite GA45", s:1, m:1, u:"Pañol A · E6", eq:["SER-CMP-03"]},
    {c:"RP-0057", d:"Retén 60×80×10", s:12, m:6, u:"Pañol A · E1", eq:["PRO-AG-01","PRO-AG-02"]},
    {c:"RP-0063", d:"Grasa SKF LGHP 2 · 1 kg", s:7, m:4, u:"Depósito lubricantes", eq:["PRO-AG-01","PRO-AG-02","REC-CV-01"]},
    {c:"RP-0071", d:"Placa filtrante filtro prensa", s:14, m:20, u:"Depósito proceso", eq:["PRO-FIL-01"]},
    {c:"RP-0080", d:"Mandíbula fija trituradora", s:1, m:1, u:"Patio repuestos mayores", eq:["REC-TR-01"]}
  ];
  const OT = [
    {n:1042, t:"PRO-AG-02", ty:"Preventiva", d:"Cambio de retenes y lubricación del reductor", st:"En curso", f:addDays(TODAY,-1)},
    {n:1041, t:"FRI-CMP-02", ty:"Preventiva", d:"Cambio de filtro y análisis de aceite", st:"Abierta", f:addDays(TODAY,-3)},
    {n:1039, t:"REC-CV-01", ty:"Correctiva", d:"Alineación de banda y cambio de rodillo de retorno", st:"Cerrada", f:addDays(TODAY,-6)},
    {n:1037, t:"SER-CMP-03", ty:"Preventiva", d:"Service 4.000 h", st:"Cerrada", f:addDays(TODAY,-26)},
    {n:1035, t:"PRO-BOM-02", ty:"Predictiva", d:"Medición de vibraciones: tendencia en lado acople", st:"Cerrada", f:addDays(TODAY,-31)},
    {n:1031, t:"REC-TR-01", ty:"Correctiva", d:"Reapriete de bulones de bancada", st:"Cerrada", f:addDays(TODAY,-41)}
  ];
  const PEDIDOS = [];
  let otN = 1043, current = "dash", eqFilter = {q:"", area:""}, vibSel = null, otFilter = "";

  /* ---- gráficos ---- */
  const COLORS = ["#E8772E","#0E1830","#2E8FD0"];
  function line(series, {w = 640, h = 230, lim = 0, labels = MONTHS, names = POINTS, small = false} = {}){
    const pad = {l:38, r:12, t:14, b:small ? 18 : 26};
    const all = series.flat().concat(lim ? [lim * 1.15] : []);
    const max = Math.max(...all) * 1.08, min = 0;
    const X = i => pad.l + i / (labels.length - 1) * (w - pad.l - pad.r), Y = v => pad.t + (1 - (v - min) / (max - min)) * (h - pad.t - pad.b);
    let g = "";
    const step = max > 6 ? 2 : 1;
    for (let v = 0; v <= max; v += step) g += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#EDF0F4"/><text x="${pad.l - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="10" fill="#8A93A4">${v}</text>`;
    if (!small) labels.forEach((m, i) => g += `<text x="${X(i)}" y="${h - 8}" text-anchor="middle" font-size="10" fill="#8A93A4">${m}</text>`);
    if (lim) {
      g += `<rect x="${pad.l}" y="${pad.t}" width="${w - pad.l - pad.r}" height="${Y(lim) - pad.t}" fill="rgba(229,83,61,.06)"/>`;
      g += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(lim)}" y2="${Y(lim)}" stroke="#E5533D" stroke-dasharray="5 5" stroke-width="1.5"/><text x="${w - pad.r}" y="${Y(lim) - 5}" text-anchor="end" font-size="10.5" fill="#C2412D">LÍMITE ${nf(lim)} mm/s</text>`;
      g += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(lim * .8)}" y2="${Y(lim * .8)}" stroke="#E0A21B" stroke-dasharray="3 5" stroke-width="1.2"/>${(small || w < 500) ? "" : `<text x="${w - pad.r}" y="${Y(lim * .8) - 5}" text-anchor="end" font-size="10.5" fill="#B0800F">ALERTA ${nf(lim * .8)}</text>`}`;
    }
    series.forEach((s, j) => {
      const pts = s.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
      g += `<polyline points="${pts}" fill="none" stroke="${COLORS[j]}" stroke-width="${j ? 1.8 : 2.6}" stroke-linejoin="round"/>`;
      const lv = s[s.length - 1]; g += `<circle cx="${X(s.length - 1)}" cy="${Y(lv)}" r="${j ? 3 : 4.5}" fill="${COLORS[j]}"/>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Tendencia de vibración">${g}</svg>`;
  }
  function bars(data){
    const w = 560, h = 190, pad = {l:28, r:8, t:10, b:24}, max = 16;
    const bw = (w - pad.l - pad.r) / data.length;
    const Y = v => pad.t + (1 - v / max) * (h - pad.t - pad.b);
    let g = "";
    [0,4,8,12,16].forEach(v => g += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#EDF0F4"/><text x="${pad.l - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="10" fill="#8A93A4">${v}</text>`);
    data.forEach((d, i) => {
      const x = pad.l + i * bw + bw * .2, bwi = bw * .6;
      g += `<rect x="${x}" y="${Y(d.p)}" width="${bwi}" height="${Y(0) - Y(d.p)}" rx="3" fill="#0E1830"/>`;
      g += `<rect x="${x}" y="${Y(d.p + d.c)}" width="${bwi}" height="${Y(d.p) - Y(d.p + d.c)}" rx="3" fill="#E8772E"/>`;
      g += `<text x="${x + bwi / 2}" y="${h - 8}" text-anchor="middle" font-size="10.5" fill="#8A93A4">${d.m}</text>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Órdenes de trabajo por mes">${g}</svg>`;
  }
  const pill = (st, txt) => `<span class="pill ${st === "na" ? "ok" : st}">${txt}</span>`;
  const vibPill = e => { const s = vibSt(e); return s === "na" ? `<span class="pill ok">SIN MEDICIÓN</span>` : pill(s, s === "crit" ? "CRÍTICO" : s === "warn" ? "ALERTA" : "NORMAL"); };
  const toast = NL.toast;
  function badges(){
    const v = EQ.filter(e => vibSt(e) === "crit" || vibSt(e) === "warn").length, r = REP.filter(x => x.s < x.m && !PEDIDOS.find(p => p.c === x.c)).length;
    root.querySelector("#np-badge-vib").textContent = v || ""; root.querySelector("#np-badge-rep").textContent = r || "";
  }
  function newOT(tag, ty, d){ const o = {n:otN++, t:tag, ty, d, st:"Abierta", f:TODAY}; OT.unshift(o); toast(`Orden de trabajo #${o.n} creada para ${tag}`); return o; }

  /* ---- vistas ---- */
  const V = {};
  V.dash = () => {
    const al = EQ.filter(e => ["crit","warn"].includes(vibSt(e))).sort((a, b) => vibNow(b) / b.lim - vibNow(a) / a.lim);
    const open = OT.filter(o => o.st !== "Cerrada").length, overdue = EQ.filter(e => pmSt(e) === "crit").length;
    const next = [...EQ].sort((a, b) => nextPM(a) - nextPM(b)).slice(0, 6);
    const low = REP.filter(r => r.s < r.m);
    return `<div class="vh"><div><h1>Dashboard</h1><p>Planta Demo · hoy ${fmtD(TODAY)}</p></div><div class="legend"><span><i style="background:#0E1830"></i>Preventivas</span><span><i style="background:#E8772E"></i>Correctivas</span></div></div>
    <div class="kpis">
      <div class="kpi"><div class="l">Equipos operativos</div><div class="v">${EQ.filter(e => e.state === "Operativo").length}/${EQ.length}</div><div class="s">1 en mantenimiento</div></div>
      <div class="kpi"><div class="l">Disponibilidad · mes</div><div class="v">97,4 %</div><div class="s">objetivo 96 %</div></div>
      <div class="kpi"><div class="l">OT abiertas</div><div class="v">${open}</div><div class="s">${OT.filter(o => o.st === "En curso").length} en curso</div></div>
      <div class="kpi"><div class="l">Preventivos vencidos</div><div class="v" style="color:${overdue ? "#C2412D" : "inherit"}">${overdue}</div><div class="s">de ${EQ.length} planes</div></div>
    </div>
    <div class="g2">
      <div class="card"><h3>Alertas de vibración <span>${al.length} equipos</span></h3>
        <table><thead><tr><th>Equipo</th><th>Actual</th><th>Límite</th><th>Estado</th></tr></thead><tbody>
        ${al.map(e => `<tr class="click" data-vib="${e.tag}"><td><span class="tag">${e.tag}</span><br><small style="color:#687386">${esc(e.name)}</small></td><td class="num">${nf(vibNow(e), 2)} mm/s</td><td class="num">${nf(e.lim)}</td><td>${vibPill(e)}</td></tr>`).join("")}
        </tbody></table><p style="font-size:12.5px;color:#687386;margin-top:8px">Tocá un equipo para ver su gráfico.</p></div>
      <div class="card"><h3>Órdenes de trabajo por mes</h3>${bars([{m:"Jun",p:9,c:5},{m:"Jul",p:11,c:4},{m:"Ago",p:10,c:3},{m:"Sep",p:12,c:3},{m:"Oct",p:12,c:2},{m:"Nov",p:8,c:2}])}
        <p style="font-size:12.5px;color:#687386">Las correctivas bajan a medida que crecen las preventivas.</p></div>
    </div>
    <div class="g2b">
      <div class="card"><h3>Próximos preventivos</h3><table><tbody>
        ${next.map(e => `<tr class="click" data-eq="${e.tag}"><td><span class="tag">${e.tag}</span></td><td>${esc(e.name)}</td><td class="num">${fmtD(nextPM(e))}</td><td>${pill(pmSt(e), pmSt(e) === "crit" ? "VENCIDO" : pmSt(e) === "warn" ? "ESTA SEMANA" : "OK")}</td></tr>`).join("")}
      </tbody></table></div>
      <div class="card"><h3>Repuestos bajo mínimo <span>${low.length}</span></h3><table><tbody>
        ${low.map(r => `<tr class="click" data-rep="1"><td class="num">${r.c}</td><td>${esc(r.d)}</td><td class="num">${r.s}/${r.m}</td></tr>`).join("")}
      </tbody></table></div>
    </div>`;
  };
  V.mapa = () => {
    const col = {ok:"#24946A", warn:"#E0A21B", crit:"#E5533D", na:"#8A93A4"};
    let g = `<rect x="0" y="0" width="1000" height="460" fill="#FBFCFD"/>`;
    g += `<path d="M320 120 H340 M740 120 H760 M170 220 V240 M540 220 V240" stroke="#B8C1CF" stroke-width="6" stroke-linecap="round"/>`;
    AREAS.forEach(a => {
      const n = EQ.filter(e => e.area === a.id), bad = n.filter(e => ["crit","warn"].includes(vibSt(e))).length;
      g += `<g class="area" data-area="${a.id}" style="cursor:pointer"><rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" rx="10" fill="#fff" stroke="${bad ? "#E0A21B" : "#D4DAE3"}" stroke-width="${bad ? 2 : 1.5}"/>
        <text x="${a.x + 14}" y="${a.y + 24}" font-size="13" font-weight="600" fill="#18212F" font-family="Archivo, sans-serif">${a.name}</text>
        <text x="${a.x + 14}" y="${a.y + 42}" font-size="11" fill="#687386">${a.id} · ${n.length} equipos${bad ? ` · ${bad} con alerta` : ""}</text></g>`;
      n.forEach((e, i) => {
        const cols = Math.max(2, Math.floor((a.w - 30) / 92)), cx = a.x + 40 + (i % cols) * 92, cy = a.y + 86 + Math.floor(i / cols) * 58, s = vibSt(e);
        g += `<g class="dot" data-eq="${e.tag}" style="cursor:pointer">${s === "crit" ? `<circle cx="${cx}" cy="${cy}" r="17" fill="rgba(229,83,61,.18)"><animate attributeName="r" values="12;19;12" dur="1.8s" repeatCount="indefinite"/></circle>` : ""}
          <circle cx="${cx}" cy="${cy}" r="10" fill="${col[s]}" stroke="#fff" stroke-width="2.5"/>
          <text x="${cx}" y="${cy + 26}" text-anchor="middle" font-size="10" fill="#18212F">${e.tag.slice(4)}</text></g>`;
      });
    });
    return `<div class="vh"><div><h1>Mapa de planta</h1><p>Tocá un equipo para abrir su ficha, o un sector para ver sus equipos.</p></div>
      <div class="legend"><span><i style="background:#24946A"></i>Normal</span><span><i style="background:#E0A21B"></i>Alerta</span><span><i style="background:#E5533D"></i>Crítico</span><span><i style="background:#8A93A4"></i>Sin medición</span></div></div>
      <div class="card" style="padding:8px;overflow-x:auto"><svg viewBox="0 0 1000 460" width="100%" style="min-width:640px" role="img" aria-label="Mapa de la planta con el estado de cada equipo">${g}</svg></div>`;
  };
  V.equipos = () => {
    const q = eqFilter.q.toLowerCase();
    const list = EQ.filter(e => (!eqFilter.area || e.area === eqFilter.area) && (!q || (e.tag + e.name + e.type + e.brand).toLowerCase().includes(q)));
    return `<div class="vh"><div><h1>Equipos</h1><p>${list.length} de ${EQ.length} equipos${eqFilter.area ? " · " + areaName(eqFilter.area) : ""}</p></div>
      <div class="tools"><input id="np-q" placeholder="Buscar tag, nombre o marca" value="${esc(eqFilter.q)}" aria-label="Buscar equipo">
      <select id="np-area" aria-label="Filtrar por sector"><option value="">Todos los sectores</option>${AREAS.map(a => `<option value="${a.id}" ${a.id === eqFilter.area ? "selected" : ""}>${a.name}</option>`).join("")}</select></div></div>
      <div class="card" style="overflow-x:auto"><table><thead><tr><th>Tag</th><th>Equipo</th><th>Sector</th><th>Crit.</th><th>Vibración</th><th>Próximo PM</th><th>Estado</th></tr></thead><tbody>
      ${list.map(e => `<tr class="click" data-eq="${e.tag}"><td><span class="tag">${e.tag}</span></td><td>${esc(e.name)}<br><small style="color:#687386">${esc(e.type)}</small></td><td>${e.area}</td><td class="num">${e.crit}</td><td>${vibPill(e)}</td><td class="num">${fmtD(nextPM(e))}</td><td>${e.state === "Operativo" ? pill("ok","OPERATIVO") : pill("warn","EN MANT.")}</td></tr>`).join("") || `<tr><td colspan="7" class="empty">No hay equipos con ese filtro.</td></tr>`}
      </tbody></table></div>`;
  };
  V.ficha = tag => {
    const e = byTag(tag), reps = REP.filter(r => r.eq.includes(tag)), ots = OT.filter(o => o.t === tag);
    return `<div class="crumb"><button data-go="equipos">Equipos</button> / ${tag}</div>
    <div class="vh"><div><h1>${tag} · ${esc(e.name)}</h1><p>${areaName(e.area)} · criticidad ${e.crit}</p></div>
      <div class="tools"><button class="b" data-newot="${tag}">+ Nueva orden de trabajo</button>${e.vib ? `<button class="b g" data-vib="${tag}">Ver vibraciones</button>` : ""}</div></div>
    <div class="g2">
      <div class="card"><h3>Ficha técnica</h3><div class="kv">
        <span>Tipo</span><span>${esc(e.type)}</span><span>Marca / modelo</span><span>${esc(e.brand)}</span>
        <span>Potencia</span><span>${nf(e.kw, e.kw % 1 ? 1 : 0)} kW</span><span>Velocidad</span><span>${e.rpm ? e.rpm.toLocaleString("es-AR") + " rpm" : "—"}</span>
        <span>Horas de marcha</span><span>${e.hours.toLocaleString("es-AR")} h</span><span>Estado</span><span>${e.state}</span>
        <span>Límite de vibración</span><span>${e.lim ? nf(e.lim) + " mm/s (propio del equipo)" : "No aplica"}</span>
        <span>Último preventivo</span><span>${fmtD(e.last)}</span><span>Próximo preventivo</span><span>${fmtD(nextPM(e))} ${pill(pmSt(e), pmSt(e) === "crit" ? "VENCIDO" : pmSt(e) === "warn" ? "PRÓXIMO" : "OK")}</span>
        <span>Frecuencia</span><span>cada ${e.freq} días</span></div></div>
      <div class="card"><h3>Vibración · últimos 12 meses ${vibPill(e)}</h3>${e.vib ? line(e.vib, {w:420, h:200, lim:e.lim, small:false}) : `<p class="empty">Este equipo no lleva medición de vibraciones.</p>`}</div>
    </div>
    <div class="g2b">
      <div class="card"><h3>Repuestos asociados</h3><table><tbody>${reps.map(r => `<tr><td class="num">${r.c}</td><td>${esc(r.d)}</td><td class="num">${r.s} u.</td><td>${r.s < r.m ? pill("crit","BAJO MÍN.") : pill("ok","OK")}</td></tr>`).join("") || `<tr><td class="empty">Sin repuestos cargados.</td></tr>`}</tbody></table></div>
      <div class="card"><h3>Historial de órdenes</h3><table><tbody>${ots.map(o => `<tr><td class="num">#${o.n}</td><td>${o.ty}<br><small style="color:#687386">${esc(o.d)}</small></td><td class="num">${fmtD(o.f)}</td><td>${pill(o.st === "Cerrada" ? "ok" : "warn", o.st.toUpperCase())}</td></tr>`).join("") || `<tr><td class="empty">Sin órdenes registradas.</td></tr>`}</tbody></table></div>
    </div>`;
  };
  V.vib = () => {
    const meas = EQ.filter(e => e.vib).sort((a, b) => vibNow(b) / b.lim - vibNow(a) / a.lim);
    const e = byTag(vibSel) || meas[0]; vibSel = e.tag;
    const s0 = e.vib[0], ch = (s0[11] - s0[8]) / s0[8] * 100;
    const diag = vibSt(e) === "ok" ? "Comportamiento estable. Sin acciones adicionales." :
      `Tendencia creciente en ${POINTS[0]}: ${ch > 0 ? "+" : ""}${nf(ch, 0)} % en los últimos 3 meses${vibSt(e) === "crit" ? ", ya por encima del límite propio" : ", acercándose al límite propio"}. Patrón compatible con desgaste de rodamiento o desalineación. Recomendado: inspección, análisis espectral y planificar el cambio en la próxima parada.`;
    return `<div class="vh"><div><h1>Vibraciones</h1><p>Velocidad RMS en mm/s · 3 puntos de medición por equipo · límite propio por equipo</p></div>
      <div class="tools"><select id="np-vsel" aria-label="Elegir equipo">${meas.map(x => `<option value="${x.tag}" ${x.tag === e.tag ? "selected" : ""}>${x.tag} · ${esc(x.name)}${vibSt(x) === "crit" ? " · CRÍTICO" : vibSt(x) === "warn" ? " · ALERTA" : ""}</option>`).join("")}</select></div></div>
    <div class="card"><h3><span>${e.tag} · ${esc(e.name)}</span>${vibPill(e)}</h3>
      <div class="legend" style="margin-bottom:6px">${POINTS.map((p, j) => `<span><i style="background:${COLORS[j]}"></i>${p}</span>`).join("")}</div>
      ${line(e.vib, {w:820, h:280, lim:e.lim})}</div>
    <div class="g2">
      <div class="card"><h3>Última medición · ${MONTHS[11]} 2026</h3><table><thead><tr><th>Punto</th><th>Actual</th><th>Mes anterior</th><th>Variación</th></tr></thead><tbody>
        ${e.vib.map((s, j) => { const d = (s[11] - s[10]) / s[10] * 100; return `<tr><td>${POINTS[j]}</td><td class="num">${nf(s[11], 2)}</td><td class="num">${nf(s[10], 2)}</td><td class="num" style="color:${d > 8 ? "#C2412D" : "#687386"}">${d > 0 ? "+" : ""}${nf(d, 0)} %</td></tr>`; }).join("")}
      </tbody></table></div>
      <div class="card"><h3>Diagnóstico</h3><p style="font-size:14px;line-height:1.5">${diag}</p>
        ${vibSt(e) !== "ok" ? `<div style="margin-top:12px"><button class="b" data-predot="${e.tag}">Generar orden predictiva</button></div>` : ""}</div>
    </div>`;
  };
  V.rep = () => `<div class="vh"><div><h1>Repuestos</h1><p>${REP.length} códigos · ${REP.filter(r => r.s < r.m).length} bajo mínimo</p></div></div>
    <div class="card" style="overflow-x:auto"><table><thead><tr><th>Código</th><th>Descripción</th><th>Stock</th><th>Mín.</th><th>Nivel</th><th>Ubicación</th><th>Equipos</th><th></th></tr></thead><tbody>
    ${REP.map(r => { const low = r.s < r.m, ped = PEDIDOS.find(p => p.c === r.c), pct = Math.min(100, r.s / (r.m * 2) * 100);
      return `<tr><td class="num">${r.c}</td><td>${esc(r.d)}</td><td class="num">${r.s}</td><td class="num">${r.m}</td><td><div class="bar"><i style="width:${Math.max(5, pct)}%;background:${low ? "var(--crit)" : "var(--ok)"}"></i></div></td><td>${esc(r.u)}</td><td>${r.eq.map(t => `<button class="lnk" data-eq="${t}">${t}</button>`).join(" ")}</td>
      <td>${low ? (ped ? pill("ok", "PEDIDO ✓") : `<button class="b g s" data-ped="${r.c}">Pedir</button>`) : ""}</td></tr>`; }).join("")}
    </tbody></table></div>
    ${PEDIDOS.length ? `<div class="card"><h3>Solicitudes de compra generadas</h3><table><tbody>${PEDIDOS.map(p => `<tr><td class="num">SC-${p.n}</td><td>${esc(p.d)}</td><td class="num">${p.q} u.</td><td>${pill("warn","PENDIENTE APROBACIÓN")}</td></tr>`).join("")}</tbody></table></div>` : ""}`;
  V.ot = () => {
    const list = OT.filter(o => !otFilter || o.st === otFilter);
    return `<div class="vh"><div><h1>Órdenes de trabajo</h1><p>${OT.filter(o => o.st !== "Cerrada").length} abiertas · ${OT.length} en total</p></div>
      <div class="tools"><select id="np-otf" aria-label="Filtrar por estado"><option value="">Todos los estados</option>${["Abierta","En curso","Cerrada"].map(s => `<option ${s === otFilter ? "selected" : ""}>${s}</option>`).join("")}</select></div></div>
    <div class="card" style="overflow-x:auto"><table><thead><tr><th>N.º</th><th>Equipo</th><th>Tipo</th><th>Trabajo</th><th>Fecha</th><th>Estado</th><th></th></tr></thead><tbody>
    ${list.map(o => `<tr><td class="num">#${o.n}</td><td><button class="lnk" data-eq="${o.t}">${o.t}</button></td><td>${o.ty}</td><td>${esc(o.d)}</td><td class="num">${fmtD(o.f)}</td><td>${pill(o.st === "Cerrada" ? "ok" : o.st === "En curso" ? "warn" : "crit", o.st.toUpperCase())}</td>
      <td>${o.st !== "Cerrada" ? `<button class="b g s" data-close="${o.n}">${o.st === "Abierta" ? "Iniciar" : "Cerrar"}</button>` : ""}</td></tr>`).join("")}
    </tbody></table></div>`;
  };

  /* ---- navegación ---- */
  const LABELS = {dash:"Dashboard", mapa:"Mapa de planta", equipos:"Equipos", vib:"Vibraciones", rep:"Repuestos", ot:"Órdenes de trabajo"};
  V.ficha.parent = "equipos";
  const render = (v, arg) => { current = v; view.innerHTML = v === "ficha" ? V.ficha(arg) : V[v](); badges(); bind(); };
  let go;
  function bind(){
    view.querySelectorAll("[data-eq]").forEach(el => el.onclick = ev => { ev.stopPropagation(); go("ficha", el.dataset.eq); });
    view.querySelectorAll("[data-vib]").forEach(el => el.onclick = () => { vibSel = el.dataset.vib; go("vib"); });
    view.querySelectorAll("[data-rep]").forEach(el => el.onclick = () => go("rep"));
    view.querySelectorAll("[data-go]").forEach(el => el.onclick = () => go(el.dataset.go));
    view.querySelectorAll(".area").forEach(el => el.onclick = () => { eqFilter = {q:"", area:el.dataset.area}; go("equipos"); });
    view.querySelectorAll("[data-newot]").forEach(el => el.onclick = () => { const t = el.dataset.newot, e = byTag(t); newOT(t, pmSt(e) === "ok" ? "Correctiva" : "Preventiva", pmSt(e) === "ok" ? "Revisión solicitada desde la ficha del equipo" : `Preventivo cada ${e.freq} días`); go("ficha", t); });
    view.querySelectorAll("[data-predot]").forEach(el => el.onclick = () => { const t = el.dataset.predot; newOT(t, "Predictiva", "Inspección por tendencia de vibración y análisis espectral"); el.disabled = true; el.textContent = "Orden creada ✓"; });
    view.querySelectorAll("[data-ped]").forEach(el => el.onclick = () => { const r = REP.find(x => x.c === el.dataset.ped); PEDIDOS.push({n:208 + PEDIDOS.length, c:r.c, d:r.d, q:r.m * 2 - r.s}); go("rep"); toast(`Solicitud de compra generada: ${r.d}`); });
    view.querySelectorAll("[data-close]").forEach(el => el.onclick = () => { const o = OT.find(x => x.n === +el.dataset.close); o.st = o.st === "Abierta" ? "En curso" : "Cerrada"; go("ot"); });
    const q = view.querySelector("#np-q"); if (q) q.oninput = () => { eqFilter.q = q.value; const pos = q.selectionStart; go("equipos"); const nq = view.querySelector("#np-q"); nq.focus(); nq.setSelectionRange(pos, pos); };
    const a = view.querySelector("#np-area"); if (a) a.onchange = () => { eqFilter.area = a.value; go("equipos"); };
    const vs = view.querySelector("#np-vsel"); if (vs) vs.onchange = () => { vibSel = vs.value; go("vib"); };
    const of = view.querySelector("#np-otf"); if (of) of.onchange = () => { otFilter = of.value; go("ot"); };
  }
  document.querySelectorAll(".side .nav, .mnav button").forEach(b => b.addEventListener("click", () => { if (b.dataset.v === "equipos") eqFilter = {q:"", area:""}; }));
  go = NL.router(V, LABELS, render, "dash");
})();
