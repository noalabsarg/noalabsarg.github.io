/* NOA Llave · demo funcional (alojamiento: complejo de cabañas + inmobiliaria con alquileres) */
(function(){
  NL.setClock(23, 18);
  const {$, $$, esc, ars, fmtD, addDays, pill, toast, form, bars, router, whatsapp, norm} = NL;
  const TODAY = new Date(2026, 10, 20);
  const DAYS = 14, DN = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const dl = d => { const x = addDays(TODAY, d); return `${DN[x.getDay()]} ${x.getDate()}`; };
  const we = d => [0, 6].includes(addDays(TODAY, d).getDay());
  const U = [
    {id:"alg", n:"Cabaña Algarrobo", cap:4, p:85000, pet:true},
    {id:"cei", n:"Cabaña Ceibo", cap:2, p:62000, pet:false},
    {id:"mol", n:"Cabaña Molle", cap:6, p:120000, pet:false},
    {id:"car", n:"Cabaña Cardón", cap:4, p:90000, pet:true},
    {id:"dep", n:"Depto. temporario Centro", cap:3, p:55000, pet:false}
  ];
  const un = id => U.find(u => u.id === id);
  let rid = 3100;
  const R = [];
  const addR = (u, from, n, who, pax, st, src) => R.push({id:rid++, u, from, n, who, pax, st, src, total:un(u).p * n});
  addR("alg", 1, 2, "Familia Pereyra", 4, "Seña pagada", "Booking"); addR("cei", -1, 3, "Paula y Diego", 2, "Check-in", "WhatsApp");
  addR("mol", 0, 3, "Grupo de Córdoba", 6, "Seña pagada", "WhatsApp"); addR("car", 4, 2, "Martina López", 3, "Seña pendiente", "Instagram");
  addR("dep", 2, 5, "Ing. Roberto Sanz", 1, "Seña pagada", "Directa"); addR("alg", 7, 3, "Familia Núñez", 4, "Seña pagada", "Booking");
  addR("cei", 8, 2, "Ana y Pablo", 2, "Seña pendiente", "WhatsApp"); addR("mol", 9, 4, "Viaje de egresados", 6, "Seña pagada", "WhatsApp");
  addR("dep", 9, 3, "Laura Méndez", 2, "Seña pagada", "Airbnb"); addR("car", 11, 2, "Familia Torres", 4, "Seña pagada", "WhatsApp");
  const busy = (u, from, n, skip) => R.some(r => r !== skip && r.u === u && r.st !== "Cancelada" && r.st !== "Finalizada" && from < r.from + r.n && r.from < from + n);
  const stCls = st => st === "Seña pendiente" ? "pend" : st === "Check-in" ? "in" : "";
  const stPill = st => pill(st === "Seña pendiente" ? "warn" : st === "Check-in" ? "ok" : st === "Finalizada" ? "na" : "ok", st.toUpperCase());
  // inmobiliaria
  const P = [
    {id:"P-21", t:"Departamento 2 ambientes", op:"Alquiler", z:"Centro", p:480000, m2:54, int:7, col:"#2E5A88"},
    {id:"P-22", t:"Casa 3 dormitorios con patio", op:"Venta", z:"Tres Cerritos", p:"USD 118.000", m2:160, int:4, col:"#8A5A2E"},
    {id:"P-23", t:"Monoambiente amoblado", op:"Alquiler", z:"Grand Bourg", p:350000, m2:32, int:11, col:"#2E7A6A"},
    {id:"P-24", t:"Local comercial a la calle", op:"Alquiler", z:"Microcentro", p:900000, m2:70, int:3, col:"#5A3E88"},
    {id:"P-25", t:"Terreno 600 m²", op:"Venta", z:"Vaqueros", p:"USD 42.000", m2:600, int:6, col:"#6A7A2E"},
    {id:"P-26", t:"Casa quinta con pileta", op:"Venta", z:"San Lorenzo", p:"USD 165.000", m2:240, int:5, col:"#883E3E"}
  ];
  const VIS = [{d:1, h:"10:00", p:"P-23", who:"Julieta R."}, {d:1, h:"17:30", p:"P-21", who:"Matías G."}, {d:3, h:"11:00", p:"P-26", who:"Familia Rivero"}];
  const K = [
    {who:"Carolina Díaz", p:"Depto. 3 amb. · Castañares", amt:520000, end:addDays(TODAY, 48), adj:addDays(TODAY, 11), st:"Pagado"},
    {who:"Estudio Jurídico Farfán", p:"Oficina · Centro", amt:610000, end:addDays(TODAY, 310), adj:addDays(TODAY, 72), st:"Pendiente"},
    {who:"Bruno Cabrera", p:"Monoambiente · Grand Bourg", amt:340000, end:addDays(TODAY, 21), adj:addDays(TODAY, 21), st:"Atrasado"},
    {who:"Natalia Ruiz", p:"Casa 2 dorm. · Limache", amt:450000, end:addDays(TODAY, 190), adj:addDays(TODAY, 4), st:"Pagado"},
    {who:"Kiosco La Esquina", p:"Local · Av. San Martín", amt:380000, end:addDays(TODAY, 95), adj:addDays(TODAY, 40), st:"Pendiente"}
  ];
  let newR = null, lastWA = null;

  function badge(){ $("#badge-res").textContent = R.filter(r => r.st === "Seña pendiente").length || ""; }
  const V = {};
  V.calendario = () => { const occ = R.filter(r => r.st !== "Cancelada" && r.from <= 0 && r.from + r.n > 0).length;
    const nights = R.filter(r => r.st !== "Cancelada").reduce((a, r) => a + Math.max(0, Math.min(r.from + r.n, DAYS) - Math.max(r.from, 0)), 0);
    let g = `<div class="hd"></div>` + Array.from({length:DAYS}, (_, d) => `<div class="hd ${we(d) ? "we" : ""}">${dl(d)}</div>`).join("");
    U.forEach(u => { g += `<div class="un">${esc(u.n)}<small>${u.cap} pers. · ${ars(u.p)}/noche</small></div>`;
      for (let d = 0; d < DAYS; d++){ const r = R.find(x => x.u === u.id && x.st !== "Cancelada" && x.st !== "Finalizada" && x.from <= d && d < x.from + x.n);
        if (r){ if (d === Math.max(r.from, 0)){ const span = Math.min(r.from + r.n, DAYS) - d; g += `<button class="r ${stCls(r.st)} ${r.id === newR ? "new" : ""}" style="grid-column:span ${span}" data-r="${r.id}" title="${esc(r.who)}">${esc(r.who)}</button>`; } }
        else g += `<button class="c" data-cell="${u.id}|${d}" aria-label="${u.n} libre el ${dl(d)}"></button>`; } });
    return `<div class="vh"><div><h1>Calendario</h1><p>Próximas dos semanas · tocá un día libre para cargar una reserva</p></div></div>
    <div class="kpis"><div class="kpi"><div class="l">Ocupadas hoy</div><div class="v">${occ} / ${U.length}</div><div class="s">unidades</div></div>
      <div class="kpi"><div class="l">Ocupación 14 días</div><div class="v">${Math.round(nights / (U.length * DAYS) * 100)} %</div><div class="s">${nights} noches vendidas</div></div>
      <div class="kpi"><div class="l">Señas pendientes</div><div class="v" style="color:var(--warn)">${R.filter(r => r.st === "Seña pendiente").length}</div><div class="s">se recuerdan solas</div></div>
      <div class="kpi"><div class="l">Reservas directas</div><div class="v">${Math.round(R.filter(r => ["WhatsApp", "Instagram", "Directa"].includes(r.src)).length / R.length * 100)} %</div><div class="s">sin comisión de plataformas</div></div></div>
    <div class="card tscroll"><h3>Ocupación <span class="legend"><span><i style="background:#0E1830"></i>Confirmada</span><span><i style="background:#E0A21B"></i>Seña pendiente</span><span><i style="background:#24946A"></i>Hospedados</span></span></h3>
    <div class="cal" style="grid-template-columns:170px repeat(${DAYS},1fr)">${g}</div></div>`; };
  V.reservas = () => `<div class="vh"><div><h1>Reservas</h1><p>De todos los canales en un solo lugar: WhatsApp, Instagram, Booking y Airbnb</p></div></div>
    <div class="card tscroll"><table><thead><tr><th>N°</th><th>Huésped</th><th>Unidad</th><th>Entrada</th><th>Noches</th><th>Pers.</th><th>Total</th><th>Seña 30 %</th><th>Canal</th><th>Estado</th><th></th></tr></thead><tbody>
    ${[...R].sort((a, b) => a.from - b.from).map(r => `<tr><td class="num">${r.id}</td><td>${esc(r.who)}</td><td>${esc(un(r.u).n)}</td><td class="num">${fmtD(addDays(TODAY, r.from))}</td><td class="num">${r.n}</td><td class="num">${r.pax}</td><td class="num">${ars(r.total)}</td><td class="num">${ars(r.total * .3)}</td><td>${r.src}</td><td>${stPill(r.st)}</td><td>${
      r.st === "Seña pendiente" ? `<button class="b o s" data-sena="${r.id}">Registrar seña</button>` : r.st === "Seña pagada" && r.from <= 0 ? `<button class="b s" data-in="${r.id}">Check-in</button>` : r.st === "Check-in" ? `<button class="b g s" data-out="${r.id}">Check-out</button>` : ""}</td></tr>`).join("")}</tbody></table></div>`;
  V.propiedades = () => `<div class="vh"><div><h1>Propiedades</h1><p>Inmobiliaria · las consultas de WhatsApp e Instagram se cargan solas como interesados</p></div><button class="b o" data-visit>+ Agendar visita</button></div>
    <div class="props">${P.map(p => `<div class="prop"><div class="ph" style="background:linear-gradient(135deg,${p.col},#0E1830)">${p.op.toUpperCase()} · ${p.id}</div><div class="bd"><b>${esc(p.t)}</b><span class="sub">${esc(p.z)} · ${p.m2} m²</span><span class="pr">${typeof p.p === "number" ? ars(p.p) + "/mes" : p.p}</span><span class="sub">${p.int} interesados · ${VIS.filter(v => v.p === p.id).length} visitas agendadas</span><div class="tools"><button class="b g s" data-visit="${p.id}">Agendar visita</button><button class="b g s" data-pub="${p.id}">Compartir ficha</button></div></div></div>`).join("")}</div>
    <div class="card tscroll"><h3>Visitas agendadas</h3><table><tbody>${[...VIS].sort((a, b) => a.d - b.d || a.h.localeCompare(b.h)).map(v => `<tr><td class="num">${dl(v.d)} ${v.h}</td><td>${esc(v.who)}</td><td>${esc(P.find(p => p.id === v.p).t)} · ${esc(P.find(p => p.id === v.p).z)}</td><td>${pill("ok", "RECORDATORIO PROGRAMADO")}</td></tr>`).join("")}</tbody></table></div>`;
  V.contratos = () => `<div class="vh"><div><h1>Alquileres</h1><p>Vencimientos, próximos ajustes y cobro del mes de cada contrato</p></div></div>
    <div class="card tscroll"><table><thead><tr><th>Inquilino</th><th>Propiedad</th><th>Alquiler</th><th>Próximo ajuste</th><th>Vence contrato</th><th>Noviembre</th><th></th></tr></thead><tbody>
    ${K.map((k, i) => { const dAdj = Math.round((k.adj - TODAY) / 864e5), dEnd = Math.round((k.end - TODAY) / 864e5);
      return `<tr><td>${esc(k.who)}</td><td>${esc(k.p)}</td><td class="num">${ars(k.amt)}</td><td class="num">${fmtD(k.adj)} ${dAdj <= 15 ? pill("warn", `EN ${dAdj} DÍAS`) : ""}</td><td class="num">${fmtD(k.end)} ${dEnd <= 60 ? pill("crit", "RENOVAR") : ""}</td><td>${pill(k.st === "Pagado" ? "ok" : k.st === "Atrasado" ? "crit" : "warn", k.st.toUpperCase())}</td><td class="tools">${k.st !== "Pagado" ? `<button class="b g s" data-krem="${i}">Recordar</button><button class="b o s" data-kpay="${i}">Cobrado</button>` : ""}</td></tr>`; }).join("")}</tbody></table></div>`;
  V.reportes = () => { const months = [["Jun", 38], ["Jul", 91], ["Ago", 64], ["Sep", 52], ["Oct", 58], ["Nov", 61], ["Dic", 74]];
    const src = ["WhatsApp", "Booking", "Instagram", "Airbnb", "Directa"].map(s => [s, R.filter(r => r.src === s).reduce((a, r) => a + r.total, 0)]);
    const tot = src.reduce((a, s) => a + s[1], 0);
    return `<div class="vh"><div><h1>Reportes</h1><p>Ocupación por temporada y de dónde vienen tus huéspedes</p></div></div>
    <div class="kpis"><div class="kpi"><div class="l">Facturación reservada</div><div class="v">${ars(tot)}</div><div class="s">próximas dos semanas</div></div><div class="kpi"><div class="l">Comisión ahorrada</div><div class="v" style="color:var(--ok)">${ars(src.filter(s => !["Booking", "Airbnb"].includes(s[0])).reduce((a, s) => a + s[1], 0) * .15)}</div><div class="s">por reservas directas (15 %)</div></div><div class="kpi"><div class="l">Estadía promedio</div><div class="v">${(R.reduce((a, r) => a + r.n, 0) / R.length).toFixed(1).replace(".", ",")}</div><div class="s">noches</div></div><div class="kpi"><div class="l">Respuesta por WhatsApp</div><div class="v">1 min</div><div class="s">a cualquier hora</div></div></div>
    <div class="g2"><div class="card"><h3>Ocupación por mes (%)</h3>${bars(months.map(([l, a]) => ({l, a, hi:l === "Jul"})), {w:620})}</div>
    <div class="card"><h3>Facturación por canal</h3><table><tbody>${src.map(([s, a]) => `<tr><td>${s}</td><td class="num">${ars(a)}</td><td style="width:40%"><div class="bar"><i style="width:${tot ? a / tot * 100 : 0}%;background:#E8772E"></i></div></td></tr>`).join("")}</tbody></table></div></div>`; };

  const view = $("#view");
  const LABELS = {calendario:"Calendario", reservas:"Reservas", propiedades:"Propiedades", contratos:"Alquileres", reportes:"Reportes"};
  let cur = {v:"calendario"};
  function render(v, arg){ cur = {v, arg}; view.innerHTML = V[v](arg); badge(); bind(); }
  const rerender = () => render(cur.v, cur.arg);
  const go = router(V, LABELS, render, "calendario");
  function bind(){
    $$("[data-cell]", view).forEach(b => b.onclick = () => { const [u, d] = b.dataset.cell.split("|"), x = un(u);
      form(`${x.n} · entrada ${dl(+d)}`, [{id:"w", label:"Huésped", placeholder:"Nombre y apellido"}, {id:"p", label:`Personas (máx. ${x.cap})`, type:"number", value:2, min:1}, {id:"n", label:"Noches", type:"number", value:2, min:1}], "Reservar y pedir seña",
        v => { const p = +v.p, n = +v.n; if (!v.w) return "Escribí el nombre del huésped"; if (!(p > 0)) return "Indicá cuántas personas"; if (p > x.cap) return `${x.n} es para ${x.cap} personas como máximo`; if (!(n > 0)) return "Indicá las noches"; if (busy(u, +d, n)) return "Se superpone con otra reserva: elegí menos noches";
          addR(u, +d, n, v.w, p, "Seña pendiente", "Directa"); newR = rid - 1; toast("Reserva cargada: le llegó el pedido de seña por WhatsApp"); rerender(); }); });
    $$("[data-r]", view).forEach(b => b.onclick = () => { const r = R.find(x => x.id === +b.dataset.r);
      form(`${r.who} · ${un(r.u).n}`, [{id:"st", label:`${fmtD(addDays(TODAY, r.from))} · ${r.n} noches · ${r.pax} pers. · ${ars(r.total)} · ${r.src}`, type:"select", options:["Seña pendiente", "Seña pagada", "Check-in", "Finalizada", "Cancelada"].map(v => ({v, t:v})), value:r.st}], "Guardar", v => { r.st = v.st; toast(v.st === "Cancelada" ? "Reserva cancelada: las noches quedaron libres" : `Reserva ${r.id}: ${v.st}`); rerender(); }); });
    $$("[data-sena]", view).forEach(b => b.onclick = () => { const r = R.find(x => x.id === +b.dataset.sena); r.st = "Seña pagada"; toast(`Seña de ${ars(r.total * .3)} registrada: reserva confirmada`); rerender(); });
    $$("[data-in]", view).forEach(b => b.onclick = () => { const r = R.find(x => x.id === +b.dataset.in); r.st = "Check-in"; toast(`${r.who} hizo check-in: le llegó la clave del wifi y las indicaciones`); rerender(); });
    $$("[data-out]", view).forEach(b => b.onclick = () => { const r = R.find(x => x.id === +b.dataset.out); r.st = "Finalizada"; toast(`Check-out de ${r.who}: se le pidió una reseña por WhatsApp`); rerender(); });
    $$("[data-visit]", view).forEach(b => b.onclick = () => form("Agendar visita", [{id:"p", label:"Propiedad", type:"select", options:P.map(p => ({v:p.id, t:`${p.id} · ${p.t} · ${p.z}`})), value:b.dataset.visit}, {id:"w", label:"Interesado", placeholder:"Nombre"}, {id:"d", label:"Día", type:"select", options:[1, 2, 3, 4, 5].map(d => ({v:d, t:dl(d)}))}, {id:"h", label:"Hora", type:"time", value:"11:00"}], "Agendar",
      v => { if (!v.w) return "Escribí el nombre del interesado"; if (VIS.some(x => x.d === +v.d && x.h === v.h)) return "Ya hay una visita a esa hora"; VIS.push({d:+v.d, h:v.h, p:v.p, who:v.w}); toast("Visita agendada: el interesado recibe la ubicación y un recordatorio"); rerender(); }));
    $$("[data-pub]", view).forEach(b => b.onclick = () => toast(`Ficha ${b.dataset.pub} lista para compartir por WhatsApp e Instagram`));
    $$("[data-krem]", view).forEach(b => b.onclick = () => toast(`Recordatorio de pago enviado a ${K[+b.dataset.krem].who}`));
    $$("[data-kpay]", view).forEach(b => b.onclick = () => { const k = K[+b.dataset.kpay]; k.st = "Pagado"; toast(`Alquiler de ${k.who} cobrado · recibo enviado por mail`); rerender(); });
  }

  /* simulador de WhatsApp: Carla busca cabaña para el fin de semana */
  const W = whatsapp($("#wa"), {name:"Cabañas Los Alisos", av:"LA", start:[23, 18]});
  const sat = [...Array(7).keys()].find(d => addDays(TODAY, d).getDay() === 6);
  async function weekend(pax){
    const opts = U.filter(u => u.cap >= pax && !busy(u.id, sat, 2));
    if (!opts.length) return W.bot(`Para el finde ya estamos completos para ${pax} personas 😕 ¿Te sirve el fin de semana siguiente?`);
    await W.bot(`¡Sí! Para el sábado ${addDays(TODAY, sat).getDate()} y domingo ${addDays(TODAY, sat + 1).getDate()} (2 noches) tengo:\n${opts.map(u => `• ${u.n}, hasta ${u.cap} personas: ${ars(u.p * 2)}`).join("\n")}\n¿Cuál te reservo?`);
    W.options(opts.map(u => ({label:`Reservame la ${u.n.replace("Cabaña ", "")}`, u})), async o => {
      if (busy(o.u.id, sat, 2)) return W.bot("Justo se acaba de ocupar 😅 Elegí otra opción.");
      addR(o.u.id, sat, 2, "Carla Gómez", pax, "Seña pendiente", "WhatsApp"); newR = rid - 1; lastWA = R[R.length - 1]; go("calendario");
      await W.bot(`Te la reservo por 24 horas ✅ Para confirmarla, la seña es del 30 %: ${ars(lastWA.total * .3)} al alias LOSALISOS.DEMO. Mandame el comprobante por acá.`);
      W.say("La reserva apareció sola en el calendario, como seña pendiente", "sys");
      W.options([{label:"Listo, ya pagué la seña"}, {label:"¿A qué hora es el check-in?"}], x => reply(x.label)); });
  }
  async function reply(text){
    const s = norm(text), p = s.match(/(\d+)\s*(personas|pers|adultos)?/);
    if (/(pague|transferi|comprobante|sena)/.test(s) && lastWA && lastWA.st === "Seña pendiente"){ lastWA.st = "Seña pagada"; go("reservas");
      await W.bot("¡Recibido! Tu reserva está confirmada 🎉 El día anterior te mando la ubicación y las indicaciones para llegar."); W.say("Seña registrada y reserva confirmada sola", "sys"); return base(); }
    if (/(lugar|disponib|finde|fin de semana|sabado|reserv)/.test(s)) return weekend(p && +p[1] < 15 ? +p[1] : 4);
    if (/(precio|cuanto|sale|tarifa|noche)/.test(s)) return W.bot("Tarifas por noche:\n" + U.map(u => `• ${u.n} (${u.cap} pers.): ${ars(u.p)}`).join("\n") + "\nIncluye desayuno regional y cochera.");
    if (/(check|hora de entrada|ingreso|salida)/.test(s)) return W.bot("El check-in es desde las 14 h y el check-out hasta las 10 h. Si llegás más tarde, avisame y te dejo la llave en el buzón con código 🔑");
    if (/(mascota|perro|gato)/.test(s)) return W.bot(`¡Sí! Aceptamos mascotas en ${U.filter(u => u.pet).map(u => u.n).join(" y ")} 🐶`);
    if (/(donde|ubicacion|llego|direccion)/.test(s)) return W.bot("Estamos en San Lorenzo, a 15 minutos de Salta Capital. Cuando confirmes te mando la ubicación exacta 📍");
    if (/(hola|buenas)/.test(s)) return W.bot("¡Hola! Soy el asistente de Cabañas Los Alisos 🌄 Te paso disponibilidad, precios y te reservo en el momento.");
    toast("Consulta derivada a la dueña"); return W.bot("Esa te la responde Mariela, la dueña, en un rato 🙌");
  }
  function base(){ W.options([{label:"¿Tienen lugar para 4 personas este finde?"}, {label:"¿Cuánto sale la noche?"}, {label:"¿Aceptan mascotas?"}], o => reply(o.label)); }
  W.onText(v => reply(v));
  W.say("HOY", "sys"); W.say("¡Hola! Soy el asistente de Cabañas Los Alisos 🌄 Te paso disponibilidad y precios, y te reservo en el momento.", "biz"); base();
})();
