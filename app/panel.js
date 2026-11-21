/* Panel del dueño: agenda (turnos, clases y pedidos), pedidos, stock, socios y caja. */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const pesos = n => (n < 0 ? "−$" : "$") + Math.abs(Math.round(n)).toLocaleString("es-AR");
  const call = (m, p) => NOA.call(m, p);
  const pad = n => String(n).padStart(2, "0");
  const fdia = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const min = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const COL = ["#E8772E", "#2F6FDE", "#1F8A5B", "#7A5AF8", "#C2412D", "#0E7490"];
  let ACT = null, P = null, TAB = "agenda", DIA = null, MES = null, VISTA = null, FILTRO = "activos", SOLO_BAJO = false, BUSCA = "";

  function toast(t) {
    const d = $("#toast"); d.innerHTML = t; d.classList.add("on");
    clearTimeout(toast.t); toast.t = setTimeout(() => d.classList.remove("on"), 3600);
  }
  function drawer(titulo, cuerpo, acciones) {
    $("#dr h2").textContent = titulo; $("#dr .db").innerHTML = cuerpo; $("#dr .da").innerHTML = acciones || "";
    $("#dr").classList.add("on"); $("#dr-bg").classList.add("on");
  }
  const cerrar = () => { $("#dr").classList.remove("on"); $("#dr-bg").classList.remove("on"); };
  async function hacer(fn, msg) { try { await fn(); if (msg) toast(msg); cerrar(); render(); } catch (e) { toast("⚠️ " + esc(e.message)); } }

  async function inicio() {
    try { P = await call("panel"); } catch (e) { document.body.innerHTML = `<p class="empty">Link inválido.</p>`; return; }
    document.title = `${P.nombre} · Panel`;
    $("#org").innerHTML = `<i>${esc(P.nombre.replace(/^(Salón|Taller|Café|Gimnasio|Ferretería|Matería)\s+/i, "").charAt(0))}</i><span>${esc(P.nombre)}<small>PANEL DEL NEGOCIO</small></span>`;
    if (P.link) $("#link").innerHTML = `Tu link para clientes <code>${esc(P.link)}</code>`;
    const tabs = [["agenda", "Agenda"]];
    if (P.tiene.productos) tabs.push(["pedidos", "Pedidos"], ["stock", "Stock"]);
    if (P.tiene.socios) tabs.push(["socios", "Socios"]);
    tabs.push(["caja", "Caja y balance"]);
    $("#tabs").innerHTML = tabs.map(([k, t]) => `<button data-t="${k}">${t}<em id="b-${k}" hidden></em></button>`).join("");
    $("#tabs").querySelectorAll("button").forEach(b => b.onclick = () => { TAB = b.dataset.t; render(); });
    $("#dr-bg").onclick = cerrar; $("#dr .x").onclick = cerrar;
    document.addEventListener("keydown", e => { if (e.key === "Escape") cerrar(); });
    NOA.suscribir((tipo, x) => {
      const nombres = {turno: "Nuevo turno", inscripcion: "Nueva reserva de clase", pedido: "Nuevo pedido", cancelado: "Se canceló una reserva"};
      if (nombres[tipo]) { toast(`<i>●</i> ${nombres[tipo]}${x && x.numero ? " #" + x.numero : ""}${x && x.inicio ? " · " + x.inicio.slice(11, 16) : ""}`); if (tipo !== "cancelado" && x && x.inicio) DIA = x.inicio.slice(0, 10); }
      if (!$("#dr").classList.contains("on")) render();
    });
    render();
  }

  async function render() {
    document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.t === TAB));
    badges();
    const v = $("#view");
    try {
      if (TAB === "agenda") await agenda(v);
      if (TAB === "pedidos") await pedidos(v);
      if (TAB === "stock") await stock(v);
      if (TAB === "socios") await socios(v);
      if (TAB === "caja") await caja(v);
    } catch (e) { v.innerHTML = `<div class="err">${esc(e.message)}</div>`; console.error(e); }
  }
  async function badges() {
    if (P.tiene.productos) {
      const ps = await call("pedidos", {estado: "reservado"}), st = await call("stock");
      const b1 = $("#b-pedidos"), b2 = $("#b-stock");
      if (b1) { b1.hidden = !ps.length; b1.textContent = ps.length; }
      const bajos = st.filter(x => x.bajo).length;
      if (b2) { b2.hidden = !bajos; b2.textContent = bajos; }
    }
    if (P.tiene.socios) { const ss = await call("socios"), b = $("#b-socios"), n = ss.filter(s => s.vencida).length; if (b) { b.hidden = !n; b.textContent = n; } }
  }

  // ── Agenda ────────────────────────────────────────────────────────
  async function agenda(v) {
    const a = await call("agenda", {dia: DIA});
    DIA = a.dia;
    const turnos = a.items.filter(i => i.kind === "turno"), clases = a.items.filter(i => i.kind === "clase"), peds = a.items.filter(i => i.kind === "pedido");
    const r = a.resumen;
    const k = [];
    if (P.tiene.turnos) k.push([P.rubro === "cafe" ? "Reservas de mesa" : "Turnos", r.turnos, turnos.filter(t => t.origen === "web").length + " por el link"]);
    if (P.tiene.clases) k.push(["Clases", r.clases, `${r.inscriptos} reservas`]);
    if (P.tiene.productos) k.push(["Pedidos", r.pedidos, peds.filter(p => p.entrega === "envio").length + " con envío"]);
    if (P.rubro !== "gimnasio") k.push(["Esperado del día", r.esperado, P.rubro === "cafe" ? "pedidos" : "si viene todo el mundo"]);
    else { const lleno = clases.length ? Math.round(100 * r.inscriptos / clases.reduce((x, c) => x + c.cupo, 0)) : 0; k.push(["Ocupación", lleno + " %", "de los cupos del día"]); }
    let html = `<div class="ph"><h1>${esc(a.es_hoy ? "Hoy · " + a.nombre : a.nombre)}</h1><span class="sp"></span>
      <button class="b hide-m" id="gcal">📅 Google Calendar</button><div class="nav2"><button class="b" id="ant">←</button><button class="b" id="hoy">Hoy</button><button class="b" id="sig">→</button></div>
      ${P.tiene.turnos && P.recursos.length ? `<div class="seg hide-m"><button data-vista="cal" class="${vistaCal() ? "on" : ""}">Por ${esc(P.recurso.toLowerCase())}</button><button data-vista="lista" class="${vistaCal() ? "" : "on"}">Lista</button></div>` : ""}</div>
      <div class="kpis">${k.map(([l, n, s]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${n}</div><div class="s">${s}</div></div>`).join("")}</div>`;
    if (P.tiene.turnos) {
      html += `<div class="sec-t">${P.rubro === "cafe" ? "Reservas de mesa" : "Turnos"}</div>`;
      html += !turnos.length ? `<div class="card empty">Sin ${P.rubro === "cafe" ? "reservas" : "turnos"} este día.</div>` : vistaCal() ? calendario(turnos, a) : listaTurnos(turnos);
    }
    if (P.tiene.clases) {
      const acts = [...new Set(clases.map(c => c.titulo))], vis = clases.filter(c => !ACT || c.titulo === ACT);
      html += `<div class="sec-t">Clases</div>` + (acts.length > 1 ? `<div class="fchips"><button data-act="" class="${!ACT ? "on" : ""}">Todas</button>${acts.map(a => `<button data-act="${esc(a)}" class="${ACT === a ? "on" : ""}">${esc(a)}</button>`).join("")}</div>` : "") +
        (vis.length ? `<div class="cgrid">${vis.map(claseCard).join("")}</div>` : `<div class="card empty">No hay clases este día.</div>`);
    }
    if (P.tiene.productos) html += `<div class="sec-t">${P.rubro === "cafe" ? "Pedidos para retirar" : "Retiros y envíos"}</div>` + (peds.length ? `<div class="pgrid">${peds.map(pedidoCard).join("")}</div>` : `<div class="card empty">No hay pedidos para este día.</div>`);
    v.innerHTML = html;
    const mover = n => { const d = new Date(DIA + "T12:00:00"); d.setDate(d.getDate() + n); DIA = fdia(d); render(); };
    $("#gcal").onclick = calendarioGoogle;
    $("#ant").onclick = () => mover(-1); $("#sig").onclick = () => mover(1); $("#hoy").onclick = () => { DIA = null; render(); };
    v.querySelectorAll("[data-act]").forEach(b => b.onclick = () => { ACT = b.dataset.act || null; render(); });
    v.querySelectorAll("[data-vista]").forEach(b => b.onclick = () => { VISTA = b.dataset.vista; render(); });
    v.querySelectorAll("[data-turno]").forEach(b => b.onclick = () => detalleTurno(turnos.find(t => t.id == b.dataset.turno)));
    v.querySelectorAll("[data-asis]").forEach(b => b.onclick = () => hacer(() => call("asistencia", {id: b.dataset.asis, asistio: b.dataset.v === "1"})));
    accionesPedido(v, peds);
  }
  function calendarioGoogle() {
    const url = P.calendario ? location.origin + P.calendario : null;
    drawer("Ver la agenda en tu celular", `<p>Tus turnos${P.tiene.clases ? ", clases" : ""}${P.tiene.productos ? " y retiros de pedidos" : ""} aparecen solos en Google Calendar o en el calendario del iPhone, junto con tus otras cosas.</p>
      <ol class="steps"><li>Abrí Google Calendar en la compu.</li><li>Al lado de "Otros calendarios", tocá <b>+</b> y elegí <b>Desde URL</b>.</li><li>Pegá este link y tocá <b>Agregar calendario</b>.</li></ol>
      <div class="codebox">${url ? esc(url) : "En tu sistema vas a tener un link privado como este:<br>https://tunegocio.noalabs/p/…/calendario.ics"}</div>
      <p style="color:var(--muted);font-size:12.5px;margin-top:10px">Google lo actualiza solo cada algunas horas. Para ver lo último al instante, usá este panel. El link es privado: no lo compartas.</p>`,
      url ? `<button class="b p" id="cp">Copiar link</button>` : "");
    if ($("#cp")) $("#cp").onclick = async () => { try { await navigator.clipboard.writeText(url); toast("Link copiado"); } catch (e) { toast("Copialo a mano desde el recuadro"); } };
  }
  const vistaCal = () => VISTA ? VISTA === "cal" && innerWidth > 760 : innerWidth > 760;
  const proDe = id => P.recursos.find(p => String(p.id) === String(id));
  const colorPro = id => { const i = P.recursos.findIndex(p => String(p.id) === String(id)); return (proDe(id) && proDe(id).color) || COL[(i < 0 ? 0 : i) % COL.length]; };
  function calendario(turnos, a) {
    const hs = a.horario.length ? a.horario : [{desde: "09:00", hasta: "19:00"}];
    const ini = Math.min(...hs.map(h => min(h.desde)), ...turnos.map(t => min(t.hora))), fin = Math.max(...hs.map(h => min(h.hasta)), ...turnos.map(t => min(t.fin)));
    const t0 = Math.floor(ini / 60) * 60, t1 = Math.ceil(fin / 60) * 60, ppm = 1.25, alto = (t1 - t0) * ppm;
    const cols = P.recursos;
    let g = "";
    for (let m = t0; m <= t1; m += 30) g += `<div class="gl ${m % 60 ? "" : "h"}" style="top:${(m - t0) * ppm}px"></div>`;
    const times = [...Array((t1 - t0) / 60 + 1)].map((_, i) => `<span style="top:${i * 60 * ppm}px">${pad(t0 / 60 + i)}:00</span>`).join("");
    const ahora = new Date(), nowM = ahora.getHours() * 60 + ahora.getMinutes();
    const now = a.es_hoy && nowM > t0 && nowM < t1 ? `<div class="now" style="top:${(nowM - t0) * ppm}px"></div>` : "";
    const ev = t => { const top = (min(t.hora) - t0) * ppm, h = Math.max(24, (min(t.fin) - min(t.hora)) * ppm - 3);
      return `<button class="ev ${t.estado} ${t.nuevo ? "nuevo" : ""}" data-turno="${t.id}" style="top:${top}px;height:${h}px;--c:${colorPro(t.pro)}"><b>${esc(t.cliente)}</b><small>${t.hora} · ${esc(t.titulo)}</small>${h > 50 ? `<small>${t.modalidad === "domicilio" ? "🚐 " + esc(t.direccion) : t.extra && t.extra.patente ? esc(t.extra.auto + " · " + t.extra.patente) : t.origen === "web" ? "Reservó por el link" : ""}</small>` : ""}</button>`; };
    return `<div class="cal" style="grid-template-columns:56px repeat(${cols.length},minmax(140px,1fr))"><div class="hd"><div></div>${cols.map(c => `<div><i style="background:${colorPro(c.id)}"></i>${esc(c.nombre)} <small>${esc(c.rol || "")}</small></div>`).join("")}</div>
      <div class="times" style="height:${alto}px">${times}</div>${cols.map(c => `<div class="col ${c.dias && !c.dias.includes(a.dia_semana) ? "off" : ""}" style="height:${alto}px">${c.dias && !c.dias.includes(a.dia_semana) ? `<span class="offt">No trabaja este día</span>` : ""}${g}${now}${turnos.filter(t => String(t.pro) === String(c.id)).map(ev).join("")}</div>`).join("")}</div>`;
  }
  const estadoTag = e => ({confirmado: `<span class="tag blue">Confirmado</span>`, asistio: `<span class="tag ok">Vino</span>`, ausente: `<span class="tag crit">No vino</span>`, cancelado: `<span class="tag">Cancelado</span>`}[e] || "");
  function listaTurnos(turnos) {
    return `<div class="rows">${turnos.map(t => `<button class="row ${t.estado} ${t.nuevo ? "nuevo" : ""}" data-turno="${t.id}"><span class="h">${t.hora}</span><span class="tx"><b>${esc(t.cliente)}</b>
      <small>${esc(t.titulo)}${t.pro && proDe(t.pro) ? " · " + esc(proDe(t.pro).nombre) : ""}${t.modalidad === "domicilio" ? " · 🚐 " + esc(t.direccion) : ""}${t.extra && t.extra.patente ? " · " + esc(t.extra.patente) : ""}</small></span>
      ${t.origen === "web" ? `<span class="tag acc hide-m">Link</span>` : ""}${estadoTag(t.estado)}</button>`).join("")}</div>`;
  }
  function detalleTurno(t) {
    if (!t) return;
    const ex = Object.entries(t.extra || {}).filter(([, x]) => x).map(([k, x]) => `<dt>${esc(k === "auto" ? "Auto" : k === "patente" ? "Patente" : k === "problema" ? "Problema" : k)}</dt><dd>${esc(x)}</dd>`).join("");
    drawer(`${t.hora} · ${t.titulo}`, `<dl class="kv"><dt>Cliente</dt><dd><b>${esc(t.cliente)}</b></dd><dt>Celular</dt><dd><a href="https://wa.me/${t.telefono}" target="_blank" rel="noopener">+${esc(t.telefono)}</a></dd>
      <dt>Horario</dt><dd>${t.hora} a ${t.fin}</dd>${t.pro && proDe(t.pro) ? `<dt>${esc(P.recurso)}</dt><dd>${esc(proDe(t.pro).nombre)}</dd>` : ""}
      <dt>Dónde</dt><dd>${t.modalidad === "domicilio" ? "A domicilio · " + esc(t.direccion) : "En el local"}</dd>${ex}
      <dt>Precio</dt><dd>${esc(t.precio)}</dd><dt>Estado</dt><dd>${estadoTag(t.estado)}</dd><dt>Origen</dt><dd>${t.origen === "web" ? "Lo sacó por el link" : "Cargado en el panel"}</dd></dl>`,
      (t.recordar ? `<a class="b wa" href="${esc(t.recordar)}" target="_blank" rel="noopener">Recordar por WhatsApp</a>` : "") +
      (t.estado === "confirmado" ? `<button class="b ok" id="d-si">Vino</button><button class="b" id="d-no">No vino</button><button class="b crit" id="d-can">Cancelar</button>` : `<button class="b" id="d-re">Volver a confirmado</button>`));
    const set = e => hacer(() => call("estadoTurno", {id: t.id, estado: e}), e === "asistio" ? "Listo, quedó registrado en la caja" : "Listo");
    if ($("#d-si")) { $("#d-si").onclick = () => set("asistio"); $("#d-no").onclick = () => set("ausente"); $("#d-can").onclick = () => set("cancelado"); }
    if ($("#d-re")) $("#d-re").onclick = () => set("confirmado");
  }
  function claseCard(c) {
    const n = c.inscriptos.length, pct = Math.min(100, Math.round(100 * n / c.cupo));
    return `<div class="cc ${c.nuevo ? "nuevo" : ""}" style="--c:${c.color}"><div class="t"><b>${esc(c.titulo)}</b><span class="m">${esc(c.profe)}</span><span class="h">${c.hora}</span></div>
      <div class="meter"><i style="width:${pct}%"></i></div><div class="m">${n} de ${c.cupo} lugares${n >= c.cupo ? " · <b style='color:var(--crit)'>completa</b>" : ""}</div>
      ${n ? `<details ${c.nuevo ? "open" : ""}><summary>Ver anotados y tomar asistencia</summary><ul>${c.inscriptos.map(i => `<li class="${i.nuevo ? "nuevo" : ""}"><span>${esc(i.nombre)}</span>
        <button class="tg ${i.asistio === true ? "si" : ""}" data-asis="${i.id}" data-v="1">Vino</button><button class="tg ${i.asistio === false ? "no" : ""}" data-asis="${i.id}" data-v="0">Faltó</button></li>`).join("")}</ul></details>` : ""}</div>`;
  }

  // ── Pedidos ───────────────────────────────────────────────────────
  const estPed = e => ({reservado: `<span class="tag acc">Nuevo</span>`, listo: `<span class="tag blue">Listo</span>`, entregado: `<span class="tag ok">Entregado</span>`, cancelado: `<span class="tag">Cancelado</span>`}[e]);
  function pedidoCard(p) {
    const items = p.items.map(i => `<li><span>${i.cant}${i.unidad === "m" ? " m" : " ×"} ${esc(i.nombre)}</span><span>${pesos(i.cant * i.precio)}</span></li>`).join("");
    return `<div class="pc ${p.nuevo ? "nuevo" : ""}"><div class="t"><b>#${p.numero}</b>${estPed(p.estado)}<span class="sp"></span><span class="tag ${p.entrega === "envio" ? "warn" : ""}">${p.entrega === "envio" ? "Envío" : "Retira"} ${esc(p.franja)}</span></div>
      <div><b>${esc(p.cliente)}</b> <a class="m" href="https://wa.me/${p.telefono}" target="_blank" rel="noopener">+${esc(p.telefono)}</a>${p.cuando ? `<div class="m">${esc(p.cuando)}</div>` : ""}${p.entrega === "envio" ? `<div class="m">🚚 ${esc(p.direccion)}</div>` : ""}</div>
      <ul>${items}${p.envio ? `<li class="m"><span>Envío</span><span>${pesos(p.envio)}</span></li>` : ""}<li style="font-weight:700;border-top:1px solid var(--line);margin-top:4px;padding-top:4px"><span>Total</span><span>${esc(p.total_txt || p.total)}</span></li></ul>
      ${p.nota ? `<div class="nota">📝 ${esc(p.nota)}</div>` : ""}
      <div class="acts">${p.estado === "reservado" ? `<button class="b p s" data-ped="${p.id}" data-e="listo">Marcar listo</button>` : ""}
        ${p.estado === "listo" ? `<a class="b wa s" href="${esc(p.avisar)}" target="_blank" rel="noopener">Avisar que está listo</a><button class="b ok s" data-ped="${p.id}" data-e="entregado">Entregado y cobrado</button>` : ""}
        ${["reservado", "listo"].includes(p.estado) ? `<button class="b crit s" data-ped="${p.id}" data-e="cancelado">Cancelar</button>` : ""}</div></div>`;
  }
  function accionesPedido(v) {
    v.querySelectorAll("[data-ped]").forEach(b => b.onclick = () => {
      const e = b.dataset.e;
      if (e === "cancelado" && !confirmar(b)) return;
      hacer(() => call("estadoPedido", {id: b.dataset.ped, estado: e}), {listo: "Pedido listo. Avisale al cliente por WhatsApp.", entregado: "Entregado. Se sumó a la caja.", cancelado: "Pedido cancelado. El stock volvió a estar disponible."}[e]);
    });
  }
  function confirmar(b) { if (b.dataset.ok) return true; b.dataset.ok = "1"; b.textContent = "¿Seguro? Tocá de nuevo"; setTimeout(() => { delete b.dataset.ok; b.textContent = "Cancelar"; }, 3000); return false; }
  async function pedidos(v) {
    const ps = await call("pedidos", {estado: FILTRO === "todos" ? "" : FILTRO});
    v.innerHTML = `<div class="ph"><h1>Pedidos</h1><span class="sp"></span><div class="seg">${[["activos", "Para preparar"], ["entregado", "Entregados"], ["cancelado", "Cancelados"]].map(([k, t]) => `<button data-f="${k}" class="${FILTRO === k ? "on" : ""}">${t}</button>`).join("")}</div></div>
      ${ps.length ? `<div class="pgrid">${ps.map(pedidoCard).join("")}</div>` : `<div class="card empty">No hay pedidos acá.</div>`}`;
    v.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { FILTRO = b.dataset.f; render(); });
    accionesPedido(v);
  }

  // ── Stock ─────────────────────────────────────────────────────────
  async function stock(v) {
    const st = await call("stock");
    const bajos = st.filter(x => x.bajo), apart = st.reduce((a, x) => a + x.apartado, 0);
    const lista = st.filter(x => (!SOLO_BAJO || x.bajo) && (!BUSCA || x.nombre.toLowerCase().includes(BUSCA.toLowerCase())));
    v.innerHTML = `<div class="ph"><h1>Stock</h1><span class="sp"></span><input class="txt" id="bus" placeholder="Buscar producto" value="${esc(BUSCA)}"><label class="b"><input type="checkbox" id="sb" ${SOLO_BAJO ? "checked" : ""}> Solo para reponer</label></div>
      <div class="kpis"><div class="kpi"><div class="l">Productos</div><div class="v">${st.length}</div><div class="s">en el catálogo</div></div>
        <div class="kpi"><div class="l">Para reponer</div><div class="v ${bajos.length ? "neg" : ""}">${bajos.length}</div><div class="s">en el mínimo o menos</div></div>
        <div class="kpi"><div class="l">Apartado en pedidos</div><div class="v">${apart}</div><div class="s">unidades reservadas sin retirar</div></div></div>
      <div class="card tw"><table><thead><tr><th>Producto</th><th class="hide-m">Categoría</th><th class="n">Precio</th><th class="n">Disponible</th><th class="n hide-m">Apartado</th><th class="n hide-m">Mínimo</th><th></th></tr></thead><tbody>
      ${lista.map(x => `<tr class="${x.bajo ? "bajo" : ""}"><td><b>${esc(x.nombre)}</b>${x.bajo ? ` <span class="tag crit">Reponer</span>` : ""}</td><td class="hide-m">${esc(x.cat)}</td><td class="n">${esc(x.precio)}</td>
        <td class="n">${x.ilimitado ? `<span class="tag">Sin control</span>` : `<input class="num" type="number" min="0" value="${x.stock}" data-st="${x.id}" aria-label="Stock de ${esc(x.nombre)}">`}</td>
        <td class="n hide-m">${x.apartado || "—"}</td><td class="n hide-m">${x.ilimitado ? "—" : x.minimo}</td><td class="n"><button class="b s" data-v="${x.id}" ${!x.ilimitado && x.stock < 1 ? "disabled" : ""}>Vendí 1</button></td></tr>`).join("")}</tbody></table></div>
      <p class="m" style="color:var(--muted);font-size:12.5px;margin-top:8px">El stock baja solo cuando un cliente reserva por el link, y vuelve si cancela. "Vendí 1" es para las ventas en el mostrador: descuenta y lo suma a la caja.</p>`;
    $("#sb").onchange = e => { SOLO_BAJO = e.target.checked; render(); };
    $("#bus").oninput = e => { BUSCA = e.target.value; clearTimeout(stock.t); stock.t = setTimeout(async () => { await render(); const i = $("#bus"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); };
    v.querySelectorAll("[data-st]").forEach(i => i.onchange = () => hacer(() => call("ajustarStock", {id: i.dataset.st, stock: i.value}), "Stock actualizado"));
    v.querySelectorAll("[data-v]").forEach(b => b.onclick = () => hacer(() => call("ajustarStock", {id: b.dataset.v, vendido: 1}), "Venta registrada"));
  }

  // ── Socios ────────────────────────────────────────────────────────
  async function socios(v) {
    const ss = await call("socios"), hoy = fdia(new Date());
    const dias = s => Math.round((new Date(s.vence + "T12:00:00") - new Date(hoy + "T12:00:00")) / 864e5);
    const lista = ss.filter(s => !BUSCA || s.nombre.toLowerCase().includes(BUSCA.toLowerCase()) || s.telefono.includes(BUSCA.replace(/\D/g, "")));
    const venc = ss.filter(s => s.vencida), prox = ss.filter(s => !s.vencida && dias(s) <= 5);
    v.innerHTML = `<div class="ph"><h1>Socios</h1><span class="sp"></span><input class="txt" id="bus" placeholder="Buscar por nombre o celular" value="${esc(BUSCA)}"></div>
      <div class="kpis"><div class="kpi"><div class="l">Socios</div><div class="v">${ss.length}</div><div class="s">cuota ${pesos(P.cuota || 0)}</div></div>
        <div class="kpi"><div class="l">Cuota vencida</div><div class="v ${venc.length ? "neg" : ""}">${venc.length}</div><div class="s">no pueden reservar clases</div></div>
        <div class="kpi"><div class="l">Vencen en 5 días</div><div class="v">${prox.length}</div><div class="s">mandales el aviso</div></div></div>
      <div class="card tw"><table><thead><tr><th>Socio</th><th class="hide-m">Plan</th><th>Vence</th><th></th></tr></thead><tbody>
      ${lista.map(s => { const d = dias(s); const aviso = `https://wa.me/${s.telefono}?text=${encodeURIComponent(`Hola ${s.nombre.split(" ")[0]}! ${d < 0 ? "Tu cuota de " + P.nombre + " está vencida." : "Tu cuota de " + P.nombre + " vence " + (d === 0 ? "hoy" : `en ${d} día${d > 1 ? "s" : ""}`) + "."} Podés pagarla por transferencia y seguir reservando tus clases 💪`)}`;
        return `<tr><td><b>${esc(s.nombre)}</b><div style="color:var(--muted);font-size:12px">+${esc(s.telefono)}</div></td><td class="hide-m">${esc(s.plan)}</td>
        <td>${s.vencida ? `<span class="tag crit">Vencida ${s.vence.slice(8)}/${s.vence.slice(5, 7)}</span>` : d <= 5 ? `<span class="tag warn">${d === 0 ? "Hoy" : `En ${d} días`}</span>` : `<span class="tag ok">${s.vence.slice(8)}/${s.vence.slice(5, 7)}</span>`}</td>
        <td class="n" style="white-space:nowrap">${s.vencida || d <= 5 ? `<a class="b s" href="${aviso}" target="_blank" rel="noopener">Avisar</a> ` : ""}<button class="b p s" data-pago="${s.telefono}">Registrar pago</button></td></tr>`; }).join("")}</tbody></table></div>`;
    $("#bus").oninput = e => { BUSCA = e.target.value; clearTimeout(socios.t); socios.t = setTimeout(async () => { await render(); const i = $("#bus"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); };
    v.querySelectorAll("[data-pago]").forEach(b => b.onclick = () => hacer(async () => { const r = await call("pagarCuota", {telefono: b.dataset.pago}); toast(`Pago registrado. Ya puede reservar. Vence el ${r.vence.slice(8)}/${r.vence.slice(5, 7)}`); }));
  }

  // ── Caja y balance ────────────────────────────────────────────────
  async function caja(v) {
    const c = await call("caja", {mes: MES});
    MES = c.mes;
    const [y, m] = c.mes.split("-").map(Number);
    const nomMes = new Date(y, m - 1, 1).toLocaleDateString("es-AR", {month: "long", year: "numeric"});
    const maxCat = Math.max(1, ...c.categorias.map(x => x.monto));
    const b = c.balance, patrimonio = b.caja + b.stock + b.a_cobrar - b.deudas;
    v.innerHTML = `<div class="ph"><h1>Caja · ${esc(nomMes)}</h1><span class="sp"></span><div class="nav2"><button class="b" id="m-ant">←</button><button class="b" id="m-sig">→</button></div><button class="b p" id="xls">⬇ Bajar Excel</button></div>
      <div class="kpis"><div class="kpi"><div class="l">Ingresos</div><div class="v pos">${pesos(c.ingresos)}</div><div class="s">del mes</div></div>
        <div class="kpi"><div class="l">Egresos</div><div class="v neg">${pesos(c.egresos)}</div><div class="s">del mes</div></div>
        <div class="kpi"><div class="l">Resultado</div><div class="v ${c.resultado >= 0 ? "pos" : "neg"}">${pesos(c.resultado)}</div><div class="s">ingresos − egresos</div></div></div>
      <div class="two"><div class="card"><h3>¿En qué entra y sale la plata?</h3><div class="bars">${c.categorias.map(x => `<div><span>${esc(x.cat)}</span><i style="width:${Math.max(3, 100 * x.monto / maxCat)}%;background:${x.tipo === "ingreso" ? "var(--ok)" : "var(--crit)"}"></i><b style="text-align:right">${pesos(x.monto)}</b></div>`).join("") || `<p class="empty">Sin movimientos.</p>`}</div></div>
        <div class="card"><h3>Balance sencillo <span class="sp"></span><span class="tag">hoy</span></h3><div class="bal">
          <div><span>Plata en caja y banco</span><b>${pesos(b.caja)}</b></div>${P.tiene.productos ? `<div><span>Mercadería en stock (al costo)</span><b>${pesos(b.stock)}</b></div><div><span>Pedidos por cobrar</span><b>${pesos(b.a_cobrar)}</b></div>` : ""}
          <div><span>Lo que debés (proveedores)</span><b style="color:var(--crit)">${b.deudas ? "−" + pesos(b.deudas) : pesos(0)}</b></div>
          <div class="tot"><span>Lo que vale tu negocio hoy</span><b>${pesos(patrimonio)}</b></div></div>
          <p style="color:var(--muted);font-size:12px;margin-top:6px">Es un balance de gestión para decidir. Los estados contables oficiales los firma tu contador, y le podés pasar este Excel.</p></div></div>
      <div class="card" style="margin-top:12px"><h3>Cargar un movimiento</h3><form class="form" id="fm"><select class="txt" id="m-t"><option value="egreso">Egreso</option><option value="ingreso">Ingreso</option></select>
        <input class="txt" id="m-c" placeholder="Concepto (ej: compra de insumos)"><input class="txt" id="m-cat" placeholder="Categoría" list="cats"><input class="txt" id="m-m" type="number" min="1" placeholder="Monto"><button class="b p">Guardar</button>
        <datalist id="cats">${[...new Set(c.categorias.map(x => x.cat))].map(x => `<option value="${esc(x)}">`).join("")}</datalist></form></div>
      <div class="card tw" style="margin-top:12px"><h3>Movimientos</h3><table><thead><tr><th>Fecha</th><th>Concepto</th><th class="hide-m">Categoría</th><th class="hide-m">Medio</th><th class="n">Monto</th></tr></thead><tbody>
        ${c.movimientos.map(x => `<tr><td>${x.fecha.slice(8, 10)}/${x.fecha.slice(5, 7)}</td><td>${esc(x.concepto)}</td><td class="hide-m">${esc(x.cat)}</td><td class="hide-m">${esc(x.medio)}</td><td class="n" style="color:${x.tipo === "ingreso" ? "var(--ok)" : "var(--crit)"};font-weight:600">${x.tipo === "ingreso" ? "+" : "−"}${pesos(x.monto)}</td></tr>`).join("") || `<tr><td colspan="5" class="empty">Sin movimientos este mes.</td></tr>`}</tbody></table></div>`;
    const mover = n => { const d = new Date(y, m - 1 + n, 1); MES = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; render(); };
    $("#m-ant").onclick = () => mover(-1); $("#m-sig").onclick = () => mover(1);
    $("#fm").onsubmit = e => { e.preventDefault(); hacer(() => call("movimiento", {tipo: $("#m-t").value, concepto: $("#m-c").value, cat: $("#m-cat").value || "Otros", monto: $("#m-m").value}), "Movimiento guardado"); };
    $("#xls").onclick = () => excel(c, nomMes);
  }
  function cargarXLSX() {
    if (window.XLSX) return Promise.resolve();
    return new Promise((ok, mal) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"; s.onload = ok; s.onerror = mal; document.head.append(s); });
  }
  async function excel(c, nomMes) {
    try { await cargarXLSX(); } catch (e) { toast("No se pudo cargar el generador de Excel. Revisá la conexión."); return; }
    const X = window.XLSX, wb = X.utils.book_new();
    const movs = [...c.movimientos].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const filas = [["Fecha", "Tipo", "Categoría", "Concepto", "Medio", "Ingreso", "Egreso"]];
    movs.forEach(x => filas.push([new Date(x.fecha.replace(" ", "T")), x.tipo === "ingreso" ? "Ingreso" : "Egreso", x.cat, x.concepto, x.medio, x.tipo === "ingreso" ? x.monto : null, x.tipo === "egreso" ? x.monto : null]));
    const n = filas.length;
    const ws = X.utils.aoa_to_sheet(filas, {cellDates: true});
    X.utils.sheet_add_aoa(ws, [["", "", "", "TOTAL", "", {t: "n", f: `SUM(F2:F${n})`}, {t: "n", f: `SUM(G2:G${n})`}]], {origin: `A${n + 1}`});
    ws["!cols"] = [{wch: 11}, {wch: 9}, {wch: 18}, {wch: 34}, {wch: 14}, {wch: 13}, {wch: 13}];
    for (let r = 2; r <= n + 1; r++) { ["F", "G"].forEach(col => { if (ws[col + r]) ws[col + r].z = '"$"#,##0'; }); if (ws["A" + r] && ws["A" + r].t === "d") ws["A" + r].z = "dd/mm/yyyy"; }
    const b = c.balance;
    const res = X.utils.aoa_to_sheet([
      [`${c.negocio} · ${nomMes}`], [],
      ["Resultado del mes"], ["Ingresos", {t: "n", f: `Movimientos!F${n + 1}`}], ["Egresos", {t: "n", f: `Movimientos!G${n + 1}`}], ["Resultado", {t: "n", f: "B4-B5"}], [],
      ["Balance sencillo (hoy)"], ["Plata en caja y banco", b.caja], ["Mercadería en stock (al costo)", b.stock], ["Pedidos por cobrar", b.a_cobrar], ["Lo que debés", b.deudas],
      ["Lo que vale tu negocio", {t: "n", f: "B9+B10+B11-B12"}], [], ["Cambiá los valores de la columna B y los totales se recalculan solos."]]);
    ["B4", "B5", "B6", "B9", "B10", "B11", "B12", "B13"].forEach(k => { if (res[k]) res[k].z = '"$"#,##0'; });
    res["!cols"] = [{wch: 34}, {wch: 16}];
    X.utils.book_append_sheet(wb, res, "Resumen");
    X.utils.book_append_sheet(wb, ws, "Movimientos");
    X.writeFile(wb, `${c.negocio.replace(/\s+/g, "_")}_caja_${c.mes}.xlsx`);
    toast("Excel descargado, con las fórmulas armadas");
  }

  addEventListener("resize", () => { clearTimeout(render.r); render.r = setTimeout(() => TAB === "agenda" && render(), 250); });
  inicio();
})();
