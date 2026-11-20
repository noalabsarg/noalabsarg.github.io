/* NOA Mesa · demo funcional (gastronomía: bodegón con salón, delivery y reservas) */
(function(){
  NL.setClock(21, 12);
  const {$, $$, esc, ars, fmtD, pill, toast, flash, form, bars, router, whatsapp, norm} = NL;
  const TODAY = new Date(2026, 10, 20);
  const M = [
    {id:"emp", n:"Empanada salteña", cat:"Entradas", p:1800, ok:true, k:["empanada"]},
    {id:"doc", n:"Docena de empanadas", cat:"Entradas", p:19500, ok:true, k:["docena"]},
    {id:"tam", n:"Tamal", cat:"Entradas", p:4500, ok:true, k:["tamal"]},
    {id:"hum", n:"Humita en chala", cat:"Entradas", p:4800, ok:true, k:["humita"]},
    {id:"loc", n:"Locro", cat:"Principales", p:9800, ok:true, k:["locro"]},
    {id:"mil", n:"Milanesa con papas", cat:"Principales", p:14500, ok:true, k:["milanesa","mila"]},
    {id:"bif", n:"Bife de chorizo con guarnición", cat:"Principales", p:19800, ok:true, k:["bife"]},
    {id:"pas", n:"Ravioles caseros", cat:"Principales", p:11800, ok:true, k:["ravioles","pasta"]},
    {id:"ens", n:"Ensalada de la casa", cat:"Principales", p:7200, ok:true, k:["ensalada"]},
    {id:"gas", n:"Gaseosa 500 ml", cat:"Bebidas", p:3200, ok:true, k:["gaseosa","coca"]},
    {id:"agu", n:"Agua mineral", cat:"Bebidas", p:2600, ok:true, k:["agua"]},
    {id:"vin", n:"Copa de vino torrontés", cat:"Bebidas", p:4200, ok:true, k:["vino","torrontes","copa"]},
    {id:"fla", n:"Flan casero con dulce de leche", cat:"Postres", p:4600, ok:true, k:["flan","postre"]},
    {id:"que", n:"Queso con dulce de cayote", cat:"Postres", p:5200, ok:true, k:["cayote","queso"]}
  ];
  const mi = id => M.find(x => x.id === id);
  // mesas: st libre / ocupada / cuenta / reservada
  const T = Array.from({length:12}, (_, i) => ({n:i + 1, cap:i < 4 ? 2 : i < 10 ? 4 : 6, st:"libre", pax:0, since:null, items:[]}));
  const open = (n, pax, since, items, st = "ocupada") => Object.assign(T[n - 1], {st, pax, since, items:items.map(([id, q]) => ({id, q, sent:true}))});
  open(2, 2, "20:41", [["emp", 4], ["vin", 2], ["loc", 2]]); open(5, 4, "20:15", [["doc", 1], ["bif", 2], ["mil", 2], ["gas", 3]], "cuenta");
  open(6, 3, "21:02", [["tam", 3], ["pas", 1], ["agu", 2]]); open(9, 4, "20:55", [["hum", 4], ["loc", 4], ["vin", 4]]); open(11, 6, "20:30", [["doc", 2], ["bif", 3], ["mil", 3], ["gas", 6]]);
  const total = t => t.items.reduce((a, x) => a + mi(x.id).p * x.q, 0);
  let oid = 230;
  const O = []; // comandas: st Nuevo / En cocina / Listo
  const addO = (where, items, st, h, src) => O.push({id:oid++, where, items:items.map(([id, q]) => ({id, q})), st, h, src});
  addO("Mesa 6", [["tam", 3], ["pas", 1]], "En cocina", "21:05", "Salón"); addO("Mesa 9", [["loc", 4], ["hum", 4]], "En cocina", "21:00", "Salón");
  addO("Delivery · B° Tres Cerritos", [["doc", 2], ["gas", 2]], "Listo", "20:48", "WhatsApp"); addO("Retiro · Paola", [["mil", 2], ["fla", 2]], "Nuevo", "21:10", "WhatsApp");
  const R = [
    {h:"21:30", n:"Familia Arancibia", pax:6, mesa:12, st:"Confirmada", src:"WhatsApp"}, {h:"21:45", n:"Gonzalo y Mica", pax:2, mesa:3, st:"Confirmada", src:"Instagram"},
    {h:"22:00", n:"Cumpleaños de Sole", pax:4, mesa:8, st:"Confirmada", src:"WhatsApp"}, {h:"22:30", n:"Mesa de Hernán", pax:4, mesa:10, st:"Sin confirmar", src:"Teléfono"}
  ];
  R.forEach(r => { if (T[r.mesa - 1].st === "libre") T[r.mesa - 1].st = "res"; });
  const SALES = [{m:"Efectivo", a:184600}, {m:"Débito", a:236900}, {m:"Mercado Pago", a:311400}, {m:"Transferencia", a:97500}];
  const SOLD = {emp:46, doc:9, tam:21, hum:18, loc:27, mil:19, bif:14, pas:11, ens:6, gas:38, agu:22, vin:31, fla:15, que:7};
  let newO = null, curT = null;
  
  const now = NL.now;
  const itemsTxt = it => it.map(x => `${x.q} × ${mi(x.id).n}`).join(", ");

  function badge(){ $("#badge-coc").textContent = O.filter(o => o.st !== "Listo").length || ""; }
  const V = {};
  V.salon = () => { const occ = T.filter(t => t.st === "ocupada" || t.st === "cuenta");
    return `<div class="vh"><div><h1>Salón</h1><p>Viernes ${fmtD(TODAY)} · servicio de noche · tocá una mesa</p></div></div>
    <div class="kpis"><div class="kpi"><div class="l">Mesas ocupadas</div><div class="v" id="k-m">${occ.length} / ${T.length}</div><div class="s">${occ.reduce((a, t) => a + t.pax, 0)} comensales</div></div>
      <div class="kpi"><div class="l">Vendido hoy</div><div class="v" id="k-v">${ars(SALES.reduce((a, s) => a + s.a, 0))}</div><div class="s">mesas cerradas y delivery</div></div>
      <div class="kpi"><div class="l">En cocina</div><div class="v">${O.filter(o => o.st !== "Listo").length}</div><div class="s">comandas abiertas</div></div>
      <div class="kpi"><div class="l">Reservas</div><div class="v">${R.length}</div><div class="s">para esta noche</div></div></div>
    <div class="card"><h3>Mesas <span class="legend"><span><i style="background:#86CFAE"></i>Libre</span><span><i style="background:#F2C49E"></i>Ocupada</span><span><i style="background:#F0B3A8"></i>Pidió la cuenta</span><span><i style="background:#B7C8E6"></i>Reservada</span></span></h3>
    <div class="tables">${T.map(t => { const r = R.find(x => x.mesa === t.n);
      return `<button class="mesa ${t.st}" data-t="${t.n}"><b>${t.n}</b>${t.st === "libre" ? `Libre · ${t.cap} lugares` : t.st === "res" ? `Reservada ${r ? r.h : ""}<small>${r ? esc(r.n) : ""}</small>` : `${t.pax} pers. · ${ars(total(t))}<small>${t.st === "cuenta" ? "pidió la cuenta" : "desde " + t.since}</small>`}</button>`; }).join("")}</div></div>`; };
  V.mesa = n => { const t = T[n - 1]; curT = n;
    return `<div class="crumb"><button data-go="salon">Salón</button> / Mesa ${n}</div>
    <div class="vh"><div><h1>Mesa ${n}</h1><p>${t.pax} personas · abierta desde ${t.since}</p></div><div class="tools"><button class="b g" data-add>+ Agregar plato</button>${t.items.some(x => !x.sent) ? `<button class="b" data-send>Enviar a cocina</button>` : ""}<button class="b o" data-pay>Cobrar ${ars(total(t))}</button></div></div>
    <div class="card tscroll"><h3>Consumo</h3><table><thead><tr><th>Plato</th><th>Cant.</th><th>Precio</th><th>Subtotal</th><th></th></tr></thead><tbody>${t.items.map((x, i) => `<tr><td>${esc(mi(x.id).n)}</td><td class="num">${x.q}</td><td class="num">${ars(mi(x.id).p)}</td><td class="num">${ars(mi(x.id).p * x.q)}</td><td>${x.sent ? pill("ok", "EN COCINA") : `${pill("warn", "SIN ENVIAR")} <button class="lnk" data-del="${i}">quitar</button>`}</td></tr>`).join("")}
    <tr><td colspan="3"><b>Total</b></td><td class="num"><b>${ars(total(t))}</b></td><td></td></tr></tbody></table></div>`; };
  V.cocina = () => { const col = s => O.filter(o => o.st === s);
    const tk = o => `<div class="tk ${o.id === newO ? "new" : ""}"><div class="top"><span>#${o.id} · ${o.h}</span><span>${o.src}</span></div><b>${esc(o.where)}</b><ul>${o.items.map(x => `<li>${x.q} × ${esc(mi(x.id).n)}</li>`).join("")}</ul>
      <button class="b s ${o.st === "Listo" ? "o" : ""}" data-adv="${o.id}">${o.st === "Nuevo" ? "Empezar →" : o.st === "En cocina" ? "Listo →" : o.where.startsWith("Mesa") ? "Entregado ✓" : "Salió / retirado ✓"}</button></div>`;
    return `<div class="vh"><div><h1>Cocina</h1><p>Comandas del salón y pedidos de WhatsApp en una sola pantalla</p></div></div>
    <div class="kanban">${["Nuevo", "En cocina", "Listo"].map(s => `<div class="col"><h3>${s} <span>${col(s).length}</span></h3>${col(s).map(tk).join("") || `<p class="empty">—</p>`}</div>`).join("")}</div>`; };
  V.reservas = () => `<div class="vh"><div><h1>Reservas</h1><p>Esta noche · las que entran por WhatsApp se agendan solas</p></div><button class="b o" data-newres>+ Nueva reserva</button></div>
    <div class="card tscroll"><table><thead><tr><th>Hora</th><th>Nombre</th><th>Personas</th><th>Mesa</th><th>Origen</th><th>Estado</th></tr></thead><tbody>${[...R].sort((a, b) => a.h.localeCompare(b.h)).map(r => `<tr><td class="num">${r.h}</td><td>${esc(r.n)}</td><td class="num">${r.pax}</td><td class="num">${r.mesa}</td><td>${r.src}</td><td>${pill(r.st === "Confirmada" ? "ok" : "warn", r.st.toUpperCase())}</td></tr>`).join("")}</tbody></table></div>`;
  V.carta = () => `<div class="vh"><div><h1>Carta</h1><p>Si marcás un plato sin stock, el WhatsApp deja de ofrecerlo al instante</p></div></div>
    <div class="card tscroll"><table><thead><tr><th>Plato</th><th>Categoría</th><th>Precio</th><th>Vendidos hoy</th><th>Estado</th><th></th></tr></thead><tbody>${M.map(x => `<tr><td>${esc(x.n)}</td><td>${x.cat}</td><td class="num">${ars(x.p)}</td><td class="num">${SOLD[x.id]}</td><td>${x.ok ? pill("ok", "DISPONIBLE") : pill("crit", "SIN STOCK")}</td><td class="tools"><button class="b g s" data-tog="${x.id}">${x.ok ? "Marcar sin stock" : "Volver a ofrecer"}</button><button class="b g s" data-price="${x.id}">Precio</button></td></tr>`).join("")}</tbody></table></div>`;
  V.caja = () => { const tot = SALES.reduce((a, s) => a + s.a, 0), top = Object.entries(SOLD).sort((a, b) => mi(b[0]).p * b[1] - mi(a[0]).p * a[1]).slice(0, 6);
    const hours = [["19h", 1.1], ["20h", 2.6], ["21h", 3.9], ["22h", 2.4], ["23h", 1.3], ["00h", .6]];
    return `<div class="vh"><div><h1>Caja</h1><p>Cierre del día en tiempo real</p></div></div>
    <div class="kpis"><div class="kpi"><div class="l">Vendido hoy</div><div class="v">${ars(tot)}</div><div class="s">salón + delivery</div></div><div class="kpi"><div class="l">Ticket promedio</div><div class="v">${ars(tot / 58)}</div><div class="s">58 tickets</div></div><div class="kpi"><div class="l">Pedidos por WhatsApp</div><div class="v">17</div><div class="s">sin atender el teléfono</div></div><div class="kpi"><div class="l">Plato estrella</div><div class="v" style="font-size:22px">Bife de chorizo</div><div class="s">el que más factura</div></div></div>
    <div class="g2"><div class="card"><h3>Ventas por hora (cientos de miles de $)</h3>${bars(hours.map(([l, a]) => ({l, a, hi:l === "21h"})), {w:620, fmt:v => v.toFixed(1)})}</div>
    <div class="card"><h3>Por medio de pago</h3><table><tbody>${SALES.map(s => `<tr><td>${s.m}</td><td class="num">${ars(s.a)}</td><td style="width:40%"><div class="bar"><i style="width:${s.a / tot * 100}%;background:#E8772E"></i></div></td></tr>`).join("")}</tbody></table></div></div>
    <div class="card tscroll"><h3>Lo que más factura</h3><table><tbody>${top.map(([id, q]) => `<tr><td>${esc(mi(id).n)}</td><td class="num">${q} vendidos</td><td class="num">${ars(mi(id).p * q)}</td></tr>`).join("")}</tbody></table></div>`; };

  const view = $("#view");
  const LABELS = {salon:"Salón", cocina:"Cocina", reservas:"Reservas", carta:"Carta", caja:"Caja"};
  V.mesa.parent = "salon";
  let cur = {v:"salon"};
  function render(v, arg){ cur = {v, arg}; view.innerHTML = V[v](arg); badge(); bind(); }
  const rerender = () => render(cur.v, cur.arg);
  const go = router(V, LABELS, render, "salon");
  const avail = () => M.filter(x => x.ok).map(x => ({v:x.id, t:`${x.n} · ${ars(x.p)}`}));
  function bind(){
    $$("[data-go]", view).forEach(b => b.onclick = () => go(b.dataset.go));
    $$("[data-t]", view).forEach(b => b.onclick = () => { const t = T[+b.dataset.t - 1];
      if (t.st === "libre" || t.st === "res") return form(`Abrir mesa ${t.n}`, [{id:"p", label:"Comensales", type:"number", value:2, min:1}], "Abrir mesa", v => { const p = +v.p; if (!p || p < 1) return "Indicá cuántas personas son"; if (p > t.cap + 2) return `La mesa ${t.n} es para ${t.cap}: juntá otra mesa`; Object.assign(t, {st:"ocupada", pax:p, since:now(), items:[]}); go("mesa", t.n); });
      go("mesa", t.n); });
    $$("[data-add]", view).forEach(b => b.onclick = () => form(`Agregar a mesa ${curT}`, [{id:"i", label:"Plato", type:"select", options:avail()}, {id:"q", label:"Cantidad", type:"number", value:1, min:1}], "Agregar", v => { if (!(+v.q > 0)) return "La cantidad tiene que ser mayor a cero"; T[curT - 1].items.push({id:v.i, q:+v.q, sent:false}); rerender(); }));
    $$("[data-del]", view).forEach(b => b.onclick = () => { T[curT - 1].items.splice(+b.dataset.del, 1); rerender(); });
    $$("[data-send]", view).forEach(b => b.onclick = () => { const t = T[curT - 1], ns = t.items.filter(x => !x.sent); ns.forEach(x => x.sent = true); addO(`Mesa ${t.n}`, ns.map(x => [x.id, x.q]), "Nuevo", now(), "Salón"); newO = oid - 1; toast("Comanda enviada a cocina"); rerender(); });
    $$("[data-pay]", view).forEach(b => b.onclick = () => { const t = T[curT - 1]; if (!t.items.length) return toast("La mesa no tiene consumo");
      form(`Cobrar mesa ${t.n} · ${ars(total(t))}`, [{id:"m", label:"Medio de pago", type:"select", options:SALES.map(s => ({v:s.m, t:s.m}))}, {id:"pr", label:"Propina sugerida (10 %)", value:ars(total(t) * .1)}], "Cobrar y liberar mesa",
        v => { SALES.find(s => s.m === v.m).a += total(t); t.items.forEach(x => SOLD[x.id] += x.q); Object.assign(t, {st:"libre", pax:0, since:null, items:[]}); toast(`Mesa ${t.n} cobrada con ${v.m}: quedó libre`); go("salon"); flash($("#k-v")); }); });
    $$("[data-adv]", view).forEach(b => b.onclick = () => { const o = O.find(x => x.id === +b.dataset.adv);
      if (o.st === "Nuevo") o.st = "En cocina"; else if (o.st === "En cocina"){ o.st = "Listo"; if (o.src === "WhatsApp") W.say(`Mensaje automático: "¡Tu pedido #${o.id} está listo! ${o.where.startsWith("Delivery") ? "Sale el cadete 🛵" : "Ya podés pasar a retirarlo"}"`, "sys"); }
      else { O.splice(O.indexOf(o), 1); toast(`Comanda #${o.id} cerrada`); }
      rerender(); });
    $$("[data-tog]", view).forEach(b => b.onclick = () => { const x = mi(b.dataset.tog); x.ok = !x.ok; toast(x.ok ? `${x.n} vuelve a ofrecerse` : `${x.n} sin stock: el WhatsApp ya no lo ofrece`); rerender(); });
    $$("[data-price]", view).forEach(b => b.onclick = () => { const x = mi(b.dataset.price); form(`Precio · ${x.n}`, [{id:"p", label:"Precio nuevo", type:"number", value:x.p, min:1}], "Actualizar", v => { if (!(+v.p > 0)) return "Poné un precio válido"; x.p = +v.p; toast("Precio actualizado en la carta y en el WhatsApp"); rerender(); }); });
    $$("[data-newres]", view).forEach(b => b.onclick = () => form("Nueva reserva", [{id:"n", label:"Nombre"}, {id:"h", label:"Hora", type:"time", value:"22:00"}, {id:"p", label:"Personas", type:"number", value:2, min:1}], "Reservar", v => addRes(v.n, v.h, +v.p, "Teléfono")));
  }
  function addRes(n, h, pax, src){
    if (!n) return "Escribí a nombre de quién";
    if (!(pax > 0)) return "Indicá cuántas personas";
    const t = T.find(x => x.st === "libre" && x.cap >= pax && !R.some(r => r.mesa === x.n));
    if (!t) return "No quedan mesas libres para esa cantidad";
    R.push({h, n, pax, mesa:t.n, st:"Confirmada", src}); t.st = "res"; toast(`Reserva confirmada: mesa ${t.n} a las ${h}`); go("reservas"); return null;
  }

  /* simulador de WhatsApp */
  const W = whatsapp($("#wa"), {name:"Bodegón El Molle", av:"EM", start:[21, 12]});
  const WORDS = {un:1, una:1, uno:1, dos:2, tres:3, cuatro:4, cinco:5, seis:6, media:.5};
  function parse(s){
    const out = [];
    s.split(/,| y | mas /).forEach(seg => {
      const it = M.find(x => x.k.some(k => seg.includes(k)) && (x.id !== "emp" || !seg.includes("docena")));
      if (!it) return; const d = seg.match(/(\d+)/), w = Object.keys(WORDS).find(k => new RegExp(`\\b${k}\\b`).test(seg));
      let q = d ? +d[1] : w ? WORDS[w] : 1; let id = it.id;
      if (it.id === "doc" && q === .5){ id = "emp"; q = 6; }
      out.push({id, q:Math.max(1, Math.round(q))});
    });
    return out;
  }
  async function order(items, where){
    const out = items.filter(x => !mi(x.id).ok);
    if (out.length) return W.bot(`Uh, hoy ya no nos queda ${out.map(x => mi(x.id).n.toLowerCase()).join(" ni ")} 😕 ¿Querés cambiarlo por otra cosa? Te paso la carta si querés.`);
    const tot = items.reduce((a, x) => a + mi(x.id).p * x.q, 0);
    addO(where, items.map(x => [x.id, x.q]), "Nuevo", now(), "WhatsApp"); newO = oid - 1; go("cocina");
    await W.bot(`Anotado ✅ Pedido #${newO}:\n${items.map(x => `• ${x.q} × ${mi(x.id).n}`).join("\n")}\nTotal: ${ars(tot)}${where.startsWith("Delivery") ? " + envío $1.500" : ""}. Está en unos 35 minutos. Podés pagar con Mercado Pago o en efectivo.`);
    W.say("El pedido entró solo a la pantalla de cocina", "sys"); base();
  }
  async function reply(text){
    const s = norm(text);
    if (/(mesa|reserv)/.test(s)){ const p = s.match(/(\d+)(?![:.\d])/), hm = s.match(/(\d{1,2})[:.](\d{2})/), hs = s.match(/a las (\d{1,2})(?![:.\d])/);
      const pax = p && +p[1] < 20 ? +p[1] : 4, hh = hm ? `${hm[1]}:${hm[2]}` : hs ? `${hs[1]}:00` : "22:00";
      const err = addRes("Reserva por WhatsApp", hh.padStart(5, "0"), pax, "WhatsApp");
      if (err) return W.bot("Para esa hora ya no nos quedan mesas 😕 ¿Te sirve más tarde, a las 23?");
      return W.bot(`¡Listo! Te reservé una mesa para ${pax} a las ${hh} ✅ Te la guardamos 15 minutos. ¡Te esperamos!`); }
    const items = parse(s);
    if (items.length) return order(items, /(retir|paso a buscar|busco)/.test(s) ? "Retiro · cliente WhatsApp" : "Delivery · cliente WhatsApp");
    if (/(menu|carta|que tienen|que hay)/.test(s)) return W.bot("Hoy tenemos:\n" + ["Entradas", "Principales", "Postres"].map(c => `${c}: ${M.filter(x => x.cat === c && x.ok).map(x => `${x.n.toLowerCase()} ${ars(x.p)}`).join(", ")}`).join("\n"));
    if (/(hora|abren|horario|abierto)/.test(s)) return W.bot("Abrimos de martes a domingo de 20 a 1. Mediodía, sábados y domingos de 12 a 16.");
    if (/(hola|buenas)/.test(s)) return W.bot("¡Hola! Soy el asistente de Bodegón El Molle 🫓 Tomo pedidos para delivery o retiro, reservas y te paso la carta.");
    toast("Consulta derivada al encargado"); return W.bot("Eso te lo responde el encargado en un ratito 🙌");
  }
  function base(){ W.options([{label:"Quiero 2 empanadas, un locro y una gaseosa para delivery"}, {label:"¿Tienen mesa para 4 a las 22:30?"}, {label:"¿Qué tienen de menú?"}], o => reply(o.label)); }
  W.onText(v => reply(v));
  W.say("HOY", "sys"); W.say("¡Hola! Soy el asistente de Bodegón El Molle 🫓 Tomo pedidos, reservas y te paso la carta.", "biz"); base();
})();
