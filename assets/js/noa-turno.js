/* NOA Turno · demo funcional (servicios: taller mecánico) */
(function(){
  NL.setClock(9, 5);
  const {$, $$, esc, ars, nf, fmtD, addDays, pill, toast, flash, form, line, bars, router, whatsapp, norm} = NL;
  const TODAY = new Date(2026, 10, 20);
  const HOURS = ["08:30","09:30","10:30","11:30","14:00","15:00","16:00","17:00"];
  const SERV = [
    {id:"aceite", n:"Cambio de aceite y filtros", p:58000, min:60},
    {id:"service", n:"Service completo", p:145000, min:180},
    {id:"frenos", n:"Frenos (pastillas y discos)", p:92000, min:120},
    {id:"alin", n:"Alineación y balanceo", p:35000, min:60},
    {id:"diag", n:"Diagnóstico con escáner", p:25000, min:45}
  ];
  const CLI = [
    {id:1, n:"Marcela Ríos", t:"387 •••-2231"}, {id:2, n:"Diego Torres", t:"387 •••-8810"}, {id:3, n:"Lucía Paz", t:"387 •••-4402"},
    {id:4, n:"Ramiro Cruz", t:"387 •••-1190"}, {id:5, n:"Transportes Güemes", t:"387 •••-7745"}, {id:6, n:"Sofía Medina", t:"387 •••-3308"}
  ];
  const VEH = [
    {pat:"AE 482 KM", m:"Toyota Corolla 2019", cli:1, km:61200, lastKm:50300, lastD:addDays(TODAY, -190), every:10000},
    {pat:"AF 120 RT", m:"VW Amarok 2021", cli:2, km:79800, lastKm:70100, lastD:addDays(TODAY, -150), every:10000},
    {pat:"AB 931 PL", m:"Renault Clio 2016", cli:3, km:118400, lastKm:111000, lastD:addDays(TODAY, -215), every:10000},
    {pat:"AD 667 SS", m:"Ford Ranger 2020", cli:4, km:54100, lastKm:50000, lastD:addDays(TODAY, -60), every:10000},
    {pat:"AG 004 TG", m:"Mercedes Sprinter 2022", cli:5, km:96200, lastKm:85900, lastD:addDays(TODAY, -95), every:10000},
    {pat:"AC 210 HM", m:"Fiat Cronos 2023", cli:6, km:21800, lastKm:20000, lastD:addDays(TODAY, -40), every:10000}
  ];
  const dueSt = v => { const pct = (v.km - v.lastKm) / v.every, days = (TODAY - v.lastD) / 864e5; return pct >= 1 || days >= 180 ? "crit" : pct >= .85 || days >= 150 ? "warn" : "ok"; };
  // turnos: día 0 = hoy, 1 = mañana, 2 = pasado
  let tid = 700;
  const T = [];
  const addT = (day, h, cli, pat, sv, st = "Confirmado", src = "WhatsApp") => T.push({id:tid++, day, h, cli, pat, sv, st, src, rem:false});
  addT(0,"08:30",4,"AD 667 SS","frenos","Terminado","Teléfono"); addT(0,"10:30",6,"AC 210 HM","diag","Terminado","WhatsApp"); addT(0,"14:00",5,"AG 004 TG","service","En taller","WhatsApp"); addT(0,"16:00",2,"AF 120 RT","alin","Confirmado","Instagram");
  addT(1,"08:30",1,"AE 482 KM","aceite","Confirmado","WhatsApp"); addT(1,"11:30",3,"AB 931 PL","frenos","Confirmado","WhatsApp"); addT(1,"15:00",4,"AD 667 SS","alin","Confirmado","Mostrador");
  addT(2,"09:30",5,"AG 004 TG","diag","Confirmado","WhatsApp");
  const LOG = [{h:"09:00", txt:"Recordatorio de turno enviado a Diego Torres (hoy 16:00)"}, {h:"08:00", txt:"Recordatorio de turno enviado a Transportes Güemes (hoy 14:00)"}];
  const dayName = d => d === 0 ? "Hoy" : d === 1 ? "Mañana" : "Pasado mañana";
  const sv = id => SERV.find(s => s.id === id), cli = id => CLI.find(c => c.id === id), veh = p => VEH.find(v => v.pat === p);
  const stPill = st => pill(st === "Terminado" ? "ok" : st === "En taller" ? "warn" : st === "Ausente" ? "crit" : "na", st.toUpperCase());
  let day = 1, newId = null;

  const pendingRem = () => {
    const a = T.filter(t => t.day === 1 && t.st === "Confirmado" && !t.rem).map(t => ({k:"t" + t.id, type:"Turno de mañana", who:cli(t.cli).n, txt:`Hola ${cli(t.cli).n.split(" ")[0]} 👋 Te recordamos tu turno de mañana a las ${t.h} para ${sv(t.sv).n.toLowerCase()} (${t.pat}). Respondé 1 para confirmar o 2 para cambiarlo.`, t}));
    const b = VEH.filter(v => dueSt(v) !== "ok" && !v.rem).map(v => ({k:"v" + v.pat, type:"Le toca service", who:cli(v.cli).n, txt:`Hola ${cli(v.cli).n.split(" ")[0]}, a tu ${v.m.split(" ").slice(0, 2).join(" ")} le toca el service (${(v.km - v.lastKm).toLocaleString("es-AR")} km desde el último). ¿Te reservo un turno esta semana? 🔧`, v}));
    return a.concat(b);
  };
  function badge(){ const n = pendingRem().length; $("#badge-rec").textContent = n || ""; }

  const V = {};
  V.agenda = () => {
    const list = T.filter(t => t.day === day), free = HOURS.filter(h => !list.find(t => t.h === h));
    const income = list.reduce((s, t) => s + sv(t.sv).p, 0);
    return `<div class="vh"><div><h1>Agenda</h1><p>${dayName(day)} · ${fmtD(addDays(TODAY, day))} · tocá un horario libre para dar un turno</p></div>
      <div class="seg" role="group" aria-label="Elegir día">${[0,1,2].map(d => `<button type="button" data-day="${d}" class="${d === day ? "act" : ""}">${dayName(d)}</button>`).join("")}</div></div>
    <div class="kpis">
      <div class="kpi"><div class="l">Turnos</div><div class="v" id="k-t">${list.length}</div><div class="s">de ${HOURS.length} horarios</div></div>
      <div class="kpi"><div class="l">Libres</div><div class="v">${free.length}</div><div class="s">${free.slice(0, 3).join(" · ") || "agenda llena"}</div></div>
      <div class="kpi"><div class="l">Facturación estimada</div><div class="v">${ars(income)}</div><div class="s">según servicios</div></div>
      <div class="kpi"><div class="l">Dados por WhatsApp</div><div class="v">${list.filter(t => t.src === "WhatsApp").length}</div><div class="s">sin atender el teléfono</div></div>
    </div>
    <div class="card"><h3>Horarios</h3><div class="slots">${HOURS.map(h => { const t = list.find(x => x.h === h);
      return t ? `<button type="button" class="slot taken ${t.st === "Terminado" ? "done" : ""} ${t.id === newId ? "new" : ""}" data-t="${t.id}"><b>${h}</b>${esc(cli(t.cli).n)}<small>${esc(sv(t.sv).n)} · ${t.pat}</small><small>${t.st} · ${t.src}</small></button>`
      : `<button type="button" class="slot free" data-free="${h}"><b>${h}</b>Libre · dar turno</button>`; }).join("")}</div></div>
    <div class="card tscroll"><h3>Detalle del día</h3>${list.length ? `<table><thead><tr><th>Hora</th><th>Cliente</th><th>Vehículo</th><th>Servicio</th><th>Origen</th><th>Estado</th><th></th></tr></thead><tbody>
      ${[...list].sort((a, b) => a.h.localeCompare(b.h)).map(t => `<tr><td class="num">${t.h}</td><td>${esc(cli(t.cli).n)}</td><td class="num">${t.pat}</td><td>${esc(sv(t.sv).n)}</td><td>${t.src}</td><td>${stPill(t.st)}</td><td><button class="b g s" data-t="${t.id}">Gestionar</button></td></tr>`).join("")}</tbody></table>` : `<p class="empty">No hay turnos este día.</p>`}</div>`;
  };
  V.clientes = () => `<div class="vh"><div><h1>Clientes</h1><p>${CLI.length} clientes</p></div><button class="b o" data-new-cli>+ Nuevo cliente</button></div>
    <div class="card tscroll"><table><thead><tr><th>Cliente</th><th>Teléfono</th><th>Vehículos</th><th>Próximo turno</th></tr></thead><tbody>
    ${CLI.map(c => { const nx = T.filter(t => t.cli === c.id && t.st === "Confirmado").sort((a, b) => a.day - b.day || a.h.localeCompare(b.h))[0];
      return `<tr><td>${esc(c.n)}</td><td class="num">${c.t}</td><td>${VEH.filter(v => v.cli === c.id).map(v => `<button class="lnk" data-veh="${v.pat}">${v.pat}</button>`).join(" ") || "—"}</td><td>${nx ? `${dayName(nx.day)} ${nx.h}` : `<span class="sub">sin turno</span>`}</td></tr>`; }).join("")}
    </tbody></table></div>`;
  V.recordatorios = () => { const pend = pendingRem();
    return `<div class="vh"><div><h1>Recordatorios</h1><p>Los mensajes salen solos por WhatsApp. Acá ves cuáles están listos y cuáles ya se enviaron.</p></div>${pend.length ? `<button class="b o" data-send-all>Enviar todos (${pend.length})</button>` : ""}</div>
    <div class="card"><h3>Listos para enviar <span>${pend.length}</span></h3>${pend.length ? pend.map(r => `<div class="alert ${r.type.startsWith("Turno") ? "w" : ""}" style="margin-bottom:8px"><span><b>${r.type} · ${esc(r.who)}</b><br><span class="sub">${esc(r.txt)}</span></span><button class="b s" data-send="${r.k}">Enviar</button></div>`).join("") : `<p class="empty">No hay recordatorios pendientes. Todo enviado ✓</p>`}</div>
    <div class="card"><h3>Enviados hoy</h3><table><tbody>${LOG.map(l => `<tr><td class="num">${l.h}</td><td>${esc(l.txt)}</td><td>${pill("ok","ENVIADO ✓✓")}</td></tr>`).join("")}</tbody></table></div>`; };
  V.vehiculos = () => `<div class="vh"><div><h1>Vehículos</h1><p>Service cada 10.000 km o 6 meses, lo que pase primero</p></div></div>
    <div class="card tscroll"><table><thead><tr><th>Patente</th><th>Vehículo</th><th>Cliente</th><th>Km actual</th><th>Desde el service</th><th>Avance</th><th>Estado</th></tr></thead><tbody>
    ${VEH.map(v => { const st = dueSt(v), pct = Math.min(100, (v.km - v.lastKm) / v.every * 100), col = {crit:"#E5533D", warn:"#E0A21B", ok:"#24946A"}[st];
      return `<tr class="click" data-veh="${v.pat}"><td class="num">${v.pat}</td><td>${esc(v.m)}</td><td>${esc(cli(v.cli).n)}</td><td class="num">${v.km.toLocaleString("es-AR")}</td><td class="num">${(v.km - v.lastKm).toLocaleString("es-AR")} km · ${Math.round((TODAY - v.lastD) / 864e5)} días</td><td><div class="bar"><i style="width:${pct}%;background:${col}"></i></div></td><td>${pill(st, st === "crit" ? "LE TOCA" : st === "warn" ? "PRÓXIMO" : "AL DÍA")}</td></tr>`; }).join("")}
    </tbody></table></div>`;
  V.vehiculo = pat => { const v = veh(pat), ts = T.filter(t => t.pat === pat);
    return `<div class="crumb"><button data-go="vehiculos">Vehículos</button> / ${pat}</div><div class="vh"><div><h1>${pat} · ${esc(v.m)}</h1><p>${esc(cli(v.cli).n)} · ${v.km.toLocaleString("es-AR")} km</p></div><button class="b o" data-book-veh="${pat}">+ Dar turno</button></div>
    <div class="g2b"><div class="card"><h3>Ficha</h3><div class="kv"><span>Cliente</span><span>${esc(cli(v.cli).n)}</span><span>Teléfono</span><span>${cli(v.cli).t}</span><span>Último service</span><span>${fmtD(v.lastD)} · ${v.lastKm.toLocaleString("es-AR")} km</span><span>Próximo service</span><span>${(v.lastKm + v.every).toLocaleString("es-AR")} km</span><span>Estado</span><span>${pill(dueSt(v), dueSt(v) === "crit" ? "LE TOCA" : dueSt(v) === "warn" ? "PRÓXIMO" : "AL DÍA")}</span></div></div>
    <div class="card"><h3>Turnos</h3>${ts.length ? `<table><tbody>${ts.map(t => `<tr><td>${dayName(t.day)} ${t.h}</td><td>${esc(sv(t.sv).n)}</td><td>${stPill(t.st)}</td></tr>`).join("")}</tbody></table>` : `<p class="empty">Sin turnos agendados.</p>`}</div></div>`; };
  V.reportes = () => `<div class="vh"><div><h1>Reportes</h1><p>Últimas 8 semanas · desde que los turnos y recordatorios son automáticos</p></div></div>
    <div class="kpis"><div class="kpi"><div class="l">Ausencias antes</div><div class="v">18 %</div><div class="s">de los turnos</div></div><div class="kpi"><div class="l">Ausencias ahora</div><div class="v" style="color:var(--ok)">6 %</div><div class="s">con recordatorio</div></div><div class="kpi"><div class="l">Clientes que volvieron</div><div class="v">23</div><div class="s">por aviso de service</div></div><div class="kpi"><div class="l">Turnos por WhatsApp</div><div class="v">71 %</div><div class="s">sin llamadas</div></div></div>
    <div class="g2"><div class="card"><h3>Turnos por semana</h3>${bars([["S1",22,2],["S2",24,3],["S3",21,1],["S4",27,4],["S5",29,5],["S6",31,6],["S7",30,7],["S8",34,8]].map(([l, a, b]) => ({l, a, b})), {w:620})}<div class="legend"><span><i style="background:#0E1830"></i>Turnos habituales</span><span><i style="background:#E8772E"></i>Clientes que volvieron por recordatorio</span></div></div>
    <div class="card"><h3>Servicios más pedidos</h3><table><tbody>${[["Cambio de aceite y filtros",64],["Alineación y balanceo",41],["Frenos (pastillas y discos)",28],["Service completo",22],["Diagnóstico con escáner",19]].map(([n, c]) => `<tr><td>${n}</td><td class="num">${c}</td><td style="width:40%"><div class="bar"><i style="width:${c / 64 * 100}%;background:#E8772E"></i></div></td></tr>`).join("")}</tbody></table></div></div>`;

  const view = $("#view");
  const LABELS = {agenda:"Agenda", clientes:"Clientes", recordatorios:"Recordatorios", vehiculos:"Vehículos", reportes:"Reportes"};
  V.vehiculo.parent = "vehiculos";
  let cur = {v:"agenda"};
  function render(v, arg){ cur = {v, arg}; view.innerHTML = V[v](arg); badge(); bind(); }
  const rerender = () => render(cur.v, cur.arg);
  const go = router(V, LABELS, render, "agenda");
  function book(h, d, preset = {}){
    const free = HOURS.filter(x => !T.find(t => t.day === d && t.h === x));
    form(`Nuevo turno · ${dayName(d)}`, [
      {id:"h", label:"Horario", type:"select", options:free.map(x => ({v:x, t:x})), value:h},
      {id:"c", label:"Cliente", type:"select", options:CLI.map(c => ({v:c.id, t:c.n})), value:preset.cli},
      {id:"p", label:"Vehículo", type:"select", options:VEH.map(v => ({v:v.pat, t:`${v.pat} · ${v.m}`})), value:preset.pat},
      {id:"s", label:"Servicio", type:"select", options:SERV.map(s => ({v:s.id, t:`${s.n} · ${ars(s.p)}`}))}
    ], "Agendar turno", v => { if (!v.h) return "No quedan horarios libres ese día"; T.push({id:tid, day:d, h:v.h, cli:+v.c, pat:v.p, sv:v.s, st:"Confirmado", src:"Mostrador", rem:false}); newId = tid++; day = d; toast(`Turno agendado: ${dayName(d)} ${v.h}`); go("agenda"); });
  }
  function bind(){
    $$("[data-go]", view).forEach(b => b.onclick = () => go(b.dataset.go));
    $$("[data-day]", view).forEach(b => b.onclick = () => { day = +b.dataset.day; render("agenda"); });
    $$("[data-free]", view).forEach(b => b.onclick = () => book(b.dataset.free, day));
    $$("[data-t]", view).forEach(b => b.onclick = () => { const t = T.find(x => x.id === +b.dataset.t);
      form(`${t.h} · ${cli(t.cli).n}`, [{id:"st", label:"Estado del turno", type:"select", options:["Confirmado","En taller","Terminado","Ausente","Cancelado"].map(v => ({v, t:v})), value:t.st}], "Guardar", v => { if (v.st === "Cancelado"){ T.splice(T.indexOf(t), 1); toast("Turno cancelado: el horario quedó libre"); } else { t.st = v.st; toast(`Turno actualizado: ${v.st}`); if (v.st === "Terminado") W.say(`Mensaje automático a ${cli(t.cli).n}: "¡Tu ${veh(t.pat).m.split(" ")[0]} ya está listo para retirar!"`, "sys"); } rerender(); }); });
    $$("[data-veh]", view).forEach(b => b.onclick = e => { e.stopPropagation(); go("vehiculo", b.dataset.veh); });
    $$("[data-book-veh]", view).forEach(b => b.onclick = () => { const v = veh(b.dataset.bookVeh); book(null, 1, {cli:v.cli, pat:v.pat}); });
    const send = r => { if (r.t) r.t.rem = true; if (r.v) r.v.rem = true; LOG.unshift({h:NL.now(), txt:`${r.type} · enviado a ${r.who}`}); };
    $$("[data-send]", view).forEach(b => b.onclick = () => { const r = pendingRem().find(x => x.k === b.dataset.send); send(r); toast(`Recordatorio enviado a ${r.who}`); rerender(); });
    $$("[data-send-all]", view).forEach(b => b.onclick = () => { const p = pendingRem(); p.forEach(send); toast(`${p.length} recordatorios enviados por WhatsApp`); rerender(); });
    $$("[data-new-cli]", view).forEach(b => b.onclick = () => form("Nuevo cliente", [{id:"n", label:"Nombre", placeholder:"Nombre y apellido o empresa"}, {id:"t", label:"Teléfono", placeholder:"387 …"}], "Guardar", v => { if (!v.n) return "Escribí el nombre del cliente"; CLI.push({id:CLI.length + 1, n:v.n, t:v.t || "—"}); toast("Cliente guardado"); rerender(); }));
  }

  /* simulador de WhatsApp */
  const W = whatsapp($("#wa"), {name:"Taller Ruta 9", av:"R9", start:[21, 15]});
  let pendingSv = "aceite";
  const svFrom = s => /(aceite|filtro)/.test(s) ? "aceite" : /(service)/.test(s) ? "service" : /(freno|pastilla)/.test(s) ? "frenos" : /(alinea|balance)/.test(s) ? "alin" : /(diagnos|escaner|luz|testigo)/.test(s) ? "diag" : null;
  function slotOpts(){ const free = HOURS.filter(h => !T.find(t => t.day === 1 && t.h === h));
    W.options(free.slice(0, 5).map(h => ({label:`Mañana a las ${h}`, h})), o => confirm(o.h)); }
  async function confirm(h){
    if (T.find(t => t.day === 1 && t.h === h)) return W.bot("Ese horario se acaba de ocupar 😅 Elegí otro de la lista.").then(slotOpts);
    T.push({id:tid, day:1, h, cli:6, pat:"AC 210 HM", sv:pendingSv, st:"Confirmado", src:"WhatsApp", rem:false}); newId = tid++; day = 1;
    go("agenda"); flash($("#k-t"));
    await W.bot(`Listo ✅ Te espero mañana a las ${h} para ${sv(pendingSv).n.toLowerCase()} (${ars(sv(pendingSv).p)}). Mañana temprano te mando un recordatorio.`);
    W.say("Turno agendado solo, sin llamadas", "sys"); base();
  }
  async function reply(text){
    const s = norm(text), wants = svFrom(s), m = s.match(/(\d{1,2})[:.]?(\d{2})?\s*(hs|h)?/);
    if (/(listo|termin|como va|estado)/.test(s)) return W.bot("Tu Cronos (AC 210 HM) está en revisión. Te aviso por acá apenas esté listo para retirar 🔧");
    if (/(cuanto|precio|sale|cuesta)/.test(s)){ const x = sv(wants || "alin"); pendingSv = x.id; await W.bot(`${x.n}: ${ars(x.p)}. Tarda aprox. ${x.min} minutos. ¿Querés que te dé un turno?`); return slotOpts(); }
    if (/(turno|reserv|agend|llevar|mañana)/.test(s) || wants){ if (wants) pendingSv = wants;
      if (m && HOURS.includes(m[1].padStart(2, "0") + ":" + (m[2] || "00"))) return confirm(m[1].padStart(2, "0") + ":" + (m[2] || "00"));
      const free = HOURS.filter(h => !T.find(t => t.day === 1 && t.h === h));
      await W.bot(`¡Dale! Para mañana tengo libre: ${free.join(", ")}. ¿Cuál te queda mejor?`); return slotOpts(); }
    if (/(hora|abren|horario)/.test(s)) return W.bot("Atendemos de lunes a viernes de 8:30 a 18 y sábados de 9 a 13.");
    if (/(hola|buenas)/.test(s)) return W.bot("¡Hola! Soy el asistente de Taller Ruta 9 🚗 Te doy turnos, precios y el estado de tu auto. ¿Qué necesitás?");
    toast("Consulta derivada al taller"); return W.bot("Esa te la responde un mecánico en un rato. ¿Querés que te reserve un turno mientras tanto?");
  }
  function base(){ W.options([{label:"Quiero turno para cambio de aceite"}, {label:"¿Cuánto sale una alineación?"}, {label:"¿Está listo mi auto?"}], o => reply(o.label)); }
  W.onText(v => reply(v));
  W.say("HOY", "sys"); W.say("¡Hola! Soy el asistente de Taller Ruta 9 🚗 Puedo darte turno, precios y el estado de tu auto.", "biz"); base();
})();
