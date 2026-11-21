/* Panel del dueño: agenda, estadías, pedidos, stock, socios, clientes, números, catálogo y caja. */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const pesos = n => (n < 0 ? "−$" : "$") + Math.abs(Math.round(n || 0)).toLocaleString("es-AR");
  const call = (m, p) => NOA.call(m, p);
  const pad = n => String(n).padStart(2, "0");
  const fdia = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const min = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const ddmm = f => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
  const COL = ["#E8772E", "#2F6FDE", "#1F8A5B", "#7A5AF8", "#C2412D", "#0E7490", "#B45309", "#475569"];
  const DSEM = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  let ACT = null, P = null, TAB = "agenda", DIA = null, MES = null, VISTA = null, FILTRO = "activos", SOLO_BAJO = false, BUSCA = "", ULTIMA_AGENDA = null;

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
  const excelNombre = s => `${P.nombre.replace(/[^\wÁÉÍÓÚáéíóúñÑ]+/g, "_")}_${s}.xlsx`;
  function excel(nombre, hojas) {
    try { NOA_XLSX.bajar(excelNombre(nombre), hojas); toast("Excel descargado, con las fórmulas armadas"); }
    catch (e) { toast("No se pudo armar el Excel: " + esc(e.message)); }
  }

  async function inicio() {
    try { P = await call("panel"); } catch (e) { document.body.innerHTML = `<p class="empty">Link inválido.</p>`; return; }
    if (P.slug && !NOA.slug) NOA.slug = P.slug;
    document.title = `${P.nombre} · Panel`;
    $("#org").innerHTML = `<i>${esc(P.nombre.replace(/^(Salón|Taller|Café|Gimnasio|Ferretería|Matería|Despensa|Tienda|Restó|Rotisería|Heladería|Academia|Cabañas|Consultorio|Estudio|Norte)\s+/i, "").charAt(0))}</i><span>${esc(P.nombre)}<small>PANEL DEL NEGOCIO</small></span>`;
    if (P.link) $("#link").innerHTML = `Tu link para clientes <code>${esc(P.link)}</code>`;
    const tabs = [];
    if (P.tiene.estadias) tabs.push(["estadias", "Estadías"]);
    tabs.push(["agenda", P.tiene.estadias ? "Entradas y salidas" : "Agenda"]);
    if (P.tiene.productos) tabs.push(["pedidos", "Pedidos"], ["stock", "Stock"]);
    if (P.tiene.socios) tabs.push(["socios", P.textos && P.textos.socio === "alumno" ? "Alumnos" : "Socios"]);
    tabs.push(["clientes", "Clientes"], ["numeros", "Números"], ["catalogo", P.tiene.productos && !P.tiene.turnos ? "Productos y precios" : "Servicios y precios"], ["caja", "Caja y balance"]);
    TAB = tabs[0][0];
    $("#tabs").innerHTML = tabs.map(([k, t]) => `<button data-t="${k}">${t}<em id="b-${k}" hidden></em></button>`).join("");
    $("#tabs").querySelectorAll("button").forEach(b => b.onclick = () => { TAB = b.dataset.t; BUSCA = ""; render(); });
    $("#dr-bg").onclick = cerrar; $("#dr .x").onclick = cerrar;
    document.addEventListener("keydown", e => { if (e.key === "Escape") cerrar(); });
    NOA.suscribir((tipo, x) => {
      const nombres = {turno: "Nuevo turno", inscripcion: "Nueva reserva de clase", pedido: "Nuevo pedido", estadia: "Nueva reserva de estadía", cancelado: "Se canceló una reserva"};
      if (nombres[tipo] && !(x && x.origen === "panel")) {
        toast(`<i>●</i> ${nombres[tipo]}${x && x.numero ? " #" + x.numero : ""}${x && x.inicio ? " · " + x.inicio.slice(11, 16) : ""}${x && x.desde ? " · " + ddmm(x.desde) : ""}`);
        if (tipo !== "cancelado" && x && x.inicio) DIA = x.inicio.slice(0, 10);
      }
      if (!$("#dr").classList.contains("on")) render();
    });
    render();
  }

  async function render() {
    document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.t === TAB));
    badges();
    const v = $("#view");
    try {
      await ({agenda, estadias, pedidos, stock, socios, clientes, numeros, catalogo, caja}[TAB])(v);
    } catch (e) { v.innerHTML = `<div class="err">${esc(e.message)}</div>`; console.error(e); }
  }
  async function badges() {
    const set = (k, n) => { const b = $("#b-" + k); if (b) { b.hidden = !n; b.textContent = n; } };
    if (P.tiene.productos) { set("pedidos", (await call("pedidos", {estado: "reservado"})).length); set("stock", (await call("stock")).filter(x => x.bajo).length); }
    if (P.tiene.socios) set("socios", (await call("socios")).filter(s => s.vencida).length);
    if (P.tiene.estadias) set("estadias", (await call("estadias", {})).reservas.filter(e => e.estado === "pendiente").length);
  }
  const buscador = (ph) => `<input class="txt" id="bus" placeholder="${ph}" value="${esc(BUSCA)}" aria-label="${ph}">`;
  function conectarBuscador() {
    const b = $("#bus"); if (!b) return;
    b.oninput = e => { BUSCA = e.target.value; clearTimeout(conectarBuscador.t); conectarBuscador.t = setTimeout(async () => { await render(); const i = $("#bus"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); };
  }

  // ── Agenda ────────────────────────────────────────────────────────
  async function agenda(v) {
    const a = await call("agenda", {dia: DIA});
    DIA = a.dia; ULTIMA_AGENDA = a;
    const turnos = a.items.filter(i => i.kind === "turno"), clases = a.items.filter(i => i.kind === "clase"), peds = a.items.filter(i => i.kind === "pedido"), ests = a.items.filter(i => i.kind === "estadia");
    const r = a.resumen, k = [];
    const palabra = P.rubro === "canchas" ? "Reservas de cancha" : ["cafe", "restaurante"].includes(P.rubro) ? "Reservas de mesa" : P.rubro === "inmobiliaria" ? "Visitas" : P.rubro === "estudio" ? "Reuniones" : "Turnos";
    if (P.tiene.estadias) { k.push(["Entran", r.entradas, "check-in del día"], ["Salen", r.salidas, "check-out del día"]); }
    if (P.tiene.turnos) k.push([palabra, r.turnos, turnos.filter(t => t.origen === "web").length + " por el link"]);
    if (P.tiene.clases) k.push(["Clases", r.clases, `${r.inscriptos} reservas`]);
    if (P.tiene.productos) k.push(["Pedidos", r.pedidos, peds.filter(p => p.entrega === "envio").length + " con envío"]);
    if (P.tiene.clases) { const lleno = clases.length ? Math.round(100 * r.inscriptos / clases.reduce((x, c) => x + c.cupo, 0)) : 0; k.push(["Ocupación", lleno + " %", "de los cupos del día"]); }
    else if (!P.tiene.estadias && P.rubro !== "inmobiliaria") k.push(["Esperado del día", r.esperado, "si viene todo el mundo"]);
    const recordables = turnos.filter(t => t.recordar && t.estado === "confirmado");
    let html = `<div class="ph"><h1>${esc(a.es_hoy ? "Hoy · " + a.nombre : a.nombre)}</h1><span class="sp"></span>
      ${P.tiene.turnos ? `<button class="b p" id="nuevo">+ ${P.rubro === "inmobiliaria" ? "Visita" : P.rubro === "estudio" ? "Reunión" : ["cafe", "restaurante", "canchas"].includes(P.rubro) ? "Reserva" : "Turno"}</button>` : ""}
      ${recordables.length && !a.es_hoy ? `<button class="b wa" id="recs">Recordar a todos (${recordables.length})</button>` : ""}
      <button class="b hide-m" id="gcal">📅 Google Calendar</button><div class="nav2"><button class="b" id="ant" aria-label="Día anterior">←</button><button class="b" id="hoy">Hoy</button><button class="b" id="sig" aria-label="Día siguiente">→</button></div>
      ${P.tiene.turnos && P.recursos.length ? `<div class="seg hide-m"><button data-vista="cal" class="${vistaCal() ? "on" : ""}">Por ${esc(P.recurso.toLowerCase())}</button><button data-vista="lista" class="${vistaCal() ? "" : "on"}">Lista</button></div>` : ""}</div>
      ${a.cerrado ? `<div class="err" style="margin:0 0 12px">Este día está marcado como cerrado. No se dan turnos por el link.</div>` : ""}
      <div class="kpis">${k.map(([l, n, s]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${n}</div><div class="s">${s}</div></div>`).join("")}</div>`;
    if (P.tiene.estadias) html += `<div class="sec-t">Entradas y salidas</div>` + (ests.length ? `<div class="rows">${ests.map(e => `<button class="row ${e.nuevo ? "nuevo" : ""}" data-est="${e.id}"><span class="h">${e.hora}</span><span class="tx"><b>${esc(e.titulo)}</b><small>${esc(e.cliente)} · ${e.personas} pers. · ${e.noches} noches${e.entra ? " · saldo " + esc(e.saldo) : ""}</small></span><span class="tag ${e.entra ? "ok" : "blue"}">${e.entra ? "Entra" : "Sale"}</span></button>`).join("")}</div>` : `<div class="card empty">Nadie entra ni sale este día.</div>`);
    if (P.tiene.turnos) {
      html += `<div class="sec-t">${palabra}</div>`;
      html += !turnos.length ? `<div class="card empty">Sin ${palabra.toLowerCase()} este día.</div>` : vistaCal() ? calendario(turnos, a) : listaTurnos(turnos);
    }
    if (P.tiene.clases) {
      const acts = [...new Set(clases.map(c => c.titulo))], vis = clases.filter(c => !ACT || c.titulo === ACT);
      html += `<div class="sec-t">Clases</div>` + (acts.length > 1 ? `<div class="fchips"><button data-act="" class="${!ACT ? "on" : ""}">Todas</button>${acts.map(x => `<button data-act="${esc(x)}" class="${ACT === x ? "on" : ""}">${esc(x)}</button>`).join("")}</div>` : "") +
        (vis.length ? `<div class="cgrid">${vis.map(claseCard).join("")}</div>` : `<div class="card empty">No hay clases este día.</div>`);
    }
    if (P.tiene.productos) html += `<div class="sec-t">${["cafe", "rotiseria", "restaurante", "heladeria"].includes(P.rubro) ? "Pedidos para retirar y enviar" : "Retiros y envíos"}</div>` + (peds.length ? `<div class="pgrid">${peds.map(pedidoCard).join("")}</div>` : `<div class="card empty">No hay pedidos para este día.</div>`);
    v.innerHTML = html;
    const mover = n => { const d = new Date(DIA + "T12:00:00"); d.setDate(d.getDate() + n); DIA = fdia(d); render(); };
    $("#gcal").onclick = calendarioGoogle;
    $("#ant").onclick = () => mover(-1); $("#sig").onclick = () => mover(1); $("#hoy").onclick = () => { DIA = null; render(); };
    if ($("#nuevo")) $("#nuevo").onclick = () => nuevoTurno();
    if ($("#recs")) $("#recs").onclick = () => recordarTodos(recordables, a);
    v.querySelectorAll("[data-act]").forEach(b => b.onclick = () => { ACT = b.dataset.act || null; render(); });
    v.querySelectorAll("[data-vista]").forEach(b => b.onclick = () => { VISTA = b.dataset.vista; render(); });
    v.querySelectorAll("[data-turno]").forEach(b => b.onclick = () => detalleTurno(turnos.find(t => String(t.id) === b.dataset.turno)));
    v.querySelectorAll("[data-asis]").forEach(b => b.onclick = () => hacer(() => call("asistencia", {id: b.dataset.asis, asistio: b.dataset.v === "1"})));
    v.querySelectorAll("[data-anotar]").forEach(b => b.onclick = () => anotarClase(clases.find(c => c.id === b.dataset.anotar)));
    v.querySelectorAll("[data-est]").forEach(b => b.onclick = () => { TAB = "estadias"; render(); });
    accionesPedido(v);
  }
  const vistaCal = () => VISTA ? VISTA === "cal" && innerWidth > 760 : innerWidth > 760;
  const proDe = id => P.recursos.find(p => String(p.id) === String(id));
  const colorPro = id => { const i = P.recursos.findIndex(p => String(p.id) === String(id)); return (proDe(id) && proDe(id).color) || COL[(i < 0 ? 0 : i) % COL.length]; };
  function calendario(turnos, a) {
    const hs = a.horario.length ? a.horario : [{desde: "09:00", hasta: "19:00"}];
    const ini = Math.min(...hs.map(h => min(h.desde)), ...turnos.map(t => min(t.hora))), fin = Math.max(...hs.map(h => min(h.hasta)), ...turnos.map(t => min(t.fin)));
    const t0 = Math.floor(ini / 60) * 60, t1 = Math.ceil(fin / 60) * 60, ppm = (t1 - t0) > 720 ? 0.9 : 1.25, alto = (t1 - t0) * ppm;
    const cols = P.recursos;
    let g = "";
    for (let m = t0; m <= t1; m += 30) g += `<div class="gl ${m % 60 ? "" : "h"}" style="top:${(m - t0) * ppm}px"></div>`;
    const times = [...Array((t1 - t0) / 60 + 1)].map((_, i) => `<span style="top:${i * 60 * ppm}px">${pad(t0 / 60 + i)}:00</span>`).join("");
    const ahora = new Date(), nowM = ahora.getHours() * 60 + ahora.getMinutes();
    const now = a.es_hoy && nowM > t0 && nowM < t1 ? `<div class="now" style="top:${(nowM - t0) * ppm}px"></div>` : "";
    const ev = t => { const top = (min(t.hora) - t0) * ppm, h = Math.max(22, (min(t.fin) - min(t.hora)) * ppm - 3);
      const extra = t.modalidad === "domicilio" ? (P.textos_modal ? "💻 " + P.textos_modal.domicilio.t : "🚐 " + t.direccion) : t.extra && t.extra.patente ? t.extra.auto + " · " + t.extra.patente : t.extra && t.extra.obra ? t.extra.obra : t.origen === "web" ? "Reservó por el link" : "Cargado en el panel";
      return `<button class="ev ${t.estado} ${t.nuevo ? "nuevo" : ""}" data-turno="${t.id}" style="top:${top}px;height:${h}px;--c:${colorPro(t.pro)}"><b>${esc(t.cliente)}</b><small>${t.hora} · ${esc(t.titulo)}</small>${h > 50 ? `<small>${esc(extra)}</small>` : ""}</button>`; };
    return `<div class="cal" style="grid-template-columns:56px repeat(${cols.length},minmax(130px,1fr))"><div class="hd"><div></div>${cols.map(c => `<div><i style="background:${colorPro(c.id)}"></i>${esc(c.nombre)} <small>${esc(c.rol || "")}</small></div>`).join("")}</div>
      <div class="times" style="height:${alto}px">${times}</div>${cols.map(c => { const off = c.dias && !c.dias.includes(a.dia_semana); return `<div class="col ${off ? "off" : ""}" style="height:${alto}px">${off ? `<span class="offt">No trabaja este día</span>` : ""}${g}${now}${turnos.filter(t => String(t.pro) === String(c.id)).map(ev).join("")}</div>`; }).join("")}</div>`;
  }
  const estadoTag = e => ({confirmado: `<span class="tag blue">Confirmado</span>`, asistio: `<span class="tag ok">Vino</span>`, ausente: `<span class="tag crit">No vino</span>`, cancelado: `<span class="tag">Cancelado</span>`}[e] || "");
  function listaTurnos(turnos) {
    return `<div class="rows">${turnos.map(t => `<button class="row ${t.estado} ${t.nuevo ? "nuevo" : ""}" data-turno="${t.id}"><span class="h">${t.hora}</span><span class="tx"><b>${esc(t.cliente)}</b>
      <small>${esc(t.titulo)}${t.pro && proDe(t.pro) ? " · " + esc(proDe(t.pro).nombre) : ""}${t.modalidad === "domicilio" ? " · " + esc(P.textos_modal ? P.textos_modal.domicilio.t : "🚐 " + t.direccion) : ""}${t.extra && t.extra.patente ? " · " + esc(t.extra.patente) : ""}</small></span>
      ${t.origen === "web" ? `<span class="tag acc hide-m">Link</span>` : ""}${estadoTag(t.estado)}</button>`).join("")}</div>`;
  }
  function detalleTurno(t) {
    if (!t) return;
    const lbl = {auto: "Auto", patente: "Patente", problema: "Problema", obra: "Obra social", motivo: "Motivo", cuit: "CUIT", tema: "Tema", busca: "Busca"};
    const ex = Object.entries(t.extra || {}).filter(([, x]) => x).map(([k, x]) => `<dt>${esc(lbl[k] || k)}</dt><dd>${esc(x)}</dd>`).join("");
    const donde = t.modalidad === "domicilio" ? (P.textos_modal ? P.textos_modal.domicilio.t : "A domicilio · " + esc(t.direccion)) : (P.textos_modal ? P.textos_modal.local.t : "En el local");
    drawer(`${t.hora} · ${t.titulo}`, `<dl class="kv"><dt>Cliente</dt><dd><b>${esc(t.cliente)}</b></dd><dt>Celular</dt><dd><a href="https://wa.me/${t.telefono}" target="_blank" rel="noopener">+${esc(t.telefono)}</a></dd>
      <dt>Horario</dt><dd>${t.hora} a ${t.fin}</dd>${t.pro && proDe(t.pro) ? `<dt>${esc(P.recurso)}</dt><dd>${esc(proDe(t.pro).nombre)}</dd>` : ""}
      <dt>Dónde</dt><dd>${esc(donde)}</dd>${ex}
      <dt>Precio</dt><dd>${esc(t.precio)}</dd><dt>Estado</dt><dd>${estadoTag(t.estado)}</dd><dt>Origen</dt><dd>${t.origen === "web" ? "Lo sacó por el link" : "Cargado en el panel"}</dd></dl>
      ${t.estado === "confirmado" && t.monto ? `<p style="color:var(--muted);font-size:12.5px;margin-top:14px">Al marcar "Vino", el cobro de ${esc(t.precio)} entra solo en la caja.</p>` : ""}`,
      (t.recordar ? `<a class="b wa" href="${esc(t.recordar)}" target="_blank" rel="noopener">Recordar por WhatsApp</a>` : "") +
      (t.estado === "confirmado" ? `<button class="b ok" id="d-si">Vino</button><button class="b" id="d-no">No vino</button><button class="b crit" id="d-can">Cancelar</button>` : `<button class="b" id="d-re">Volver a confirmado</button>`));
    const set = e => hacer(() => call("estadoTurno", {id: t.id, estado: e}), e === "asistio" ? "Listo, quedó registrado en la caja" : "Listo");
    if ($("#d-si")) { $("#d-si").onclick = () => set("asistio"); $("#d-no").onclick = () => set("ausente"); $("#d-can").onclick = () => set("cancelado"); }
    if ($("#d-re")) $("#d-re").onclick = () => set("confirmado");
  }
  function recordarTodos(lista, a) {
    drawer(`Recordatorios · ${a.nombre}`, `<p>Tocá cada uno: se abre tu WhatsApp con el mensaje escrito y solo apretás enviar.</p>
      <div class="rows" style="margin-top:12px">${lista.map((t, i) => `<a class="row" style="text-decoration:none" data-rec="${i}" href="${esc(t.recordar)}" target="_blank" rel="noopener"><span class="h">${t.hora}</span><span class="tx"><b>${esc(t.cliente)}</b><small>${esc(t.titulo)}</small></span><span class="tag ok">Enviar</span></a>`).join("")}</div>`);
    $("#dr").querySelectorAll("[data-rec]").forEach(x => x.addEventListener("click", () => { const tg = x.querySelector(".tag"); tg.textContent = "Enviado ✓"; tg.className = "tag"; }));
  }
  async function nuevoTurno() {
    const ss = P.servicios;
    const opts = ss.map(s => `<option value="${s.id}">${esc(s.nombre)}${s.precio ? " · " + pesos(s.precio) : ""}</option>`).join("");
    drawer(P.rubro === "inmobiliaria" ? "Nueva visita" : "Cargar un turno", `<p style="color:var(--muted);font-size:13px">Para cuando te piden por teléfono o en el local. Usa la misma agenda que el link: no se superpone con nada.</p>
      <label class="lbl2">Servicio<select class="txt w" id="nt-s">${opts}</select></label>
      <div id="nt-pro"></div><div id="nt-mod"></div>
      <label class="lbl2">Día<input class="txt w" type="date" id="nt-d" value="${DIA}"></label>
      <div id="nt-h"><p class="empty">Elegí el día…</p></div>
      <label class="lbl2">Nombre del cliente<input class="txt w" id="nt-n" autocomplete="off"></label>
      <label class="lbl2">Celular<input class="txt w" id="nt-t" type="tel" placeholder="387 612 4879"></label>
      ${(P.campos_extra || []).map(c => `<label class="lbl2">${esc(c.label)}<input class="txt w" id="nt-x-${c.id}" placeholder="${esc(c.ph || "")}"></label>`).join("")}
      <div id="nt-err"></div>`, `<button class="b p" id="nt-ok">Guardar turno</button>`);
    let hora = null;
    const s = () => ss.find(x => String(x.id) === $("#nt-s").value);
    const pintarPro = () => {
      const sv = s(), pr = P.recursos.filter(p => sv.pros.map(String).includes(String(p.id)));
      $("#nt-pro").innerHTML = pr.length > 1 ? `<label class="lbl2">${esc(P.recurso)}<select class="txt w" id="nt-p"><option value="">${P.rubro === "canchas" ? "La que esté libre" : "Cualquiera"}</option>${pr.map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join("")}</select></label>` : "";
      $("#nt-mod").innerHTML = sv.modalidad === "ambos" ? `<label class="lbl2">Modalidad<select class="txt w" id="nt-m"><option value="local">${esc(P.textos_modal ? P.textos_modal.local.t : "En el local")}</option><option value="domicilio">${esc(P.textos_modal ? P.textos_modal.domicilio.t : "A domicilio")}</option></select></label>` : "";
      if ($("#nt-p")) $("#nt-p").onchange = horas;
      if ($("#nt-m")) $("#nt-m").onchange = () => { horas(); pintarDir(); };
      pintarDir();
    };
    const pintarDir = () => { const need = ($("#nt-m") && $("#nt-m").value === "domicilio" || s().modalidad === "domicilio") && !(P.textos_modal && P.textos_modal.sin_dir);
      let d = $("#nt-dir-w"); if (need && !d) { $("#nt-mod").insertAdjacentHTML("beforeend", `<label class="lbl2" id="nt-dir-w">Dirección<input class="txt w" id="nt-dir"></label>`); } else if (!need && d) d.remove(); };
    const horas = async () => {
      hora = null;
      const sv = s(), mod = $("#nt-m") ? $("#nt-m").value : sv.modalidad === "domicilio" ? "domicilio" : "local";
      let hs = [];
      try { hs = await call("horas", {servicio: sv.id, dia: $("#nt-d").value, pro: $("#nt-p") ? $("#nt-p").value : "", modalidad: mod}); } catch (e) { /* sin horarios */ }
      $("#nt-h").innerHTML = hs.length ? `<label class="lbl2">Hora</label><div class="hgrid">${hs.map(h => `<button type="button" class="b s" data-h="${h.inicio}" data-p="${h.pro || ""}">${h.hora}</button>`).join("")}</div>` : `<p class="empty">No quedan horarios libres ese día.</p>`;
      $("#nt-h").querySelectorAll("[data-h]").forEach(b => b.onclick = () => { $("#nt-h").querySelectorAll("[data-h]").forEach(x => x.classList.remove("p")); b.classList.add("p"); hora = {inicio: b.dataset.h, pro: b.dataset.p}; });
    };
    $("#nt-s").onchange = () => { pintarPro(); horas(); };
    $("#nt-d").onchange = horas;
    pintarPro(); horas();
    $("#nt-ok").onclick = async () => {
      if (!hora) { $("#nt-err").innerHTML = `<div class="err">Elegí un horario.</div>`; return; }
      const sv = s();
      try {
        await call("reservarTurno", {origen: "panel", servicio: sv.id, inicio: hora.inicio, pro: ($("#nt-p") && $("#nt-p").value) || hora.pro || undefined, nombre: $("#nt-n").value.trim(), telefono: $("#nt-t").value.trim(),
                                    modalidad: $("#nt-m") ? $("#nt-m").value : undefined, direccion: $("#nt-dir") ? $("#nt-dir").value : "", acepta: true,
                                    extra: Object.fromEntries((P.campos_extra || []).map(c => [c.id, ($("#nt-x-" + c.id) || {}).value || ""]))});
        DIA = hora.inicio.slice(0, 10); toast("Turno cargado"); cerrar(); render();
      } catch (e) { $("#nt-err").innerHTML = `<div class="err">${esc(e.message)}</div>`; }
    };
  }
  function anotarClase(c) {
    drawer(`Anotar en ${c.titulo} · ${c.hora}`, `<p style="color:var(--muted);font-size:13px">Quedan ${c.cupo - c.inscriptos.length} lugares.</p>
      <label class="lbl2">Nombre<input class="txt w" id="ac-n"></label><label class="lbl2">Celular<input class="txt w" id="ac-t" type="tel" placeholder="387 612 4879"></label><div id="ac-err"></div>`,
      `<button class="b p" id="ac-ok">Anotar</button>`);
    $("#ac-ok").onclick = async () => {
      try { await call("inscribir", {origen: "panel", ocurrencia: c.id, nombre: $("#ac-n").value.trim(), telefono: $("#ac-t").value.trim()}); toast("Anotado"); cerrar(); render(); }
      catch (e) { $("#ac-err").innerHTML = `<div class="err">${esc(e.message)}</div>`; }
    };
  }
  function claseCard(c) {
    const n = c.inscriptos.length, pct = Math.min(100, Math.round(100 * n / c.cupo));
    return `<div class="cc ${c.nuevo ? "nuevo" : ""}" style="--c:${c.color}"><div class="t"><b>${esc(c.titulo)}</b><span class="m">${esc(c.profe)}</span><span class="h">${c.hora}</span></div>
      <div class="meter"><i style="width:${pct}%"></i></div><div class="m">${n} de ${c.cupo} lugares${n >= c.cupo ? " · <b style='color:var(--crit)'>completa</b>" : ""}</div>
      <div style="display:flex;gap:8px;align-items:center;margin-top:4px">${n ? `<details ${c.nuevo ? "open" : ""} style="flex:1"><summary>Ver anotados y tomar asistencia</summary><ul>${c.inscriptos.map(i => `<li class="${i.nuevo ? "nuevo" : ""}"><span>${esc(i.nombre)}</span>
        <button class="tg ${i.asistio === true ? "si" : ""}" data-asis="${i.id}" data-v="1">Vino</button><button class="tg ${i.asistio === false ? "no" : ""}" data-asis="${i.id}" data-v="0">Faltó</button></li>`).join("")}</ul></details>` : `<span style="flex:1"></span>`}
        ${n < c.cupo ? `<button class="b s" data-anotar="${esc(c.id)}">+ Anotar</button>` : ""}</div></div>`;
  }
  function calendarioGoogle() {
    const url = P.calendario ? location.origin + P.calendario : null;
    drawer("Ver la agenda en tu celular", `<p>Tus ${P.tiene.estadias ? "reservas" : "turnos"}${P.tiene.clases ? ", clases" : ""}${P.tiene.productos ? " y retiros de pedidos" : ""} aparecen solos en Google Calendar o en el calendario del iPhone, junto con tus otras cosas.</p>
      <ol class="steps"><li>Abrí Google Calendar en la compu.</li><li>Al lado de "Otros calendarios", tocá <b>+</b> y elegí <b>Desde URL</b>.</li><li>Pegá este link y tocá <b>Agregar calendario</b>.</li></ol>
      <div class="codebox">${url ? esc(url) : "En tu sistema vas a tener un link privado, que termina en /calendario.ics."}</div>
      <p style="color:var(--muted);font-size:12.5px;margin-top:10px">Google lo actualiza solo cada algunas horas. Para ver lo último al instante, usá este panel. El link es privado: no lo compartas.</p>`,
      url ? `<button class="b p" id="cp">Copiar link</button>` : "");
    if ($("#cp")) $("#cp").onclick = async () => { try { await navigator.clipboard.writeText(url); toast("Link copiado"); } catch (e) { toast("Copialo a mano desde el recuadro"); } };
  }

  // ── Estadías ──────────────────────────────────────────────────────
  async function estadias(v) {
    const e = await call("estadias", {desde: DIA && TAB === "estadias" ? null : null});
    const est = {pendiente: ["warn", "Espera seña"], confirmada: ["blue", "Confirmada"], checkin: ["ok", "Alojada"], finalizada: ["", "Finalizada"]};
    const bloq = (e.bloqueos || []).map(b => ({...b, estado: "ext", cliente: b.origen, ext: true}));
    const celda = (u, d) => [...e.reservas, ...bloq].find(r => String(r.unidad) === String(u.id) && r.desde <= d.fecha && r.hasta > d.fecha);
    let grid = `<div class="card tw" style="padding:0"><table class="occ"><thead><tr><th style="min-width:140px">Unidad</th>${e.dias.map(d => `<th class="${d.hoy ? "hoyc" : ""}">${d.dia}<br>${d.d}</th>`).join("")}</tr></thead><tbody>`;
    for (const u of e.unidades) {
      grid += `<tr><td><b>${esc(u.nombre)}</b><div style="color:var(--muted);font-size:11.5px">${u.capacidad} pers. · ${esc(u.precio)}</div></td>`;
      for (let i = 0; i < e.dias.length; i++) {
        const d = e.dias[i], r = celda(u, d);
        if (!r) { grid += `<td class="${d.hoy ? "hoyc" : ""}"></td>`; continue; }
        const inicio = r.desde === d.fecha || i === 0;
        if (!inicio) continue;
        let span = 0; for (let j = i; j < e.dias.length && e.dias[j].fecha < r.hasta; j++) span++;
        grid += r.ext ? `<td colspan="${span}" class="bk"><button class="bkb ext" data-b="${esc(r.id)}" title="Reserva de ${esc(r.origen)}">${esc(r.origen)} · ${r.noches}n</button></td>`
          : `<td colspan="${span}" class="bk"><button class="bkb ${r.estado} ${r.nuevo ? "nuevo" : ""}" data-r="${r.id}" title="${esc(r.cliente)}">${esc(r.cliente.split(" ")[0])} · ${r.noches}n</button></td>`;
      }
      grid += `</tr>`;
    }
    grid += `</tbody></table></div>`;
    const prox = e.reservas.filter(r => r.estado !== "finalizada");
    v.innerHTML = `<div class="ph"><h1>Estadías</h1><span class="sp"></span><button class="b p" id="nr">+ Reserva</button><button class="b" id="ical">Booking y Airbnb</button></div>
      <div class="kpis"><div class="kpi"><div class="l">Alojados hoy</div><div class="v">${e.reservas.filter(r => r.estado === "checkin").length}</div><div class="s">de ${e.unidades.length} unidades</div></div>
        <div class="kpi"><div class="l">Esperan seña</div><div class="v ${prox.some(r => r.estado === "pendiente") ? "neg" : ""}">${prox.filter(r => r.estado === "pendiente").length}</div><div class="s">se liberan solas a las 24 h</div></div>
        <div class="kpi"><div class="l">Próximas confirmadas</div><div class="v">${prox.filter(r => r.estado === "confirmada").length}</div><div class="s">con seña cobrada</div></div></div>
      ${grid}<p style="color:var(--muted);font-size:12px;margin:6px 0 0">Tocá una reserva para ver el detalle. Naranja: espera la seña · azul: confirmada · verde: alojada · gris: reservada en Booking o Airbnb.</p>
      <div class="sec-t">Próximas reservas</div><div class="rows">${prox.map(r => `<button class="row ${r.nuevo ? "nuevo" : ""}" data-r="${r.id}"><span class="h" style="min-width:auto">${esc(r.cuando)}</span><span class="tx"><b>${esc(r.unidad_nombre)} · ${esc(r.cliente)}</b><small>${r.personas} pers. · ${r.noches} noches · total ${esc(r.total_txt)}${r.estado === "pendiente" ? " · seña " + esc(r.sena_txt) : ""}</small></span><span class="tag ${est[r.estado][0]}">${est[r.estado][1]}</span></button>`).join("") || `<div class="card empty">No hay reservas próximas.</div>`}</div>`;
    v.querySelectorAll("[data-r]").forEach(b => b.onclick = () => detalleEstadia(e.reservas.find(r => String(r.id) === b.dataset.r), est));
    v.querySelectorAll("[data-b]").forEach(x => x.onclick = () => { const b = bloq.find(y => String(y.id) === x.dataset.b); const u = e.unidades.find(y => String(y.id) === String(b.unidad));
      drawer(`${u ? u.nombre : ""} · ${b.origen}`, `<p>Esta reserva entró por <b>${esc(b.origen)}</b>, del ${esc(b.cuando)} (${b.noches} noches). Las fechas quedan bloqueadas acá y en tu página, así no se pisa con otra reserva.</p>
        <p style="color:var(--muted);font-size:12.5px">Los datos del huésped y el cobro los ves en ${esc(b.origen)}. Si la cancelan allá, la fecha se libera sola en la próxima sincronización.</p>`); });
    $("#nr").onclick = () => nuevaEstadia(e);
    $("#ical").onclick = () => conectarPlataformas(e);
  }
  function conectarPlataformas(e) {
    const demo = e.unidades.some(u => String(u.ical || "").startsWith("demo-"));
    const link = u => demo ? `https://reservas.tunegocio.com.ar/ical/…${String(u.id).slice(-2)}.ics` : `${location.origin}/ical/${u.ical}.ics`;
    drawer("Booking y Airbnb", `<p>Se conectan por calendario, en los dos sentidos. Así una fecha vendida en un lado se bloquea en los otros.</p>
      <ol class="steps"><li><b>De acá a ellos:</b> copiá el link de cada unidad y pegalo en Booking (Extranet → Tarifas y disponibilidad → Sincronizar calendarios) y en Airbnb (Calendario → Disponibilidad → Conectar calendarios).</li>
        <li><b>De ellos a acá:</b> en esas mismas pantallas, Booking y Airbnb te dan el link de su calendario. Pegalo en la unidad que corresponde y guardá.</li></ol>
      ${e.unidades.map(u => `<div class="card" style="padding:12px;margin:10px 0"><b>${esc(u.nombre)}</b>
        <div class="lbl2" style="margin-top:8px">Link de esta unidad (para Booking y Airbnb)</div>
        <div class="codebox" style="display:flex;gap:8px;align-items:center"><span style="flex:1;word-break:break-all">${esc(link(u))}</span>${demo ? "" : `<button class="b s" data-cp="${esc(link(u))}">Copiar</button>`}</div>
        <div class="lbl2" style="margin-top:8px">Calendarios de Booking o Airbnb (uno por línea)</div>
        <textarea class="txt w" rows="2" data-ext="${esc(u.id)}" placeholder="https://admin.booking.com/…/ical…">${esc((u.externos || []).join("\n"))}</textarea></div>`).join("")}
      <p style="color:var(--muted);font-size:12.5px;margin-top:10px">El sistema revisa esos calendarios cada 30 minutos${e.sincronizado ? ` (última vez: ${esc(e.sincronizado)})` : ""}. Booking y Airbnb leen el tuyo cada algunas horas, no al instante: por eso conviene confirmar rápido las reservas de último momento.${demo ? " En la demo los links son de ejemplo." : ""}</p>`,
      `<button class="b" id="sync">Revisar ahora</button><button class="b p" id="gx">Guardar</button>`);
    document.querySelectorAll("[data-cp]").forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.cp); toast("Link copiado"); } catch (x) { toast("Copialo a mano desde el recuadro"); } });
    $("#gx").onclick = () => hacer(async () => {
      for (const t of document.querySelectorAll("[data-ext]")) await call("guardarIcal", {unidad: t.dataset.ext, externos: t.value.split(/\s+/).filter(Boolean)});
      await call("sincronizarIcal");
    }, "Calendarios guardados");
    $("#sync").onclick = async () => { try { const r = await call("sincronizarIcal"); toast(r.errores && r.errores.length ? "⚠️ " + esc(r.errores[0]) : `Listo: ${r.bloqueos} fechas tomadas en otras plataformas`); cerrar(); render(); } catch (x) { toast("⚠️ " + esc(x.message)); } };
  }
  function detalleEstadia(r, est) {
    if (!r) return;
    drawer(`${r.unidad_nombre}`, `<dl class="kv"><dt>Huésped</dt><dd><b>${esc(r.cliente)}</b></dd><dt>Celular</dt><dd><a href="https://wa.me/${r.telefono}" target="_blank" rel="noopener">+${esc(r.telefono)}</a></dd>
      <dt>Fechas</dt><dd>${esc(r.cuando)} · ${r.noches} noches</dd><dt>Personas</dt><dd>${r.personas}</dd><dt>Total</dt><dd>${esc(r.total_txt)}</dd><dt>Seña</dt><dd>${esc(r.sena_txt)}</dd>
      <dt>Saldo</dt><dd>${esc(r.saldo_txt)}</dd><dt>Estado</dt><dd><span class="tag ${est[r.estado][0]}">${est[r.estado][1]}</span></dd>${r.nota ? `<dt>Nota</dt><dd>${esc(r.nota)}</dd>` : ""}<dt>Origen</dt><dd>${r.origen === "web" ? "Reservó por el link" : "Cargada en el panel"}</dd></dl>`,
      `<a class="b wa" href="${esc(r.avisar)}" target="_blank" rel="noopener">${r.estado === "pendiente" ? "Recordar la seña" : "Escribirle"}</a>` +
      ({pendiente: `<button class="b ok" data-e="confirmada">Llegó la seña</button>`, confirmada: `<button class="b ok" data-e="checkin">Llegó (check-in)</button>`, checkin: `<button class="b ok" data-e="finalizada">Se fue y pagó el saldo</button>`}[r.estado] || "") +
      (["pendiente", "confirmada"].includes(r.estado) ? `<button class="b crit" data-e="cancelada">Cancelar</button>` : ""));
    $("#dr").querySelectorAll("[data-e]").forEach(b => b.onclick = () => hacer(() => call("estadoEstadia", {id: r.id, estado: b.dataset.e}),
      {confirmada: "Seña registrada en la caja", checkin: "Check-in hecho", finalizada: "Saldo registrado en la caja", cancelada: "Reserva cancelada, fechas liberadas"}[b.dataset.e]));
  }
  function nuevaEstadia(e) {
    const hoy = fdia(new Date());
    drawer("Cargar una reserva", `<label class="lbl2">Unidad<select class="txt w" id="ne-u">${e.unidades.map(u => `<option value="${u.id}">${esc(u.nombre)} · ${u.capacidad} pers.</option>`).join("")}</select></label>
      <div class="two" style="grid-template-columns:1fr 1fr"><label class="lbl2">Entrada<input class="txt w" type="date" id="ne-d" value="${hoy}"></label><label class="lbl2">Salida<input class="txt w" type="date" id="ne-h"></label></div>
      <label class="lbl2">Personas<input class="txt w" type="number" id="ne-p" value="2" min="1"></label><label class="lbl2">Nombre<input class="txt w" id="ne-n"></label><label class="lbl2">Celular<input class="txt w" id="ne-t" type="tel"></label><div id="ne-err"></div>`,
      `<button class="b p" id="ne-ok">Guardar (con seña cobrada)</button>`);
    $("#ne-ok").onclick = async () => {
      try { await call("reservarEstadia", {origen: "panel", unidad: $("#ne-u").value, desde: $("#ne-d").value, hasta: $("#ne-h").value, personas: $("#ne-p").value, nombre: $("#ne-n").value, telefono: $("#ne-t").value}); toast("Reserva cargada"); cerrar(); render(); }
      catch (er) { $("#ne-err").innerHTML = `<div class="err">${esc(er.message)}</div>`; }
    };
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
    const lista = FILTRO === "entregado" ? ps.slice(-40).reverse() : ps;
    v.innerHTML = `<div class="ph"><h1>Pedidos</h1><span class="sp"></span><div class="seg">${[["activos", "Para preparar"], ["entregado", "Entregados"], ["cancelado", "Cancelados"]].map(([k, t]) => `<button data-f="${k}" class="${FILTRO === k ? "on" : ""}">${t}</button>`).join("")}</div></div>
      ${lista.length ? `<div class="pgrid">${lista.map(pedidoCard).join("")}</div>` : `<div class="card empty">No hay pedidos acá.</div>`}`;
    v.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { FILTRO = b.dataset.f; render(); });
    accionesPedido(v);
  }

  // ── Stock ─────────────────────────────────────────────────────────
  async function stock(v) {
    const st = await call("stock");
    const bajos = st.filter(x => x.bajo), apart = st.reduce((a, x) => a + x.apartado, 0);
    const valor = st.filter(x => !x.ilimitado).reduce((a, x) => a + x.stock * (x.costo || 0), 0);
    const lista = st.filter(x => (!SOLO_BAJO || x.bajo) && (!BUSCA || x.nombre.toLowerCase().includes(BUSCA.toLowerCase())));
    v.innerHTML = `<div class="ph"><h1>Stock</h1><span class="sp"></span>${buscador("Buscar producto")}<label class="b"><input type="checkbox" id="sb" ${SOLO_BAJO ? "checked" : ""}> Solo para reponer</label><button class="b p" id="venta">+ Venta en el local</button><button class="b" id="xls">⬇ Excel</button></div>
      <div class="kpis"><div class="kpi"><div class="l">Productos</div><div class="v">${st.length}</div><div class="s">en el catálogo</div></div>
        <div class="kpi"><div class="l">Para reponer</div><div class="v ${bajos.length ? "neg" : ""}">${bajos.length}</div><div class="s">en el mínimo o menos</div></div>
        <div class="kpi"><div class="l">Apartado en pedidos</div><div class="v">${apart}</div><div class="s">reservado sin retirar</div></div>
        <div class="kpi"><div class="l">Mercadería al costo</div><div class="v">${pesos(valor)}</div><div class="s">lo que tenés en el local</div></div></div>
      <div class="card tw"><table><thead><tr><th>Producto</th><th class="hide-m">Categoría</th><th class="n">Precio</th><th class="n">Disponible</th><th class="n hide-m">Apartado</th><th class="n hide-m">Mínimo</th><th></th></tr></thead><tbody>
      ${lista.map(x => `<tr class="${x.bajo ? "bajo" : ""}"><td><b>${esc(x.nombre)}</b>${x.bajo ? ` <span class="tag crit">Reponer</span>` : ""}</td><td class="hide-m">${esc(x.cat)}</td><td class="n">${esc(x.precio)}</td>
        <td class="n">${x.ilimitado ? `<span class="tag">Sin control</span>` : `<input class="num" type="number" min="0" value="${x.stock}" data-st="${x.id}" aria-label="Stock de ${esc(x.nombre)}">`}</td>
        <td class="n hide-m">${x.apartado || "—"}</td><td class="n hide-m">${x.ilimitado ? "—" : x.minimo}</td><td class="n"><button class="b s" data-v="${x.id}" ${!x.ilimitado && x.stock < 1 ? "disabled" : ""}>Vendí 1</button></td></tr>`).join("")}</tbody></table></div>
      <p style="color:var(--muted);font-size:12.5px;margin-top:8px">El stock baja solo cuando un cliente reserva por el link, y vuelve si cancela. Para lo que vendés en el mostrador usá "Venta en el local": descuenta y lo suma a la caja.</p>`;
    $("#sb").onchange = e => { SOLO_BAJO = e.target.checked; render(); };
    conectarBuscador();
    v.querySelectorAll("[data-st]").forEach(i => i.onchange = () => hacer(() => call("ajustarStock", {id: i.dataset.st, stock: i.value}), "Stock actualizado"));
    v.querySelectorAll("[data-v]").forEach(b => b.onclick = () => hacer(() => call("ajustarStock", {id: b.dataset.v, vendido: 1}), "Venta registrada"));
    $("#venta").onclick = () => ventaLocal(st);
    $("#xls").onclick = () => {
      const filas = [["Producto", "Categoría", "Disponible", "Apartado", "Mínimo", "Costo", "Valor al costo", "¿Reponer?"].map(t => ({v: t, b: true}))];
      st.filter(x => !x.ilimitado).forEach((x, i) => { const r = i + 2; filas.push([x.nombre, x.cat, x.stock, x.apartado, x.minimo, {v: x.costo || 0, z: "plata"}, {f: `C${r}*F${r}`, z: "plata"}, {f: `IF(C${r}<=E${r},"Sí","No")`}]); });
      const n = filas.length;
      filas.push(["", "", "", "", "", {v: "TOTAL", b: true}, {f: `SUM(G2:G${n})`, z: "plata", b: true}, ""]);
      excel("stock", [{nombre: "Stock", columnas: [34, 16, 11, 10, 9, 12, 15, 10], filas}]);
    };
  }
  function ventaLocal(st) {
    const carrito = new Map();
    const disp = st.filter(x => x.ilimitado || x.stock > 0);
    drawer("Venta en el local", `<input class="txt w" id="vl-q" placeholder="Buscar producto"><div id="vl-res" class="rows" style="margin-top:8px;max-height:230px;overflow:auto"></div>
      <div class="sec-t">En esta venta</div><div id="vl-car"></div><label class="lbl2">Cómo pagó<select class="txt w" id="vl-m"><option>Efectivo</option><option>Transferencia</option><option>Débito</option><option>Crédito</option><option>Mercado Pago</option></select></label><div id="vl-err"></div>`,
      `<button class="b p" id="vl-ok">Registrar venta</button>`);
    const precioN = x => Number(String(x.precio).replace(/\D/g, ""));
    const pintar = () => {
      const q = $("#vl-q").value.toLowerCase();
      $("#vl-res").innerHTML = disp.filter(x => !q || x.nombre.toLowerCase().includes(q)).slice(0, 12).map(x => `<button class="row" data-add="${x.id}"><span class="tx"><b>${esc(x.nombre)}</b><small>${esc(x.precio)}${x.ilimitado ? "" : " · quedan " + x.stock}</small></span><span class="tag acc">Agregar</span></button>`).join("");
      $("#vl-res").querySelectorAll("[data-add]").forEach(b => b.onclick = () => { const x = disp.find(y => String(y.id) === b.dataset.add), c = carrito.get(b.dataset.add) || 0; if (!x.ilimitado && c >= x.stock) return; carrito.set(b.dataset.add, c + 1); pintar(); });
      const items = [...carrito.entries()].map(([id, c]) => ({x: disp.find(y => String(y.id) === id), c}));
      $("#vl-car").innerHTML = items.length ? `<table><tbody>${items.map(({x, c}) => `<tr><td>${c} × ${esc(x.nombre)}</td><td class="n">${pesos(precioN(x) * c)}</td><td class="n"><button class="tg" data-menos="${x.id}">−</button></td></tr>`).join("")}<tr><td><b>Total</b></td><td class="n"><b>${pesos(items.reduce((a, {x, c}) => a + precioN(x) * c, 0))}</b></td><td></td></tr></tbody></table>` : `<p class="empty" style="padding:8px">Todavía no agregaste nada.</p>`;
      $("#vl-car").querySelectorAll("[data-menos]").forEach(b => b.onclick = () => { const c = carrito.get(b.dataset.menos) - 1; c > 0 ? carrito.set(b.dataset.menos, c) : carrito.delete(b.dataset.menos); pintar(); });
    };
    $("#vl-q").oninput = pintar; pintar();
    $("#vl-ok").onclick = async () => {
      try { const r = await call("ventaMostrador", {items: [...carrito.entries()].map(([producto, cant]) => ({producto, cant})), medio: $("#vl-m").value}); toast(`Venta de ${r.total} registrada. El stock ya se descontó.`); cerrar(); render(); }
      catch (e) { $("#vl-err").innerHTML = `<div class="err">${esc(e.message)}</div>`; }
    };
  }

  // ── Socios ────────────────────────────────────────────────────────
  async function socios(v) {
    const ss = await call("socios"), hoy = fdia(new Date()), alumno = P.textos && P.textos.socio === "alumno";
    const dias = s => Math.round((new Date(s.vence + "T12:00:00") - new Date(hoy + "T12:00:00")) / 864e5);
    const lista = ss.filter(s => !BUSCA || s.nombre.toLowerCase().includes(BUSCA.toLowerCase()) || s.telefono.includes(BUSCA.replace(/\D/g, "")));
    const venc = ss.filter(s => s.vencida), prox = ss.filter(s => !s.vencida && dias(s) <= 5);
    v.innerHTML = `<div class="ph"><h1>${alumno ? "Alumnos" : "Socios"}</h1><span class="sp"></span>${buscador("Buscar por nombre o celular")}</div>
      <div class="kpis"><div class="kpi"><div class="l">${alumno ? "Alumnos" : "Socios"}</div><div class="v">${ss.length}</div><div class="s">cuota ${pesos(P.cuota || 0)}</div></div>
        <div class="kpi"><div class="l">Cuota vencida</div><div class="v ${venc.length ? "neg" : ""}">${venc.length}</div><div class="s">no pueden reservar clases · ${pesos(venc.length * (P.cuota || 0))} sin cobrar</div></div>
        <div class="kpi"><div class="l">Vencen en 5 días</div><div class="v">${prox.length}</div><div class="s">mandales el aviso</div></div></div>
      <div class="card tw"><table><thead><tr><th>${alumno ? "Alumno" : "Socio"}</th><th class="hide-m">Plan</th><th>Vence</th><th></th></tr></thead><tbody>
      ${lista.map(s => { const d = dias(s); const aviso = `https://wa.me/${s.telefono}?text=${encodeURIComponent(`Hola ${s.nombre.split(" ")[0]}! ${d < 0 ? "Tu cuota de " + P.nombre + " está vencida." : "Tu cuota de " + P.nombre + " vence " + (d === 0 ? "hoy" : `en ${d} día${d > 1 ? "s" : ""}`) + "."} Podés pagarla por transferencia y seguir reservando tus clases 💪`)}`;
        return `<tr><td><b>${esc(s.nombre)}</b><div style="color:var(--muted);font-size:12px">+${esc(s.telefono)}</div></td><td class="hide-m">${esc(s.plan)}</td>
        <td>${s.vencida ? `<span class="tag crit">Vencida ${ddmm(s.vence)}</span>` : d <= 5 ? `<span class="tag warn">${d === 0 ? "Hoy" : `En ${d} días`}</span>` : `<span class="tag ok">${ddmm(s.vence)}</span>`}</td>
        <td class="n" style="white-space:nowrap">${s.vencida || d <= 5 ? `<a class="b s" href="${aviso}" target="_blank" rel="noopener">Avisar</a> ` : ""}<button class="b p s" data-pago="${s.telefono}">Registrar pago</button></td></tr>`; }).join("")}</tbody></table></div>`;
    conectarBuscador();
    v.querySelectorAll("[data-pago]").forEach(b => b.onclick = () => hacer(async () => { const r = await call("pagarCuota", {telefono: b.dataset.pago}); toast(`Pago registrado. Ya puede reservar. Vence el ${ddmm(r.vence)}`); }));
  }

  // ── Clientes ──────────────────────────────────────────────────────
  async function clientes(v) {
    const cs = await call("clientes");
    const lista = cs.filter(c => !BUSCA || c.nombre.toLowerCase().includes(BUSCA.toLowerCase()) || c.telefono.includes(BUSCA.replace(/\D/g, "")));
    const volver = cs.filter(c => c.volver), nuevos = cs.filter(c => c.nuevo);
    const hace = c => c.hace == null ? "—" : c.hace === 0 ? "Hoy" : c.hace === 1 ? "Ayer" : `Hace ${c.hace} días`;
    v.innerHTML = `<div class="ph"><h1>Clientes</h1><span class="sp"></span>${buscador("Buscar por nombre o celular")}<button class="b" id="xls">⬇ Excel</button></div>
      <div class="kpis"><div class="kpi"><div class="l">Clientes</div><div class="v">${cs.length}</div><div class="s">con al menos una visita o reserva</div></div>
        <div class="kpi"><div class="l">Para recuperar</div><div class="v ${volver.length ? "neg" : ""}">${volver.length}</div><div class="s">venían y hace más de 5 semanas que no vuelven</div></div>
        <div class="kpi"><div class="l">Tus mejores 10</div><div class="v">${pesos(cs.slice(0, 10).reduce((a, c) => a + c.gastado, 0))}</div><div class="s">lo que gastaron en las últimas semanas</div></div></div>
      ${volver.length ? `<div class="card" style="margin-bottom:12px;border-color:#F5C9A5;background:#FFF8F2"><h3>💬 Invitalos a volver <span class="sp"></span><span class="tag acc">${volver.length}</span></h3><p style="color:var(--muted);font-size:13px;margin-bottom:8px">Tocá cada uno: se abre tu WhatsApp con el mensaje escrito.</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${volver.slice(0, 12).map(c => `<a class="b s" href="${esc(c.volver)}" target="_blank" rel="noopener">${esc(c.nombre)} · ${hace(c).toLowerCase()}</a>`).join("")}</div></div>` : ""}
      <div class="card tw"><table><thead><tr><th>Cliente</th><th class="n">Visitas</th><th class="hide-m">Última vez</th><th class="n">Gastó</th><th class="hide-m">Lo que más pide</th><th class="hide-m">Próxima</th><th></th></tr></thead><tbody>
      ${lista.slice(0, 150).map(c => `<tr><td><b>${esc(c.nombre)}</b>${c.nuevo ? ` <span class="tag acc">Nuevo</span>` : ""}<div style="color:var(--muted);font-size:12px">+${esc(c.telefono)}</div></td><td class="n">${c.visitas}</td>
        <td class="hide-m">${hace(c)}</td><td class="n">${pesos(c.gastado)}</td><td class="hide-m">${esc(c.favorito)}</td><td class="hide-m">${c.proxima ? `${ddmm(c.proxima.slice(0, 10))}` : "—"}</td>
        <td class="n"><a class="b s" href="${esc(c.volver || "https://wa.me/" + c.telefono)}" target="_blank" rel="noopener">${c.volver ? "Invitar" : "WhatsApp"}</a></td></tr>`).join("")}</tbody></table></div>`;
    conectarBuscador();
    $("#xls").onclick = () => {
      const filas = [["Cliente", "Celular", "Visitas", "Última vez", "Gastó", "Lo que más pide"].map(t => ({v: t, b: true}))];
      cs.forEach(c => filas.push([c.nombre, "+" + c.telefono, c.visitas, c.ultima ? {v: new Date(c.ultima)} : "", {v: c.gastado, z: "plata"}, c.favorito]));
      excel("clientes", [{nombre: "Clientes", columnas: [26, 16, 9, 12, 13, 30], filas}]);
    };
  }

  // ── Números ───────────────────────────────────────────────────────
  async function numeros(v) {
    const n = await call("numeros");
    const maxT = Math.max(1, ...n.top.map(t => t.m || t.q));
    const maxP = Math.max(1, ...Object.values(n.pico));
    const dias = [0, 1, 2, 3, 4, 5, 6].filter(d => Object.keys(n.pico).some(k => k.startsWith(d + "|")));
    const heat = n.horas.length ? `<div class="tw"><table class="heat"><thead><tr><th></th>${n.horas.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${dias.map(d => `<tr><th>${DSEM[d]}</th>${n.horas.map(h => { const q = n.pico[`${d}|${h}`] || 0; return `<td style="background:rgba(232,119,46,${q ? 0.12 + 0.88 * q / maxP : 0})" title="${q}">${q || ""}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>` : `<p class="empty">Todavía no hay datos.</p>`;
    v.innerHTML = `<div class="ph"><h1>Tus números</h1><span class="sp"></span><span class="tag">últimos 30 días</span></div>
      <div class="kpis">${n.kpis.map(k => `<div class="kpi"><div class="l">${esc(k.l)}</div><div class="v">${esc(k.v)}</div><div class="s">${esc(k.s)}</div></div>`).join("")}</div>
      ${n.recomendaciones.length ? `<div class="sec-t">Tres cosas para hacer este mes</div><div class="recs">${n.recomendaciones.map((r, i) => `<div class="card rec"><i>${i + 1}</i><p>${esc(r)}</p></div>`).join("")}</div>` : ""}
      <div class="two" style="margin-top:12px"><div class="card"><h3>Lo que más te dejó</h3><div class="bars">${n.top.map(t => `<div><span>${esc(t.n)}</span><i style="width:${Math.max(4, 100 * (t.m || t.q) / maxT)}%;background:var(--acc)"></i><b style="text-align:right">${t.m ? esc(t.m_txt) : t.q + " veces"}</b></div>`).join("") || `<p class="empty">Sin datos.</p>`}</div></div>
        <div class="card"><h3>¿Cuándo viene la gente?</h3>${heat}<p style="color:var(--muted);font-size:12px;margin-top:6px">Más oscuro, más movimiento. Los huecos claros son horarios para llenar con una promo.</p></div></div>
      ${n.cobertura.length ? `<div class="card" style="margin-top:12px"><h3>¿Para cuántos días te alcanza el stock?</h3><table><thead><tr><th>Producto</th><th class="n">Stock</th><th class="n">Te alcanza para</th></tr></thead><tbody>${n.cobertura.map(c => `<tr><td>${esc(c.n)}</td><td class="n">${c.stock}</td><td class="n"><span class="tag ${c.dias <= 3 ? "crit" : c.dias <= 7 ? "warn" : "ok"}">${c.dias <= 0 ? "menos de 1 día" : c.dias + " días"}</span></td></tr>`).join("")}</tbody></table></div>` : ""}`;
  }

  // ── Catálogo ──────────────────────────────────────────────────────
  async function catalogo(v) {
    const c = await call("catalogo");
    const sw = (tipo, x) => `<label class="sw"><input type="checkbox" data-on="${tipo}|${x.id}" ${x.activo ? "checked" : ""}><span></span></label>`;
    const num = (tipo, x, campo, val, w = 100) => `<input class="num" style="width:${w}px" type="number" min="0" value="${val ?? ""}" data-ed="${tipo}|${x.id}|${campo}">`;
    let html = `<div class="ph"><h1>${P.tiene.productos && !P.tiene.turnos ? "Productos y precios" : "Servicios y precios"}</h1><span class="sp"></span></div>
      <p style="color:var(--muted);font-size:13px;margin:-6px 0 12px">Lo que cambiás acá se ve al instante en tu link. Apagá lo que no querés ofrecer por un tiempo.</p>`;
    if (c.servicios.length) html += `<div class="card tw"><h3>${P.rubro === "inmobiliaria" ? "Propiedades" : P.rubro === "canchas" ? "Turnos de cancha" : ["cafe", "restaurante"].includes(P.rubro) ? "Reservas de mesa" : "Servicios"} <span class="sp"></span><button class="b s p" id="add-s">+ Agregar</button></h3><table><thead><tr><th>Nombre</th><th class="hide-m">Categoría</th><th class="n">Precio</th><th class="n">Minutos</th><th class="n">Activo</th></tr></thead><tbody>
      ${c.servicios.map(x => `<tr><td>${esc(x.nombre)}</td><td class="hide-m">${esc(x.cat || "")}</td><td class="n">${num("servicio", x, "precio", x.precio)}</td><td class="n">${num("servicio", x, "min", x.min, 70)}</td><td class="n">${sw("servicio", x)}</td></tr>`).join("")}</tbody></table></div>`;
    if (c.productos.length) html += `<div class="card tw" style="margin-top:12px"><h3>Productos <span class="sp"></span><button class="b s p" id="add-p">+ Agregar</button></h3><table><thead><tr><th>Producto</th><th class="hide-m">Categoría</th><th class="n">Precio</th><th class="n hide-m">Costo</th><th class="n hide-m">Mínimo</th><th class="n">Activo</th></tr></thead><tbody>
      ${c.productos.map(x => `<tr><td>${esc(x.nombre)}</td><td class="hide-m">${esc(x.cat || "")}</td><td class="n">${num("producto", x, "precio", x.precio)}</td><td class="n hide-m">${num("producto", x, "costo", x.costo)}</td><td class="n hide-m">${x.stock == null ? "—" : num("producto", x, "minimo", x.minimo, 70)}</td><td class="n">${sw("producto", x)}</td></tr>`).join("")}</tbody></table>
      <p style="color:var(--muted);font-size:12px;margin-top:6px">El stock se carga y corrige en la pestaña Stock. Con el costo calculamos el margen y el valor de tu mercadería.</p></div>`;
    if (c.clases.length) html += `<div class="card tw" style="margin-top:12px"><h3>Clases</h3><table><thead><tr><th>Clase</th><th>Días y hora</th><th class="hide-m">Profe</th><th class="n">Cupo</th><th class="n">Activa</th></tr></thead><tbody>
      ${c.clases.map(x => `<tr><td>${esc(x.nombre)}</td><td>${esc(x.dias)} · ${x.hora}</td><td class="hide-m">${esc(x.profe)}</td><td class="n">${num("clase", x, "cupo", x.cupo, 70)}</td><td class="n">${sw("clase", x)}</td></tr>`).join("")}</tbody></table></div>`;
    if (c.unidades.length) html += `<div class="card tw" style="margin-top:12px"><h3>Unidades</h3><table><thead><tr><th>Unidad</th><th class="n">Personas</th><th class="n">Precio por noche</th><th class="n">Activa</th></tr></thead><tbody>
      ${c.unidades.map(x => `<tr><td>${esc(x.nombre)}</td><td class="n">${x.capacidad}</td><td class="n">${num("unidad", x, "precio", x.precio)}</td><td class="n">${sw("unidad", x)}</td></tr>`).join("")}</tbody></table></div>`;
    const porDia = {}; c.horarios.forEach(h => (porDia[h.dia] = porDia[h.dia] || []).push(`${h.desde} a ${h.hasta}`));
    html += `<div class="two" style="margin-top:12px"><div class="card"><h3>Horario de atención</h3>${Object.entries(porDia).map(([d, hs]) => `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #F0F2F5"><span style="text-transform:capitalize">${c.horarios.find(h => h.dia == d).dia_txt}</span><span>${hs.join(" y ")}</span></div>`).join("")}
      <p style="color:var(--muted);font-size:12px;margin-top:8px">¿Cambió tu horario? Escribinos y lo actualizamos en el día.</p></div>
      <div class="card"><h3>Días cerrados</h3><p style="color:var(--muted);font-size:13px">Feriados, vacaciones o un día que no abrís: ese día no se dan turnos ni reservas por el link.</p>
        <div style="display:flex;gap:8px;margin:10px 0"><input class="txt" type="date" id="cd"><button class="b p" id="cd-ok">Cerrar ese día</button></div>
        ${c.cierres.length ? c.cierres.map(f => `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #F0F2F5"><span>${new Date(f + "T12:00:00").toLocaleDateString("es-AR", {weekday: "long", day: "numeric", month: "long"})}</span><button class="b s" data-abrir="${f}">Volver a abrir</button></div>`).join("") : `<p class="empty" style="padding:8px">No hay días cerrados.</p>`}</div></div>`;
    v.innerHTML = html;
    v.querySelectorAll("[data-ed]").forEach(i => i.onchange = () => { const [tipo, id, campo] = i.dataset.ed.split("|"); hacer(() => call("editar", {tipo, id, campo, valor: i.value}), "Guardado. Ya se ve en tu link."); });
    v.querySelectorAll("[data-on]").forEach(i => i.onchange = () => { const [tipo, id] = i.dataset.on.split("|"); hacer(() => call("editar", {tipo, id, campo: "activo", valor: i.checked}), i.checked ? "Activado" : "Apagado: ya no se ofrece en tu link"); });
    $("#cd-ok").onclick = () => hacer(async () => { const r = await call("cerrarDia", {fecha: $("#cd").value}); toast(r.afectados ? `Día cerrado. Ojo: ya tenías ${r.afectados} turnos ese día, avisales.` : "Día cerrado"); });
    v.querySelectorAll("[data-abrir]").forEach(b => b.onclick = () => hacer(() => call("cerrarDia", {fecha: b.dataset.abrir, abrir: true}), "Día abierto otra vez"));
    if ($("#add-p")) $("#add-p").onclick = () => {
      const cats = [...new Set(c.productos.map(x => x.cat))];
      drawer("Agregar producto", `<label class="lbl2">Nombre<input class="txt w" id="ap-n"></label><label class="lbl2">Categoría<input class="txt w" id="ap-c" list="ap-cats" value="${esc(cats[0] || "")}"><datalist id="ap-cats">${cats.map(x => `<option value="${esc(x)}">`).join("")}</datalist></label>
        <label class="lbl2">Descripción (opcional)<input class="txt w" id="ap-d"></label><div class="two" style="grid-template-columns:1fr 1fr"><label class="lbl2">Precio<input class="txt w" type="number" id="ap-p"></label><label class="lbl2">Costo (opcional)<input class="txt w" type="number" id="ap-co"></label></div>
        <div class="two" style="grid-template-columns:1fr 1fr"><label class="lbl2">Stock inicial<input class="txt w" type="number" id="ap-s" value="0"></label><label class="lbl2">Avisarme cuando queden<input class="txt w" type="number" id="ap-m" value="2"></label></div>
        <label class="lbl2" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ap-sin"> Sin control de stock (se prepara en el momento)</label><div id="ap-err"></div>`, `<button class="b p" id="ap-ok">Agregar</button>`);
      $("#ap-ok").onclick = async () => { try { await call("agregarProducto", {nombre: $("#ap-n").value, cat: $("#ap-c").value, desc: $("#ap-d").value, precio: $("#ap-p").value, costo: $("#ap-co").value, stock: $("#ap-s").value, minimo: $("#ap-m").value, sin_stock: $("#ap-sin").checked}); toast("Producto agregado. Ya está en tu link."); cerrar(); render(); } catch (e) { $("#ap-err").innerHTML = `<div class="err">${esc(e.message)}</div>`; } };
    };
    if ($("#add-s")) $("#add-s").onclick = () => {
      const cats = [...new Set(c.servicios.map(x => x.cat).filter(Boolean))];
      drawer("Agregar servicio", `<label class="lbl2">Nombre<input class="txt w" id="as-n"></label><label class="lbl2">Categoría<input class="txt w" id="as-c" list="as-cats" value="${esc(cats[0] || "")}"><datalist id="as-cats">${cats.map(x => `<option value="${esc(x)}">`).join("")}</datalist></label>
        <label class="lbl2">Descripción (opcional)<input class="txt w" id="as-d"></label><div class="two" style="grid-template-columns:1fr 1fr"><label class="lbl2">Precio<input class="txt w" type="number" id="as-p"></label><label class="lbl2">Minutos<input class="txt w" type="number" id="as-m" value="60"></label></div>
        ${P.recursos.length ? `<label class="lbl2">¿Quién lo hace?</label>${P.recursos.map(r => `<label style="display:flex;gap:8px;align-items:center;padding:3px 0"><input type="checkbox" class="as-pro" value="${r.id}" checked> ${esc(r.nombre)} <small style="color:var(--muted)">${esc(r.rol || "")}</small></label>`).join("")}` : ""}<div id="as-err"></div>`, `<button class="b p" id="as-ok">Agregar</button>`);
      $("#as-ok").onclick = async () => { try { await call("agregarServicio", {nombre: $("#as-n").value, cat: $("#as-c").value, desc: $("#as-d").value, precio: $("#as-p").value, min: $("#as-m").value, pros: [...document.querySelectorAll(".as-pro:checked")].map(x => x.value)}); toast("Servicio agregado. Ya está en tu link."); P = await call("panel"); cerrar(); render(); } catch (e) { $("#as-err").innerHTML = `<div class="err">${esc(e.message)}</div>`; } };
    };
  }

  // ── Caja y balance ────────────────────────────────────────────────
  async function caja(v) {
    const c = await call("caja", {mes: MES});
    MES = c.mes;
    const [y, m] = c.mes.split("-").map(Number);
    const nomMes = new Date(y, m - 1, 1).toLocaleDateString("es-AR", {month: "long", year: "numeric"});
    const maxCat = Math.max(1, ...c.categorias.map(x => x.monto));
    const b = c.balance, patrimonio = b.caja + b.stock + b.a_cobrar - b.deudas;
    v.innerHTML = `<div class="ph"><h1>Caja · ${esc(nomMes)}</h1><span class="sp"></span><div class="nav2"><button class="b" id="m-ant" aria-label="Mes anterior">←</button><button class="b" id="m-sig" aria-label="Mes siguiente">→</button></div><button class="b p" id="xls">⬇ Bajar Excel</button></div>
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
        ${c.movimientos.map(x => `<tr><td>${ddmm(x.fecha)}</td><td>${esc(x.concepto)}</td><td class="hide-m">${esc(x.cat)}</td><td class="hide-m">${esc(x.medio)}</td><td class="n" style="color:${x.tipo === "ingreso" ? "var(--ok)" : "var(--crit)"};font-weight:600">${x.tipo === "ingreso" ? "+" : "−"}${pesos(x.monto)}</td></tr>`).join("") || `<tr><td colspan="5" class="empty">Sin movimientos este mes.</td></tr>`}</tbody></table></div>`;
    const mover = k => { const d = new Date(y, m - 1 + k, 1); MES = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; render(); };
    $("#m-ant").onclick = () => mover(-1); $("#m-sig").onclick = () => mover(1);
    $("#fm").onsubmit = e => { e.preventDefault(); hacer(() => call("movimiento", {tipo: $("#m-t").value, concepto: $("#m-c").value, cat: $("#m-cat").value || "Otros", monto: $("#m-m").value}), "Movimiento guardado"); };
    $("#xls").onclick = () => {
      const movs = [...c.movimientos].sort((a, b2) => a.fecha.localeCompare(b2.fecha));
      const filas = [["Fecha", "Tipo", "Categoría", "Concepto", "Medio", "Ingreso", "Egreso"].map(t => ({v: t, b: true}))];
      movs.forEach(x => filas.push([{v: new Date(x.fecha)}, x.tipo === "ingreso" ? "Ingreso" : "Egreso", x.cat, x.concepto, x.medio, x.tipo === "ingreso" ? {v: x.monto, z: "plata"} : "", x.tipo === "egreso" ? {v: x.monto, z: "plata"} : ""]));
      const n = filas.length;
      filas.push(["", "", "", {v: "TOTAL", b: true}, "", {f: `SUM(F2:F${n})`, z: "plata", b: true}, {f: `SUM(G2:G${n})`, z: "plata", b: true}]);
      const res = [[{v: `${c.negocio} · ${nomMes}`, b: true}, ""], ["", ""], [{v: "Resultado del mes", b: true}, ""],
        ["Ingresos", {f: `Movimientos!F${n + 1}`, z: "plata"}], ["Egresos", {f: `Movimientos!G${n + 1}`, z: "plata"}], [{v: "Resultado", b: true}, {f: "B4-B5", z: "plata", b: true}], ["", ""],
        [{v: "Balance sencillo (hoy)", b: true}, ""], ["Plata en caja y banco", {v: b.caja, z: "plata"}], ["Mercadería en stock (al costo)", {v: b.stock, z: "plata"}], ["Pedidos por cobrar", {v: b.a_cobrar, z: "plata"}],
        ["Lo que debés", {v: b.deudas, z: "plata"}], [{v: "Lo que vale tu negocio", b: true}, {f: "B9+B10+B11-B12", z: "plata", b: true}], ["", ""], ["Cambiá los valores de la columna B y los totales se recalculan solos.", ""]];
      excel(`caja_${c.mes}`, [{nombre: "Resumen", columnas: [36, 16], filas: res}, {nombre: "Movimientos", columnas: [12, 9, 18, 40, 14, 14, 14], filas}]);
    };
  }

  addEventListener("resize", () => { clearTimeout(render.r); render.r = setTimeout(() => TAB === "agenda" && render(), 250); });
  inicio();
})();
