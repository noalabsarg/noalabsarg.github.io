/* NOA Club · demo funcional (deporte: gimnasio con musculación, funcional y boxeo) */
(function(){
  NL.setClock(18, 58);
  const {$, $$, esc, ars, fmtD, addDays, pill, toast, flash, form, bars, router, whatsapp, norm} = NL;
  const TODAY = new Date(2026, 10, 20);
  const PLANES = [
    {id:"libre", n:"Pase libre", p:42000, d:"Musculación y todas las clases"},
    {id:"musc", n:"Musculación", p:34000, d:"Sala de musculación, lunes a sábado"},
    {id:"func", n:"Funcional 3x", p:30000, d:"3 clases de funcional por semana"},
    {id:"box", n:"Boxeo", p:32000, d:"Boxeo recreativo, 3 veces por semana"}
  ];
  const pl = id => PLANES.find(p => p.id === id);
  let sid = 1040;
  const S = [];
  const addS = (n, dni, plan, venc, tel, asis) => S.push({id:sid++, n, dni, plan, venc:addDays(TODAY, venc), tel, asis, alta:addDays(TODAY, -40 - asis * 3), rem:false});
  addS("Sofía Medina", "40123456", "func", -4, "387 •••-3308", 31);
  addS("Martín Gallardo", "38456789", "libre", 12, "387 •••-1290", 58);
  addS("Valentina Ruiz", "42345678", "box", 2, "387 •••-7741", 22);
  addS("Nicolás Cardozo", "39876543", "musc", 18, "387 •••-6610", 74);
  addS("Agustina Flores", "41234987", "libre", -9, "387 •••-2045", 12);
  addS("Federico Quispe", "37654321", "musc", 25, "387 •••-9083", 91);
  addS("Camila Ortiz", "43567890", "func", 6, "387 •••-4472", 40);
  addS("Joaquín Sosa", "40987654", "box", 1, "387 •••-5519", 35);
  addS("Lucía Chávez", "41876543", "libre", 21, "387 •••-8802", 66);
  addS("Tomás Aguirre", "38234567", "musc", -2, "387 •••-3127", 18);
  addS("Florencia Vargas", "42678901", "func", 15, "387 •••-6655", 27);
  addS("Ramiro Cruz", "36789012", "box", 9, "387 •••-1190", 49);
  const ME = S[0]; // la persona del simulador de WhatsApp
  const st = s => { const d = Math.round((s.venc - TODAY) / 864e5); return d < 0 ? "crit" : d <= 3 ? "warn" : "ok"; };
  const stTxt = s => ({crit:"VENCIDA", warn:"POR VENCER", ok:"AL DÍA"})[st(s)];
  const byDni = q => S.find(s => s.dni === q || String(s.id) === q);
  // clases de hoy (0) y mañana (1)
  let cid = 1; const C = [];
  const addC = (d, h, n, prof, cupo, ins) => C.push({id:cid++, d, h, n, prof, cupo, ins:[...ins]});
  addC(0, "07:00", "Funcional", "Profe Caro", 14, [1047, 1050, 1040]); addC(0, "18:00", "Funcional", "Profe Caro", 14, [1046, 1050, 1047, 1048, 1041, 1043]);
  addC(0, "19:00", "Boxeo", "Profe Leo", 12, [1042, 1047, 1051, 1048]); addC(0, "20:00", "Spinning", "Profe Juli", 10, [1041, 1045, 1048, 1043, 1050, 1049, 1046, 1042, 1047, 1051]);
  addC(1, "09:00", "Funcional", "Profe Caro", 14, [1046, 1050]); addC(1, "10:00", "Boxeo", "Profe Leo", 12, [1042, 1051, 1047]);
  addC(1, "11:00", "Spinning", "Profe Juli", 10, [1041, 1045, 1048, 1043, 1050, 1049, 1046, 1042]); addC(1, "12:00", "Movilidad", "Profe Caro", 12, [1045]);
  const LOG = [
    {h:"18:52", s:1045, ok:true}, {h:"18:47", s:1051, ok:true}, {h:"18:41", s:1044, ok:false}, {h:"18:39", s:1043, ok:true},
    {h:"18:30", s:1042, ok:true}, {h:"18:22", s:1048, ok:true}, {h:"18:05", s:1046, ok:true}
  ];
  const PAYS = [
    {h:"17:02", s:1048, m:"Mercado Pago", a:42000}, {h:"11:30", s:1043, m:"Efectivo", a:34000}, {h:"10:14", s:1041, m:"Transferencia", a:42000}
  ];
  const sn = id => S.find(s => s.id === id);
  let clsDay = 0, newCls = null, lastRes = null;
  const inside = () => LOG.filter(l => l.ok).length;

  function badge(){ $("#badge-cob").textContent = S.filter(s => st(s) !== "ok").length || ""; }
  function pay(s, m){
    const base = s.venc < TODAY ? TODAY : s.venc; s.venc = addDays(base, 30);
    PAYS.unshift({h:NL.now(), s:s.id, m, a:pl(s.plan).p});
  }
  function access(s){
    const h = NL.now(), ok = st(s) !== "crit";
    LOG.unshift({h, s:s.id, ok}); if (ok) s.asis++;
    lastRes = {s, ok, h}; return ok;
  }

  const V = {};
  V.ingreso = () => {
    const r = lastRes;
    const res = !r ? `<div class="gate-res"><b>Esperando ingreso…</b><span>Ingresá un DNI o tocá un socio de la lista para simular que pasa por el molinete.</span></div>`
      : r.ok ? `<div class="gate-res ok"><b>✓ ACCESO HABILITADO</b><span><b style="font-size:17px">${esc(r.s.n)}</b> · ${esc(pl(r.s.plan).n)}</span><span>Cuota al día hasta el ${fmtD(r.s.venc)}${st(r.s) === "warn" ? " · <b>vence pronto</b>: le llega el aviso por WhatsApp" : ""}</span></div>`
      : `<div class="gate-res crit"><b>✕ CUOTA VENCIDA</b><span><b style="font-size:17px">${esc(r.s.n)}</b> · venció el ${fmtD(r.s.venc)}</span><span>El molinete no abre. <button class="lnk" data-pay="${r.s.id}">Registrar pago</button> y queda habilitado al instante.</span></div>`;
    return `<div class="vh"><div><h1>Ingreso en vivo</h1><p>Molinete con DNI, QR o huella · viernes ${fmtD(TODAY)}</p></div></div>
    <div class="kpis">
      <div class="kpi"><div class="l">Adentro ahora</div><div class="v" id="k-in">${inside()}</div><div class="s">ingresos de la última hora y media</div></div>
      <div class="kpi"><div class="l">Socios activos</div><div class="v">${S.filter(s => st(s) !== "crit").length}</div><div class="s">de ${S.length} registrados</div></div>
      <div class="kpi"><div class="l">Cuotas vencidas</div><div class="v" style="color:var(--crit)">${S.filter(s => st(s) === "crit").length}</div><div class="s">no pueden ingresar</div></div>
      <div class="kpi"><div class="l">Cobrado hoy</div><div class="v">${ars(PAYS.reduce((a, p) => a + p.a, 0))}</div><div class="s">${PAYS.length} pagos</div></div>
    </div>
    <div class="gate">
      <div class="card"><h3>Molinete</h3>
        <form class="gate-in" id="gate"><input id="dni" inputmode="numeric" placeholder="DNI del socio" aria-label="DNI del socio" autocomplete="off"><button class="b o">Validar</button></form>
        ${res}
        <p class="sub" style="margin:12px 0 6px">Simular que llega:</p>
        <div class="quick">${S.slice(0, 8).map(s => `<button class="b g s" data-in="${s.dni}">${esc(s.n.split(" ")[0])} ${esc(s.n.split(" ")[1][0])}.</button>`).join("")}</div>
      </div>
      <div class="card tscroll"><h3>Últimos ingresos</h3><table><tbody>${LOG.slice(0, 9).map(l => `<tr><td class="num">${l.h}</td><td>${esc(sn(l.s).n)}</td><td>${esc(pl(sn(l.s).plan).n)}</td><td>${l.ok ? pill("ok", "INGRESÓ") : pill("crit", "RECHAZADO")}</td></tr>`).join("")}</tbody></table></div>
    </div>`;
  };
  V.socios = () => `<div class="vh"><div><h1>Socios</h1><p>${S.length} socios · tocá uno para ver su ficha</p></div><button class="b o" data-new>+ Nuevo socio</button></div>
    <div class="tools"><input id="q" placeholder="Buscar por nombre o DNI" aria-label="Buscar socio" style="flex:1;max-width:320px"><select id="fp" aria-label="Filtrar por plan"><option value="">Todos los planes</option>${PLANES.map(p => `<option value="${p.id}">${p.n}</option>`).join("")}</select></div>
    <div class="card tscroll"><table><thead><tr><th>N°</th><th>Socio</th><th>DNI</th><th>Plan</th><th>Vence</th><th>Asistencias</th><th>Cuota</th></tr></thead><tbody id="tb"></tbody></table></div>`;
  const rowsS = () => { const q = norm($("#q").value), f = $("#fp").value;
    $("#tb").innerHTML = S.filter(s => (!f || s.plan === f) && (!q || norm(s.n).includes(q) || s.dni.includes(q))).map(s => `<tr class="click" data-s="${s.id}"><td class="num">${s.id}</td><td>${esc(s.n)}</td><td class="num">${s.dni}</td><td>${esc(pl(s.plan).n)}</td><td class="num">${fmtD(s.venc)}</td><td class="num">${s.asis}</td><td>${pill(st(s), stTxt(s))}</td></tr>`).join("") || `<tr><td colspan="7" class="empty">Sin resultados</td></tr>`;
    $$("[data-s]", view).forEach(r => r.onclick = () => go("socio", +r.dataset.s)); };
  V.socio = id => { const s = sn(id), lg = LOG.filter(l => l.s === id), pg = PAYS.filter(p => p.s === id), cl = C.filter(c => c.ins.includes(id));
    return `<div class="crumb"><button data-go="socios">Socios</button> / N° ${s.id}</div>
    <div class="vh"><div><h1>${esc(s.n)}</h1><p>DNI ${s.dni} · socio desde ${fmtD(s.alta)}</p></div><div class="tools"><button class="b g" data-rem="${s.id}">Avisar por WhatsApp</button><button class="b o" data-pay="${s.id}">Registrar pago</button></div></div>
    <div class="g2b"><div class="card"><h3>Ficha</h3><div class="kv"><span>Plan</span><span>${esc(pl(s.plan).n)} · ${ars(pl(s.plan).p)}/mes</span><span>Incluye</span><span>${esc(pl(s.plan).d)}</span><span>Cuota</span><span>${pill(st(s), stTxt(s))} hasta ${fmtD(s.venc)}</span><span>Teléfono</span><span>${s.tel}</span><span>Asistencias</span><span>${s.asis} en total</span><span>Apto físico</span><span>Presentado ✓</span></div></div>
    <div class="card"><h3>Clases reservadas</h3>${cl.length ? `<table><tbody>${cl.map(c => `<tr><td>${c.d ? "Mañana" : "Hoy"} ${c.h}</td><td>${c.n}</td><td>${c.prof}</td></tr>`).join("")}</tbody></table>` : `<p class="empty">No tiene clases reservadas.</p>`}</div>
    <div class="card"><h3>Ingresos recientes</h3>${lg.length ? `<table><tbody>${lg.map(l => `<tr><td class="num">Hoy ${l.h}</td><td>${l.ok ? pill("ok", "INGRESÓ") : pill("crit", "RECHAZADO")}</td></tr>`).join("")}</tbody></table>` : `<p class="empty">Hoy no vino.</p>`}</div>
    <div class="card"><h3>Pagos</h3>${pg.length ? `<table><tbody>${pg.map(p => `<tr><td class="num">Hoy ${p.h}</td><td>${p.m}</td><td class="num">${ars(p.a)}</td></tr>`).join("")}</tbody></table>` : `<p class="empty">Sin pagos registrados este mes.</p>`}</div></div>`; };
  V.clases = () => { const list = C.filter(c => c.d === clsDay);
    return `<div class="vh"><div><h1>Clases y cupos</h1><p>Los socios reservan su lugar por WhatsApp. Si la cuota está vencida, no pueden reservar.</p></div>
      <div class="seg" role="group" aria-label="Elegir día">${["Hoy", "Mañana"].map((d, i) => `<button type="button" data-cd="${i}" class="${i === clsDay ? "act" : ""}">${d}</button>`).join("")}</div></div>
    <div class="classes">${list.map(c => { const full = c.ins.length >= c.cupo;
      return `<div class="cls ${full ? "full" : ""} ${c.id === newCls ? "new" : ""}"><span class="h">${c.h}</span><b>${c.n}</b><span class="sub">${c.prof}</span>
        <div class="bar"><i style="width:${c.ins.length / c.cupo * 100}%;background:${full ? "#E5533D" : "#E8772E"}"></i></div>
        <span class="sub">${c.ins.length} de ${c.cupo} lugares ${full ? "· <b style='color:var(--crit)'>COMPLETA</b>" : ""}</span>
        <div class="tools"><button class="b s" data-book="${c.id}" ${full ? "aria-disabled='true'" : ""}>Reservar lugar</button><button class="b g s" data-list="${c.id}">Asistencia</button></div></div>`; }).join("")}</div>`; };
  V.cobros = () => { const v = S.filter(s => st(s) === "crit"), p = S.filter(s => st(s) === "warn");
    const row = s => `<tr><td>${esc(s.n)}</td><td>${esc(pl(s.plan).n)}</td><td class="num">${ars(pl(s.plan).p)}</td><td class="num">${fmtD(s.venc)}</td><td>${s.rem ? pill("ok", "AVISADO ✓✓") : pill(st(s), stTxt(s))}</td><td class="tools"><button class="b g s" data-rem="${s.id}">Avisar</button><button class="b o s" data-pay="${s.id}">Cobrar</button></td></tr>`;
    return `<div class="vh"><div><h1>Cobros</h1><p>Al registrar el pago, el socio queda habilitado en el molinete en el momento.</p></div>${v.concat(p).some(s => !s.rem) ? `<button class="b o" data-rem-all>Avisar a todos por WhatsApp</button>` : ""}</div>
    <div class="card tscroll"><h3>Vencidas <span>${v.length}</span></h3>${v.length ? `<table><thead><tr><th>Socio</th><th>Plan</th><th>Cuota</th><th>Venció</th><th>Estado</th><th></th></tr></thead><tbody>${v.map(row).join("")}</tbody></table>` : `<p class="empty">No hay cuotas vencidas ✓</p>`}</div>
    <div class="card tscroll"><h3>Vencen en los próximos 3 días <span>${p.length}</span></h3>${p.length ? `<table><tbody>${p.map(row).join("")}</tbody></table>` : `<p class="empty">Nadie vence esta semana.</p>`}</div>
    <div class="card tscroll"><h3>Pagos de hoy</h3><table><tbody>${PAYS.map(x => `<tr><td class="num">${x.h}</td><td>${esc(sn(x.s).n)}</td><td>${x.m}</td><td class="num">${ars(x.a)}</td></tr>`).join("")}</tbody></table></div>`; };
  V.finanzas = () => { const act = S.filter(s => st(s) !== "crit"), mrr = act.reduce((a, s) => a + pl(s.plan).p, 0);
    const months = [["Jun", 4.1], ["Jul", 4.6], ["Ago", 4.4], ["Sep", 4.9], ["Oct", 5.3], ["Nov", 5.8]];
    return `<div class="vh"><div><h1>Finanzas</h1><p>Cuotas, morosidad y qué plan te deja más</p></div></div>
    <div class="kpis"><div class="kpi"><div class="l">Ingreso mensual</div><div class="v">${ars(mrr)}</div><div class="s">socios activos de la demo</div></div><div class="kpi"><div class="l">Morosidad</div><div class="v" style="color:var(--crit)">${Math.round(S.filter(s => st(s) === "crit").length / S.length * 100)} %</div><div class="s">cuotas vencidas</div></div><div class="kpi"><div class="l">Asistencia promedio</div><div class="v">2,8</div><div class="s">veces por semana</div></div><div class="kpi"><div class="l">Bajas del mes</div><div class="v">3</div><div class="s">avisadas antes de irse</div></div></div>
    <div class="g2"><div class="card"><h3>Cobrado por mes (millones de $)</h3>${bars(months.map(([l, a], i) => ({l, a, hi:i === months.length - 1})), {w:620, fmt:v => v.toFixed(1)})}</div>
    <div class="card"><h3>Por plan</h3><table><tbody>${PLANES.map(p => { const n = S.filter(s => s.plan === p.id).length; return `<tr><td>${p.n}</td><td class="num">${n} socios</td><td class="num">${ars(p.p * n)}</td></tr>`; }).join("")}</tbody></table></div></div>`; };

  const view = $("#view");
  const LABELS = {ingreso:"Ingreso en vivo", socios:"Socios", clases:"Clases y cupos", cobros:"Cobros", finanzas:"Finanzas"};
  V.socio.parent = "socios";
  let cur = {v:"ingreso"};
  function render(v, arg){ cur = {v, arg}; view.innerHTML = V[v](arg); badge(); bind(); }
  const rerender = () => render(cur.v, cur.arg);
  const go = router(V, LABELS, render, "ingreso");
  function payForm(s){ form(`Registrar pago · ${s.n}`, [{id:"m", label:"Medio de pago", type:"select", options:["Efectivo", "Transferencia", "Mercado Pago", "Débito"].map(v => ({v, t:v}))}, {id:"a", label:"Monto", value:ars(pl(s.plan).p)}], "Cobrar y habilitar",
    v => { pay(s, v.m); toast(`${s.n.split(" ")[0]} habilitado hasta el ${fmtD(s.venc)}`); if (lastRes && lastRes.s === s){ lastRes = null; } rerender(); }); }
  function bind(){
    $$("[data-go]", view).forEach(b => b.onclick = () => go(b.dataset.go));
    const g = $("#gate", view); if (g) g.onsubmit = e => { e.preventDefault(); const s = byDni($("#dni").value.trim()); if (!s){ toast("DNI no registrado: no es socio"); return; } access(s); rerender(); flash($("#k-in")); };
    $$("[data-in]", view).forEach(b => b.onclick = () => { access(byDni(b.dataset.in)); rerender(); flash($("#k-in")); });
    $$("[data-pay]", view).forEach(b => b.onclick = () => payForm(sn(+b.dataset.pay)));
    $$("[data-rem]", view).forEach(b => b.onclick = () => { const s = sn(+b.dataset.rem); s.rem = true; toast(`Aviso enviado a ${s.n} por WhatsApp`); rerender(); });
    $$("[data-rem-all]", view).forEach(b => b.onclick = () => { const l = S.filter(s => st(s) !== "ok" && !s.rem); l.forEach(s => s.rem = true); toast(`${l.length} avisos de cuota enviados por WhatsApp`); rerender(); });
    if ($("#tb", view)){ rowsS(); $("#q").oninput = rowsS; $("#fp").onchange = rowsS; }
    $$("[data-cd]", view).forEach(b => b.onclick = () => { clsDay = +b.dataset.cd; rerender(); });
    $$("[data-book]", view).forEach(b => b.onclick = () => { const c = C.find(x => x.id === +b.dataset.book); if (c.ins.length >= c.cupo) return toast("Clase completa");
      form(`Reservar · ${c.n} ${c.h}`, [{id:"s", label:"Socio", type:"select", options:S.filter(s => !c.ins.includes(s.id)).map(s => ({v:s.id, t:`${s.n} · ${stTxt(s).toLowerCase()}`}))}], "Reservar", v => { const s = sn(+v.s); if (st(s) === "crit") return `${s.n.split(" ")[0]} tiene la cuota vencida: primero registrá el pago`; c.ins.push(s.id); newCls = c.id; toast(`Lugar reservado para ${s.n}`); rerender(); }); });
    $$("[data-list]", view).forEach(b => b.onclick = () => { const c = C.find(x => x.id === +b.dataset.list);
      form(`${c.n} ${c.h} · ${c.ins.length} inscriptos`, [{id:"x", label:"Inscriptos", type:"select", options:c.ins.map(i => ({v:i, t:sn(i).n}))}], "Marcar presentes", () => { toast(`Asistencia tomada: ${c.ins.length} presentes`); }); });
    $$("[data-new]", view).forEach(b => b.onclick = () => form("Nuevo socio", [{id:"n", label:"Nombre y apellido"}, {id:"d", label:"DNI", placeholder:"Sin puntos"}, {id:"p", label:"Plan", type:"select", options:PLANES.map(p => ({v:p.id, t:`${p.n} · ${ars(p.p)}`}))}], "Dar de alta y cobrar",
      v => { if (!v.n) return "Escribí el nombre"; if (!/^\d{7,8}$/.test(v.d)) return "El DNI tiene que tener 7 u 8 números"; if (byDni(v.d)) return "Ya hay un socio con ese DNI"; S.unshift({id:sid++, n:v.n, dni:v.d, plan:v.p, venc:addDays(TODAY, 30), tel:"—", asis:0, alta:TODAY, rem:false}); PAYS.unshift({h:NL.now(), s:sid - 1, m:"Efectivo", a:pl(v.p).p}); toast("Socio dado de alta y habilitado en el molinete"); rerender(); }));
  }

  /* simulador de WhatsApp: escribe Sofía, socia con la cuota vencida */
  const W = whatsapp($("#wa"), {name:"Gimnasio Altura", av:"GA", start:[18, 59]});
  async function reserve(){
    const free = C.filter(c => c.d === 1 && c.ins.length < c.cupo);
    if (st(ME) === "crit"){ await W.bot(`Sofi, tu cuota venció el ${fmtD(ME.venc)} 😕 Para reservar tenés que tenerla al día. Podés transferir ${ars(pl(ME.plan).p)} al alias ALTURA.GYM.DEMO y mandarme el comprobante por acá.`); return W.options([{label:"Ya transferí, te paso el comprobante"}, {label:"¿Qué planes tienen?"}], o => reply(o.label)); }
    await W.bot(`Para mañana tengo lugar en: ${free.map(c => `${c.n} ${c.h} (${c.cupo - c.ins.length} lugares)`).join(", ")}. ¿Cuál te reservo?`);
    W.options(free.slice(0, 4).map(c => ({label:`${c.n} a las ${c.h}`, c})), async o => {
      if (o.c.ins.length >= o.c.cupo) return W.bot("Uy, se acaba de llenar 😅 Elegí otra.");
      if (!o.c.ins.includes(ME.id)) o.c.ins.push(ME.id); newCls = o.c.id; clsDay = 1; go("clases");
      await W.bot(`Listo ✅ Te reservé ${o.c.n} mañana a las ${o.c.h} con ${o.c.prof}. Si no podés venir, avisame así liberamos el lugar.`); W.say("Cupo descontado solo en la agenda de clases", "sys"); base(); });
  }
  async function reply(text){
    const s = norm(text);
    if (/(transferi|pague|comprobante|pago)/.test(s) && st(ME) === "crit"){ pay(ME, "Transferencia"); lastRes = null; go("cobros");
      await W.bot(`¡Recibido! ✅ Ya estás habilitada hasta el ${fmtD(ME.venc)}. El molinete te reconoce con tu DNI como siempre.`); W.say("Pago registrado y socia habilitada sin que nadie toque nada", "sys"); return W.options([{label:"Quiero reservar funcional para mañana"}], o => reply(o.label)); }
    if (/(reserv|lugar|cupo|clase|anotar|turno)/.test(s)) return reserve();
    if (/(vence|debo|hasta cuando|cuota|estado)/.test(s)) return W.bot(st(ME) === "crit" ? `Tu cuota de ${pl(ME.plan).n} venció el ${fmtD(ME.venc)}. Son ${ars(pl(ME.plan).p)}; podés pagar por transferencia al alias ALTURA.GYM.DEMO.` : `Tenés la cuota al día hasta el ${fmtD(ME.venc)} 💪`);
    if (/(plan|precio|cuanto|sale|cuesta)/.test(s)) return W.bot("Nuestros planes:\n" + PLANES.map(p => `• ${p.n}: ${ars(p.p)}/mes · ${p.d}`).join("\n"));
    if (/(hora|abren|horario|abierto)/.test(s)) return W.bot("Abrimos de lunes a viernes de 7 a 23 y los sábados de 9 a 14.");
    if (/(hola|buenas|buen dia)/.test(s)) return W.bot("¡Hola Sofi! 👋 Soy el asistente de Gimnasio Altura. Te ayudo con tu cuota, planes y reservas de clases.");
    toast("Consulta derivada a recepción"); return W.bot("Esa consulta te la responde alguien de recepción en un rato 🙌");
  }
  function base(){ W.options([{label:"Quiero reservar funcional para mañana"}, {label:"¿Hasta cuándo tengo paga la cuota?"}, {label:"¿Qué planes tienen?"}], o => reply(o.label)); }
  W.onText(v => reply(v));
  W.say("HOY", "sys"); W.say("¡Hola! Soy el asistente de Gimnasio Altura 💪 Te ayudo con cuotas, planes y reservas de clases.", "biz"); base();
})();
