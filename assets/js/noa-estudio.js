/* NOA Estudio · demo funcional (profesionales: estudio contable y jurídico) */
(function(){
  NL.setClock(10, 12);
  const {$, $$, esc, ars, fmtD, addDays, pill, toast, flash, form, bars, router, whatsapp, norm} = NL;
  const TODAY = new Date(2026, 10, 20);
  const dlab = d => { const x = addDays(TODAY, d); return `${["dom","lun","mar","mié","jue","vie","sáb"][x.getDay()]} ${x.getDate()}/${x.getMonth() + 1}`; };
  const C = [
    {id:1, n:"Marcos Ibarra", t:"Monotributo D", act:"Electricista", hon:38000, pago:"Pendiente", tel:"387 •••-5512"},
    {id:2, n:"Panadería La Espiga SRL", t:"Sociedad (SRL)", act:"Panadería", hon:145000, pago:"Pagado", tel:"387 •••-7020"},
    {id:3, n:"Lucía Chávez", t:"Monotributo B", act:"Diseñadora", hon:28000, pago:"Pagado", tel:"387 •••-8802"},
    {id:4, n:"Transportes Norte SA", t:"Sociedad (SA)", act:"Transporte de cargas", hon:260000, pago:"Atrasado", tel:"387 •••-3391"},
    {id:5, n:"Dr. Esteban Ruiz", t:"Resp. Inscripto", act:"Odontólogo", hon:85000, pago:"Pagado", tel:"387 •••-6610"},
    {id:6, n:"Ferretería El Cerro", t:"Resp. Inscripto", act:"Comercio", hon:110000, pago:"Pendiente", tel:"387 •••-4410"},
    {id:7, n:"Cabañas Los Alisos", t:"Resp. Inscripto", act:"Alojamiento", hon:95000, pago:"Pagado", tel:"387 •••-2219"},
    {id:8, n:"Sofía Medina", t:"Monotributo A", act:"Profesora de yoga", hon:22000, pago:"Atrasado", tel:"387 •••-3308"}
  ];
  const cn = id => C.find(c => c.id === id);
  let vid = 1; const VE = [];
  const addV = (cli, ob, d, doc, st = "Por presentar") => VE.push({id:vid++, cli, ob, d, doc, st, asked:false});
  addV(4, "Cargas sociales (F.931)", -1, "Recibida", "Presentado"); addV(2, "IVA mensual", 3, "Recibida"); addV(6, "IVA mensual", 3, "Incompleta");
  addV(5, "IVA mensual", 4, "Pendiente"); addV(7, "IVA mensual", 4, "Recibida"); addV(4, "IVA mensual", 5, "Pendiente");
  addV(2, "Ingresos Brutos", 6, "Recibida"); addV(6, "Ingresos Brutos", 6, "Pendiente"); addV(7, "Ingresos Brutos", 7, "Pendiente");
  addV(1, "Facturación del mes (control de categoría)", 10, "Pendiente"); addV(3, "Facturación del mes (control de categoría)", 10, "Recibida");
  addV(4, "Anticipo de Ganancias", 11, "Recibida"); addV(5, "Autónomos", 12, "Recibida"); addV(8, "Recategorización: revisar ingresos", 13, "Pendiente");
  let did = 40; const D = [
    {id:did++, cli:2, t:"Facturas de compra de noviembre (14 fotos)", src:"WhatsApp", h:"09:12", st:"Por revisar"},
    {id:did++, cli:7, t:"Liquidación de Booking de octubre (PDF)", src:"WhatsApp", h:"08:47", st:"Por revisar"},
    {id:did++, cli:3, t:"Facturas emitidas de noviembre", src:"Mail", h:"Ayer", st:"Cargado"},
    {id:did++, cli:4, t:"Recibos de sueldo de octubre", src:"WhatsApp", h:"Ayer", st:"Cargado"}
  ];
  const K = [
    {exp:"Expte. 4.512/26", car:"Gómez c/ Transportes Norte SA s/ despido", fuero:"Laboral", cli:4, next:"Contestar demanda", d:5, aud:null},
    {exp:"Expte. 1.208/25", car:"Panadería La Espiga SRL c/ Molinos del Valle s/ cobro de pesos", fuero:"Civil y Comercial", cli:2, next:"Audiencia preliminar", d:10, aud:"10:00"},
    {exp:"Expte. 7.733/26", car:"Chávez, Lucía s/ sucesión", fuero:"Civil", cli:3, next:"Presentar inventario", d:12, aud:null},
    {exp:"Expte. 902/26", car:"Ruiz, Esteban c/ Consorcio Edificio Güemes s/ daños", fuero:"Civil y Comercial", cli:5, next:"Audiencia de conciliación", d:17, aud:"11:30"}
  ];
  const MEET = [{d:3, h:"11:00", cli:6, m:"Revisar IVA con faltantes"}, {d:4, h:"16:00", cli:5, m:"Planificación anual"}];
  const ME = C[0];
  let newDoc = null;
  const docPill = s => pill(s === "Recibida" ? "ok" : s === "Incompleta" ? "warn" : "crit", s.toUpperCase());
  const payPill = s => pill(s === "Pagado" ? "ok" : s === "Pendiente" ? "warn" : "crit", s.toUpperCase());
  function badge(){ $("#badge-doc").textContent = D.filter(x => x.st === "Por revisar").length || ""; $("#badge-ven").textContent = VE.filter(v => v.st !== "Presentado" && v.d <= 5 && v.doc !== "Recibida").length || ""; }

  const V = {};
  V.vencimientos = () => { const open = VE.filter(v => v.st !== "Presentado"), risk = open.filter(v => v.d <= 5 && v.doc !== "Recibida");
    return `<div class="vh"><div><h1>Vencimientos</h1><p>Próximos 15 días · fechas de ejemplo · los pedidos de documentación salen solos por WhatsApp</p></div>${open.some(v => v.doc !== "Recibida" && !v.asked) ? `<button class="b o" data-ask-all>Pedir toda la documentación faltante</button>` : ""}</div>
    <div class="kpis"><div class="kpi"><div class="l">Por presentar</div><div class="v">${open.length}</div><div class="s">en los próximos 15 días</div></div>
      <div class="kpi"><div class="l">En riesgo</div><div class="v" style="color:var(--crit)">${risk.length}</div><div class="s">vencen esta semana y falta documentación</div></div>
      <div class="kpi"><div class="l">Documentos por revisar</div><div class="v" id="k-doc">${D.filter(x => x.st === "Por revisar").length}</div><div class="s">llegaron por WhatsApp o mail</div></div>
      <div class="kpi"><div class="l">Honorarios a cobrar</div><div class="v">${ars(C.filter(c => c.pago !== "Pagado").reduce((a, c) => a + c.hon, 0))}</div><div class="s">${C.filter(c => c.pago !== "Pagado").length} clientes</div></div></div>
    <div class="card tscroll"><h3>Agenda de vencimientos</h3><table><thead><tr><th>Vence</th><th>Cliente</th><th>Obligación</th><th>Documentación</th><th>Estado</th><th></th></tr></thead><tbody>
      ${[...VE].sort((a, b) => a.d - b.d).map(v => `<tr><td class="num">${dlab(v.d)}</td><td>${esc(cn(v.cli).n)}</td><td>${esc(v.ob)}</td><td>${docPill(v.doc)}${v.asked && v.doc !== "Recibida" ? ` <span class="sub">pedida ✓✓</span>` : ""}</td><td>${v.st === "Presentado" ? pill("ok", "PRESENTADO") : v.d <= 5 && v.doc !== "Recibida" ? pill("crit", "EN RIESGO") : pill("na", "POR PRESENTAR")}</td>
        <td class="tools">${v.st !== "Presentado" ? `${v.doc !== "Recibida" ? `<button class="b g s" data-ask="${v.id}">Pedir</button>` : ""}<button class="b s" data-done="${v.id}">Presentado</button>` : ""}</td></tr>`).join("")}</tbody></table></div>
    <div class="card"><h3>Reuniones de la semana</h3>${MEET.length ? `<table><tbody>${[...MEET].sort((a, b) => a.d - b.d || a.h.localeCompare(b.h)).map(m => `<tr><td class="num">${dlab(m.d)} ${m.h}</td><td>${esc(cn(m.cli).n)}<br><span class="sub">${esc(m.m)}</span></td></tr>`).join("")}</tbody></table>` : `<p class="empty">Sin reuniones.</p>`}</div>`; };
  V.clientes = () => `<div class="vh"><div><h1>Clientes</h1><p>${C.length} clientes · tocá uno para ver su ficha</p></div></div>
    <div class="card tscroll"><table><thead><tr><th>Cliente</th><th>Condición</th><th>Actividad</th><th>Próximo vencimiento</th><th>Honorario</th><th>Pago</th></tr></thead><tbody>
    ${C.map(c => { const nx = VE.filter(v => v.cli === c.id && v.st !== "Presentado").sort((a, b) => a.d - b.d)[0];
      return `<tr class="click" data-c="${c.id}"><td>${esc(c.n)}</td><td>${c.t}</td><td>${esc(c.act)}</td><td>${nx ? `${dlab(nx.d)} · ${esc(nx.ob)}` : `<span class="sub">al día</span>`}</td><td class="num">${ars(c.hon)}</td><td>${payPill(c.pago)}</td></tr>`; }).join("")}</tbody></table></div>`;
  V.cliente = id => { const c = cn(id), vs = VE.filter(v => v.cli === id), ds = D.filter(x => x.cli === id), ks = K.filter(k => k.cli === id);
    return `<div class="crumb"><button data-go="clientes">Clientes</button> / ${esc(c.n)}</div>
    <div class="vh"><div><h1>${esc(c.n)}</h1><p>${c.t} · ${esc(c.act)} · ${c.tel}</p></div><div class="tools"><button class="b g" data-remind="${id}">Pedir documentación</button>${c.pago !== "Pagado" ? `<button class="b o" data-pay="${id}">Registrar pago</button>` : ""}</div></div>
    <div class="g2b"><div class="card"><h3>Vencimientos</h3>${vs.length ? `<table><tbody>${vs.map(v => `<tr><td class="num">${dlab(v.d)}</td><td>${esc(v.ob)}</td><td>${v.st === "Presentado" ? pill("ok", "PRESENTADO") : docPill(v.doc)}</td></tr>`).join("")}</tbody></table>` : `<p class="empty">Sin vencimientos en los próximos días.</p>`}</div>
    <div class="card"><h3>Documentos recibidos</h3>${ds.length ? `<table><tbody>${ds.map(x => `<tr><td>${esc(x.t)}</td><td>${x.src}</td><td>${pill(x.st === "Cargado" ? "ok" : "warn", x.st.toUpperCase())}</td></tr>`).join("")}</tbody></table>` : `<p class="empty">Todavía no mandó documentación este mes.</p>`}</div>
    <div class="card"><h3>Causas</h3>${ks.length ? `<table><tbody>${ks.map(k => `<tr><td class="num">${k.exp}</td><td>${esc(k.car)}</td></tr>`).join("")}</tbody></table>` : `<p class="empty">Sin causas abiertas.</p>`}</div>
    <div class="card"><h3>Honorarios</h3><div class="kv"><span>Abono mensual</span><span>${ars(c.hon)}</span><span>Noviembre</span><span>${payPill(c.pago)}</span></div></div></div>`; };
  V.documentos = () => `<div class="vh"><div><h1>Documentos</h1><p>Lo que mandan los clientes por WhatsApp o mail entra acá, ordenado por cliente</p></div></div>
    <div class="card tscroll"><table><thead><tr><th>Llegó</th><th>Cliente</th><th>Documento</th><th>Por</th><th>Estado</th><th></th></tr></thead><tbody>
    ${D.map(x => `<tr${x.id === newDoc ? ' style="background:#FFF6EE"' : ""}><td class="num">${x.h}</td><td>${esc(cn(x.cli).n)}</td><td>${esc(x.t)}</td><td>${x.src}</td><td>${pill(x.st === "Cargado" ? "ok" : "warn", x.st.toUpperCase())}</td><td>${x.st !== "Cargado" ? `<button class="b s" data-load="${x.id}">Marcar cargado</button>` : ""}</td></tr>`).join("")}</tbody></table></div>`;
  V.causas = () => `<div class="vh"><div><h1>Causas</h1><p>Área jurídica · plazos y audiencias con aviso al abogado y al cliente</p></div></div>
    <div class="card tscroll"><table><thead><tr><th>Expediente</th><th>Carátula</th><th>Fuero</th><th>Próximo paso</th><th>Fecha</th><th></th></tr></thead><tbody>
    ${[...K].sort((a, b) => a.d - b.d).map((k, i) => `<tr><td class="num">${k.exp}</td><td>${esc(k.car)}</td><td>${k.fuero}</td><td>${esc(k.next)}</td><td class="num">${dlab(k.d)}${k.aud ? " " + k.aud : ""} ${k.d <= 5 ? pill("crit", `EN ${k.d} DÍAS`) : ""}</td><td><button class="b g s" data-notify="${K.indexOf(k)}">Avisar al cliente</button></td></tr>`).join("")}</tbody></table></div>`;
  V.honorarios = () => { const tot = C.reduce((a, c) => a + c.hon, 0), cob = C.filter(c => c.pago === "Pagado").reduce((a, c) => a + c.hon, 0);
    return `<div class="vh"><div><h1>Honorarios</h1><p>Abonos mensuales y cobranza</p></div>${C.some(c => c.pago !== "Pagado") ? `<button class="b o" data-remind-pay>Recordar a los que deben</button>` : ""}</div>
    <div class="kpis"><div class="kpi"><div class="l">Facturación mensual</div><div class="v">${ars(tot)}</div><div class="s">${C.length} abonos</div></div><div class="kpi"><div class="l">Cobrado noviembre</div><div class="v" id="k-cob">${ars(cob)}</div><div class="s">${Math.round(cob / tot * 100)} % del total</div></div><div class="kpi"><div class="l">Atrasados</div><div class="v" style="color:var(--crit)">${C.filter(c => c.pago === "Atrasado").length}</div><div class="s">más de 10 días</div></div><div class="kpi"><div class="l">Clientes al día</div><div class="v">${C.filter(c => c.pago === "Pagado").length} / ${C.length}</div><div class="s">con el abono pagado</div></div></div>
    <div class="g2"><div class="card tscroll"><h3>Estado de cobro</h3><table><tbody>${C.map(c => `<tr><td>${esc(c.n)}</td><td class="num">${ars(c.hon)}</td><td>${payPill(c.pago)}</td><td>${c.pago !== "Pagado" ? `<button class="b o s" data-pay="${c.id}">Cobrado</button>` : ""}</td></tr>`).join("")}</tbody></table></div>
    <div class="card"><h3>Cobrado por mes (millones de $)</h3>${bars([["Jun", .62], ["Jul", .66], ["Ago", .64], ["Sep", .71], ["Oct", .74], ["Nov", cob / 1e6]].map(([l, a], i) => ({l, a, hi:i === 5})), {w:520, fmt:v => v.toFixed(2)})}</div></div>`; };

  const view = $("#view");
  const LABELS = {vencimientos:"Vencimientos", clientes:"Clientes", documentos:"Documentos", causas:"Causas", honorarios:"Honorarios"};
  V.cliente.parent = "clientes";
  let cur = {v:"vencimientos"};
  function render(v, arg){ cur = {v, arg}; view.innerHTML = V[v](arg); badge(); bind(); }
  const rerender = () => render(cur.v, cur.arg);
  const go = router(V, LABELS, render, "vencimientos");
  function bind(){
    $$("[data-go]", view).forEach(b => b.onclick = () => go(b.dataset.go));
    $$("[data-c]", view).forEach(r => r.onclick = () => go("cliente", +r.dataset.c));
    $$("[data-ask]", view).forEach(b => b.onclick = () => { const v = VE.find(x => x.id === +b.dataset.ask); v.asked = true; toast(`Pedido enviado por WhatsApp a ${cn(v.cli).n}`); rerender(); });
    $$("[data-ask-all]", view).forEach(b => b.onclick = () => { const l = VE.filter(v => v.st !== "Presentado" && v.doc !== "Recibida" && !v.asked); l.forEach(v => v.asked = true); toast(`${l.length} pedidos de documentación enviados por WhatsApp`); rerender(); });
    $$("[data-done]", view).forEach(b => b.onclick = () => { const v = VE.find(x => x.id === +b.dataset.done);
      if (v.doc !== "Recibida") return form(`${v.ob} · ${cn(v.cli).n}`, [{id:"x", label:"Falta documentación. ¿La marcás como presentada igual?", type:"select", options:[{v:"si", t:"Sí, ya la presenté"}]}], "Marcar presentado", () => { v.st = "Presentado"; toast("Marcado como presentado"); rerender(); });
      v.st = "Presentado"; toast(`${v.ob} de ${cn(v.cli).n}: presentado. El cliente recibe el comprobante por WhatsApp`); rerender(); });
    $$("[data-remind]", view).forEach(b => b.onclick = () => { toast(`Pedido de documentación enviado a ${cn(+b.dataset.remind).n}`); });
    $$("[data-pay]", view).forEach(b => b.onclick = () => { const c = cn(+b.dataset.pay); form(`Cobro de honorarios · ${c.n}`, [{id:"m", label:"Medio de pago", type:"select", options:["Transferencia", "Mercado Pago", "Efectivo"].map(v => ({v, t:v}))}], "Registrar", () => { c.pago = "Pagado"; toast(`Honorarios de ${c.n} cobrados`); rerender(); }); });
    $$("[data-remind-pay]", view).forEach(b => b.onclick = () => toast(`${C.filter(c => c.pago !== "Pagado").length} recordatorios de honorarios enviados por WhatsApp`));
    $$("[data-load]", view).forEach(b => b.onclick = () => { const x = D.find(d => d.id === +b.dataset.load); x.st = "Cargado"; toast("Documento cargado"); rerender(); });
    $$("[data-notify]", view).forEach(b => b.onclick = () => { const k = K[+b.dataset.notify]; toast(`Aviso enviado a ${cn(k.cli).n}: ${k.next.toLowerCase()} el ${dlab(k.d)}`); });
  }

  /* simulador de WhatsApp: Marcos, monotributista */
  const W = whatsapp($("#wa"), {name:"Estudio Figueroa", av:"EF", start:[10, 14]});
  async function reply(text){
    const s = norm(text);
    if (/(factura|comprobante|te mando|te paso|adjunto|papeles)/.test(s) && !/(pague|transferi)/.test(s)){
      D.unshift({id:did, cli:1, t:"Facturas de noviembre (9 fotos)", src:"WhatsApp", h:NL.now(), st:"Por revisar"}); newDoc = did++;
      VE.filter(v => v.cli === 1).forEach(v => v.doc = "Recibida"); go("documentos");
      await W.bot("¡Recibidas, Marcos! ✅ 9 fotos de facturas de noviembre. Las revisamos y te avisamos si falta algo. Con esto ya podemos controlar tu categoría del monotributo.");
      return W.say("Los documentos entraron solos al estudio, ordenados por cliente", "sys"); }
    if (/(pague|transferi|ya te pague)/.test(s)){ ME.pago = "Pagado"; go("honorarios");
      await W.bot("¡Gracias! Registramos el pago de tus honorarios de noviembre ✅"); return W.say("Pago registrado en honorarios", "sys"); }
    if (/(honorario|cuanto te debo|cuanto debo)/.test(s)) return W.bot(`Tus honorarios de noviembre son ${ars(ME.hon)}. Podés transferir al alias ESTUDIO.FIGUEROA.DEMO y mandarme el comprobante por acá.`);
    if (/(monotributo|categoria|cuota|vence)/.test(s)) return W.bot("Tu monotributo vence el 20 de cada mes. Para controlar que sigas en la categoría D, necesitamos tus facturas de noviembre. ¿Me las mandás por acá?");
    if (/(reunion|turno|hablar|contador|cita)/.test(s)){ const opts = [[3, "17:00"], [4, "10:00"], [5, "12:00"]].filter(([d, h]) => !MEET.some(m => m.d === d && m.h === h));
      await W.bot("¡Claro! Tengo estos horarios con el contador:"); return W.options(opts.map(([d, h]) => ({label:`${dlab(d)} a las ${h}`, d, h})), async o => {
        MEET.push({d:o.d, h:o.h, cli:1, m:"Consulta por WhatsApp"}); go("vencimientos");
        await W.bot(`Listo ✅ Te esperamos el ${dlab(o.d)} a las ${o.h}. El día anterior te mando un recordatorio.`); W.say("Reunión agendada sola en la semana del estudio", "sys"); base(); }); }
    if (/(hola|buenas|buen dia)/.test(s)) return W.bot("¡Hola Marcos! 👋 Soy el asistente de Estudio Figueroa. Podés mandarme tus facturas, consultar vencimientos, honorarios o pedir una reunión.");
    toast("Consulta derivada al contador"); return W.bot("Esa consulta te la responde el contador en el día 🙌");
  }
  function base(){ W.options([{label:"Te mando las facturas de noviembre"}, {label:"¿Cuándo vence mi monotributo?"}, {label:"Quiero una reunión con el contador"}], o => reply(o.label)); }
  W.onText(v => reply(v));
  W.say("HOY", "sys"); W.say("¡Hola! Soy el asistente de Estudio Figueroa 📑 Recibo documentación, te aviso vencimientos y agendo reuniones.", "biz"); base();
})();
