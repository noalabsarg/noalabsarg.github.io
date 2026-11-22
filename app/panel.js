/* Panel del dueño: agenda, estadías, pedidos, stock, socios, clientes, números, catálogo y caja. */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const pesos = n => (n < 0 ? "−$" : "$") + Math.abs(Math.round(n || 0)).toLocaleString("es-AR");
  const call = (m, p) => NOA.call(m, p).catch(e => {
    if (e && e.tipo === "sesion" && !NOA.esDemo) { location.href = "/entrar"; return new Promise(() => {}); }
    throw e;
  });
  const ROL = () => (P && P.rol) || "dueño";
  const esEmpleado = () => ROL() === "empleado", esDueno = () => ROL() === "dueño";
  const pad = n => String(n).padStart(2, "0");
  const fdia = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const min = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const ddmm = f => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
  const COL = ["#E8772E", "#2F6FDE", "#1F8A5B", "#7A5AF8", "#C2412D", "#0E7490", "#B45309", "#475569"];
  const DSEM = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  let SEM = null;
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
    try { P = await call("panel"); } catch (e) { document.body.innerHTML = `<p class="empty">Link inválido. <a href="/entrar">Entrar con usuario y contraseña</a></p>`; return; }
    if (P.slug && !NOA.slug) NOA.slug = P.slug;
    document.title = `${P.nombre} · Panel`;
    $("#org").innerHTML = `<i>${esc(P.nombre.replace(/^(Salón|Taller|Café|Gimnasio|Ferretería|Matería|Despensa|Tienda|Restó|Rotisería|Heladería|Academia|Cabañas|Consultorio|Estudio|Norte)\s+/i, "").charAt(0))}</i><span>${esc(P.nombre)}<small>PANEL DEL NEGOCIO</small></span>`;
    const ROLES_T = {dueño: "Dueño", encargado: "Encargado", empleado: "Empleado"};
    $("#link").innerHTML = (P.link ? `Tu link para clientes <code>${esc(P.link)}</code>` : "") +
      (P.usuario && !NOA.esDemo ? ` <span class="yo">${esc(P.usuario.nombre)} · ${ROLES_T[ROL()]} <button class="b s" id="salir">Salir</button></span>` : "");
    if (NOA.esDemo && P.usuario) $("#org small").textContent = `${ROLES_T[ROL()].toUpperCase()} · ${P.usuario.nombre.toUpperCase()}`;
    if ($("#salir")) $("#salir").onclick = async () => { try { await call("salir"); } catch (e) {} location.href = "/entrar"; };
    const tabs = [];
    if (P.tiene.estadias) tabs.push(["estadias", "Estadías"]);
    tabs.push(["agenda", P.tiene.estadias ? "Entradas y salidas" : "Agenda"]);
    if (P.tiene.productos) tabs.push(["pedidos", "Pedidos"], ["stock", "Stock"]);
    if (P.tiene.socios) tabs.push(["socios", P.textos && P.textos.socio === "alumno" ? "Alumnos" : "Socios"]);
    if (P.tiene.presupuestos) tabs.push(["presupuestos", "Presupuestos"]);
    tabs.push(["clientes", "Clientes"], ["personal", "Personal"]);
    if (esDueno()) tabs.push(["numeros", "Números"]);
    if (!esEmpleado()) tabs.push(["catalogo", P.tiene.productos && !P.tiene.turnos ? "Productos y precios" : "Servicios y precios"]);
    if (esDueno()) tabs.push(["caja", "Caja y balance"], ["usuarios", "Usuarios"]);
    if (!tabs.some(t => t[0] === TAB)) TAB = tabs[0][0];
    $("#tabs").innerHTML = tabs.map(([k, t]) => `<button data-t="${k}">${t}<em id="b-${k}" hidden></em></button>`).join("");
    $("#tabs").querySelectorAll("button").forEach(b => b.onclick = () => { TAB = b.dataset.t; BUSCA = ""; render(); });
    $("#dr-bg").onclick = cerrar; $("#dr .x").onclick = cerrar;
    document.addEventListener("click", ev => {
      const a = ev.target.closest("[data-resena]"); if (!a) return;
      call("marcarResena", {telefono: a.dataset.resena}).then(() => { a.textContent = "Opinión pedida ✓"; a.classList.add("ok"); setTimeout(() => { if (!$("#dr").classList.contains("on")) render(); }, 1500); }).catch(() => {});
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape") cerrar(); });
    NOA.suscribir((tipo, x) => {
      const nombres = {presupuesto: x ? `Presupuesto N° ${x.numero}: ${x.acepta ? "¡lo aceptaron!" : "lo rechazaron"}` : null, opinion: x && x.nota <= 3 ? `Una opinión de ${x.nota} estrella${x.nota > 1 ? "s" : ""}: mirala en Clientes` : x ? `Nueva opinión: ${"★".repeat(x.nota)}` : null, arqueo: esDueno() ? "La caja se cerró con diferencia: mirala en Caja" : null, sena: "💳 Entró una seña por Mercado Pago", turno: "Nuevo turno", inscripcion: "Nueva reserva de clase", pedido: "Nuevo pedido", estadia: "Nueva reserva de estadía", cancelado: "Se canceló una reserva", vencido: "Un pedido no se retiró: volvió al stock"};
      if (nombres[tipo] && !(x && x.origen === "panel")) {
        toast(`<i>●</i> ${nombres[tipo]}${x && x.numero ? " #" + x.numero : ""}${x && x.inicio ? " · " + x.inicio.slice(11, 16) : ""}${x && x.desde ? " · " + ddmm(x.desde) : ""}`);
        if (!["cancelado", "vencido"].includes(tipo) && x && x.inicio) DIA = x.inicio.slice(0, 10);
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
      await ({agenda, estadias, pedidos, stock, socios, clientes, personal, numeros, catalogo, caja, usuarios, presupuestos}[TAB])(v);
    } catch (e) { v.innerHTML = `<div class="err">${esc(e.message)}</div>`; console.error(e); }
  }
  async function badges() {
    const set = (k, n) => { const b = $("#b-" + k); if (b) { b.hidden = !n; b.textContent = n; } };
    if (P.tiene.productos) { set("pedidos", (await call("pedidos", {estado: "reservado"})).length); set("stock", (await call("stock")).filter(x => x.bajo).length); }
    if (P.tiene.socios) set("socios", (await call("socios")).filter(s => s.vencida).length);
    if (esDueno()) set("caja", (await call("gastos")).alertas);
    if (P.tiene.estadias) set("estadias", (await call("estadias", {})).reservas.filter(e => e.estado === "pendiente").length);
  }
  const buscador = (ph) => `<input class="txt" id="bus" placeholder="${ph}" value="${esc(BUSCA)}" aria-label="${ph}">`;
  function conectarBuscador() {
    const b = $("#bus"); if (!b) return;
    b.oninput = e => { BUSCA = e.target.value; clearTimeout(conectarBuscador.t); conectarBuscador.t = setTimeout(async () => { await render(); const i = $("#bus"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); };
  }

  // ── Agenda ────────────────────────────────────────────────────────
  let ESPERA = [];
  async function agenda(v) {
    const a = await call("agenda", {dia: DIA});
    ESPERA = (P.tiene.turnos || P.tiene.clases) ? await call("espera") : [];
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
      ${(P.tiene.turnos || P.tiene.clases) && ESPERA.length ? `<button class="b ${ESPERA.some(e => e.hay_lugar) ? "warnb" : ""}" id="esp">Lista de espera (${ESPERA.length})${ESPERA.some(e => e.hay_lugar) ? " · hay lugar" : ""}</button>` : ""}
      ${esDueno() ? `<button class="b" id="rsm">📲 Resumen del día</button><button class="b hide-m" id="gcal">📅 Google Calendar</button>` : `<button class="b" id="arq2">Cerrar caja</button>`}<div class="nav2"><button class="b" id="ant" aria-label="Día anterior">←</button><button class="b" id="hoy">Hoy</button><button class="b" id="sig" aria-label="Día siguiente">→</button></div>
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
    if ($("#gcal")) $("#gcal").onclick = calendarioGoogle;
    if ($("#arq2")) $("#arq2").onclick = () => cierreCaja(null);
    if ($("#rsm")) $("#rsm").onclick = resumenDia;
    $("#ant").onclick = () => mover(-1); $("#sig").onclick = () => mover(1); $("#hoy").onclick = () => { DIA = null; render(); };
    if ($("#nuevo")) $("#nuevo").onclick = () => nuevoTurno();
    if ($("#recs")) $("#recs").onclick = () => recordarTodos(recordables, a);
    if ($("#esp")) $("#esp").onclick = listaEspera;
    v.querySelectorAll("[data-act]").forEach(b => b.onclick = () => { ACT = b.dataset.act || null; render(); });
    v.querySelectorAll("[data-vista]").forEach(b => b.onclick = () => { VISTA = b.dataset.vista; render(); });
    v.querySelectorAll("[data-turno]").forEach(b => b.onclick = () => detalleTurno(turnos.find(t => String(t.id) === b.dataset.turno)));
    v.querySelectorAll("[data-asis]").forEach(b => b.onclick = () => hacer(() => call("asistencia", {id: b.dataset.asis, asistio: b.dataset.v === "1"})));
    v.querySelectorAll("[data-cobrar]").forEach(b => b.onclick = ev => { ev.preventDefault(); hacer(() => call("cobrarClase", {id: b.dataset.cobrar}), "Clase suelta cobrada. Se sumó a la caja."); });
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
      return `<button class="ev ${t.estado} ${t.nuevo ? "nuevo" : ""}" data-turno="${t.id}" style="top:${top}px;height:${h}px;--c:${colorPro(t.pro)}"><b>${t.serie ? "🔁 " : ""}${esc(t.cliente)}</b><small>${t.hora} · ${esc(t.titulo)}</small>${h > 50 ? `<small>${esc(extra)}</small>` : ""}</button>`; };
    return `<div class="cal" style="grid-template-columns:56px repeat(${cols.length},minmax(130px,1fr))"><div class="hd"><div></div>${cols.map(c => `<div><i style="background:${colorPro(c.id)}"></i>${esc(c.nombre)} <small>${esc(c.rol || "")}</small></div>`).join("")}</div>
      <div class="times" style="height:${alto}px">${times}</div>${cols.map(c => { const off = c.dias && !c.dias.includes(a.dia_semana); return `<div class="col ${off ? "off" : ""}" style="height:${alto}px">${off ? `<span class="offt">No trabaja este día</span>` : ""}${g}${now}${turnos.filter(t => String(t.pro) === String(c.id)).map(ev).join("")}</div>`; }).join("")}</div>`;
  }
  const estadoTag = e => ({confirmado: `<span class="tag blue">Confirmado</span>`, asistio: `<span class="tag ok">Vino</span>`, ausente: `<span class="tag crit">No vino</span>`, cancelado: `<span class="tag">Cancelado</span>`}[e] || "");
  function listaTurnos(turnos) {
    return `<div class="rows">${turnos.map(t => `<button class="row ${t.estado} ${t.nuevo ? "nuevo" : ""}" data-turno="${t.id}"><span class="h">${t.hora}</span><span class="tx"><b>${esc(t.cliente)}</b>
      <small>${t.serie ? "🔁 Fijo · " : ""}${esc(t.titulo)}${t.pro && proDe(t.pro) ? " · " + esc(proDe(t.pro).nombre) : ""}${t.modalidad === "domicilio" ? " · " + esc(P.textos_modal ? P.textos_modal.domicilio.t : "🚐 " + t.direccion) : ""}${t.extra && t.extra.patente ? " · " + esc(t.extra.patente) : ""}</small></span>
      ${t.origen === "web" ? `<span class="tag acc hide-m">Link</span>` : ""}${t.faltas >= 2 ? `<span class="tag crit" title="Faltó sin avisar en los últimos 6 meses">Faltó ${t.faltas} veces</span>` : ""}${t.esperando_sena ? `<span class="tag warn">Esperando seña</span>` : t.sena_pagada ? `<span class="tag ok">Seña ✓</span>` : ""}${estadoTag(t.estado)}</button>`).join("")}</div>`;
  }
  function detalleTurno(t) {
    if (!t) return;
    const lbl = {auto: "Auto", patente: "Patente", problema: "Problema", obra: "Obra social", afiliado: "N° de afiliado", motivo: "Motivo", cuit: "CUIT", tema: "Tema", busca: "Busca"};
    const ex = Object.entries(t.extra || {}).filter(([, x]) => x).map(([k, x]) => `<dt>${esc(lbl[k] || k)}</dt><dd>${esc(x)}</dd>`).join("");
    const donde = t.modalidad === "domicilio" ? (P.textos_modal ? P.textos_modal.domicilio.t : "A domicilio · " + esc(t.direccion)) : (P.textos_modal ? P.textos_modal.local.t : "En el local");
    drawer(`${t.hora} · ${t.titulo}`, `<dl class="kv"><dt>Cliente</dt><dd><b>${esc(t.cliente)}</b></dd><dt>Celular</dt><dd><a href="https://wa.me/${t.telefono}" target="_blank" rel="noopener">+${esc(t.telefono)}</a></dd>
      <dt>Horario</dt><dd>${t.hora} a ${t.fin}</dd>${t.pro && proDe(t.pro) ? `<dt>${esc(P.recurso)}</dt><dd>${esc(proDe(t.pro).nombre)}</dd>` : ""}
      <dt>Dónde</dt><dd>${esc(donde)}</dd>${t.cobertura ? `<dt>Cobertura</dt><dd>${esc(t.cobertura)}</dd>` : ""}${ex}
      <dt>${t.cobertura && t.cobertura !== "Particular" ? "Coseguro" : "Precio"}</dt><dd>${t.cobertura && t.cobertura !== "Particular" && !t.monto ? "Sin cargo" : esc(t.precio)}</dd>${t.promo ? `<dt>Código</dt><dd>${esc(t.promo)}</dd>` : ""}${t.faltas ? `<dt>Ausencias</dt><dd>Faltó ${t.faltas === 1 ? "1 vez" : t.faltas + " veces"} sin avisar en los últimos 6 meses</dd>` : ""}${t.sena ? `<dt>Seña</dt><dd>${pesos(t.sena)} · ${t.sena_pagada ? "<b style='color:#1F8A5B'>pagada por Mercado Pago</b>" : t.estado === "confirmado" ? "esperando el pago (si no paga en 30 minutos, se libera)" : "no se pagó"}</dd>` : ""}<dt>Estado</dt><dd>${estadoTag(t.estado)}</dd><dt>Origen</dt><dd>${t.origen === "web" ? "Lo sacó por el link" : "Cargado en el panel"}</dd>${t.serie ? `<dt>Repetición</dt><dd>🔁 Turno fijo semanal · <button class="tg" id="d-serie">Cancelar todos los que vienen</button></dd>` : ""}</dl>
      ${t.estado === "confirmado" && t.monto ? `<p style="color:var(--muted);font-size:12.5px;margin-top:14px">Al marcar "Vino", el cobro de ${esc(t.precio)} entra solo en la caja.</p>` : ""}`,
      (t.recordar ? `<a class="b wa" href="${esc(t.recordar)}" target="_blank" rel="noopener">Recordar por WhatsApp</a>` : "") + `${t.resena ? `<a class="b s" data-resena="${esc(t.telefono)}" href="${esc(t.resena)}" target="_blank" rel="noopener">⭐ Pedir opinión</a>` : ""}` +
      (t.estado === "confirmado" ? `<button class="b ok" id="d-si">Vino</button><button class="b" id="d-no">No vino</button><button class="b crit" id="d-can">Cancelar</button>` : `<button class="b" id="d-re">Volver a confirmado</button>`));
    const set = e => hacer(() => call("estadoTurno", {id: t.id, estado: e}), e === "asistio" ? "Listo, quedó registrado en la caja" : "Listo");
    if ($("#d-si")) { $("#d-si").onclick = () => set("asistio"); $("#d-no").onclick = () => set("ausente"); $("#d-can").onclick = () => set("cancelado"); }
    if ($("#d-re")) $("#d-re").onclick = () => set("confirmado");
    if ($("#d-serie")) $("#d-serie").onclick = () => { const b = $("#d-serie"); if (!confirmar(b)) return; hacer(async () => { const r = await call("cancelarSerie", {serie: t.serie}); toast(`Se cancelaron ${r.cancelados} turnos`); }); };
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
      <label class="lbl2">Repetir<select class="txt w" id="nt-r"><option value="1">Solo esta vez</option><option value="4">Todas las semanas, por 1 mes</option><option value="8">Todas las semanas, por 2 meses</option><option value="13">Todas las semanas, por 3 meses</option><option value="26">Todas las semanas, por 6 meses</option></select></label>
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
        const rep = Number($("#nt-r").value);
        const r = await call("reservarTurno", {origen: "panel", repetir: rep, servicio: sv.id, inicio: hora.inicio, pro: ($("#nt-p") && $("#nt-p").value) || hora.pro || undefined, nombre: $("#nt-n").value.trim(), telefono: $("#nt-t").value.trim(),
                                    modalidad: $("#nt-m") ? $("#nt-m").value : undefined, direccion: $("#nt-dir") ? $("#nt-dir").value : "", acepta: true,
                                    extra: Object.fromEntries((P.campos_extra || []).map(c => [c.id, ($("#nt-x-" + c.id) || {}).value || ""]))});
        DIA = hora.inicio.slice(0, 10);
        if (r.serie && r.serie.choques.length) {
          drawer("Turno fijo cargado", `<p>Quedaron agendadas <b>${r.serie.semanas} semanas</b> seguidas a la misma hora.</p>
            <div class="err" style="margin-top:10px">Estas semanas ese horario ya estaba ocupado, así que no se cargaron: <b>${r.serie.choques.map(esc).join(", ")}</b>. Cargalas a mano con otro horario si hace falta.</div>`, `<button class="b p" id="nt-fin">Listo</button>`);
          $("#nt-fin").onclick = () => { cerrar(); render(); };
        } else { toast(r.serie ? `Turno fijo: ${r.serie.semanas} semanas agendadas` : "Turno cargado"); cerrar(); render(); }
      } catch (e) { $("#nt-err").innerHTML = `<div class="err">${esc(e.message)}</div>`; }
    };
  }
  function listaEspera() {
    const fila = e => `<div class="card" style="padding:10px 12px;margin:8px 0;${e.hay_lugar ? "border-color:#1F8A5B;background:#F1FAF5" : ""}">
      <div style="display:flex;gap:8px;align-items:flex-start"><div style="flex:1"><b>${esc(e.nombre)}</b> <span style="color:var(--muted);font-size:12.5px">+${esc(e.telefono)}</span>
        <div style="font-size:13px">${esc(e.que)} · ${esc(e.cuando)}</div>
        <div style="font-size:12px;color:var(--muted)">${e.hay_lugar ? `<b style="color:#1F8A5B">Hay ${e.libres === 1 ? "1 lugar libre" : e.libres + " lugares libres"}</b>` : "Todavía completo"}${e.avisado ? ` · avisado el ${ddmm(e.avisado)}` : ""}</div></div>
        <span class="tag ${e.tipo === "clase" ? "blue" : ""}">${e.tipo === "clase" ? "Clase" : "Turno"}</span></div>
      <div style="display:flex;gap:6px;margin-top:8px">${e.hay_lugar ? `<a class="b wa s" target="_blank" rel="noopener" href="${esc(e.avisar)}" data-avesp="${esc(e.id)}">${e.avisado ? "Avisar de nuevo" : "Avisar por WhatsApp"}</a>` : ""}
        <button class="b s" data-qesp="${esc(e.id)}">Quitar</button></div></div>`;
    drawer("Lista de espera", `<p style="color:var(--muted);font-size:13px;margin-top:0">Gente que quiso un lugar y estaba todo completo. Cuando alguien cancela, la persona aparece en verde: le avisás por WhatsApp y reserva por el link. Primero está quien se anotó antes.</p>
      ${ESPERA.length ? ESPERA.map(fila).join("") : `<p class="empty">Nadie en espera.</p>`}`);
    document.querySelectorAll("[data-avesp]").forEach(a => a.addEventListener("click", () => call("avisarEspera", {id: a.dataset.avesp}).then(async () => { ESPERA = await call("espera"); }).catch(() => {})));
    document.querySelectorAll("[data-qesp]").forEach(b => b.onclick = async () => { if (!confirmar(b)) return; try { await call("quitarEspera", {id: b.dataset.qesp}); ESPERA = await call("espera"); toast("Quitado de la lista"); ESPERA.length ? listaEspera() : cerrar(); render(); } catch (e) { toast("⚠️ " + esc(e.message)); } });
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
      <div class="meter"><i style="width:${pct}%"></i></div><div class="m">${n} de ${c.cupo} lugares${n >= c.cupo ? " · <b style='color:var(--crit)'>completa</b>" : ""}${c.espera ? ` · ${c.espera} en espera` : ""}</div>
      <div style="display:flex;gap:8px;align-items:center;margin-top:4px">${n ? `<details ${c.nuevo ? "open" : ""} style="flex:1"><summary>Ver anotados y tomar asistencia</summary><ul>${c.inscriptos.map(i => `<li class="${i.nuevo ? "nuevo" : ""}"><span>${esc(i.nombre)}${i.cobro ? (i.cobrado ? ` <span class="tag ok">Suelta cobrada</span>` : ` <button class="tg" data-cobrar="${i.id}">Cobrar suelta ${pesos(i.cobro)}</button>`) : ""}</span>
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


  // ── Personal ──────────────────────────────────────────────────────
  // Horarios de cada persona, francos, vacaciones y licencias. Solo se cambian desde este panel.
  const TIPO_CLS = {trabaja: "", franco: "fr", vacaciones: "vac", licencia: "lic"};
  const dm = f => `${Number(f.slice(8, 10))}/${Number(f.slice(5, 7))}`;
  const diaLargo = (e, f) => { const d = e.dias.find(x => x.fecha === f); return d ? `${d.dia} ${dm(f)}` : dm(f); };
  const DIAS_L = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábados", "domingos"];
  async function personal(v) {
    const e = await call("personal", {desde: SEM});
    const hoy = e.dias.find(d => d.hoy);
    const enHoy = hoy ? e.personas.filter(p => p.semana.find(x => x.fecha === hoy.fecha).tipo === "trabaja") : [];
    const fuera = e.personas.filter(p => p.semana.some(x => ["vacaciones", "licencia"].includes(x.tipo)));
    const horas = e.personas.reduce((a, p) => a + p.horas, 0);
    const fmtH = h => (Math.round(h * 10) / 10).toLocaleString("es-AR");
    let grid = `<div class="card tw" style="padding:0"><table class="occ pers"><thead><tr><th style="min-width:170px">Persona</th>${e.dias.map(d => `<th class="${d.hoy ? "hoyc" : ""}">${d.dia}<br>${d.d}/${d.mes}</th>`).join("")}<th>Horas</th></tr></thead><tbody>`;
    for (const p of e.personas) {
      grid += `<tr><td><button class="pname" data-per="${esc(p.id)}"><i style="background:${esc(p.color || "#475569")}"></i><span><b>${esc(p.nombre)}</b><small>${esc(p.rol || "")}${p.pro_nombre ? (p.pro_nombre === p.nombre ? " · toma turnos" : ` · turnos de ${esc(p.pro_nombre)}`) : ""}</small></span></button></td>`;
      for (const x of p.semana) {
        const d = e.dias.find(y => y.fecha === x.fecha);
        grid += `<td class="${d.hoy ? "hoyc" : ""}"><div role="button" tabindex="0" class="pcell ${TIPO_CLS[x.tipo]} ${x.cambiado && ["trabaja", "franco"].includes(x.tipo) ? "cm" : ""}" data-p="${esc(p.id)}" data-f="${x.fecha}" ${x.tipo === "trabaja" ? 'draggable="true"' : ""} title="${esc(x.nota || "")}">${esc(x.texto)}${x.nota ? `<small>${esc(x.nota)}</small>` : ""}</div></td>`;
      }
      grid += `<td class="n"><b>${fmtH(p.horas)}</b></td></tr>`;
    }
    grid += `</tbody></table></div>`;
    v.innerHTML = `<div class="ph"><h1>Personal</h1><span class="sp"></span>
        <button class="b" id="s-a" aria-label="Semana anterior">←</button><span class="semtxt">Semana del ${dm(e.dias[0].fecha)} al ${dm(e.dias[6].fecha)}</span><button class="b" id="s-s" aria-label="Semana siguiente">→</button>${hoy ? "" : `<button class="b" id="s-h">Esta semana</button>`}
        <button class="b" id="aus">+ Vacaciones o licencia</button><button class="b" id="np">+ Persona</button><button class="b" id="xls">⬇ Excel</button></div>
      <div class="kpis"><div class="kpi"><div class="l">${hoy ? "Trabajan hoy" : "Personas"}</div><div class="v">${hoy ? enHoy.length : e.personas.length}</div><div class="s">${hoy ? (enHoy.map(p => esc(p.nombre.split(" ")[0])).join(", ") || "nadie") : "en el equipo"}</div></div>
        <div class="kpi"><div class="l">De vacaciones o licencia</div><div class="v">${fuera.length}</div><div class="s">${fuera.map(p => esc(p.nombre.split(" ")[0])).join(", ") || "esta semana, nadie"}</div></div>
        <div class="kpi"><div class="l">Horas de la semana</div><div class="v">${fmtH(horas)}</div><div class="s">entre todos</div></div></div>
      ${e.personas.length ? grid : `<div class="card empty">Todavía no cargaste a nadie. Tocá “+ Persona”.</div>`}
      <p class="pleg"><span class="pcell">9 a 13</span> trabaja <span class="pcell fr">Franco</span> <span class="pcell vac">Vacaciones</span> <span class="pcell lic">Licencia</span> <span class="pcell cm">9 a 13</span> cambiado solo ese día</p>
      <p style="color:var(--muted);font-size:12.5px;margin-top:4px">Tocá un día para cambiar el horario, solo esa fecha o todas las semanas. En la compu también podés arrastrar un horario a otro día para moverlo. ${e.personas.some(p => p.pro) ? "La agenda respeta estos horarios: nadie puede sacar turno con alguien que no trabaja." : ""}</p>`;
    const semana = n => { const d = new Date(e.desde + "T12:00:00"); d.setDate(d.getDate() + n); SEM = d.toISOString().slice(0, 10); render(); };
    $("#s-a").onclick = () => semana(-7); $("#s-s").onclick = () => semana(7);
    if ($("#s-h")) $("#s-h").onclick = () => { SEM = null; render(); };
    if (esEmpleado()) { ["#aus", "#np"].forEach(x => { if ($(x)) $(x).remove(); }); v.querySelector(".ph").insertAdjacentHTML("afterend", `<p class="hint" style="color:var(--muted);font-size:13px;margin:-4px 0 10px">Los horarios los cambia el encargado o el dueño.</p>`); }
    if ($("#aus")) $("#aus").onclick = () => ausenciaDrawer(e);
    if ($("#np")) $("#np").onclick = () => nuevaPersona(e);
    $("#xls").onclick = () => excelPersonal(e);
    v.querySelectorAll("[data-per]").forEach(b => b.onclick = () => fichaPersona(e, e.personas.find(p => String(p.id) === b.dataset.per)));
    if (esEmpleado()) { v.querySelectorAll(".pcell[draggable]").forEach(b => b.removeAttribute("draggable")); v.querySelectorAll(".pcell").forEach(b => { b.style.cursor = "default"; b.removeAttribute("role"); b.removeAttribute("tabindex"); }); }
    else v.querySelectorAll(".pcell[data-p]").forEach(b => {
      const p = e.personas.find(x => String(x.id) === b.dataset.p), x = p.semana.find(y => y.fecha === b.dataset.f);
      b.onclick = () => editarDia(e, p, x);
      b.onkeydown = ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); editarDia(e, p, x); } };
      b.ondragstart = ev => { ev.dataTransfer.setData("text/plain", JSON.stringify({p: b.dataset.p, f: b.dataset.f})); b.classList.add("drag"); };
      b.ondragend = () => b.classList.remove("drag");
      b.ondragover = ev => { ev.preventDefault(); b.classList.add("over"); };
      b.ondragleave = () => b.classList.remove("over");
      b.ondrop = async ev => {
        ev.preventDefault(); b.classList.remove("over");
        let o; try { o = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch (er) { return; }
        if (o.p !== b.dataset.p) return toast("Arrastralo dentro de la misma fila: es el horario de esa persona.");
        if (o.f === b.dataset.f) return;
        const src = p.semana.find(y => y.fecha === o.f);
        try {
          const r1 = await call("guardarDia", {persona: p.id, fecha: b.dataset.f, tipo: "trabaja", tramos: src.tramos, alcance: "dia", nota: `Movido del ${diaLargo(e, o.f)}`});
          const r2 = await call("guardarDia", {persona: p.id, fecha: o.f, tipo: "franco", alcance: "dia", nota: `Pasó al ${diaLargo(e, b.dataset.f)}`});
          const af = [...r1.afectados, ...r2.afectados];
          if (af.length) avisarAfectados(p, af); else toast(`Listo: ${esc(p.nombre.split(" ")[0])} trabaja el ${diaLargo(e, b.dataset.f)} en vez del ${diaLargo(e, o.f)}`);
          render();
        } catch (er) { toast("⚠️ " + esc(er.message)); }
      };
    });
  }
  function tramosHtml(tr) {
    const filas = (tr.length ? tr : [["09:00", "13:00"]]).map(([a, b]) => `<div class="trow"><input class="txt" type="time" value="${a}" aria-label="Entra"><span>a</span><input class="txt" type="time" value="${b}" aria-label="Sale"><button type="button" class="b s" data-rm aria-label="Quitar este horario">×</button></div>`).join("");
    return `<div id="trs">${filas}</div><button type="button" class="b s" id="tr-add" style="margin-top:6px">+ Otro horario ese día (corte al mediodía)</button>`;
  }
  function leerTramos() { return [...document.querySelectorAll("#trs .trow")].map(r => { const i = r.querySelectorAll("input"); return [i[0].value, i[1].value]; }); }
  function conectarTramos() {
    const enl = () => document.querySelectorAll("#trs [data-rm]").forEach(b => b.onclick = () => { if (document.querySelectorAll("#trs .trow").length > 1) b.parentElement.remove(); });
    enl();
    $("#tr-add").onclick = () => { const c = $("#trs"); if (c.children.length >= 3) return; const r = c.lastElementChild.cloneNode(true); const i = r.querySelectorAll("input"); i[0].value = "16:00"; i[1].value = "20:00"; c.append(r); enl(); };
  }
  function editarDia(e, p, x) {
    const w = (new Date(x.fecha + "T12:00:00").getDay() + 6) % 7;
    drawer(`${p.nombre} · ${diaLargo(e, x.fecha)}`, `
      <div class="lbl2">Ese día</div><div class="fchips" id="tipo">${Object.entries(e.tipos).map(([k, t]) => `<button type="button" class="chip ${x.tipo === k ? "on" : ""}" data-t="${k}">${t}</button>`).join("")}</div>
      <div id="hor" style="margin-top:12px"><div class="lbl2">Horario</div>${tramosHtml(x.tramos)}</div>
      <div id="alc" style="margin-top:14px"><div class="lbl2">¿Para cuándo?</div>
        <label class="rad"><input type="radio" name="alc" value="dia" checked> Solo el ${esc(diaLargo(e, x.fecha))}</label>
        <label class="rad"><input type="radio" name="alc" value="semanal"> Todos los ${DIAS_L[w]} desde ahora</label></div>
      <label class="lbl2" style="margin-top:12px">Nota (opcional)<input class="txt w" id="nota" maxlength="120" value="${esc(x.nota || "")}" placeholder="Ej: cambió con Juli, turno médico"></label>
      ${p.pro_nombre ? `<p style="color:var(--muted);font-size:12.5px;margin-top:10px">La agenda usa este horario: fuera de él nadie puede reservar ${p.pro_nombre === p.nombre ? `con ${esc(p.nombre.split(" ")[0])}` : `en ${esc(p.pro_nombre)}`}.</p>` : ""}
      <div id="d-err"></div>`,
      `${x.cambiado ? `<button class="b" id="base">Volver a su horario de siempre</button>` : ""}<button class="b p" id="gd">Guardar</button>`);
    let tipo = x.tipo;
    const pintar = () => {
      document.querySelectorAll("#tipo .chip").forEach(b => b.classList.toggle("on", b.dataset.t === tipo));
      $("#hor").style.display = tipo === "trabaja" ? "" : "none";
      $("#alc").style.display = ["trabaja", "franco"].includes(tipo) ? "" : "none";
    };
    document.querySelectorAll("#tipo .chip").forEach(b => b.onclick = () => { tipo = b.dataset.t; pintar(); });
    pintar(); conectarTramos();
    $("#gd").onclick = async () => {
      const alc = (document.querySelector("[name=alc]:checked") || {}).value || "dia";
      try {
        const r = await call("guardarDia", {persona: p.id, fecha: x.fecha, tipo, tramos: tipo === "trabaja" ? leerTramos() : [], alcance: ["trabaja", "franco"].includes(tipo) ? alc : "dia", nota: $("#nota").value});
        if (r.afectados.length) avisarAfectados(p, r.afectados); else { cerrar(); toast(alc === "semanal" ? `Guardado para todos los ${DIAS_L[w]}` : "Horario guardado"); }
        render();
      } catch (er) { $("#d-err").innerHTML = `<p class="err">${esc(er.message)}</p>`; }
    };
    if ($("#base")) $("#base").onclick = async () => { try { const r = await call("volverBase", {persona: p.id, fecha: x.fecha}); if (r.afectados.length) avisarAfectados(p, r.afectados); else { cerrar(); toast("Volvió a su horario de siempre"); } render(); } catch (er) { toast("⚠️ " + esc(er.message)); } };
  }
  function avisarAfectados(p, af) {
    drawer("Revisá estos turnos", `<p>${esc(p.nombre)} no va a estar en ${af.length === 1 ? "este horario" : "estos horarios"} que ya estaban reservados. Avisales o pasalos a otra persona desde la Agenda.</p>
      <div class="rows" style="margin-top:10px">${af.map(a => `<div class="row" style="cursor:default"><span class="tx"><b>${esc(a.texto)}</b></span>${a.avisar ? `<a class="b wa s" href="${esc(a.avisar)}" target="_blank" rel="noopener">Avisar</a>` : ""}</div>`).join("")}</div>`,
      `<button class="b p" id="ok-af">Entendido</button>`);
    $("#ok-af").onclick = cerrar;
  }
  function ausenciaDrawer(e, pre) {
    const hoyF = new Date(); const f0 = `${hoyF.getFullYear()}-${String(hoyF.getMonth() + 1).padStart(2, "0")}-${String(hoyF.getDate()).padStart(2, "0")}`;
    drawer("Vacaciones, licencia o franco", `
      <label class="lbl2">Quién<select class="txt w" id="a-p">${e.personas.map(p => `<option value="${esc(p.id)}" ${pre && String(pre.id) === String(p.id) ? "selected" : ""}>${esc(p.nombre)}</option>`).join("")}</select></label>
      <div class="lbl2" style="margin-top:12px">Qué es</div><div class="fchips" id="a-t"><button type="button" class="chip on" data-t="vacaciones">Vacaciones</button><button type="button" class="chip" data-t="licencia">Licencia</button><button type="button" class="chip" data-t="franco">Franco</button></div>
      <div class="seg2" style="display:flex;gap:10px;margin-top:12px"><label class="lbl2" style="flex:1">Desde<input class="txt w" type="date" id="a-d" value="${f0}"></label><label class="lbl2" style="flex:1">Hasta (inclusive)<input class="txt w" type="date" id="a-h" value="${f0}"></label></div>
      <label class="lbl2" style="margin-top:12px">Nota (opcional)<input class="txt w" id="a-n" maxlength="120" placeholder="Ej: vacaciones de verano"></label><div id="a-err"></div>`,
      `<button class="b p" id="a-ok">Guardar</button>`);
    let tipo = "vacaciones";
    document.querySelectorAll("#a-t .chip").forEach(b => b.onclick = () => { tipo = b.dataset.t; document.querySelectorAll("#a-t .chip").forEach(x => x.classList.toggle("on", x === b)); });
    $("#a-d").onchange = () => { if ($("#a-h").value < $("#a-d").value) $("#a-h").value = $("#a-d").value; };
    $("#a-ok").onclick = async () => {
      const p = e.personas.find(x => String(x.id) === $("#a-p").value);
      try {
        const r = await call("ausencia", {persona: p.id, desde: $("#a-d").value, hasta: $("#a-h").value, tipo, nota: $("#a-n").value});
        if (r.afectados.length) avisarAfectados(p, r.afectados); else { cerrar(); toast(`Listo: ${r.dias} día${r.dias > 1 ? "s" : ""} de ${tipo} para ${esc(p.nombre.split(" ")[0])}`); }
        render();
      } catch (er) { $("#a-err").innerHTML = `<p class="err">${esc(er.message)}</p>`; }
    };
  }
  function nuevaPersona(e) {
    const libres = e.recursos.filter(r => !r.usado);
    drawer("Sumar a alguien al equipo", `
      <label class="lbl2">Nombre<input class="txt w" id="n-n" maxlength="60" placeholder="Ej: Carla Gómez"></label>
      <label class="lbl2" style="margin-top:12px">Qué hace<input class="txt w" id="n-r" maxlength="40" placeholder="Ej: Vendedora, Cocina, Recepción"></label>
      ${e.recursos.length ? `<label class="lbl2" style="margin-top:12px">¿Atiende turnos en la agenda?<select class="txt w" id="n-p"><option value="">No</option>${libres.map(r => `<option value="${esc(r.id)}">Sí, como ${esc(r.nombre)}</option>`).join("")}</select></label>` : ""}
      <p style="color:var(--muted);font-size:12.5px;margin-top:10px">Arranca con el horario del negocio todos los días que abre. Después lo ajustás tocando cada día.</p><div id="n-err"></div>`,
      `<button class="b p" id="n-ok">Sumar</button>`);
    $("#n-ok").onclick = async () => {
      try { await call("agregarPersona", {nombre: $("#n-n").value, rol: $("#n-r").value, pro: $("#n-p") ? $("#n-p").value : ""}); cerrar(); toast("Listo. Ajustá su horario tocando cada día."); render(); }
      catch (er) { $("#n-err").innerHTML = `<p class="err">${esc(er.message)}</p>`; }
    };
  }
  function fichaPersona(e, p) {
    const fmt = tr => tr && tr.length ? tr.map(([a, b]) => `${a} a ${b}`).join(" · ") : "Franco";
    drawer(p.nombre, `<p style="color:var(--muted)">${esc(p.rol || "")}${p.pro_nombre ? ` · atiende turnos como ${esc(p.pro_nombre)}` : ""}</p>
      <div class="sec-t">Su horario de siempre</div>
      <dl class="kv">${["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d, i) => `<dt>${d}</dt><dd>${esc(fmt(p.horario[String(i)]))}</dd>`).join("")}</dl>
      <p style="color:var(--muted);font-size:12.5px;margin-top:10px">Para cambiarlo, tocá un día en la grilla y elegí “Todos los … desde ahora”.</p>`,
      `<button class="b crit" id="baja">Dar de baja</button><button class="b" id="f-aus">Cargar vacaciones o licencia</button>`);
    $("#f-aus").onclick = () => ausenciaDrawer(e, p);
    $("#baja").onclick = () => { if (!confirmar($("#baja"))) return; hacer(() => call("quitarPersona", {persona: p.id}), `${esc(p.nombre)} ya no figura en el equipo`); };
  }
  function excelPersonal(e) {
    const cab = ["Persona", "Qué hace", ...e.dias.map(d => `${d.dia} ${d.d}/${d.mes}`)];
    const h1 = [cab.map(t => ({v: t, b: true}))];
    e.personas.forEach(p => h1.push([p.nombre, p.rol || "", ...p.semana.map(x => x.texto + (x.nota ? ` (${x.nota})` : ""))]));
    const h2 = [[...cab, "Total"].map(t => ({v: t, b: true}))];
    e.personas.forEach((p, i) => { const r = i + 2; h2.push([p.nombre, p.rol || "", ...p.semana.map(x => x.horas), {f: `SUM(C${r}:I${r})`, b: true}]); });
    const n = h2.length;
    h2.push([{v: "TOTAL", b: true}, "", ...["C", "D", "E", "F", "G", "H", "I", "J"].map(c => ({f: `SUM(${c}2:${c}${n})`, b: true}))]);
    excel(`horarios_${e.desde}`, [{nombre: "Horarios", columnas: [22, 18, 16, 16, 16, 16, 16, 16, 16], filas: h1}, {nombre: "Horas", columnas: [22, 18, 9, 9, 9, 9, 9, 9, 9, 10], filas: h2}]);
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
    v.innerHTML = `<div class="ph"><h1>Estadías</h1><span class="sp"></span><button class="b p" id="nr">+ Reserva</button>${esEmpleado() ? "" : `<button class="b" id="ical">Booking y Airbnb</button>`}</div>
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
    if ($("#ical")) $("#ical").onclick = () => conectarPlataformas(e);
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
      (["pendiente", "confirmada"].includes(r.estado) ? `<button class="b crit" data-e="cancelada">Cancelar</button>` : "") + `${r.resena ? `<a class="b s" data-resena="${esc(r.telefono)}" href="${esc(r.resena)}" target="_blank" rel="noopener">⭐ Pedir opinión</a>` : ""}`);
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
  const estPed = e => ({reservado: `<span class="tag acc">Nuevo</span>`, listo: `<span class="tag blue">Listo</span>`, entregado: `<span class="tag ok">Entregado</span>`, cancelado: `<span class="tag">Cancelado</span>`, vencido: `<span class="tag crit">No lo retiró</span>`}[e]);
  function pedidoCard(p) {
    const items = p.items.map(i => `<li><span>${i.cant}${i.unidad === "m" ? " m" : " ×"} ${esc(i.nombre)}</span><span>${pesos(i.cant * i.precio)}</span></li>`).join("");
    return `<div class="pc ${p.nuevo ? "nuevo" : ""}"><div class="t"><b>#${p.numero}</b>${estPed(p.estado)}<span class="sp"></span><span class="tag ${p.entrega === "envio" ? "warn" : ""}">${p.entrega === "envio" ? "Envío" : "Retira"} ${esc(p.franja)}</span></div>
      <div><b>${esc(p.cliente)}</b> <a class="m" href="https://wa.me/${p.telefono}" target="_blank" rel="noopener">+${esc(p.telefono)}</a>${p.cuando ? `<div class="m">${esc(p.cuando)}</div>` : ""}${p.entrega === "envio" ? `<div class="m">🚚 ${esc(p.direccion)}</div>` : ""}</div>
      <ul>${items}${p.descuento ? `<li class="m"><span>Código ${esc(p.promo || "")}</span><span>−${pesos(p.descuento)}</span></li>` : ""}${p.envio ? `<li class="m"><span>Envío</span><span>${pesos(p.envio)}</span></li>` : ""}<li style="font-weight:700;border-top:1px solid var(--line);margin-top:4px;padding-top:4px"><span>Total</span><span>${esc(p.total_txt || p.total)}</span></li></ul>
      ${p.nota ? `<div class="nota">📝 ${esc(p.nota)}</div>` : ""}
      <div class="acts">${p.estado === "reservado" ? `<button class="b p s" data-ped="${p.id}" data-e="listo">Marcar listo</button>` : ""}
        ${p.estado === "listo" ? `<a class="b wa s" href="${esc(p.avisar)}" target="_blank" rel="noopener">Avisar que está listo</a><button class="b ok s" data-ped="${p.id}" data-e="entregado">Entregado y cobrado</button>` : ""}
        ${["reservado", "listo"].includes(p.estado) ? `<button class="b crit s" data-ped="${p.id}" data-e="cancelado">Cancelar</button>` : ""}
        ${p.resena ? `<a class="b s" data-resena="${esc(p.telefono)}" href="${esc(p.resena)}" target="_blank" rel="noopener">⭐ Pedir opinión</a>` : ""}
        ${p.estado === "vencido" ? `<a class="b wa s" href="${esc(p.avisar)}" target="_blank" rel="noopener">Avisarle por WhatsApp</a><button class="b s" data-ped="${p.id}" data-e="entregado">Lo retiró igual</button>` : ""}</div>
      ${p.estado === "vencido" ? `<div class="m" style="margin-top:6px">Pasó el tiempo de retiro y la mercadería volvió al stock.</div>` : ""}</div>`;
  }
  function accionesPedido(v) {
    v.querySelectorAll("[data-ped]").forEach(b => b.onclick = () => {
      const e = b.dataset.e;
      if (e === "cancelado" && !confirmar(b)) return;
      hacer(() => call("estadoPedido", {id: b.dataset.ped, estado: e}), {listo: "Pedido listo. Avisale al cliente por WhatsApp.", entregado: "Entregado. Se sumó a la caja y se descontó del stock si correspondía.", cancelado: "Pedido cancelado. El stock volvió a estar disponible."}[e]);
    });
  }
  function confirmar(b) { if (b.dataset.ok) return true; const t = b.textContent; b.dataset.ok = "1"; b.textContent = "¿Seguro? Tocá de nuevo"; setTimeout(() => { delete b.dataset.ok; b.textContent = t; }, 3000); return false; }
  async function pedidos(v) {
    const ps = await call("pedidos", {estado: FILTRO === "todos" ? "" : FILTRO});
    const lista = FILTRO === "entregado" ? ps.slice(-40).reverse() : ps;
    v.innerHTML = `<div class="ph"><h1>Pedidos</h1><span class="sp"></span><div class="seg">${[["activos", "Para preparar"], ["entregado", "Entregados"], ["vencido", "No retirados"], ["cancelado", "Cancelados"]].map(([k, t]) => `<button data-f="${k}" class="${FILTRO === k ? "on" : ""}">${t}</button>`).join("")}</div></div>
      ${lista.length ? `<div class="pgrid">${lista.map(pedidoCard).join("")}</div>` : `<div class="card empty">No hay pedidos acá.</div>`}`;
    v.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { FILTRO = b.dataset.f; render(); });
    accionesPedido(v);
  }

  // ── Stock ─────────────────────────────────────────────────────────
  let PROVS = [];
  async function stock(v) {
    const st = await call("stock");
    PROVS = esEmpleado() ? [] : await call("proveedores");
    const bajos = st.filter(x => x.bajo), apart = st.reduce((a, x) => a + x.apartado, 0);
    const valor = st.filter(x => !x.ilimitado).reduce((a, x) => a + x.stock * (x.costo || 0), 0);
    const lista = st.filter(x => (!SOLO_BAJO || x.bajo) && (!BUSCA || x.nombre.toLowerCase().includes(BUSCA.toLowerCase())));
    v.innerHTML = `<div class="ph"><h1>Stock</h1><span class="sp"></span>${buscador("Buscar producto")}<label class="b"><input type="checkbox" id="sb" ${SOLO_BAJO ? "checked" : ""}> Solo para reponer</label>${esEmpleado() ? "" : `<button class="b" id="prov">Pedir a proveedores${bajos.length ? ` (${bajos.length})` : ""}</button>`}<button class="b p" id="venta">+ Venta en el local</button><button class="b" id="xls">⬇ Excel</button></div>
      <div class="kpis"><div class="kpi"><div class="l">Productos</div><div class="v">${st.length}</div><div class="s">en el catálogo</div></div>
        <div class="kpi"><div class="l">Para reponer</div><div class="v ${bajos.length ? "neg" : ""}">${bajos.length}</div><div class="s">en el mínimo o menos</div></div>
        <div class="kpi"><div class="l">Apartado en pedidos</div><div class="v">${apart}</div><div class="s">reservado sin retirar</div></div>
        <div class="kpi"><div class="l">Mercadería al costo</div><div class="v">${pesos(valor)}</div><div class="s">lo que tenés en el local</div></div></div>
      <div class="card tw"><table><thead><tr><th>Producto</th><th class="hide-m">Categoría</th><th class="n">Precio</th><th class="n">Disponible</th><th class="n hide-m">Apartado</th><th class="n hide-m">Mínimo</th>${esEmpleado() ? "" : `<th class="hide-m">Proveedor</th>`}<th></th></tr></thead><tbody>
      ${lista.map(x => `<tr class="${x.bajo ? "bajo" : ""}"><td><b>${esc(x.nombre)}</b>${x.bajo ? ` <span class="tag crit">Reponer</span>` : ""}</td><td class="hide-m">${esc(x.cat)}</td><td class="n">${esc(x.precio)}</td>
        <td class="n">${x.ilimitado ? `<span class="tag">Sin control</span>` : esEmpleado() ? `<b>${x.stock}</b>` : `<input class="num" type="number" min="0" value="${x.stock}" data-st="${x.id}" aria-label="Stock de ${esc(x.nombre)}">`}</td>
        <td class="n hide-m">${x.apartado || "—"}</td><td class="n hide-m">${x.ilimitado ? "—" : x.minimo}</td>${esEmpleado() ? "" : `<td class="hide-m">${x.ilimitado ? "" : `<select class="txt" style="padding:4px 6px;font-size:12.5px;max-width:150px" data-pv="${esc(x.id)}"><option value="">—</option>${PROVS.map(p => `<option value="${esc(p.id)}" ${p.id === x.proveedor ? "selected" : ""}>${esc(p.nombre)}</option>`).join("")}</select>`}</td>`}<td class="n"><button class="b s" data-v="${x.id}" ${!x.ilimitado && x.stock < 1 ? "disabled" : ""}>Vendí 1</button></td></tr>`).join("")}</tbody></table></div>
      <p style="color:var(--muted);font-size:12.5px;margin-top:8px">El stock baja solo cuando un cliente reserva por el link, y vuelve si cancela o si no lo retira a tiempo. Para lo que vendés en el mostrador usá "Venta en el local": descuenta y lo suma a la caja.</p>`;
    $("#sb").onchange = e => { SOLO_BAJO = e.target.checked; render(); };
    conectarBuscador();
    v.querySelectorAll("[data-st]").forEach(i => i.onchange = () => hacer(() => call("ajustarStock", {id: i.dataset.st, stock: i.value}), "Stock actualizado"));
    v.querySelectorAll("[data-v]").forEach(b => b.onclick = () => hacer(() => call("ajustarStock", {id: b.dataset.v, vendido: 1}), "Venta registrada"));
    $("#venta").onclick = () => ventaLocal(st);
    if ($("#prov")) $("#prov").onclick = () => pedidoProveedores(st);
    v.querySelectorAll("[data-pv]").forEach(sl => sl.onchange = () => hacer(() => call("asignarProveedor", {producto: sl.dataset.pv, proveedor: sl.value}), "Proveedor asignado"));
    $("#xls").onclick = () => {
      const filas = [["Producto", "Categoría", "Disponible", "Apartado", "Mínimo", "Costo", "Valor al costo", "¿Reponer?"].map(t => ({v: t, b: true}))];
      st.filter(x => !x.ilimitado).forEach((x, i) => { const r = i + 2; filas.push([x.nombre, x.cat, x.stock, x.apartado, x.minimo, {v: x.costo || 0, z: "plata"}, {f: `C${r}*F${r}`, z: "plata"}, {f: `IF(C${r}<=E${r},"Sí","No")`}]); });
      const n = filas.length;
      filas.push(["", "", "", "", "", {v: "TOTAL", b: true}, {f: `SUM(G2:G${n})`, z: "plata", b: true}, ""]);
      excel("stock", [{nombre: "Stock", columnas: [34, 16, 11, 10, 9, 12, 15, 10], filas}]);
    };
  }
  async function pedidoProveedores(st) {
    const pvs = await call("proveedores");
    const faltan = st.filter(x => x.bajo);
    const sug = x => Math.max(1, Math.round((x.minimo || 1) * 2 - x.stock));
    const grupos = [...pvs.map(pv => ({pv, items: faltan.filter(x => x.proveedor === pv.id)})), {pv: null, items: faltan.filter(x => !x.proveedor || !pvs.some(p => p.id === x.proveedor))}].filter(g => g.items.length);
    const fila = x => `<tr><td>${esc(x.nombre)}<div style="color:var(--muted);font-size:11.5px">quedan ${x.stock} · mínimo ${x.minimo}</div></td><td class="n"><input class="num" style="width:70px" type="number" min="0" value="${sug(x)}" data-pq="${esc(x.id)}"></td></tr>`;
    drawer("Pedido a proveedores", `${grupos.length ? "" : `<p class="empty">No hay productos en el mínimo. Cuando algo baje, aparece acá.</p>`}
      ${grupos.map((g, k) => `<div class="card" style="padding:12px;margin:10px 0"><h3 style="margin-bottom:6px">${g.pv ? esc(g.pv.nombre) : "Sin proveedor asignado"}</h3>
        <table><tbody>${g.items.map(fila).join("")}</tbody></table>
        <div style="margin-top:8px">${g.pv && g.pv.telefono ? `<a class="b wa s" data-pg="${k}" target="_blank" rel="noopener" href="#">Mandar pedido por WhatsApp</a>` : `<button class="b s" data-cp="${k}">Copiar la lista</button>`}</div></div>`).join("")}
      <div class="sec-t">Proveedores</div>
      ${pvs.map(p => `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #F0F2F5"><span>${esc(p.nombre)}</span><span style="color:var(--muted);font-size:12.5px">${p.telefono ? "+" + esc(p.telefono) : "sin celular"} · ${p.productos} productos</span></div>`).join("") || `<p style="color:var(--muted);font-size:13px">Todavía no cargaste proveedores.</p>`}
      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap"><input class="txt" id="pv-n" placeholder="Nombre" style="flex:1;min-width:120px"><input class="txt" id="pv-t" placeholder="Celular (opcional)" style="width:150px"><button class="b" id="pv-ok">+ Agregar</button></div>
      <p style="color:var(--muted);font-size:12px;margin-top:8px">A cada producto le elegís su proveedor en la tabla de Stock. La cantidad sugerida es lo que falta para llegar al doble del mínimo; la podés cambiar.</p><div id="pv-err"></div>`);
    const texto = g => `Hola${g.pv ? " " + g.pv.nombre : ""}! Te hago un pedido para ${P.nombre}:\n` + g.items.map(x => { const q = Number((document.querySelector(`[data-pq="${x.id}"]`) || {}).value || 0); return q > 0 ? `• ${q} × ${x.nombre}` : null; }).filter(Boolean).join("\n") + "\n¡Gracias!";
    document.querySelectorAll("[data-pg]").forEach(a => a.onclick = () => { const g = grupos[Number(a.dataset.pg)]; a.href = `https://wa.me/${g.pv.telefono}?text=${encodeURIComponent(texto(g))}`; });
    document.querySelectorAll("[data-cp]").forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(texto(grupos[Number(b.dataset.cp)])); toast("Lista copiada"); } catch (e) { toast("No se pudo copiar"); } });
    $("#pv-ok").onclick = async () => { try { await call("agregarProveedor", {nombre: $("#pv-n").value, telefono: $("#pv-t").value}); toast("Proveedor agregado"); pedidoProveedores(await call("stock")); } catch (e) { $("#pv-err").innerHTML = `<div class="err">${esc(e.message)}</div>`; } };
  }
  function ventaLocal(st) {
    const carrito = new Map();
    const disp = st.filter(x => x.ilimitado || x.stock > 0);
    drawer("Venta en el local", `<input class="txt w" id="vl-q" placeholder="Buscar producto"><div id="vl-res" class="rows" style="margin-top:8px;max-height:230px;overflow:auto"></div>
      <div class="sec-t">En esta venta</div><div id="vl-car"></div><label class="lbl2">Cómo pagó<select class="txt w" id="vl-m"><option>Efectivo</option><option>Transferencia</option><option>Débito</option><option>Crédito</option><option>Mercado Pago</option><option value="Fiado">Fiado (queda en su cuenta)</option></select></label>
      <div id="vl-f" hidden><div class="two" style="grid-template-columns:1fr 1fr"><label class="lbl2">Nombre<input class="txt w" id="vl-fn"></label><label class="lbl2">Celular<input class="txt w" id="vl-ft" type="tel" placeholder="387 612 4879"></label></div></div><div id="vl-err"></div>`,
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
    $("#vl-m").onchange = () => { $("#vl-f").hidden = $("#vl-m").value !== "Fiado"; };
    $("#vl-ok").onclick = async () => {
      try { const r = await call("ventaMostrador", {items: [...carrito.entries()].map(([producto, cant]) => ({producto, cant})), medio: $("#vl-m").value, nombre: $("#vl-fn").value, telefono: $("#vl-ft").value}); toast($("#vl-m").value === "Fiado" ? `Fiado: ${r.total} quedó en su cuenta. El stock ya se descontó.` : `Venta de ${r.total} registrada. El stock ya se descontó.`); cerrar(); render(); }
      catch (e) { $("#vl-err").innerHTML = `<div class="err">${esc(e.message)}</div>`; }
    };
  }

  // ── Socios ────────────────────────────────────────────────────────
  async function socios(v) {
    const ss = await call("socios"), hoy = fdia(new Date()), alumno = P.textos && P.textos.socio === "alumno";
    const dias = s => Math.round((new Date(s.vence + "T12:00:00") - new Date(hoy + "T12:00:00")) / 864e5);
    const lista = ss.filter(s => !BUSCA || s.nombre.toLowerCase().includes(BUSCA.toLowerCase()) || s.telefono.includes(BUSCA.replace(/\D/g, "")));
    const venc = ss.filter(s => s.vencida), prox = ss.filter(s => !s.vencida && dias(s) <= 5);
    const planesP = (P.planes || []).filter(x => x.activo && !x.suelta);
    v.innerHTML = `<div class="ph"><h1>${alumno ? "Alumnos" : "Socios"}</h1><span class="sp"></span>${buscador("Buscar por nombre o celular")}${planesP.length ? `<button class="b p" id="ns">+ ${alumno ? "Alumno" : "Socio"}</button>` : ""}</div>
      <div class="kpis"><div class="kpi"><div class="l">${alumno ? "Alumnos" : "Socios"}</div><div class="v">${ss.length}</div><div class="s">${planesP.length ? `${planesP.length} planes · ${pesos(ss.filter(x => !x.vencida).reduce((a, x) => a + (x.precio || 0), 0))} por mes` : `cuota ${pesos(P.cuota || 0)}`}</div></div>
        <div class="kpi"><div class="l">Cuota vencida</div><div class="v ${venc.length ? "neg" : ""}">${venc.length}</div><div class="s">no pueden reservar clases · ${pesos(venc.reduce((a, x) => a + (x.precio || P.cuota || 0), 0))} sin cobrar</div></div>
        <div class="kpi"><div class="l">Vencen en 5 días</div><div class="v">${prox.length}</div><div class="s">mandales el aviso</div></div></div>
      <div class="card tw"><table><thead><tr><th>${alumno ? "Alumno" : "Socio"}</th><th class="hide-m">Plan</th><th>Vence</th><th></th></tr></thead><tbody>
      ${lista.map(s => { const d = dias(s); const aviso = `https://wa.me/${s.telefono}?text=${encodeURIComponent(`Hola ${s.nombre.split(" ")[0]}! ${d < 0 ? "Tu cuota de " + P.nombre + " está vencida." : "Tu cuota de " + P.nombre + " vence " + (d === 0 ? "hoy" : `en ${d} día${d > 1 ? "s" : ""}`) + "."} Podés pagarla por transferencia y seguir reservando tus clases 💪`)}`;
        return `<tr><td><b>${esc(s.nombre)}</b><div style="color:var(--muted);font-size:12px">+${esc(s.telefono)}</div></td><td class="hide-m">${esc(s.plan || "")}${s.restantes != null ? `<div style="color:var(--muted);font-size:12px">Le quedan ${s.restantes} clases</div>` : ""}${s.precio ? `<div style="color:var(--muted);font-size:12px">${pesos(s.precio)}</div>` : ""}</td>
        <td>${s.vencida ? `<span class="tag crit">Vencida ${ddmm(s.vence)}</span>` : d <= 5 ? `<span class="tag warn">${d === 0 ? "Hoy" : `En ${d} días`}</span>` : `<span class="tag ok">${ddmm(s.vence)}</span>`}</td>
        <td class="n" style="white-space:nowrap">${s.vencida || d <= 5 ? `<a class="b s" href="${aviso}" target="_blank" rel="noopener">Avisar</a> ` : ""}<button class="b p s" data-pago="${s.telefono}">Registrar pago</button></td></tr>`; }).join("")}</tbody></table></div>`;
    conectarBuscador();
    const medios = `<option>Efectivo</option><option>Transferencia</option><option>Débito</option><option>Mercado Pago</option>`;
    const opPlanes = sel => planesP.map(x => `<option value="${esc(x.id)}" ${String(x.id) === String(sel) ? "selected" : ""}>${esc(x.nombre)} · ${pesos(x.precio)}</option>`).join("");
    v.querySelectorAll("[data-pago]").forEach(b => b.onclick = () => {
      const so = ss.find(x => x.telefono === b.dataset.pago);
      if (!planesP.length) return hacer(async () => { const r = await call("pagarCuota", {telefono: b.dataset.pago}); toast(`Pago registrado. Ya puede reservar. Vence el ${ddmm(r.vence)}`); });
      drawer(`Cobrar a ${so.nombre}`, `<label class="lbl2">Plan<select class="txt w" id="pg-p">${opPlanes(so.plan_id)}</select></label><p class="m" id="pg-d" style="margin:6px 0 0;color:var(--muted);font-size:12.5px"></p>
        <label class="lbl2" style="margin-top:12px">Cómo pagó<select class="txt w" id="pg-m">${medios}</select></label>
        <p style="color:var(--muted);font-size:12.5px;margin-top:10px">Si todavía está al día con el mismo plan, se suma desde su vencimiento. Si cambia de plan o estaba vencido, arranca hoy.</p><div id="pg-err"></div>`,
        `<button class="b p" id="pg-ok">Registrar pago</button>`);
      const det = () => { const x = planesP.find(y => String(y.id) === $("#pg-p").value); $("#pg-d").textContent = x ? x.detalle : ""; };
      $("#pg-p").onchange = det; det();
      $("#pg-ok").onclick = async () => { try { const r = await call("pagarCuota", {telefono: so.telefono, plan: $("#pg-p").value, medio: $("#pg-m").value}); cerrar(); toast(`Cobrado ${r.precio || ""}. Ya puede reservar. Vence el ${ddmm(r.vence)}`); render(); } catch (e) { $("#pg-err").innerHTML = `<div class="err">${esc(e.message)}</div>`; } };
    });
    if ($("#ns")) $("#ns").onclick = () => {
      drawer(alumno ? "Nuevo alumno" : "Nuevo socio", `<label class="lbl2">Nombre y apellido<input class="txt w" id="ns-n" maxlength="60"></label>
        <label class="lbl2" style="margin-top:10px">Celular<input class="txt w" id="ns-t" inputmode="tel" placeholder="387 612 4879"></label>
        <label class="lbl2" style="margin-top:10px">Plan<select class="txt w" id="ns-p">${opPlanes(planesP[0].id)}</select></label>
        <label class="lbl2" style="margin-top:10px">Cómo pagó<select class="txt w" id="ns-m">${medios}</select></label>
        <p style="color:var(--muted);font-size:12.5px;margin-top:10px">Queda al día desde hoy y ya puede reservar con su celular.</p><div id="ns-err"></div>`, `<button class="b p" id="ns-ok">Dar de alta y cobrar</button>`);
      $("#ns-ok").onclick = async () => { try { const r = await call("agregarSocio", {nombre: $("#ns-n").value, telefono: $("#ns-t").value, plan: $("#ns-p").value, medio: $("#ns-m").value}); cerrar(); toast(`Listo, cobrado ${r.precio}. Vence el ${ddmm(r.vence)}`); render(); } catch (e) { $("#ns-err").innerHTML = `<div class="err">${esc(e.message)}</div>`; } };
    };
  }

  // ── Clientes ──────────────────────────────────────────────────────
  async function clientes(v) {
    const cs = await call("clientes");
    const vu = P.tiene.turnos ? await call("vuelta") : [];
    const op = await call("opiniones");
    const fi = P.tiene.productos || P.tiene.socios ? await call("fiado") : null;
    const lista = cs.filter(c => !BUSCA || c.nombre.toLowerCase().includes(BUSCA.toLowerCase()) || c.telefono.includes(BUSCA.replace(/\D/g, "")));
    const volver = cs.filter(c => c.volver), nuevos = cs.filter(c => c.nuevo), resenas = cs.filter(c => c.resena);
    const cumples = cs.filter(c => c.saludo).sort((a, b) => a.cumple_en - b.cumple_en);
    const hace = c => c.hace == null ? "—" : c.hace === 0 ? "Hoy" : c.hace === 1 ? "Ayer" : `Hace ${c.hace} días`;
    v.innerHTML = `<div class="ph"><h1>Clientes</h1><span class="sp"></span>${buscador("Buscar por nombre o celular")}<button class="b" id="xls">⬇ Excel</button></div>
      <div class="kpis"><div class="kpi"><div class="l">Clientes</div><div class="v">${cs.length}</div><div class="s">con al menos una visita o reserva</div></div>
        <div class="kpi"><div class="l">Para recuperar</div><div class="v ${volver.length ? "neg" : ""}">${volver.length}</div><div class="s">venían y hace más de 5 semanas que no vuelven</div></div>
        <div class="kpi"><div class="l">Tus mejores 10</div><div class="v">${pesos(cs.slice(0, 10).reduce((a, c) => a + c.gastado, 0))}</div><div class="s">lo que gastaron en las últimas semanas</div></div></div>
      ${op.cantidad || NOA.esDemo ? `<div class="card" style="margin-bottom:12px"><h3>⭐ Lo que opinan tus clientes <span class="sp"></span>${op.promedio != null ? `<span class="tag ${op.promedio >= 4 ? "ok" : op.promedio >= 3 ? "warn" : "crit"}">${String(op.promedio).replace(".", ",")} de 5 · ${op.cantidad} opiniones</span>` : ""}</h3>
        <p style="color:var(--muted);font-size:13px;margin:4px 0 10px">Últimos 90 días. Después de cada visita, el botón "Pedir opinión" le manda la encuesta por WhatsApp. A todos se les ofrece dejar la reseña en Google (Google no permite pedírsela solo a los conformes); si alguien pone 3 o menos, te aparece acá para que lo contactes.${op.muestra ? ` <a href="${esc(op.muestra)}" target="_blank" rel="noopener">Ver la encuesta como la ve el cliente</a>` : ""}</p>
        ${op.items.filter(x => x.contactar).slice(0, 6).map(x => `<div style="display:flex;gap:10px;align-items:center;padding:6px 0;border-top:1px solid #F0F2F5"><span class="tag crit">${"★".repeat(x.nota)}</span><span style="flex:1"><b>${esc(x.nombre)}</b>${x.comentario ? ` · ${esc(x.comentario)}` : ""}</span><a class="b wa s" target="_blank" rel="noopener" href="${esc(x.contactar)}">Escribirle</a></div>`).join("")}
        ${op.items.filter(x => !x.contactar && x.comentario).slice(0, 3).map(x => `<div style="padding:5px 0;border-top:1px solid #F0F2F5;font-size:13px"><span style="color:#F2B01E">${"★".repeat(x.nota)}</span> “${esc(x.comentario)}” · ${esc((x.nombre || "").split(" ")[0])}</div>`).join("")}</div>` : ""}
      ${resenas.length ? `<div class="card" style="margin-bottom:12px"><h3>⭐ Pediles su opinión <span class="sp"></span><span class="tag">${resenas.length}</span></h3><p style="color:var(--muted);font-size:13px;margin:4px 0 10px">Vinieron en los últimos 30 días y todavía no se la pediste. Les llega la encuesta y, si quieren, dejan la reseña en Google: más reseñas te suben en Google Maps.</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${resenas.slice(0, 12).map(c => `<a class="b s" data-resena="${esc(c.telefono)}" href="${esc(c.resena)}" target="_blank" rel="noopener">${esc(c.nombre)}</a>`).join("")}</div></div>`
        : !P.resena_url ? `<div class="card" style="margin-bottom:12px"><h3>⭐ Reseñas en Google</h3><p style="color:var(--muted);font-size:13px;margin-top:4px">Cargá tu link de reseñas en Servicios y precios y te armamos el pedido para cada cliente que vino.</p></div>` : ""}
      ${fi ? `<div class="card" style="margin-bottom:12px"><h3>📒 Cuentas corrientes (fiado) <span class="sp"></span>${fi.total ? `<span class="tag warn">Te deben ${pesos(fi.total)}</span>` : ""}<button class="b s p" id="fi-n">+ Fiado</button></h3>
        ${fi.clientes.length ? `<table><tbody>${fi.clientes.map((x, i) => `<tr><td><b>${esc(x.nombre)}</b><div style="color:var(--muted);font-size:11.5px">${x.movimientos.filter(m => m.tipo === "debe").slice(0, 2).map(m => esc(m.concepto || "compra")).join(" · ")} · desde hace ${x.dias} día${x.dias === 1 ? "" : "s"}</div></td>
          <td class="n"><b>${pesos(x.saldo)}</b></td><td class="n" style="white-space:nowrap"><button class="b s ok" data-fip="${i}">Cobrar</button> <a class="b s wa" target="_blank" rel="noopener" href="${esc(x.recordar)}">Recordar</a></td></tr>`).join("")}</tbody></table>`
          : `<p style="color:var(--muted);font-size:13px;margin:4px 0 0">Nadie te debe. Cuando alguien se lleve algo a cuenta, cargalo acá o elegí "Fiado" en la venta en el local.</p>`}</div>` : ""}
      ${vu.length ? `<div class="card" style="margin-bottom:12px"><h3>${P.rubro === "taller" ? "🔧 Les toca el service" : "🔁 Les toca volver"} <span class="sp"></span><span class="tag acc">${vu.length}</span></h3><p style="color:var(--muted);font-size:13px;margin:4px 0 10px">Ya pasó el tiempo que pusiste en cada servicio desde su última visita y no tienen turno sacado. Tocá para mandarles el WhatsApp.</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${vu.slice(0, 16).map(x => `<a class="b s" target="_blank" rel="noopener" href="${esc(x.avisar)}" data-vtel="${esc(x.telefono)}" data-vsrv="${esc(x.servicio_id)}">${esc(x.cliente)} · ${esc(x.auto || x.servicio)} · hace ${esc(x.hace_txt)}</a>`).join("")}</div></div>` : ""}
      ${cumples.length ? `<div class="card" style="margin-bottom:12px"><h3>🎂 Cumplen esta semana <span class="sp"></span><span class="tag">${cumples.length}</span></h3><p style="color:var(--muted);font-size:13px;margin:4px 0 10px">Tocá para saludar por WhatsApp. Si armaste un código de cumpleaños en Servicios y precios, va en el mensaje.</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${cumples.map(c => `<a class="b s" href="${esc(c.saludo)}" target="_blank" rel="noopener">${esc(c.nombre)} · ${c.cumple_en === 0 ? "¡hoy!" : c.cumple_en === 1 ? "mañana" : c.cumple}</a>`).join("")}</div></div>` : ""}
      ${volver.length ? `<div class="card" style="margin-bottom:12px;border-color:#F5C9A5;background:#FFF8F2"><h3>💬 Invitalos a volver <span class="sp"></span><span class="tag acc">${volver.length}</span></h3><p style="color:var(--muted);font-size:13px;margin-bottom:8px">Tocá cada uno: se abre tu WhatsApp con el mensaje escrito.</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${volver.slice(0, 12).map(c => `<a class="b s" href="${esc(c.volver)}" target="_blank" rel="noopener">${esc(c.nombre)} · ${hace(c).toLowerCase()}</a>`).join("")}</div></div>` : ""}
      <div class="card tw"><table><thead><tr><th>Cliente</th><th class="n">Visitas</th><th class="hide-m">Última vez</th><th class="n">Gastó</th><th class="hide-m">Lo que más pide</th><th class="hide-m">Próxima</th><th></th></tr></thead><tbody>
      ${lista.slice(0, 150).map(c => `<tr><td><b>${esc(c.nombre)}</b>${c.nuevo ? ` <span class="tag acc">Nuevo</span>` : ""}<div style="color:var(--muted);font-size:12px">+${esc(c.telefono)}${c.cumple ? ` · 🎂 ${c.cumple}` : ""}</div>${c.faltas >= 2 ? `<span class="tag crit">Faltó ${c.faltas} veces</span>` : ""}</td><td class="n">${c.visitas}</td>
        <td class="hide-m">${hace(c)}</td><td class="n">${pesos(c.gastado)}</td><td class="hide-m">${esc(c.favorito)}</td><td class="hide-m">${c.proxima ? `${ddmm(c.proxima.slice(0, 10))}` : "—"}</td>
        <td class="n"><a class="b s" href="${esc(c.volver || "https://wa.me/" + c.telefono)}" target="_blank" rel="noopener">${c.volver ? "Invitar" : "WhatsApp"}</a></td></tr>`).join("")}</tbody></table></div>`;
    conectarBuscador();
    if ($("#fi-n")) $("#fi-n").onclick = () => {
      drawer("Fiado", `<div class="two" style="grid-template-columns:1fr 1fr"><label class="lbl2">Nombre<input class="txt w" id="fn-n"></label><label class="lbl2">Celular<input class="txt w" id="fn-t" type="tel" placeholder="387 612 4879"></label></div>
        <div class="two" style="grid-template-columns:1fr 2fr"><label class="lbl2">Monto<input class="txt w" id="fn-m" type="number" min="1"></label><label class="lbl2">Qué se llevó (opcional)<input class="txt w" id="fn-c" placeholder="Ej: compras de la semana"></label></div><div id="fn-err"></div>`, `<button class="b p" id="fn-ok">Anotar</button>`);
      $("#fn-ok").onclick = async () => { try { await call("agregarFiado", {nombre: $("#fn-n").value, telefono: $("#fn-t").value, monto: $("#fn-m").value, concepto: $("#fn-c").value}); cerrar(); toast("Anotado en su cuenta"); render(); } catch (e) { $("#fn-err").innerHTML = `<div class="err">${esc(e.message)}</div>`; } };
    };
    v.querySelectorAll("[data-fip]").forEach(b => b.onclick = () => {
      const x = fi.clientes[Number(b.dataset.fip)];
      drawer(`Cobrar a ${x.nombre}`, `<p style="margin-top:0">Debe <b>${pesos(x.saldo)}</b>.</p><label class="lbl2">Cuánto paga<input class="txt w" id="fp-m" type="number" value="${x.saldo}"></label>
        <label class="lbl2">Cómo pagó<select class="txt w" id="fp-md">${MEDIOS.slice(0, 4).map(m => `<option>${m}</option>`).join("")}</select></label><div id="fp-err"></div>`, `<button class="b p" id="fp-ok">Registrar pago</button>`);
      $("#fp-ok").onclick = async () => { try { const r = await call("pagarFiado", {telefono: x.telefono, monto: $("#fp-m").value, medio: $("#fp-md").value}); cerrar(); toast(r.saldo ? `Pago registrado. Le queda ${pesos(r.saldo)}.` : "Cuenta saldada. El pago entró en la caja."); render(); } catch (e) { $("#fp-err").innerHTML = `<div class="err">${esc(e.message)}</div>`; } };
    });
    v.querySelectorAll("[data-vtel]").forEach(a => a.addEventListener("click", () => call("marcarVuelta", {telefono: a.dataset.vtel, servicio: a.dataset.vsrv}).then(() => { a.classList.add("ok"); a.textContent = "Avisado ✓"; }).catch(() => {})));
    $("#xls").onclick = () => {
      const filas = [["Cliente", "Celular", "Visitas", "Última vez", "Gastó", "Lo que más pide", "Cumpleaños"].map(t => ({v: t, b: true}))];
      cs.forEach(c => filas.push([c.nombre, "+" + c.telefono, c.visitas, c.ultima ? {v: new Date(c.ultima)} : "", {v: c.gastado, z: "plata"}, c.favorito, c.cumple || ""]));
      excel("clientes", [{nombre: "Clientes", columnas: [26, 16, 9, 12, 13, 30, 12], filas}]);
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
      ${(n.obras || []).length ? `<div class="card" style="margin-top:12px"><h3>Pacientes por cobertura · últimos 30 días</h3><table><thead><tr><th>Cobertura</th><th class="n">Atendidos</th><th class="n">Cobrado en el consultorio</th></tr></thead><tbody>${n.obras.map(o => `<tr><td>${esc(o.nombre)}</td><td class="n">${o.turnos}</td><td class="n">${esc(o.cobrado_txt)}</td></tr>`).join("")}</tbody></table>
        <p style="color:var(--muted);font-size:12px;margin-top:6px">Lo cobrado es lo particular y los coseguros. Lo que paga cada obra social se factura aparte.</p></div>` : ""}
      <div id="n-mar"></div><div id="n-com"></div>
      ${n.cobertura.length ? `<div class="card" style="margin-top:12px"><h3>¿Para cuántos días te alcanza el stock?</h3><table><thead><tr><th>Producto</th><th class="n">Stock</th><th class="n">Te alcanza para</th></tr></thead><tbody>${n.cobertura.map(c => `<tr><td>${esc(c.n)}</td><td class="n">${c.stock}</td><td class="n"><span class="tag ${c.dias <= 3 ? "crit" : c.dias <= 7 ? "warn" : "ok"}">${c.dias <= 0 ? "menos de 1 día" : c.dias + " días"}</span></td></tr>`).join("")}</tbody></table></div>` : ""}`;
    extrasNumeros();
  }

  const COMISIONAN = () => P.tiene.turnos && P.recursos.length && !["canchas", "cafe", "restaurante", "inmobiliaria"].includes(P.rubro);
  let MESC = null;
  async function extrasNumeros() {
    if (P.tiene.productos && $("#n-mar")) {
      const m = await call("margenes", {dias: 30}), vend = m.items.filter(x => x.vendido), flojos = m.items.filter(x => x.margen != null && x.margen < 15);
      $("#n-mar").innerHTML = `<div class="card tw" style="margin-top:12px"><h3>Cuánto te deja cada producto <span class="sp"></span><span class="tag">${pesos(m.ganancia)} de ganancia en ${m.dias} días</span></h3>
        <table><thead><tr><th>Producto</th><th class="n">Vendidos</th><th class="n hide-m">Vendiste</th><th class="n">Te dejó</th><th class="n">Margen</th></tr></thead><tbody>
        ${vend.slice(0, 12).map(x => `<tr><td>${esc(x.nombre)}</td><td class="n">${x.vendido}</td><td class="n hide-m">${pesos(x.ingresos)}</td><td class="n">${x.ganancia == null ? "—" : pesos(x.ganancia)}</td><td class="n">${x.margen == null ? `<span class="tag">Sin costo</span>` : `<span class="tag ${x.margen < 15 ? "crit" : x.margen < 30 ? "warn" : "ok"}">${String(x.margen).replace(".", ",")} %</span>`}</td></tr>`).join("") || `<tr><td colspan="5" class="empty">Todavía no hay ventas en estos días.</td></tr>`}</tbody></table>
        <p style="color:var(--muted);font-size:12px;margin-top:6px">${flojos.length ? `Ojo: ${flojos.slice(0, 3).map(x => esc(x.nombre)).join(", ")}${flojos.length > 3 ? " y otros" : ""} te deja${flojos.length > 1 ? "n" : ""} menos del 15 %. ` : ""}${m.sin_costo ? `${m.sin_costo} producto${m.sin_costo > 1 ? "s" : ""} sin costo cargado: cargalo en Productos y precios para ver su margen.` : "Cuenta los pedidos entregados y las ventas en el local."}</p></div>`;
    }
    if (COMISIONAN() && $("#n-com")) {
      const co = await call("comisiones", {mes: MESC}); MESC = co.mes;
      const [y, mm] = co.mes.split("-").map(Number), nom = new Date(y, mm - 1, 1).toLocaleDateString("es-AR", {month: "long", year: "numeric"});
      $("#n-com").innerHTML = `<div class="card tw" style="margin-top:12px"><h3>Comisiones · ${esc(nom)} <span class="sp"></span><button class="b s" id="mc-a" aria-label="Mes anterior">←</button><button class="b s" id="mc-s" aria-label="Mes siguiente">→</button></h3>
        <table><thead><tr><th>${esc(P.recurso)}</th><th class="n">Atendió</th><th class="n hide-m">Facturó</th><th class="n">Comisión</th><th class="n">Le toca</th><th></th></tr></thead><tbody>
        ${co.items.map(x => `<tr><td>${esc(x.nombre)}</td><td class="n">${x.turnos}</td><td class="n hide-m">${pesos(x.facturado)}</td><td class="n"><input class="num" style="width:64px" type="number" min="0" max="100" value="${x.pct ?? ""}" data-com="${esc(x.id)}"> %</td>
          <td class="n"><b>${pesos(x.a_pagar)}</b></td><td class="n">${x.pagado ? `<span class="tag ok">Pagado</span>` : x.a_pagar ? `<button class="b s ok" data-cpag="${esc(x.id)}">Pagar</button>` : ""}</td></tr>`).join("")}</tbody></table>
        <p style="color:var(--muted);font-size:12px;margin-top:6px">Sobre los turnos que marcaste como "Vino". Total del mes: <b>${pesos(co.total)}</b>. Al pagar, se carga el egreso en la caja.</p></div>`;
      const mov = k => { const d = new Date(y, mm - 1 + k, 1); MESC = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; extrasNumeros(); };
      $("#mc-a").onclick = () => mov(-1); $("#mc-s").onclick = () => mov(1);
      document.querySelectorAll("[data-com]").forEach(i => i.onchange = async () => { try { await call("editar", {tipo: "profesional", id: i.dataset.com, campo: "comision", valor: i.value}); toast("Comisión guardada"); extrasNumeros(); } catch (e) { toast("⚠️ " + esc(e.message)); } });
      document.querySelectorAll("[data-cpag]").forEach(b => b.onclick = async () => { if (!confirmar(b)) return; try { await call("pagarComision", {id: b.dataset.cpag, mes: co.mes}); toast("Comisión pagada. Se cargó en la caja."); extrasNumeros(); } catch (e) { toast("⚠️ " + esc(e.message)); } });
    }
  }
  async function resumenDia() {
    const r = await call("resumen");
    drawer("Resumen del día", `<pre style="white-space:pre-wrap;font:inherit;font-size:14px;background:#F6F8FA;border-radius:10px;padding:12px;margin:0">${esc(r.texto)}</pre>
      <p style="color:var(--muted);font-size:12.5px">Se abre tu WhatsApp con el resumen escrito: mandátelo a vos o a tu socio.</p>`,
      `${r.whatsapp ? `<a class="b wa" target="_blank" rel="noopener" href="${esc(r.whatsapp)}">Mandar por WhatsApp</a>` : ""}<button class="b" id="rs-c">Copiar</button>`);
    $("#rs-c").onclick = async () => { try { await navigator.clipboard.writeText(r.texto); toast("Copiado"); } catch (e) { toast("No se pudo copiar"); } };
  }

  // ── Catálogo ──────────────────────────────────────────────────────
  async function catalogo(v) {
    const c = await call("catalogo");
    const sw = (tipo, x) => `<label class="sw"><input type="checkbox" data-on="${tipo}|${x.id}" ${x.activo ? "checked" : ""}><span></span></label>`;
    const num = (tipo, x, campo, val, w = 100) => `<input class="num" style="width:${w}px" type="number" min="0" value="${val ?? ""}" data-ed="${tipo}|${x.id}|${campo}">`;
    let html = `<div class="ph"><h1>${P.tiene.productos && !P.tiene.turnos ? "Productos y precios" : "Servicios y precios"}</h1><span class="sp"></span><button class="b p" id="aum">Subir precios %</button></div>
      <p style="color:var(--muted);font-size:13px;margin:-6px 0 12px">Lo que cambiás acá se ve al instante en tu link. Apagá lo que no querés ofrecer por un tiempo.</p>`;
    if (c.servicios.length) html += `<div class="card tw"><h3>${P.rubro === "inmobiliaria" ? "Propiedades" : P.rubro === "canchas" ? "Turnos de cancha" : ["cafe", "restaurante"].includes(P.rubro) ? "Reservas de mesa" : "Servicios"} <span class="sp"></span><button class="b s p" id="add-s">+ Agregar</button></h3><table><thead><tr><th>Nombre</th><th class="hide-m">Categoría</th><th class="n">Precio</th><th class="n">Minutos</th><th class="n hide-m" title="Para recordarle al cliente que le toca volver. Vacío: no se recuerda.">${P.rubro === "taller" ? "Service cada (días)" : "Volver a los (días)"}</th>${P.mp && P.mp.conectado ? `<th class="n">Seña</th>` : ""}<th class="n">Activo</th></tr></thead><tbody>
      ${c.servicios.map(x => `<tr><td>${esc(x.nombre)}<div><button class="lnk" data-addt="${esc(x.id)}">+ Precio distinto según día u horario</button></div></td><td class="hide-m">${esc(x.cat || "")}</td><td class="n">${num("servicio", x, "precio", x.precio)}</td><td class="n">${num("servicio", x, "min", x.min, 70)}</td><td class="n hide-m">${num("servicio", x, "repetir", x.repetir, 70)}</td>${P.mp && P.mp.conectado ? `<td class="n">${num("servicio", x, "sena", x.sena || 0, 90)}</td>` : ""}<td class="n">${sw("servicio", x)}</td></tr>
        ${(x.tarifas || []).map(t => `<tr class="sub"><td colspan="2">↳ ${esc(t.texto)}</td><td class="n"><input class="num" style="width:100px" type="number" min="0" value="${t.precio}" data-tar="${esc(x.id)}|${t.i}"></td><td></td><td class="hide-m"></td>${P.mp && P.mp.conectado ? "<td></td>" : ""}<td class="n"><button class="b s" data-qt="${esc(x.id)}|${t.i}">Quitar</button></td></tr>`).join("")}`).join("")}</tbody></table>
      ${c.servicios.some(x => (x.tarifas || []).length) ? `<p style="color:var(--muted);font-size:12px;margin-top:6px">El precio con ↳ se usa en ese día y horario; el resto del tiempo, el precio de arriba. Tu cliente ve el precio de cada horario antes de reservar.</p>` : ""}</div>`;
    if (c.productos.length) html += `<div class="card tw" style="margin-top:12px"><h3>Productos <span class="sp"></span><button class="b s p" id="add-p">+ Agregar</button></h3><table><thead><tr><th>Producto</th><th class="hide-m">Categoría</th><th class="n">Precio</th><th class="n hide-m">Costo</th><th class="n hide-m">Margen</th><th class="n hide-m">Mínimo</th><th class="n">Activo</th></tr></thead><tbody>
      ${c.productos.map(x => `<tr><td>${esc(x.nombre)}</td><td class="hide-m">${esc(x.cat || "")}</td><td class="n">${num("producto", x, "precio", x.precio)}</td><td class="n hide-m">${num("producto", x, "costo", x.costo)}</td><td class="n hide-m">${x.costo == null || !x.precio ? `<span class="tag">Sin costo</span>` : (m => `<span class="tag ${m < 15 ? "crit" : m < 30 ? "warn" : "ok"}">${m} %</span>`)(Math.round(100 * (x.precio - x.costo) / x.precio))}</td><td class="n hide-m">${x.stock == null ? "—" : num("producto", x, "minimo", x.minimo, 70)}</td><td class="n">${sw("producto", x)}</td></tr>`).join("")}</tbody></table>
      <p style="color:var(--muted);font-size:12px;margin-top:6px">El stock se carga y corrige en la pestaña Stock. Con el costo calculamos el margen y el valor de tu mercadería.</p></div>`;
    if (P.tiene.socios) html += `<div class="card tw" style="margin-top:12px"><h3>Planes y cuotas <span class="sp"></span><button class="b s p" id="add-pl">+ Agregar plan</button></h3>
      <table><thead><tr><th>Plan</th><th class="hide-m">Qué incluye</th><th class="n">Precio</th><th class="n">Activo</th></tr></thead><tbody>
      ${(c.planes || []).map(x => `<tr><td><b>${esc(x.nombre)}</b></td><td class="hide-m" style="color:var(--muted);font-size:12.5px">${esc(x.detalle)}</td><td class="n">${num("plan", x, "precio", x.precio)}</td><td class="n">${sw("plan", x)}</td></tr>`).join("")}</tbody></table>
      <p style="color:var(--muted);font-size:12px;margin-top:6px">Cada ${P.textos && P.textos.socio === "alumno" ? "alumno" : "socio"} tiene un plan, y el sistema controla solo qué actividades incluye, cuántas veces por semana o cuántas clases le quedan. Un plan apagado no se ofrece más, pero quien ya lo tiene lo conserva hasta que vence.</p></div>`;
    if (c.clases.length) html += `<div class="card tw" style="margin-top:12px"><h3>Clases</h3><table><thead><tr><th>Clase</th><th>Días y hora</th><th class="hide-m">Profe</th><th class="n">Cupo</th><th class="n">Activa</th></tr></thead><tbody>
      ${c.clases.map(x => `<tr><td>${esc(x.nombre)}</td><td>${esc(x.dias)} · ${x.hora}</td><td class="hide-m">${esc(x.profe)}</td><td class="n">${num("clase", x, "cupo", x.cupo, 70)}</td><td class="n">${sw("clase", x)}</td></tr>`).join("")}</tbody></table></div>`;
    if (c.unidades.length) html += `<div class="card tw" style="margin-top:12px"><h3>Unidades</h3><table><thead><tr><th>Unidad</th><th class="n">Personas</th><th class="n">Precio por noche</th><th class="n">Activa</th></tr></thead><tbody>
      ${c.unidades.map(x => `<tr><td>${esc(x.nombre)}</td><td class="n">${x.capacidad}</td><td class="n">${num("unidad", x, "precio", x.precio)}</td><td class="n">${sw("unidad", x)}</td></tr>`).join("")}</tbody></table></div>`;
    if ((c.coberturas || []).length || P.rubro === "consultorio") html += `<div class="card tw" style="margin-top:12px"><h3>Obras sociales <span class="sp"></span><button class="b s p" id="add-ob">+ Agregar</button></h3>
      <table><thead><tr><th>Obra social</th><th class="n">Coseguro que cobrás</th><th class="n">Activa</th></tr></thead><tbody>
      ${(c.coberturas || []).map(x => `<tr><td>${esc(x.nombre)}</td><td class="n">${num("cobertura", x, "coseguro", x.coseguro)}</td><td class="n">${sw("cobertura", x)}</td></tr>`).join("")}</tbody></table>
      <p style="color:var(--muted);font-size:12px;margin-top:6px">El paciente elige al reservar si viene particular o por obra social. Particular paga el precio del servicio; por obra social, el coseguro (0 = sin cargo).</p></div>`;
    if (c.estadia) html += `<div class="card tw" style="margin-top:12px"><h3>Temporadas y fin de semana <span class="sp"></span><button class="b s p" id="add-tm">+ Temporada</button></h3>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><span>Noches de viernes y sábado:</span><input class="num" style="width:80px" type="number" id="finde" value="${c.estadia.finde}"><span>% más</span></div>
      <table><thead><tr><th>Temporada</th><th>Desde</th><th>Hasta</th><th class="n">Precio</th><th></th></tr></thead><tbody>
      ${c.estadia.temporadas.map(t => `<tr><td>${esc(t.nombre)}</td><td>${ddmm(t.desde)}/${t.desde.slice(2, 4)}</td><td>${ddmm(t.hasta)}/${t.hasta.slice(2, 4)}</td><td class="n"><span class="tag ${t.recargo >= 0 ? "warn" : "ok"}">${t.recargo >= 0 ? "+" : ""}${t.recargo} %</span></td><td class="n"><button class="b s" data-qtm="${esc(t.id)}">Quitar</button></td></tr>`).join("") || `<tr><td colspan="5" class="empty">Sin temporadas: todo el año al precio de cada unidad.</td></tr>`}</tbody></table>
      <p style="color:var(--muted);font-size:12px;margin-top:6px">El precio por noche de cada unidad se ajusta solo según la fecha. Un número negativo es un descuento (temporada baja). Tu huésped ve el detalle antes de reservar.</p></div>`;
    if ((c.servicios.length || c.unidades.length) && P.mp && P.mp.disponible) html += `<div class="card" style="margin-top:12px"><h3>Señas con Mercado Pago ${P.mp.conectado ? `<span class="tag ok">Conectado${P.mp.demo ? " · simulación" : ""}</span>` : ""}</h3>
      ${P.mp.conectado ? `<p style="color:var(--muted);font-size:13px;margin:4px 0 10px">${c.servicios.length ? "Poné la seña de cada servicio en la columna Seña (0 = sin seña). " : ""}Quien reserva por el link paga la seña con Mercado Pago y la plata va directo a tu cuenta. ${c.servicios.length ? "Si no paga en 30 minutos, el turno se libera solo. " : "La estadía se confirma sola cuando entra el pago. "}La seña entra sola en la caja.</p>
        ${c.servicios.length ? `<label class="rad" style="margin:0 0 10px"><input type="checkbox" id="mp-falt" ${P.sena_faltadores ? "checked" : ""}> A quien faltó 2 veces sin avisar en los últimos 6 meses, pedirle seña (30 %) para el próximo turno, aunque el servicio no tenga</label>` : ""}
        <button class="b s" id="mp-off">Desconectar</button>`
      : `<p style="color:var(--muted);font-size:13px;margin:4px 0 10px">Pegá tu Access Token de producción de Mercado Pago (en Mercado Pago Developers → Tus integraciones → Credenciales de producción). La plata de las señas va directo a tu cuenta.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><input class="txt" style="flex:1;min-width:240px" id="mp-t" placeholder="APP_USR-…" autocomplete="off"><button class="b p" id="mp-ok">Conectar</button></div>`}</div>`;
    html += `<div class="card" style="margin-top:12px"><h3>Reseñas en Google</h3><p style="color:var(--muted);font-size:13px;margin:4px 0 10px">Pegá el link para dejar reseña de tu perfil de Google (en Google Maps, tu perfil → “Pedir reseñas” → copiar link). Después de cada visita le mandás la encuesta con el botón “Pedir opinión”, y al terminarla se le ofrece dejar la reseña en Google.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><input class="txt" style="flex:1;min-width:240px" id="res-u" placeholder="https://g.page/r/…/review" value="${esc(P.resena_url || "")}"><button class="b p" id="res-ok">Guardar</button></div></div>`;
    const pm = P.rubro === "inmobiliaria" ? null : await call("promos");
    if (pm && pm.areas.length) html += `<div class="card tw" style="margin-top:12px"><h3>Promos y códigos de descuento <span class="sp"></span><button class="b s p" id="add-pr">+ Código</button></h3>
      <table><thead><tr><th>Código</th><th class="n">Descuento</th><th class="hide-m">Para</th><th class="hide-m">Hasta</th><th class="n">Usos</th><th class="n">Activo</th><th></th></tr></thead><tbody>
      ${pm.promos.map(x => `<tr><td><b>${esc(x.codigo)}</b>${x.cumple ? ` <span class="tag acc">🎂 Cumpleaños</span>` : ""}${x.una_vez ? `<div style="color:var(--muted);font-size:11.5px">una vez por cliente</div>` : ""}</td><td class="n">${x.pct} %</td><td class="hide-m">${esc(x.aplica_txt)}</td>
        <td class="hide-m">${x.hasta ? ddmm(x.hasta) + "/" + x.hasta.slice(2, 4) : "Sin fecha"}</td><td class="n">${x.usos}${x.usos_max ? " de " + x.usos_max : ""}</td>
        <td class="n"><label class="sw"><input type="checkbox" data-prx="${esc(x.id)}" ${x.activo ? "checked" : ""}><span></span></label></td><td class="n"><button class="b s" data-prq="${esc(x.id)}">Quitar</button></td></tr>`).join("") || `<tr><td colspan="7" class="empty">Todavía no armaste códigos.</td></tr>`}</tbody></table>
      <p style="color:var(--muted);font-size:12px;margin-top:6px">Tus clientes escriben el código al reservar o pedir y el descuento se aplica solo. Pasalo en tus historias, en un volante o por WhatsApp.</p>
      <label class="rad" style="margin-top:8px"><input type="checkbox" id="pcum" ${pm.pedir_cumple ? "checked" : ""}> Pedir el cumpleaños (opcional) al reservar, para saludarlos con el código 🎂</label></div>`;
    const porDia = {}; c.horarios.forEach(h => (porDia[h.dia] = porDia[h.dia] || []).push(`${h.desde} a ${h.hasta}`));
    html += `<div class="two" style="margin-top:12px"><div class="card"><h3>Horario de atención</h3>${Object.entries(porDia).map(([d, hs]) => `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #F0F2F5"><span style="text-transform:capitalize">${c.horarios.find(h => h.dia == d).dia_txt}</span><span>${hs.join(" y ")}</span></div>`).join("")}
      <p style="color:var(--muted);font-size:12px;margin-top:8px">¿Cambió tu horario? Escribinos y lo actualizamos en el día.</p></div>
      <div class="card"><h3>Días cerrados</h3><p style="color:var(--muted);font-size:13px">Feriados, vacaciones o un día que no abrís: ese día no se dan turnos ni reservas por el link.</p>
        <div style="display:flex;gap:8px;margin:10px 0"><input class="txt" type="date" id="cd"><button class="b p" id="cd-ok">Cerrar ese día</button></div>
        ${c.cierres.length ? c.cierres.map(f => `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #F0F2F5"><span>${new Date(f + "T12:00:00").toLocaleDateString("es-AR", {weekday: "long", day: "numeric", month: "long"})}</span><button class="b s" data-abrir="${f}">Volver a abrir</button></div>`).join("") : `<p class="empty" style="padding:8px">No hay días cerrados.</p>`}</div></div>`;
    v.innerHTML = html;
    v.querySelectorAll("[data-ed],[data-on]").forEach(i => i.addEventListener("change", () => { if ((i.dataset.ed || i.dataset.on || "").startsWith("plan|")) setTimeout(async () => { P = await call("panel"); }, 300); }));
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
    v.querySelectorAll("[data-addt]").forEach(b => b.onclick = () => {
      const sv = c.servicios.find(x => String(x.id) === b.dataset.addt);
      drawer(`Precio por horario · ${sv.nombre}`, `<div class="lbl2">Qué días (sin marcar ninguno: todos)</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px 14px">${["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d, i) => `<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" class="tr-d" value="${i}"> ${d}</label>`).join("")}</div>
        <div class="two" style="grid-template-columns:1fr 1fr 1fr;margin-top:10px"><label class="lbl2">Desde<input class="txt w" type="time" id="tr-a" value="18:00"></label><label class="lbl2">Hasta<input class="txt w" id="tr-b" value="24:00" placeholder="24:00"></label><label class="lbl2">Precio<input class="txt w" type="number" min="0" id="tr-p" value="${sv.precio}"></label></div>
        <p style="color:var(--muted);font-size:12.5px;margin-top:8px">Ejemplo: de lunes a viernes de 18:00 a 24:00 la cancha sale más. Fuera de ese horario se cobra el precio normal (${pesos(sv.precio)}).</p><div id="tr-err"></div>`,
        `<button class="b p" id="tr-ok">Guardar</button>`);
      $("#tr-ok").onclick = async () => { try { await call("agregarTarifa", {servicio: sv.id, dias: [...document.querySelectorAll(".tr-d:checked")].map(x => Number(x.value)), desde: $("#tr-a").value, hasta: $("#tr-b").value.trim(), precio: $("#tr-p").value}); cerrar(); toast("Guardado. Ya se ve en tu link."); render(); } catch (e) { $("#tr-err").innerHTML = `<div class="err">${esc(e.message)}</div>`; } };
    });
    v.querySelectorAll("[data-tar]").forEach(i => i.onchange = () => { const [sid, k] = i.dataset.tar.split("|"); hacer(() => call("editarTarifa", {servicio: sid, i: k, precio: i.value}), "Guardado. Ya se ve en tu link."); });
    v.querySelectorAll("[data-qt]").forEach(b => b.onclick = () => { const [sid, k] = b.dataset.qt.split("|"); hacer(() => call("quitarTarifa", {servicio: sid, i: k}), "Listo, se usa el precio normal en ese horario."); });
    if ($("#add-ob")) $("#add-ob").onclick = () => {
      drawer("Agregar obra social", `<label class="lbl2">Nombre<input class="txt w" id="ob-n" placeholder="Ej: Medifé"></label><label class="lbl2" style="margin-top:10px">Coseguro que cobrás (0 si es sin cargo)<input class="txt w" type="number" min="0" id="ob-c" value="0"></label><div id="ob-err"></div>`, `<button class="b p" id="ob-ok">Agregar</button>`);
      $("#ob-ok").onclick = async () => { try { await call("agregarCobertura", {nombre: $("#ob-n").value, coseguro: $("#ob-c").value}); cerrar(); toast("Obra social agregada."); render(); } catch (e) { $("#ob-err").innerHTML = `<div class="err">${esc(e.message)}</div>`; } };
    };
    if ($("#finde")) $("#finde").onchange = () => hacer(() => call("guardarFinde", {finde: $("#finde").value}), "Guardado. Ya se ve en tu link.");
    v.querySelectorAll("[data-qtm]").forEach(b => b.onclick = () => hacer(() => call("quitarTemporada", {id: b.dataset.qtm}), "Temporada quitada."));
    if ($("#add-tm")) $("#add-tm").onclick = () => {
      drawer("Agregar temporada", `<label class="lbl2">Nombre<input class="txt w" id="tm-n" placeholder="Ej: temporada alta"></label>
        <div class="two" style="grid-template-columns:1fr 1fr;margin-top:10px"><label class="lbl2">Desde<input class="txt w" type="date" id="tm-a"></label><label class="lbl2">Hasta<input class="txt w" type="date" id="tm-b"></label></div>
        <label class="lbl2" style="margin-top:10px">Precio por noche: % más (o negativo para descuento)<input class="txt w" type="number" id="tm-r" value="20"></label><div id="tm-err"></div>`, `<button class="b p" id="tm-ok">Agregar</button>`);
      $("#tm-ok").onclick = async () => { try { await call("agregarTemporada", {nombre: $("#tm-n").value, desde: $("#tm-a").value, hasta: $("#tm-b").value, recargo: $("#tm-r").value}); cerrar(); toast("Temporada agregada."); render(); } catch (e) { $("#tm-err").innerHTML = `<div class="err">${esc(e.message)}</div>`; } };
    };
    v.querySelectorAll("[data-prx]").forEach(i => i.onchange = () => hacer(() => call("estadoPromo", {id: i.dataset.prx, activo: i.checked}), i.checked ? "Código activado" : "Código pausado"));
    v.querySelectorAll("[data-prq]").forEach(b => b.onclick = () => { if (confirmar(b)) hacer(() => call("estadoPromo", {id: b.dataset.prq, quitar: true}), "Código quitado"); });
    if ($("#pcum")) $("#pcum").onchange = () => hacer(() => call("pedirCumple", {activo: $("#pcum").checked}), $("#pcum").checked ? "Listo: tu link pregunta el cumpleaños (opcional)" : "Ya no se pregunta el cumpleaños");
    if ($("#add-pr")) $("#add-pr").onclick = () => {
      drawer("Nuevo código de descuento", `<div class="two" style="grid-template-columns:1fr 1fr"><label class="lbl2">Código<input class="txt w" id="pr-c" placeholder="VERANO10" style="text-transform:uppercase"></label><label class="lbl2">Descuento (%)<input class="txt w" type="number" min="1" max="90" id="pr-p" value="10"></label></div>
        <div class="lbl2" style="margin-top:10px">Sirve para</div>${pm.areas.map((a, i) => `<label class="rad"><input type="checkbox" class="pr-a" value="${a.id}" ${i === 0 ? "checked" : ""}> ${esc(a.nombre)}</label>`).join("")}
        <div class="two" style="grid-template-columns:1fr 1fr;margin-top:10px"><label class="lbl2">Vale hasta (opcional)<input class="txt w" type="date" id="pr-h"></label><label class="lbl2">Máximo de usos (opcional)<input class="txt w" type="number" min="1" id="pr-u" placeholder="Sin tope"></label></div>
        <label class="rad" style="margin-top:8px"><input type="checkbox" id="pr-1" checked> Una vez por cliente</label>
        <label class="rad"><input type="checkbox" id="pr-cu"> Es el regalo de cumpleaños (va en el saludo)</label><div id="pr-err"></div>`, `<button class="b p" id="pr-ok">Crear código</button>`);
      $("#pr-ok").onclick = async () => { try { await call("agregarPromo", {codigo: $("#pr-c").value, pct: $("#pr-p").value, aplica: [...document.querySelectorAll(".pr-a:checked")].map(x => x.value), hasta: $("#pr-h").value, usos_max: $("#pr-u").value, una_vez: $("#pr-1").checked, cumple: $("#pr-cu").checked}); cerrar(); toast("Código creado. Ya funciona en tu link."); render(); } catch (e) { $("#pr-err").innerHTML = `<div class="err">${esc(e.message)}</div>`; } };
    };
    if ($("#mp-ok")) $("#mp-ok").onclick = () => hacer(async () => { const r = await call("guardarConfig", {mp_token: $("#mp-t").value}); P = await call("panel"); toast(`Mercado Pago conectado: ${esc(r.cuenta || "")}`); });
    if ($("#mp-falt")) $("#mp-falt").onchange = () => hacer(async () => { await call("guardarConfig", {sena_faltadores: $("#mp-falt").checked}); P = await call("panel"); }, $("#mp-falt").checked ? "Listo: a quien falta seguido se le pide seña" : "Ya no se pide seña por ausencias");
    if ($("#mp-off")) $("#mp-off").onclick = () => { const b = $("#mp-off"); if (confirmar(b)) hacer(async () => { await call("guardarConfig", {mp_token: ""}); P = await call("panel"); }, "Mercado Pago desconectado. Ya no se piden señas."); };
    $("#res-ok").onclick = () => hacer(async () => { await call("guardarConfig", {resena_url: $("#res-u").value}); P = await call("panel"); }, "Guardado. Ya podés pedir reseñas.");
    $("#aum").onclick = () => {
      const grupos = [["servicios", "Servicios", c.servicios.length], ["productos", "Productos", c.productos.length], ["planes", "Planes y cuotas", (c.planes || []).length],
                      ["unidades", "Unidades (precio por noche)", c.unidades.length], ["coberturas", "Coseguros", (c.coberturas || []).length]].filter(g => g[2]);
      drawer("Subir precios", `<div class="two" style="grid-template-columns:1fr 1fr"><label class="lbl2">Cuánto (%)<input class="txt w" type="number" id="au-p" value="8" step="0.5"></label>
          <label class="lbl2">Redondear a<select class="txt w" id="au-r"><option value="100">$100</option><option value="500">$500</option><option value="1000">$1.000</option></select></label></div>
        <div class="lbl2" style="margin-top:10px">Qué precios</div>${grupos.map(([k, t]) => `<label class="rad"><input type="checkbox" class="au-q" value="${k}" ${k !== "coberturas" ? "checked" : ""}> ${t}</label>`).join("")}
        <p style="color:var(--muted);font-size:12.5px;margin-top:8px">Un número negativo baja los precios. Primero te mostramos cómo quedan; nada cambia hasta que confirmes.</p>
        <div id="au-prev"></div><div id="au-err"></div>`, `<button class="b" id="au-ver">Ver cómo quedan</button><button class="b p" id="au-ok" disabled>Aplicar</button>`);
      const datos = () => ({pct: $("#au-p").value, redondeo: $("#au-r").value, que: [...document.querySelectorAll(".au-q:checked")].map(x => x.value)});
      const ver = async () => {
        $("#au-err").innerHTML = "";
        try {
          const r = await call("aumentarPrecios", {...datos(), aplicar: false});
          $("#au-prev").innerHTML = `<div class="sec-t">${r.cambios.length} precios cambian</div><div style="max-height:280px;overflow:auto"><table><tbody>${r.cambios.map(x => `<tr><td>${esc(x.nombre)}<div style="color:var(--muted);font-size:11.5px">${esc(x.tipo)}</div></td><td class="n" style="color:var(--muted)">${esc(x.antes_txt)}</td><td class="n"><b>${esc(x.despues_txt)}</b></td></tr>`).join("")}</tbody></table></div>`;
          $("#au-ok").disabled = !r.cambios.length;
        } catch (e) { $("#au-err").innerHTML = `<div class="err">${esc(e.message)}</div>`; }
      };
      $("#au-ver").onclick = ver;
      ["#au-p", "#au-r"].forEach(x => $(x).onchange = () => { $("#au-ok").disabled = true; });
      document.querySelectorAll(".au-q").forEach(x => x.onchange = () => { $("#au-ok").disabled = true; });
      $("#au-ok").onclick = () => hacer(async () => { const r = await call("aumentarPrecios", {...datos(), aplicar: true}); P = await call("panel"); toast(`Listo: ${r.cambios.length} precios actualizados. Ya se ven en tu link.`); });
    };
    if ($("#add-pl")) $("#add-pl").onclick = () => {
      drawer("Agregar plan", `<label class="lbl2">Nombre<input class="txt w" id="pl-n" maxlength="60" placeholder="Ej: Funcional 3 veces por semana"></label>
        <div class="two" style="grid-template-columns:1fr 1fr"><label class="lbl2">Precio<input class="txt w" type="number" min="0" id="pl-p"></label><label class="lbl2">Dura (días)<input class="txt w" type="number" min="1" id="pl-d" value="30"></label></div>
        <div class="lbl2" style="margin-top:10px">Cómo se usa</div>
        <label class="rad"><input type="radio" name="pl-t" value="libre" checked> Libre: todas las clases que quiera</label>
        <label class="rad"><input type="radio" name="pl-t" value="semana"> <input class="txt" type="number" min="1" max="7" id="pl-s" value="2" style="width:64px"> veces por semana</label>
        <label class="rad"><input type="radio" name="pl-t" value="pack"> Pack de <input class="txt" type="number" min="1" id="pl-c" value="8" style="width:64px"> clases para usar cuando quiera</label>
        <label class="rad"><input type="radio" name="pl-t" value="suelta"> Clase suelta: se paga en cada clase</label>
        <div class="lbl2" style="margin-top:10px">Qué actividades incluye (sin marcar ninguna: todas)</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px 14px">${(P.actividades || []).map(a => `<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" class="pl-a" value="${esc(a.id)}"> ${esc(a.nombre)}</label>`).join("")}</div><div id="pl-err"></div>`,
        `<button class="b p" id="pl-ok">Agregar</button>`);
      $("#pl-ok").onclick = async () => {
        const t = (document.querySelector("[name=pl-t]:checked") || {}).value;
        try {
          await call("agregarPlan", {nombre: $("#pl-n").value, precio: $("#pl-p").value, dias: $("#pl-d").value, por_semana: t === "semana" ? $("#pl-s").value : null, clases: t === "pack" ? $("#pl-c").value : null,
                                     suelta: t === "suelta", actividades: [...document.querySelectorAll(".pl-a:checked")].map(x => x.value)});
          P = await call("panel"); cerrar(); toast("Plan agregado. Ya lo podés asignar a tus socios."); render();
        } catch (e) { $("#pl-err").innerHTML = `<div class="err">${esc(e.message)}</div>`; }
      };
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
  async function presupuestos(v) {
    const ps = await call("presupuestos");
    const tag = e => ({enviado: `<span class="tag blue">Esperando respuesta</span>`, aceptado: `<span class="tag ok">Aceptado</span>`, rechazado: `<span class="tag">Rechazado</span>`, vencido: `<span class="tag warn">Vencido</span>`}[e]);
    const k = e => ps.filter(p => p.estado === e).length, acept = ps.filter(p => p.estado === "aceptado").reduce((a, p) => a + p.total, 0);
    v.innerHTML = `<div class="ph"><h1>Presupuestos</h1><span class="sp"></span><button class="b p" id="np">+ Presupuesto</button></div>
      <div class="kpis"><div class="kpi"><div class="l">Esperando respuesta</div><div class="v">${k("enviado")}</div><div class="s">mandados y vigentes</div></div>
        <div class="kpi"><div class="l">Aceptados</div><div class="v pos">${k("aceptado")}</div><div class="s">${pesos(acept)} en trabajos</div></div>
        <div class="kpi"><div class="l">Vencidos</div><div class="v">${k("vencido")}</div><div class="s">para volver a llamar</div></div></div>
      <div class="card tw"><table><thead><tr><th>N°</th><th>Cliente</th><th class="hide-m">Auto</th><th class="n">Total</th><th>Estado</th><th></th></tr></thead><tbody>
      ${ps.map(p => `<tr><td>${p.numero}</td><td><b>${esc(p.cliente)}</b><div style="color:var(--muted);font-size:11.5px">${p.items.map(i => esc(i.desc)).slice(0, 2).join(" · ")}${p.items.length > 2 ? "…" : ""}</div></td>
        <td class="hide-m">${esc([p.auto, p.patente].filter(Boolean).join(" · "))}</td><td class="n"><b>${esc(p.total_txt)}</b></td><td>${tag(p.estado)}</td>
        <td class="n" style="white-space:nowrap"><a class="b s wa" target="_blank" rel="noopener" href="${esc(p.enviar)}">${p.estado === "vencido" ? "Volver a escribirle" : "Mandar por WhatsApp"}</a>
          ${p.link ? `<a class="b s" target="_blank" rel="noopener" href="${esc(p.link)}">Ver</a>` : ""}${p.estado === "enviado" ? ` <button class="b s ok" data-pra="${esc(p.id)}">Aceptó</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="6" class="empty">Todavía no armaste presupuestos.</td></tr>`}</tbody></table></div>
      <p style="color:var(--muted);font-size:12.5px;margin-top:8px">El cliente recibe un link, ve el presupuesto completo y lo acepta con un toque; después saca el turno desde tu link. Si te lo confirma por teléfono, marcalo con "Aceptó".</p>`;
    v.querySelectorAll("[data-pra]").forEach(b => b.onclick = () => hacer(() => call("estadoPresupuesto", {id: b.dataset.pra, acepta: true}), "Presupuesto aceptado"));
    $("#np").onclick = () => {
      const fila = () => `<div class="pr-it" style="display:grid;grid-template-columns:1fr 64px 110px;gap:6px;margin-bottom:6px"><input class="txt" placeholder="Repuesto o trabajo" data-pd><input class="txt" type="number" min="1" value="1" data-pc><input class="txt" type="number" min="0" placeholder="Precio" data-pp></div>`;
      drawer("Nuevo presupuesto", `<div class="two" style="grid-template-columns:1fr 1fr"><label class="lbl2">Cliente<input class="txt w" id="pn-n"></label><label class="lbl2">Celular<input class="txt w" id="pn-t" type="tel" placeholder="387 612 4879"></label></div>
        <div class="two" style="grid-template-columns:2fr 1fr"><label class="lbl2">Auto<input class="txt w" id="pn-a" placeholder="Ej: Gol Trend 2015"></label><label class="lbl2">Patente<input class="txt w" id="pn-p" style="text-transform:uppercase"></label></div>
        <div class="lbl2" style="margin-top:8px">Detalle</div><div id="pn-its">${fila()}${fila()}</div><button class="lnk" id="pn-mas" type="button">+ Otro ítem</button>
        <p style="margin:8px 0 0;font-weight:700" id="pn-tot">Total: $0</p>
        <div class="two" style="grid-template-columns:1fr 2fr;margin-top:8px"><label class="lbl2">Vale por (días)<input class="txt w" id="pn-v" type="number" min="1" value="15"></label><label class="lbl2">Nota (opcional)<input class="txt w" id="pn-o" placeholder="Ej: incluye mano de obra"></label></div><div id="pn-err"></div>`,
        `<button class="b p" id="pn-ok">Guardar y mandar por WhatsApp</button>`);
      const tot = () => { $("#pn-tot").textContent = "Total: " + pesos([...document.querySelectorAll(".pr-it")].reduce((a, r) => a + (Number(r.querySelector("[data-pc]").value) || 0) * (Number(r.querySelector("[data-pp]").value) || 0), 0)); };
      $("#pn-its").oninput = tot; $("#pn-mas").onclick = () => $("#pn-its").insertAdjacentHTML("beforeend", fila());
      $("#pn-ok").onclick = async () => {
        const items = [...document.querySelectorAll(".pr-it")].map(r => ({desc: r.querySelector("[data-pd]").value.trim(), cant: Number(r.querySelector("[data-pc]").value) || 1, precio: Number(r.querySelector("[data-pp]").value) || 0})).filter(i => i.desc);
        const w = window.open("about:blank", "_blank");
        try { const p = await call("agregarPresupuesto", {nombre: $("#pn-n").value, telefono: $("#pn-t").value, auto: $("#pn-a").value, patente: $("#pn-p").value, items, validez_dias: $("#pn-v").value, nota: $("#pn-o").value});
          if (w) w.location = p.enviar; cerrar(); toast(`Presupuesto N° ${p.numero} guardado`); render(); }
        catch (e) { if (w) w.close(); $("#pn-err").innerHTML = `<div class="err">${esc(e.message)}</div>`; }
      };
    };
  }
  async function usuarios(v) {
    const us = await call("usuarios");
    const RT = {dueño: "Dueño", encargado: "Encargado", empleado: "Empleado"};
    v.innerHTML = `<div class="ph"><h1>Usuarios</h1><span class="sp"></span><button class="b p" id="nu">+ Usuario</button></div>
      <div class="card" style="margin-bottom:12px"><p style="margin:0;font-size:13.5px">Cada persona entra con su usuario y contraseña en <b>${NOA.esDemo ? "tusistema.noalabs/entrar" : esc(location.origin + "/entrar")}</b>. Tu link de dueño sigue funcionando como siempre y no hace falta compartirlo.</p>
        <div class="two" style="grid-template-columns:repeat(3,1fr);margin-top:10px;font-size:12.5px;color:var(--muted)">
          <div><b style="color:var(--ink)">Empleado</b><br>Agenda, turnos, clases, pedidos, ventas en el local, socios y clientes. No ve la caja ni los números, no cambia precios ni horarios.</div>
          <div><b style="color:var(--ink)">Encargado</b><br>Todo lo del empleado, más precios, catálogo, stock, proveedores y horarios del personal. No ve la caja ni los números.</div>
          <div><b style="color:var(--ink)">Dueño</b><br>Todo, incluida la caja, los números y los usuarios.</div></div></div>
      <div class="card tw"><table><thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th class="hide-m">Última vez que entró</th><th class="n">Activo</th><th></th></tr></thead><tbody>
      ${us.map(u => `<tr class="${u.activo ? "" : "off"}"><td><b>${esc(u.nombre)}</b></td><td><code>${esc(u.usuario)}</code></td>
        <td><select class="txt" style="padding:4px 6px" data-urol="${esc(u.id)}">${Object.entries(RT).map(([k, t]) => `<option value="${k}" ${k === u.rol ? "selected" : ""}>${t}</option>`).join("")}</select></td>
        <td class="hide-m">${u.ultimo ? new Date(u.ultimo).toLocaleString("es-AR", {day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit"}) : "Nunca"}</td>
        <td class="n"><label class="sw"><input type="checkbox" data-uact="${esc(u.id)}" ${u.activo ? "checked" : ""}><span></span></label></td>
        <td class="n"><button class="b s" data-uclave="${esc(u.id)}">Nueva contraseña</button></td></tr>`).join("") || `<tr><td colspan="6" class="empty">Todavía no hay usuarios. Creá uno para cada persona que use el panel.</td></tr>`}</tbody></table></div>
      <p style="color:var(--muted);font-size:12.5px;margin-top:8px">Si alguien deja de trabajar con vos, apagalo: queda afuera en el momento, aunque tenga el panel abierto.</p>
      <div class="card tw" style="margin-top:14px"><h3>Quién hizo qué <span class="sp"></span><select class="txt" style="padding:4px 8px;font-size:13px" id="act-q"><option value="">Todos</option></select></h3><div id="act"><p class="empty">Cargando…</p></div></div>`;
    const pintarAct = async () => {
      const a = await call("actividad", {quien: $("#act-q").value || undefined});
      const sel = $("#act-q"), v0 = sel.value;
      sel.innerHTML = `<option value="">Todos</option>` + a.quienes.map(q => `<option ${q === v0 ? "selected" : ""}>${esc(q)}</option>`).join("");
      $("#act").innerHTML = a.items.length ? `<table><tbody>${a.items.map(x => `<tr><td style="white-space:nowrap;color:var(--muted);font-size:12.5px">${new Date(x.cuando).toLocaleString("es-AR", {day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit"})}</td><td><b>${esc(x.quien)}</b></td><td>${esc(x.accion)}</td></tr>`).join("")}</tbody></table>`
        : `<p class="empty">Todavía no hay movimientos.</p>`;
    };
    $("#act-q").onchange = pintarAct; pintarAct();
    $("#nu").onclick = () => {
      drawer("Nuevo usuario", `<label class="lbl2">Nombre<input class="txt w" id="nu-n" placeholder="Ej: Caro"></label>
        <label class="lbl2">Usuario<input class="txt w" id="nu-u" autocapitalize="none" placeholder="Ej: caro.${esc((P.slug || "negocio").split("-")[0])}"></label>
        <label class="lbl2">Contraseña<input class="txt w" id="nu-c" type="text" autocomplete="new-password" placeholder="Al menos 8 caracteres"></label>
        <label class="lbl2">Rol<select class="txt w" id="nu-r"><option value="empleado">Empleado</option><option value="encargado">Encargado</option><option value="dueño">Dueño (otro socio)</option></select></label>
        <p style="color:var(--muted);font-size:12.5px">Pasale el usuario y la contraseña en persona o por WhatsApp. Después la puede cambiar el dueño desde acá.</p><div id="nu-err"></div>`, `<button class="b p" id="nu-ok">Crear usuario</button>`);
      $("#nu-ok").onclick = async () => { try { await call("agregarUsuario", {nombre: $("#nu-n").value, usuario: $("#nu-u").value, clave: $("#nu-c").value, rol: $("#nu-r").value}); cerrar(); toast("Usuario creado"); render(); } catch (e) { $("#nu-err").innerHTML = `<div class="err">${esc(e.message)}</div>`; } };
    };
    v.querySelectorAll("[data-urol]").forEach(sl => sl.onchange = () => hacer(() => call("cambiarUsuario", {id: sl.dataset.urol, rol: sl.value}), "Rol cambiado. Tiene que volver a entrar."));
    v.querySelectorAll("[data-uact]").forEach(i => i.onchange = () => hacer(() => call("cambiarUsuario", {id: i.dataset.uact, activo: i.checked}), i.checked ? "Usuario activado" : "Usuario apagado: ya no puede entrar"));
    v.querySelectorAll("[data-uclave]").forEach(b => b.onclick = () => {
      const u = us.find(x => x.id === b.dataset.uclave);
      drawer(`Nueva contraseña · ${u.nombre}`, `<label class="lbl2">Contraseña nueva<input class="txt w" id="uc-c" type="text" autocomplete="new-password"></label><div id="uc-err"></div>`, `<button class="b p" id="uc-ok">Guardar</button>`);
      $("#uc-ok").onclick = async () => { try { await call("cambiarUsuario", {id: u.id, clave: $("#uc-c").value}); cerrar(); toast("Contraseña cambiada"); } catch (e) { $("#uc-err").innerHTML = `<div class="err">${esc(e.message)}</div>`; } };
    });
  }
  const MEDIOS = ["Efectivo", "Transferencia", "Mercado Pago", "Tarjeta", "Débito automático"];
  const hora = iso => new Date(iso).toLocaleString("es-AR", {weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit"});
  async function tarjetaArqueo() {
    const a = await call("arqueo"), el = $("#c-arq"); if (!el) return;
    el.innerHTML = `<h3>Cierre de caja <span class="sp"></span><button class="b s p" id="arq">Cerrar caja</button></h3>
      <div class="bal"><div><span>Arrancó con</span><b>${pesos(a.fondo)}</b></div><div><span>Entró en efectivo</span><b style="color:var(--ok)">+${pesos(a.ingresos)}</b></div><div><span>Salió en efectivo</span><b style="color:var(--crit)">−${pesos(a.egresos)}</b></div>
        <div class="tot"><span>Debería haber en la caja</span><b>${pesos(a.esperado)}</b></div></div>
      <p style="color:var(--muted);font-size:12px;margin:6px 0 10px">Desde ${a.ultimo ? `el cierre de ${esc(a.ultimo.quien)} (${hora(a.ultimo.cuando)})` : "el comienzo del día"}.${a.otros.length ? " Además: " + a.otros.map(o => `${esc(o.medio)} +${pesos(o.ingresos)}${o.egresos ? " −" + pesos(o.egresos) : ""}`).join(" · ") + "." : ""} Tus empleados cuentan sin ver este número.</p>
      ${a.cierres.length ? `<table><thead><tr><th>Cierre</th><th>Quién</th><th class="n">Contó</th><th class="n">Diferencia</th></tr></thead><tbody>${a.cierres.slice(0, 8).map(x => `<tr title="${esc(x.nota || "")}"><td style="font-size:12.5px">${hora(x.cuando)}</td><td>${esc(x.quien)}</td><td class="n">${pesos(x.contado)}</td>
        <td class="n"><span class="tag ${x.diferencia === 0 ? "ok" : x.diferencia < 0 ? "crit" : "warn"}">${x.diferencia === 0 ? "Justo" : (x.diferencia > 0 ? "Sobra " : "Falta ") + pesos(Math.abs(x.diferencia))}</span></td></tr>`).join("")}</tbody></table>` : ""}`;
    $("#arq").onclick = () => cierreCaja(a);
  }
  function cierreCaja(a) {
    drawer("Cerrar caja", `${a && !a.ciego ? `<div class="info" style="margin-bottom:10px">Debería haber <b>${pesos(a.esperado)}</b> en efectivo.</div>` : `<p style="color:var(--muted);font-size:13px;margin-top:0">Contá los billetes y monedas que hay en la caja y anotá el total.</p>`}
      <label class="lbl2">¿Cuánto efectivo hay en la caja?<input class="txt w" id="aq-c" type="number" min="0" inputmode="numeric"></label>
      <label class="lbl2">¿Cuánto sacás? (lo que no queda para mañana)<input class="txt w" id="aq-r" type="number" min="0" value="0" inputmode="numeric"></label>
      <label class="lbl2">Nota (opcional)<input class="txt w" id="aq-n" placeholder="Ej: deposité en el banco"></label><div id="aq-err"></div>`, `<button class="b p" id="aq-ok">Cerrar caja</button>`);
    $("#aq-ok").onclick = async () => {
      if ($("#aq-c").value === "") { $("#aq-err").innerHTML = `<div class="err">Escribí cuánto efectivo contaste.</div>`; return; }
      try {
        const r = await call("cerrarCaja", {contado: $("#aq-c").value, retiro: $("#aq-r").value, nota: $("#aq-n").value});
        cerrar(); toast(r.diferencia == null ? "Caja cerrada. ¡Gracias!" : r.diferencia === 0 ? "Caja cerrada: justo" : `Caja cerrada: ${r.diferencia > 0 ? "sobran" : "faltan"} ${pesos(Math.abs(r.diferencia))}`); render();
      } catch (e) { $("#aq-err").innerHTML = `<div class="err">${esc(e.message)}</div>`; }
    };
  }
  async function tarjetaGastos() {
    const g = await call("gastos"), el = $("#c-gas"); if (!el) return;
    const est = x => x.pagado ? `<span class="tag ok">Pagado</span>` : x.dias < 0 ? `<span class="tag crit">Venció hace ${-x.dias} día${x.dias === -1 ? "" : "s"}</span>` : x.dias === 0 ? `<span class="tag crit">Vence hoy</span>` : x.dias <= 3 ? `<span class="tag warn">Vence en ${x.dias} día${x.dias === 1 ? "" : "s"}</span>` : `<span class="tag">El ${x.dia}</span>`;
    el.innerHTML = `<h3>Gastos fijos del mes <span class="sp"></span><button class="b s p" id="add-g">+ Gasto</button></h3>
      <table><tbody>${g.items.map(x => `<tr class="${x.activo ? "" : "off"}"><td><b>${esc(x.concepto)}</b><div style="color:var(--muted);font-size:11.5px">${esc(x.cat)} · ${esc(x.medio)}</div></td><td class="n">${pesos(x.monto)}</td><td class="n">${x.activo ? est(x) : `<span class="tag">Pausado</span>`}</td>
        <td class="n">${x.activo && !x.pagado ? `<button class="b s ok" data-gpag="${esc(x.id)}">Pagado</button>` : ""}<button class="b s" data-gq="${esc(x.id)}" title="Quitar">✕</button></td></tr>`).join("") || `<tr><td class="empty">Cargá alquiler, luz, internet, impuestos… y te avisamos antes de que venzan.</td></tr>`}</tbody></table>
      ${g.items.length ? `<p style="color:var(--muted);font-size:12px;margin-top:6px">Total por mes: <b>${pesos(g.total)}</b>. Al tocar "Pagado" se carga solo el egreso en la caja.</p>` : ""}`;
    $("#add-g").onclick = () => {
      drawer("Nuevo gasto fijo", `<label class="lbl2">Qué es<input class="txt w" id="gf-c" placeholder="Ej: alquiler del local"></label>
        <div class="two" style="grid-template-columns:1fr 1fr"><label class="lbl2">Monto por mes<input class="txt w" id="gf-m" type="number" min="1"></label><label class="lbl2">Vence el día<input class="txt w" id="gf-d" type="number" min="1" max="28" value="10"></label></div>
        <div class="two" style="grid-template-columns:1fr 1fr"><label class="lbl2">Categoría<input class="txt w" id="gf-k" value="Gastos fijos" list="gf-cats"><datalist id="gf-cats"><option value="Alquiler"><option value="Servicios"><option value="Impuestos"><option value="Sueldos"><option value="Seguros"></datalist></label>
        <label class="lbl2">Cómo lo pagás<select class="txt w" id="gf-md">${MEDIOS.slice(1).concat("Efectivo").map(x => `<option>${x}</option>`).join("")}</select></label></div><div id="gf-err"></div>`, `<button class="b p" id="gf-ok">Agregar</button>`);
      $("#gf-ok").onclick = async () => { try { await call("agregarGasto", {concepto: $("#gf-c").value, monto: $("#gf-m").value, dia: $("#gf-d").value, cat: $("#gf-k").value, medio: $("#gf-md").value}); cerrar(); toast("Gasto agregado"); render(); } catch (e) { $("#gf-err").innerHTML = `<div class="err">${esc(e.message)}</div>`; } };
    };
    el.querySelectorAll("[data-gpag]").forEach(b => b.onclick = () => {
      const x = g.items.find(y => y.id === b.dataset.gpag);
      drawer(`Pagar ${x.concepto}`, `<label class="lbl2">Monto de este mes<input class="txt w" id="gp-m" type="number" value="${x.monto}"></label><label class="lbl2">Cómo lo pagaste<select class="txt w" id="gp-md">${MEDIOS.map(m => `<option ${m === x.medio ? "selected" : ""}>${m}</option>`).join("")}</select></label><div id="gp-err"></div>`, `<button class="b p" id="gp-ok">Marcar pagado</button>`);
      $("#gp-ok").onclick = async () => { try { await call("pagarGasto", {id: x.id, monto: $("#gp-m").value, medio: $("#gp-md").value}); cerrar(); toast("Pagado. Se cargó en la caja."); render(); } catch (e) { $("#gp-err").innerHTML = `<div class="err">${esc(e.message)}</div>`; } };
    });
    el.querySelectorAll("[data-gq]").forEach(b => b.onclick = () => { if (confirmar(b)) hacer(() => call("cambiarGasto", {id: b.dataset.gq, quitar: true}), "Gasto quitado"); });
  }
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
      <div class="two" style="margin-top:12px"><div class="card" id="c-arq"><p class="empty">Cargando…</p></div><div class="card tw" id="c-gas"><p class="empty">Cargando…</p></div></div>
      <div class="card" style="margin-top:12px"><h3>Cargar un movimiento</h3><form class="form" id="fm"><select class="txt" id="m-t"><option value="egreso">Egreso</option><option value="ingreso">Ingreso</option></select>
        <input class="txt" id="m-c" placeholder="Concepto (ej: compra de insumos)"><input class="txt" id="m-cat" placeholder="Categoría" list="cats"><input class="txt" id="m-m" type="number" min="1" placeholder="Monto"><select class="txt" id="m-md">${MEDIOS.map(x => `<option>${x}</option>`).join("")}</select><button class="b p">Guardar</button>
        <datalist id="cats">${[...new Set(c.categorias.map(x => x.cat))].map(x => `<option value="${esc(x)}">`).join("")}</datalist></form></div>
      <div class="card tw" style="margin-top:12px"><h3>Movimientos</h3><table><thead><tr><th>Fecha</th><th>Concepto</th><th class="hide-m">Categoría</th><th class="hide-m">Medio</th><th class="n">Monto</th></tr></thead><tbody>
        ${c.movimientos.map(x => `<tr><td>${ddmm(x.fecha)}</td><td>${esc(x.concepto)}</td><td class="hide-m">${esc(x.cat)}</td><td class="hide-m">${esc(x.medio)}</td><td class="n" style="color:${x.tipo === "ingreso" ? "var(--ok)" : "var(--crit)"};font-weight:600">${x.tipo === "ingreso" ? "+" : "−"}${pesos(x.monto)}</td></tr>`).join("") || `<tr><td colspan="5" class="empty">Sin movimientos este mes.</td></tr>`}</tbody></table></div>`;
    const mover = k => { const d = new Date(y, m - 1 + k, 1); MES = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; render(); };
    $("#m-ant").onclick = () => mover(-1); $("#m-sig").onclick = () => mover(1);
    $("#fm").onsubmit = e => { e.preventDefault(); hacer(() => call("movimiento", {tipo: $("#m-t").value, concepto: $("#m-c").value, cat: $("#m-cat").value || "Otros", monto: $("#m-m").value, medio: $("#m-md").value}), "Movimiento guardado"); };
    tarjetaArqueo(); tarjetaGastos();
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
