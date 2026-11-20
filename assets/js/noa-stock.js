/* NOA Stock · demo funcional (comercio: ferretería) */
(function(){
  const {$, $$, esc, ars, nf, fmtD, addDays, pill, toast, flash, form, line, bars, router, whatsapp, norm} = NL;
  const TODAY = new Date(2026, 10, 20);
  const P = [
    {c:"FE-0101", n:"Cable unipolar 2,5 mm · rollo 100 m", cat:"Electricidad", cost:12800, price:18900, q:40, min:15, prov:"Distribuidora Eléctrica Norte", v30:62, k:["cable","2,5","2.5"]},
    {c:"FE-0102", n:"Cable unipolar 1,5 mm · rollo 100 m", cat:"Electricidad", cost:8900, price:13200, q:18, min:12, prov:"Distribuidora Eléctrica Norte", v30:41, k:["1,5","1.5"]},
    {c:"FE-0110", n:"Lámpara LED 12 W luz fría", cat:"Electricidad", cost:1100, price:2300, q:96, min:40, prov:"Distribuidora Eléctrica Norte", v30:180, k:["lampara","foco","led"]},
    {c:"FE-0201", n:"Látex interior blanco 20 L", cat:"Pinturería", cost:41000, price:64500, q:6, min:5, prov:"Pinturerías del NOA", v30:19, k:["latex","pintura"]},
    {c:"FE-0202", n:"Esmalte sintético 1 L", cat:"Pinturería", cost:6200, price:9800, q:24, min:10, prov:"Pinturerías del NOA", v30:33, k:["esmalte"]},
    {c:"FE-0210", n:"Rodillo de lana 22 cm", cat:"Pinturería", cost:2600, price:4900, q:9, min:10, prov:"Pinturerías del NOA", v30:22, k:["rodillo"]},
    {c:"FE-0301", n:"Tornillos 6 mm · caja ×100", cat:"Bulonería", cost:2300, price:4200, q:22, min:10, prov:"Bulonera Salta", v30:48, k:["tornillo","tornillos"]},
    {c:"FE-0302", n:"Tarugos 8 mm · bolsa ×100", cat:"Bulonería", cost:1400, price:2700, q:35, min:15, prov:"Bulonera Salta", v30:52, k:["tarugo","tarugos"]},
    {c:"FE-0401", n:"Caño termofusión 20 mm · 4 m", cat:"Sanitarios", cost:3300, price:5600, q:12, min:8, prov:"Agua y Gas Salta", v30:30, k:["caño","cano","termofusion"]},
    {c:"FE-0402", n:"Llave de paso 1/2\"", cat:"Sanitarios", cost:4800, price:8200, q:7, min:6, prov:"Agua y Gas Salta", v30:14, k:["llave de paso","llave"]},
    {c:"FE-0501", n:"Silicona acética transparente", cat:"Adhesivos", cost:2100, price:3900, q:28, min:12, prov:"Bulonera Salta", v30:37, k:["silicona"]},
    {c:"FE-0601", n:"Guantes de trabajo de vaqueta", cat:"Seguridad", cost:2900, price:5400, q:14, min:10, prov:"Seguridad Industrial NOA", v30:26, k:["guante","guantes"]}
  ];
  const CLI = [
    {id:1, n:"Juan Pablo Arias", t:"387 •••-4410", canal:"WhatsApp"}, {id:2, n:"Constructora Lerma", t:"387 •••-9021", canal:"WhatsApp"},
    {id:3, n:"María Inés Gutiérrez", t:"387 •••-1187", canal:"Instagram"}, {id:4, n:"Electricidad Don Bosco", t:"387 •••-5530", canal:"Mostrador"},
    {id:5, n:"Lucas Fernández", t:"387 •••-7702", canal:"WhatsApp"}, {id:6, n:"Consumidor final", t:"—", canal:"Mostrador"}
  ];
  let sid = 5310;
  const SALES = [];
  const add = (code, q, canal, cli, h) => { const p = P.find(x => x.c === code); SALES.unshift({id:sid++, c:code, n:p.n, q, unit:p.price, total:p.price * q, canal, cli, h}); };
  add("FE-0110", 6, "Mostrador", 6, "09:12"); add("FE-0301", 2, "WhatsApp", 1, "09:40"); add("FE-0401", 5, "WhatsApp", 2, "10:15"); add("FE-0201", 1, "Instagram", 3, "11:02");
  add("FE-0101", 1, "Mostrador", 4, "11:48"); add("FE-0501", 3, "Mostrador", 6, "16:20"); add("FE-0202", 2, "WhatsApp", 5, "17:05"); add("FE-0101", 2, "WhatsApp", 2, "18:30");
  const HIST = [612, 548, 701, 655, 480, 820, 310, 590, 640, 702, 588, 760, 845, 0].map(v => v * 1000);
  const ORD = []; let ordN = 88; let aiCount = 37;
  const alerts = () => P.filter(p => p.q < p.min);
  const todayTotal = () => SALES.reduce((s, x) => s + x.total, 0);

  function badge(){ const n = alerts().filter(p => !ORD.find(o => o.c === p.c && o.st !== "Recibido")).length; $("#badge-al").textContent = n || ""; }
  function sell(code, q, canal, cli){
    const p = P.find(x => x.c === code); if (!p) return "Producto inexistente";
    if (q < 1) return "La cantidad tiene que ser mayor a cero";
    if (q > p.q) return `No hay stock suficiente: quedan ${p.q}`;
    p.q -= q; const h = new Date().toTimeString().slice(0, 5);
    SALES.unshift({id:sid++, c:code, n:p.n, q, unit:p.price, total:p.price * q, canal, cli, h});
    if (p.q < p.min) toast(`Alerta: reponer ${p.n} (quedan ${p.q})`);
    rerender(); return null;
  }
  const lvl = p => { const st = p.q < p.min ? "crit" : p.q < p.min * 1.4 ? "warn" : "ok"; const col = {crit:"#E5533D", warn:"#E0A21B", ok:"#24946A"}[st];
    return {st, html:`<div class="bar"><i style="width:${Math.max(5, Math.min(100, p.q / (p.min * 3) * 100))}%;background:${col}"></i></div>`, label:{crit:"REPONER", warn:"BAJO", ok:"OK"}[st]}; };
  const canalPill = c => pill(c === "WhatsApp" ? "ok" : c === "Instagram" ? "warn" : "na", c.toUpperCase());

  const V = {}; let fStock = {q:"", cat:""}, fCanal = "";
  V.inicio = () => {
    const tot = todayTotal(), n = SALES.length, labels = [...Array(14)].map((_, i) => { const d = addDays(TODAY, i - 13); return `${d.getDate()}/${d.getMonth() + 1}`; });
    const hist = HIST.slice(); hist[13] = tot;
    const top = Object.values(SALES.reduce((a, s) => { (a[s.c] = a[s.c] || {n:s.n, q:0, t:0}); a[s.c].q += s.q; a[s.c].t += s.total; return a; }, {})).sort((a, b) => b.t - a.t).slice(0, 5);
    const wa = SALES.filter(s => s.canal !== "Mostrador").reduce((a, s) => a + s.total, 0);
    return `<div class="vh"><div><h1>Inicio</h1><p>Hoy · ${fmtD(TODAY)} · se actualiza solo con cada venta</p></div><button class="b o" data-new-sale>+ Nueva venta</button></div>
    <div class="kpis">
      <div class="kpi"><div class="l">Ventas de hoy</div><div class="v" id="k-tot">${ars(tot)}</div><div class="s">${n} operaciones</div></div>
      <div class="kpi"><div class="l">Ticket promedio</div><div class="v">${ars(tot / n)}</div><div class="s">por operación</div></div>
      <div class="kpi"><div class="l">Mensajes respondidos por IA</div><div class="v" id="k-ai">${aiCount}</div><div class="s">${ars(wa)} vendidos por redes</div></div>
      <div class="kpi"><div class="l">Productos para reponer</div><div class="v" style="color:${alerts().length ? "var(--crit)" : "inherit"}">${alerts().length}</div><div class="s">bajo el stock mínimo</div></div>
    </div>
    <div class="g2">
      <div class="card"><h3>Ventas de los últimos 14 días <span>en pesos</span></h3>${line([hist], {labels, w:680, h:240, fmt:v => "$" + Math.round(v / 1000) + "k"})}</div>
      <div class="card"><h3>Más vendidos hoy</h3><table><tbody>${top.map(t => `<tr><td>${esc(t.n)}</td><td class="num">${t.q} u.</td><td class="num">${ars(t.t)}</td></tr>`).join("")}</tbody></table></div>
    </div>
    <div class="g2b">
      <div class="card"><h3>Para reponer <button class="lnk" data-go="alertas">Ver alertas →</button></h3>${alerts().length ? `<table><tbody>${alerts().map(p => `<tr><td>${esc(p.n)}</td><td class="num">${p.q}/${p.min}</td><td>${pill("crit","REPONER")}</td></tr>`).join("")}</tbody></table>` : `<p class="empty">Todo el stock está sobre el mínimo.</p>`}</div>
      <div class="card"><h3>Últimas ventas <button class="lnk" data-go="ventas">Ver todas →</button></h3><table><tbody>${SALES.slice(0, 5).map(s => `<tr><td class="num">${s.h}</td><td>${esc(s.n)} ×${s.q}</td><td>${canalPill(s.canal)}</td><td class="num">${ars(s.total)}</td></tr>`).join("")}</tbody></table></div>
    </div>`;
  };
  V.stock = () => {
    const q = norm(fStock.q), cats = [...new Set(P.map(p => p.cat))];
    const list = P.filter(p => (!fStock.cat || p.cat === fStock.cat) && (!q || norm(p.n + p.c).includes(q)));
    return `<div class="vh"><div><h1>Stock</h1><p>${P.length} productos · valorizado a costo ${ars(P.reduce((s, p) => s + p.q * p.cost, 0))}</p></div>
      <div class="tools"><input id="sq" placeholder="Buscar producto o código" value="${esc(fStock.q)}" aria-label="Buscar producto"><select id="sc" aria-label="Categoría"><option value="">Todas las categorías</option>${cats.map(c => `<option ${c === fStock.cat ? "selected" : ""}>${c}</option>`).join("")}</select></div></div>
    <div class="card tscroll"><table><thead><tr><th>Código</th><th>Producto</th><th>Categoría</th><th>Stock</th><th>Mín.</th><th>Nivel</th><th>Precio</th><th>Estado</th><th></th></tr></thead><tbody>
    ${list.map(p => { const l = lvl(p); return `<tr><td class="num">${p.c}</td><td>${esc(p.n)}</td><td>${p.cat}</td><td class="num">${p.q}</td><td class="num">${p.min}</td><td>${l.html}</td><td class="num">${ars(p.price)}</td><td>${pill(l.st, l.label)}</td>
      <td class="tools" style="flex-wrap:nowrap"><button class="b g s" data-in="${p.c}">+ Ingreso</button><button class="b g s" data-edit="${p.c}">Editar</button></td></tr>`; }).join("") || `<tr><td colspan="9" class="empty">No hay productos con ese filtro.</td></tr>`}
    </tbody></table></div>`;
  };
  V.ventas = () => {
    const list = SALES.filter(s => !fCanal || s.canal === fCanal);
    const byC = ["WhatsApp","Instagram","Mostrador"].map(c => ({c, t:SALES.filter(s => s.canal === c).reduce((a, s) => a + s.total, 0)}));
    return `<div class="vh"><div><h1>Ventas</h1><p>Hoy · ${SALES.length} ventas · ${ars(todayTotal())}</p></div>
      <div class="tools"><div class="seg" role="group" aria-label="Filtrar por canal">${["","WhatsApp","Instagram","Mostrador"].map(c => `<button type="button" data-canal="${c}" class="${c === fCanal ? "act" : ""}">${c || "Todas"}</button>`).join("")}</div><button class="b o" data-new-sale>+ Nueva venta</button></div></div>
    <div class="g3">${byC.map(x => `<div class="kpi"><div class="l">${x.c}</div><div class="v">${ars(x.t)}</div></div>`).join("")}</div>
    <div class="card tscroll"><table><thead><tr><th>N.º</th><th>Hora</th><th>Producto</th><th>Cant.</th><th>Cliente</th><th>Canal</th><th>Total</th></tr></thead><tbody>
    ${list.map(s => `<tr><td class="num">#${s.id}</td><td class="num">${s.h}</td><td>${esc(s.n)}</td><td class="num">${s.q}</td><td><button class="lnk" data-cli="${s.cli}">${esc(CLI.find(c => c.id === s.cli).n)}</button></td><td>${canalPill(s.canal)}</td><td class="num">${ars(s.total)}</td></tr>`).join("")}
    </tbody></table></div>`;
  };
  V.clientes = () => `<div class="vh"><div><h1>Clientes</h1><p>${CLI.length} clientes · la IA los agenda solos cuando escriben</p></div><button class="b o" data-new-cli>+ Nuevo cliente</button></div>
    <div class="card tscroll"><table><thead><tr><th>Cliente</th><th>Teléfono</th><th>Canal habitual</th><th>Compras hoy</th><th>Total</th></tr></thead><tbody>
    ${CLI.map(c => { const s = SALES.filter(x => x.cli === c.id); return `<tr class="click" data-cli="${c.id}"><td>${esc(c.n)}</td><td class="num">${esc(c.t)}</td><td>${canalPill(c.canal)}</td><td class="num">${s.length}</td><td class="num">${ars(s.reduce((a, x) => a + x.total, 0))}</td></tr>`; }).join("")}
    </tbody></table></div>`;
  V.cliente = id => { const c = CLI.find(x => x.id === +id), s = SALES.filter(x => x.cli === c.id);
    return `<div class="crumb"><button data-go="clientes">Clientes</button> / ${esc(c.n)}</div><div class="vh"><div><h1>${esc(c.n)}</h1><p>${esc(c.t)} · canal habitual ${c.canal}</p></div></div>
    <div class="card tscroll"><h3>Compras de hoy</h3>${s.length ? `<table><tbody>${s.map(x => `<tr><td class="num">${x.h}</td><td>${esc(x.n)} ×${x.q}</td><td>${canalPill(x.canal)}</td><td class="num">${ars(x.total)}</td></tr>`).join("")}</tbody></table>` : `<p class="empty">Sin compras hoy.</p>`}</div>`; };
  V.alertas = () => {
    const al = alerts();
    return `<div class="vh"><div><h1>Alertas</h1><p>Productos bajo el mínimo y pedidos a proveedores</p></div></div>
    <div class="card"><h3>Reposición</h3>${al.length ? al.map(p => { const o = ORD.find(x => x.c === p.c && x.st !== "Recibido");
      return `<div class="alert ${o ? "w" : ""}" style="margin-bottom:8px"><span><b>${esc(p.n)}</b><br><span class="sub">Quedan ${p.q} · mínimo ${p.min} · vende ~${nf(p.v30 / 30, 1)} por día · proveedor ${esc(p.prov)}</span></span>
      ${o ? `<button class="b g s" data-recv="${o.n}">Marcar recibido</button>` : `<button class="b s" data-order="${p.c}">Pedir al proveedor</button>`}</div>`; }).join("") : `<p class="empty">No hay productos para reponer. ¡Bien!</p>`}</div>
    <div class="card tscroll"><h3>Pedidos a proveedores</h3>${ORD.length ? `<table><thead><tr><th>N.º</th><th>Producto</th><th>Cantidad</th><th>Proveedor</th><th>Estado</th></tr></thead><tbody>${ORD.map(o => `<tr><td class="num">PC-${o.n}</td><td>${esc(o.name)}</td><td class="num">${o.q}</td><td>${esc(o.prov)}</td><td>${pill(o.st === "Recibido" ? "ok" : "warn", o.st.toUpperCase())}</td></tr>`).join("")}</tbody></table>` : `<p class="empty">Todavía no hiciste pedidos. Cuando pidas desde una alerta, aparecen acá.</p>`}</div>`;
  };
  V.reportes = () => {
    const rev = P.map(p => ({...p, r:p.v30 * p.price})).sort((a, b) => b.r - a.r), tot = rev.reduce((s, p) => s + p.r, 0);
    let acc = 0; rev.forEach(p => { acc += p.r; p.cum = acc / tot; p.abc = p.cum <= .8 ? "A" : p.cum <= .95 ? "B" : "C"; });
    const cats = Object.entries(rev.reduce((a, p) => (a[p.cat] = (a[p.cat] || 0) + p.r, a), {})).sort((a, b) => b[1] - a[1]);
    return `<div class="vh"><div><h1>Reportes</h1><p>Últimos 30 días · para decidir qué comprar y qué no</p></div></div>
    <div class="g2">
      <div class="card"><h3>Facturación por categoría</h3>${bars(cats.map(([l, a], i) => ({l:l.slice(0, 10), a, hi:i === 0})), {w:620, fmt:v => "$" + Math.round(v / 1e6 * 10) / 10 + "M"})}</div>
      <div class="card"><h3>Cómo leer la clasificación ABC</h3><p class="note" style="font-size:14px;line-height:1.55"><b>A</b>: pocos productos que hacen el 80 % de tu facturación. Nunca pueden faltar.<br><b>B</b>: el siguiente 15 %. Control semanal.<br><b>C</b>: el resto. Comprá poco y seguido.<br><br>Los <b>días de cobertura</b> te dicen cuánto te dura el stock al ritmo actual de ventas.</p></div>
    </div>
    <div class="card tscroll"><h3>Clasificación ABC y días de cobertura</h3><table><thead><tr><th>Clase</th><th>Producto</th><th>Vendidas 30 d</th><th>Facturación</th><th>% acum.</th><th>Margen</th><th>Cobertura</th></tr></thead><tbody>
    ${rev.map(p => { const cov = p.q / (p.v30 / 30); return `<tr><td>${pill(p.abc === "A" ? "crit" : p.abc === "B" ? "warn" : "na", p.abc)}</td><td>${esc(p.n)}</td><td class="num">${p.v30}</td><td class="num">${ars(p.r)}</td><td class="num">${nf(p.cum * 100, 0)} %</td><td class="num">${nf((p.price - p.cost) / p.price * 100, 0)} %</td><td class="num" style="color:${cov < 7 ? "var(--crit)" : "inherit"}">${nf(cov, 0)} días</td></tr>`; }).join("")}
    </tbody></table></div>`;
  };

  const view = $("#view");
  const LABELS = {inicio:"Inicio", stock:"Stock", ventas:"Ventas", clientes:"Clientes", alertas:"Alertas", reportes:"Reportes"};
  V.cliente.parent = "clientes";
  let cur = {v:"inicio", arg:null};
  function render(v, arg){ cur = {v, arg}; view.innerHTML = V[v](arg); badge(); bind(); }
  function rerender(){ const st = {q:$("#sq")?.value}; render(cur.v, cur.arg); }
  const go = router(V, LABELS, render, "inicio");
  function bind(){
    $$("[data-go]", view).forEach(b => b.onclick = () => go(b.dataset.go));
    $$("[data-new-sale]", view).forEach(b => b.onclick = () => form("Nueva venta", [
      {id:"p", label:"Producto", type:"select", options:P.map(p => ({v:p.c, t:`${p.n} · quedan ${p.q}`}))},
      {id:"q", label:"Cantidad", type:"number", value:1, min:1},
      {id:"ch", label:"Canal", type:"select", options:["Mostrador","WhatsApp","Instagram"].map(v => ({v, t:v}))},
      {id:"cl", label:"Cliente", type:"select", options:CLI.map(c => ({v:c.id, t:c.n})), value:6}
    ], "Registrar venta", v => { const e = sell(v.p, parseInt(v.q, 10) || 0, v.ch, +v.cl); if (!e) toast("Venta registrada y stock descontado"); return e; }));
    $$("[data-in]", view).forEach(b => b.onclick = () => { const p = P.find(x => x.c === b.dataset.in); form(`Ingreso de mercadería · ${p.n}`, [{id:"q", label:"Cantidad que entra", type:"number", value:p.min * 2, min:1}], "Sumar al stock", v => { const q = parseInt(v.q, 10); if (!(q > 0)) return "Ingresá una cantidad mayor a cero"; p.q += q; toast(`Stock actualizado: ${p.q} unidades`); rerender(); }); });
    $$("[data-edit]", view).forEach(b => b.onclick = () => { const p = P.find(x => x.c === b.dataset.edit); form(`Editar · ${p.n}`, [{id:"price", label:"Precio de venta", type:"number", value:p.price, min:1}, {id:"min", label:"Stock mínimo", type:"number", value:p.min, min:0}], "Guardar", v => { const pr = parseInt(v.price, 10), mi = parseInt(v.min, 10); if (!(pr > 0) || !(mi >= 0)) return "Revisá precio y mínimo"; p.price = pr; p.min = mi; toast("Producto actualizado"); rerender(); }); });
    const sq = $("#sq"); if (sq) sq.oninput = () => { fStock.q = sq.value; const pos = sq.selectionStart; render("stock"); const n = $("#sq"); n.focus(); n.setSelectionRange(pos, pos); };
    const sc = $("#sc"); if (sc) sc.onchange = () => { fStock.cat = sc.value; render("stock"); };
    $$("[data-canal]", view).forEach(b => b.onclick = () => { fCanal = b.dataset.canal; render("ventas"); });
    $$("[data-cli]", view).forEach(b => b.onclick = () => go("cliente", b.dataset.cli));
    $$("[data-new-cli]", view).forEach(b => b.onclick = () => form("Nuevo cliente", [{id:"n", label:"Nombre", placeholder:"Nombre y apellido o empresa"}, {id:"t", label:"Teléfono", placeholder:"387 …"}, {id:"c", label:"Canal habitual", type:"select", options:["WhatsApp","Instagram","Mostrador"].map(v => ({v, t:v}))}], "Guardar cliente", v => { if (!v.n) return "Escribí el nombre del cliente"; CLI.push({id:CLI.length + 1, n:v.n, t:v.t || "—", canal:v.c}); toast("Cliente guardado"); rerender(); }));
    $$("[data-order]", view).forEach(b => b.onclick = () => { const p = P.find(x => x.c === b.dataset.order), q = Math.ceil(p.v30 / 2) - p.q; ORD.unshift({n:ordN++, c:p.c, name:p.n, q:Math.max(q, p.min), prov:p.prov, st:"Enviado"}); toast(`Pedido enviado a ${p.prov}`); rerender(); });
    $$("[data-recv]", view).forEach(b => b.onclick = () => { const o = ORD.find(x => x.n === +b.dataset.recv), p = P.find(x => x.c === o.c); o.st = "Recibido"; p.q += o.q; toast(`Recibido: +${o.q} ${p.n}`); rerender(); });
  }

  /* simulador de WhatsApp con respuestas automáticas */
  const W = whatsapp($("#wa"), {name:"Ferretería El Cerro", av:"EC"});
  let lastP = P[0];
  const findP = t => { const s = norm(t); return P.find(p => p.k.some(k => s.includes(norm(k)))); };
  const qty = t => { const m = norm(t).match(/\b(\d+)\b/) || null; const w = {un:1, una:1, uno:1, dos:2, tres:3, cuatro:4, cinco:5}; if (m) return +m[1]; const ww = norm(t).split(/\s+/).find(x => w[x]); return ww ? w[ww] : 1; };
  async function reply(text){
    aiCount++; flash($("#k-ai")); if ($("#k-ai")) $("#k-ai").textContent = aiCount;
    const s = norm(text), p = findP(text) || (/(reserv|quiero|dame|mandame|separame|compro|llevo)/.test(s) ? lastP : null);
    if (/(hora|abren|cierran|horario|abierto)/.test(s)) return W.bot("Abrimos de lunes a sábado de 8 a 13 y de 16 a 20:30. Si querés, te reservo lo que necesites y pasás a retirar.");
    if (/(donde|direccion|ubicacion|queda)/.test(s)) return W.bot("Estamos en Av. Ejemplo 1234, Salta Capital. Hay estacionamiento en la puerta.");
    if (p && /(reserv|quiero|dame|mandame|separame|compro|llevo)/.test(s)){
      const n = qty(text), err = sell(p.c, n, "WhatsApp", 5);
      if (err) return W.bot(`Uy, de ${p.n.split(" · ")[0].toLowerCase()} me quedan solo ${p.q}. ¿Te reservo esas?`);
      await W.bot(`Listo ✅ Te reservé ${n} × ${p.n}. Total ${ars(p.price * n)}. Te esperamos.`);
      if (p.q < p.min) W.say(`Aviso al dueño: reponer ${p.n}`, "sys");
      return;
    }
    if (p){ lastP = p; return W.bot(`¡Sí! ${p.n}: ${ars(p.price)}. Nos quedan ${p.q}. ¿Te reservo?`); }
    if (/(hola|buenas|buen dia|buenas tardes)/.test(s)) return W.bot("¡Hola! Soy el asistente de Ferretería El Cerro 👋 Te paso precios, stock y horarios al instante. ¿Qué estás buscando?");
    if (/(gracias|genial|perfecto|dale)/.test(s)) return W.bot("¡A vos! Cualquier cosa escribime 🙌");
    toast("Consulta derivada al dueño"); return W.bot("Esa te la contesta alguien del local en un ratito. Mientras, ¿te ayudo con precios o stock de algún producto?");
  }
  function opts(){ W.options([{label:"¿Tienen cable de 2,5 mm?"}, {label:"Reservame 2 rollos"}, {label:"¿Precio del látex de 20 L?"}, {label:"Quiero 3 latas de látex"}, {label:"¿A qué hora abren?"}], o => reply(o.label).then(opts)); }
  W.onText(v => reply(v));
  W.say("HOY", "sys"); W.say("¡Hola! Soy el asistente de Ferretería El Cerro 👋 ¿En qué te ayudo?", "biz"); opts();
})();
