/* Página que usa el cliente del negocio: sacar turno, reservar una clase o hacer un pedido. */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const pesos = n => "$" + Math.round(n).toLocaleString("es-AR");
  const call = (m, p) => NOA.call(m, p);
  const app = () => $("#app");
  const K = id => String(id);
  const T = k => (INFO.textos || {})[k];
  const ICON = {"Mates": "🧉", "Bombillas": "🧉", "Termos": "♨️", "Yerbas": "🌿", "Materas": "👜", "Sets": "🎁", "Electricidad": "🔌", "Plomería": "🚰", "Pinturería": "🎨",
                "Herramientas": "🔨", "Bulonería": "🔩", "Café para llevar": "☕", "Panadería del día": "🥐", "Pastelería": "🍰", "Para regalar": "🎁"};
  const WA_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.8 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1a17 17 0 0 1-1.8-.7 13.5 13.5 0 0 1-5.1-4.5c-.6-.8-1.3-2-1.3-3.2 0-1.2.6-1.8.9-2.1.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.3.5-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.2.5.1.6 0l.9-1c.2-.3.4-.2.6-.1l2 .9c.3.2.5.2.6.3.1.2.1.7-.1 1.4Z"/></svg>';

  let INFO = null, TAB = null;
  const st = {};                        // estado del recorrido actual
  const cart = new Map();               // producto -> cantidad
  const guardado = (() => { try { return JSON.parse(localStorage.getItem("noa-cliente") || "{}"); } catch (e) { return {}; } })();
  const recordar = (n, t) => { try { localStorage.setItem("noa-cliente", JSON.stringify({n, t})); } catch (e) {} };

  function pantalla(titulo, cuerpo, volver) {
    app().innerHTML = `<div class="head">${volver ? `<button class="back" id="volver" aria-label="Volver">←</button>` : ""}<h2>${titulo}</h2></div>${cuerpo}`;
    if (volver) $("#volver").onclick = volver;
    window.scrollTo({top: 0});
  }
  function error(msg, extra = "") {
    document.querySelectorAll(".err").forEach(e => e.remove());
    const d = document.createElement("div"); d.className = "err"; d.innerHTML = esc(msg) + extra;
    (document.querySelector("form") || app()).append(d);
    d.scrollIntoView({block: "nearest", behavior: "smooth"});
  }
  const cargando = (n = 3) => '<div class="skel"></div>'.repeat(n);
  const resumen = partes => `<div class="sum">${partes.filter(Boolean).join("")}</div>`;

  // ── Inicio ────────────────────────────────────────────────────────
  async function inicio() {
    app().innerHTML = cargando(4);
    if (NOA.codigoUrl && !NOA.slug && !NOA.esDemo) { try { NOA.slug = (await call("reserva", {codigo: NOA.codigoUrl})).slug; } catch (e) { /* lo maneja cancelar() */ } }
    try { INFO = await call("info"); } catch (e) { app().innerHTML = `<div class="err">${esc(e.message)}</div>`; return; }
    document.title = INFO.nombre;
    $("#nom").textContent = INFO.nombre;
    $("#logo").textContent = INFO.nombre.replace(/^(Salón|Taller|Café|Gimnasio|Ferretería|Matería)\s+/i, "").charAt(0).toUpperCase();
    $("#ubic").textContent = INFO.direccion ? "📍 " + INFO.direccion : "";
    if (INFO.maps) $("#ubic").href = INFO.maps;
    if (INFO.whatsapp) { $("#wa").href = `https://wa.me/${INFO.whatsapp}`; $("#wa").innerHTML = WA_SVG; $("#wa").hidden = false; }
    if (NOA.codigoUrl) return cancelar(NOA.codigoUrl);
    const tabs = [];
    if (INFO.servicios.length) tabs.push(["turnos", (INFO.textos && INFO.textos.turnos) || "Sacar turno"]);
    if (INFO.actividades.length) tabs.push(["clases", "Reservar clase"]);
    if (INFO.productos.length) tabs.push(["productos", (INFO.textos && INFO.textos.productos) || "Comprar"]);
    if (INFO.unidades && INFO.unidades.length) tabs.push(["estadias", T("estadias") || "Reservar"]);
    if (INFO.productos.length && INFO.servicios.length) tabs.reverse();
    $("#tabs").innerHTML = tabs.length > 1 ? tabs.map(([k, t]) => `<button data-t="${k}">${esc(t)}</button>`).join("") : "";
    $("#tabs").querySelectorAll("button").forEach(b => b.onclick = () => ir(b.dataset.t));
    ir(tabs[0][0]);
    NOA.suscribir((tipo) => { if (TAB === "productos" && st.vista === "catalogo" && ["pedido", "stock", "cancelado"].includes(tipo)) catalogo(); });
  }
  async function ir(t) {
    TAB = t;
    document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.t === t));
    Object.keys(st).forEach(k => delete st[k]);
    if (t === "turnos") servicios();
    if (t === "clases") clases();
    if (t === "productos") { INFO = await call("info"); catalogo(); }
    if (t === "estadias") fechas();
  }

  // ── Turnos ────────────────────────────────────────────────────────
  function servicios() {
    const cats = [...new Set(INFO.servicios.map(s => s.cat).filter(Boolean))];
    st.cat = st.cat && cats.includes(st.cat) ? st.cat : null;
    const lista = INFO.servicios.filter(s => !st.cat || s.cat === st.cat);
    pantalla(T("servicio_titulo") || (INFO.rubro === "cafe" ? "¿Para cuántos?" : "¿Qué servicio querés?"),
      (cats.length > 1 ? `<div class="chips"><button class="chip ${!st.cat ? "on" : ""}" data-c="">Todos</button>${cats.map(c => `<button class="chip ${st.cat === c ? "on" : ""}" data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div>` : "") +
      `<div class="list">${lista.map(s => `<button class="opt" data-s="${s.id}"><span class="tx"><b>${esc(s.nombre)}</b><small>${esc([s.desc, ["cafe", "restaurante", "inmobiliaria", "canchas"].includes(INFO.rubro) ? "" : s.min >= 60 ? `${Math.floor(s.min / 60)} h${s.min % 60 ? " " + (s.min % 60) + " min" : ""}` : s.min + " min",
      s.modalidad === "domicilio" ? "A domicilio" : s.modalidad === "ambos" ? (T("modal") ? `${T("modal").local.t} o ${T("modal").domicilio.t.toLowerCase()}` : "En el taller o a domicilio") : ""].filter(Boolean).join(" · "))}</small></span><span class="pr">${esc(s.precio_txt)}</span></button>`).join("")}</div>`);
    app().querySelectorAll("[data-c]").forEach(b => b.onclick = () => { st.cat = b.dataset.c || null; servicios(); });
    app().querySelectorAll("[data-s]").forEach(b => b.onclick = () => {
      st.s = INFO.servicios.find(x => K(x.id) === b.dataset.s); st.pro = null; st.modalidad = st.s.modalidad === "domicilio" ? "domicilio" : "local";
      siguienteDespuesDeServicio();
    });
  }
  function siguienteDespuesDeServicio() {
    const prosServ = INFO.profesionales.filter(p => st.s.pros.map(K).includes(K(p.id)));
    if (INFO.elegir_pro && prosServ.length > 1) return elegirPro(prosServ);
    if (INFO.elegir_pro && prosServ.length === 1) st.pro = prosServ[0];
    if (st.s.modalidad === "ambos") return elegirModalidad();
    dias();
  }
  function elegirPro(prosServ) {
    const colores = ["#D9622B", "#2F6FDE", "#1F8A5B", "#7A5AF8", "#C2412D"];
    pantalla(T("pro_titulo") || `¿Con quién?`, resumen([`<b>${esc(st.s.nombre)}</b>`, `<span>${esc(st.s.precio_txt)}</span>`]) +
      `<div class="list"><button class="opt" data-p=""><span class="av" style="background:#9AA0AC">★</span><span class="tx"><b>${esc(T("pro_todos") || "Cualquiera")}</b><small>El primer horario libre</small></span></button>` +
      prosServ.map((p, i) => `<button class="opt" data-p="${p.id}"><span class="av" style="background:${colores[i % 5]}">${esc(p.nombre[0])}</span><span class="tx"><b>${esc(p.nombre)}</b><small>${esc(p.rol || "")}</small></span></button>`).join("") + `</div>`,
      servicios);
    app().querySelectorAll("[data-p]").forEach(b => b.onclick = () => { st.pro = b.dataset.p ? prosServ.find(p => K(p.id) === b.dataset.p) : null; st.s.modalidad === "ambos" ? elegirModalidad() : dias(); });
  }
  function elegirModalidad() {
    const M = T("modal") || {local: {t: "Lo llevo al taller", s: INFO.direccion || "", i: "🔧"}, domicilio: {t: "Vengan adonde está el auto", s: INFO.zona_domicilio ? "Zona: " + INFO.zona_domicilio : "A domicilio", i: "🚐"}};
    pantalla(T("modal") ? "¿Cómo preferís?" : "¿Dónde?", resumen([`<b>${esc(st.s.nombre)}</b>`, `<span>${esc(st.s.precio_txt)}</span>`]) +
      `<div class="list"><button class="opt" data-m="local"><span class="av" style="background:#18212F">${M.local.i}</span><span class="tx"><b>${esc(M.local.t)}</b><small>${esc(M.local.s)}</small></span></button>
       <button class="opt" data-m="domicilio"><span class="av" style="background:#1F8A5B">${M.domicilio.i}</span><span class="tx"><b>${esc(M.domicilio.t)}</b><small>${esc(M.domicilio.s)}</small></span></button></div>`,
      servicios);
    app().querySelectorAll("[data-m]").forEach(b => b.onclick = () => { st.modalidad = b.dataset.m; dias(); });
  }
  const resTurno = () => resumen([`<b>${esc(st.s.nombre)}</b>`, st.s.precio ? `<span>${esc(st.s.precio_txt)}</span>` : "", st.pro && INFO.elegir_pro ? `<span>con ${esc(st.pro.nombre)}</span>` : "",
                                   st.modalidad === "domicilio" ? `<span>${T("modal") ? T("modal").domicilio.t.toLowerCase() : "a domicilio"}</span>` : "", st.dia ? `<span>${esc(st.dia.nombre)}</span>` : "", st.hora ? `<span>${st.hora.hora}</span>` : ""]);
  async function dias() {
    st.dia = st.hora = null;
    const volver = () => { st.s.modalidad === "ambos" ? elegirModalidad() : INFO.elegir_pro && st.s.pros.length > 1 ? elegirPro(INFO.profesionales.filter(p => st.s.pros.map(K).includes(K(p.id)))) : servicios(); };
    pantalla("¿Qué día?", resTurno() + cargando(2), volver);
    let ds;
    try { ds = await call("dias", {servicio: st.s.id, pro: st.pro && st.pro.id, modalidad: st.modalidad}); } catch (e) { return error(e.message); }
    pantalla("¿Qué día?", resTurno() + (ds.length ? `<div class="grid">${ds.map(d => `<button class="slot" data-d="${d.fecha}">${esc(d.nombre)}<small>${d.libres} libre${d.libres > 1 ? "s" : ""}</small></button>`).join("")}</div>`
      : `<p class="empty">No quedan lugares en los próximos días. Escribinos por WhatsApp.</p>`), volver);
    app().querySelectorAll("[data-d]").forEach(b => b.onclick = () => { st.dia = ds.find(d => d.fecha === b.dataset.d); horas(); });
  }
  async function horas() {
    st.hora = null;
    pantalla("¿A qué hora?", resTurno() + cargando(2), dias);
    let hs;
    try { hs = await call("horas", {servicio: st.s.id, dia: st.dia.fecha, pro: st.pro && st.pro.id, modalidad: st.modalidad}); } catch (e) { return error(e.message); }
    const man = hs.filter(h => +h.hora.slice(0, 2) < 13), tar = hs.filter(h => +h.hora.slice(0, 2) >= 13);
    const bloque = (t, l) => l.length ? `<div class="dayh">${t}</div><div class="grid">${l.map(h => `<button class="slot" data-h="${h.inicio}">${h.hora}</button>`).join("")}</div>` : "";
    pantalla("¿A qué hora?", resTurno() + (hs.length ? bloque("Mañana", man) + bloque("Tarde", tar) : `<p class="empty">Ese día ya no quedan horarios.</p>`), dias);
    app().querySelectorAll("[data-h]").forEach(b => b.onclick = () => { st.hora = hs.find(h => h.inicio === b.dataset.h); datosTurno(); });
  }
  function camposPersona() {
    return `<label class="f" for="n">Nombre y apellido</label><input class="in" id="n" autocomplete="name" value="${esc(guardado.n || "")}">
      <label class="f" for="t">Celular</label><input class="in" id="t" type="tel" inputmode="tel" autocomplete="tel" placeholder="387 612 4879" value="${esc(guardado.t || "")}">
      <p class="hint">Con código de área, sin 0 y sin 15.</p><input class="hp" id="web" tabindex="-1" autocomplete="off" aria-hidden="true">`;
  }
  function datosTurno() {
    const extra = INFO.campos_extra.map(c => `<label class="f" for="x-${c.id}">${esc(c.label)}</label><input class="in" id="x-${c.id}" placeholder="${esc(c.ph || "")}">`).join("");
    pantalla("Tus datos", resTurno() + `<form id="f" novalidate>${camposPersona()}${extra}
      ${st.modalidad === "domicilio" && !(T("modal") && T("modal").sin_dir) ? `<label class="f" for="dir">¿Dónde está el auto?</label><input class="in" id="dir" placeholder="Calle, número y barrio" autocomplete="street-address">` : ""}
      <label class="check"><input type="checkbox" id="a" checked> Acepto que me manden el recordatorio del turno por WhatsApp.</label>
      <button class="btn" id="ok">Confirmar ${["cafe", "restaurante"].includes(INFO.rubro) ? "reserva" : INFO.rubro === "inmobiliaria" ? "visita" : INFO.rubro === "estudio" ? "reunión" : "turno"}</button></form>`, horas);
    $("#f").onsubmit = async ev => {
      ev.preventDefault();
      const p = {servicio: st.s.id, inicio: st.hora.inicio, pro: st.pro ? st.pro.id : st.hora.pro, nombre: $("#n").value.trim(), telefono: $("#t").value.trim(),
                 acepta: $("#a").checked, modalidad: st.modalidad, direccion: $("#dir") ? $("#dir").value.trim() : "", web: $("#web").value,
                 extra: Object.fromEntries(INFO.campos_extra.map(c => [c.id, $("#x-" + c.id).value.trim()]))};
      if (!st.pro && INFO.elegir_pro) delete p.pro;
      await enviar("reservarTurno", p, () => horas());
    };
  }

  // ── Clases ────────────────────────────────────────────────────────
  async function clases() {
    pantalla("Reservá tu lugar", cargando(5));
    let cs;
    try { cs = await call("clases"); } catch (e) { return error(e.message); }
    st.todas = cs;
    const acts = INFO.actividades;
    const lista = cs.filter(c => !st.act || K(c.actividad) === st.act);
    let html = `<div class="chips"><button class="chip ${!st.act ? "on" : ""}" data-a="">Todas</button>${acts.map(a => `<button class="chip ${st.act === K(a.id) ? "on" : ""}" data-a="${a.id}">${esc(a.nombre)}</button>`).join("")}</div>`;
    if (INFO.solo_socios) html += `<p class="hint" style="margin:-4px 0 6px">Reservan los ${T("socio") === "alumno" ? "alumnos" : "socios"} con la cuota al día, con el celular que dejaron en recepción.</p>`;
    let dia = "";
    for (const c of lista) {
      if (c.dia !== dia) { dia = c.dia; html += `<div class="dayh">${esc(c.dia)}</div>`; }
      const q = c.cupo - c.ocupados;
      html += `<button class="cls" data-o="${c.id}" ${q <= 0 ? "disabled" : ""}><span class="h">${c.hora}</span><span class="dot" style="background:${c.color}"></span><span class="tx"><b>${esc(c.nombre)}</b><small>${esc(c.profe)} · ${c.min} min</small></span>
        <span class="badge ${q <= 0 ? "crit" : q <= 3 ? "warn" : ""}">${q <= 0 ? "Completa" : q === 1 ? "Queda 1" : `Quedan ${q}`}</span></button>`;
    }
    if (!lista.length) html += `<p class="empty">No hay clases en los próximos días.</p>`;
    pantalla("Reservá tu lugar", `<div class="list" style="gap:8px">${html}</div>`);
    app().querySelectorAll("[data-a]").forEach(b => b.onclick = () => { st.act = b.dataset.a || null; clases(); });
    app().querySelectorAll("[data-o]").forEach(b => b.onclick = () => datosClase(cs.find(c => c.id === b.dataset.o)));
  }
  function datosClase(c) {
    st.clase = c;
    const q = c.cupo - c.ocupados;
    pantalla("Tus datos", resumen([`<b>${esc(c.nombre)}</b>`, `<span>${esc(c.dia)} ${c.hora}</span>`, `<span>con ${esc(c.profe)}</span>`, `<span>${q === 1 ? "queda 1 lugar" : `quedan ${q} lugares`}</span>`]) +
      `<form id="f" novalidate>${camposPersona()}${NOA.esDemo && INFO.textos && INFO.textos.prueba ? `<div class="demo-note">${esc(INFO.textos.prueba)}</div>` : ""}
       <button class="btn" id="ok">Reservar mi lugar</button></form>`, clases);
    $("#f").onsubmit = async ev => {
      ev.preventDefault();
      await enviar("inscribir", {ocurrencia: c.id, nombre: $("#n").value.trim(), telefono: $("#t").value.trim(), web: $("#web").value}, null, e => {
        if (["cuota", "socio"].includes(e.tipo) && INFO.whatsapp)
          return ` <a class="btn wa" style="margin-top:10px" target="_blank" rel="noopener" href="https://wa.me/${INFO.whatsapp}?text=${encodeURIComponent(e.tipo === "cuota" ? "Hola! Quiero pagar la cuota para reservar clases." : "Hola! Quiero hacerme socio.")}">${e.tipo === "cuota" ? "Pagar la cuota por WhatsApp" : "Quiero ser socio"}</a>`;
        return "";
      });
    };
  }

  // ── Productos ─────────────────────────────────────────────────────
  const cantEnCarrito = () => [...cart.values()].reduce((a, b) => a + b, 0);
  const totalCarrito = () => [...cart.entries()].reduce((a, [id, q]) => a + q * (INFO.productos.find(p => K(p.id) === id) || {precio: 0}).precio, 0);
  function barraCarrito() {
    let b = $("#cartbar");
    const n = cantEnCarrito();
    if (!n || st.vista !== "catalogo") { if (b) b.remove(); return; }
    if (!b) { b = document.createElement("div"); b.className = "cart"; b.id = "cartbar"; document.body.append(b); }
    b.innerHTML = `<button id="vercart"><span><span class="n">${n}</span>Ver pedido</span><span>${pesos(totalCarrito())}</span></button>`;
    $("#vercart").onclick = carrito;
  }
  function catalogo() {
    st.vista = "catalogo";
    const cats = [...new Set(INFO.productos.map(p => p.cat))];
    const qtxt = (st.q || "").toLowerCase();
    const lista = INFO.productos.filter(p => (!st.cat || p.cat === st.cat) && (!qtxt || (p.nombre + " " + (p.desc || "") + " " + p.cat).toLowerCase().includes(qtxt)));
    const card = p => {
      const q = cart.get(K(p.id)) || 0, agot = !p.ilimitado && p.stock <= 0, max = p.ilimitado ? 99 : p.stock;
      const stock = p.ilimitado ? "" : agot ? `<span class="badge crit">Sin stock</span>` : p.stock <= 3 ? `<span class="badge warn">${p.stock === 1 ? "Queda 1" : "Quedan " + p.stock}</span>` : `<span class="badge">Hay stock</span>`;
      return `<div class="prod ${agot ? "agotado" : ""}"><div class="ph" aria-hidden="true">${ICON[p.cat] || "🛍️"}</div><b>${esc(p.nombre)}</b><small>${esc(p.desc || "")}</small>${stock}
        <div class="row"><span class="pr">${esc(p.precio_txt)}${p.unidad === "m" ? "<small style='display:inline'> /m</small>" : ""}</span>
        ${q ? `<div class="qty"><button data-m="${p.id}" aria-label="Quitar uno">−</button><span>${q}</span><button class="add" data-p="${p.id}" ${q >= max ? "disabled" : ""} aria-label="Agregar uno">+</button></div>`
            : `<button class="addbtn" data-p="${p.id}" ${agot ? "disabled" : ""}>Agregar</button>`}</div></div>`;
    };
    const keep = document.activeElement && document.activeElement.id === "q";
    pantalla(INFO.textos && INFO.textos.productos ? esc(INFO.textos.productos) : "Catálogo",
      (INFO.productos.length > 10 ? `<input class="search" id="q" type="search" placeholder="Buscar: tomacorriente, rodillo, mate…" value="${esc(st.q || "")}" aria-label="Buscar">` : "") +
      `<div class="chips"><button class="chip ${!st.cat ? "on" : ""}" data-c="">Todo</button>${cats.map(c => `<button class="chip ${st.cat === c ? "on" : ""}" data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div>` +
      (lista.length ? `<div class="prods">${lista.map(card).join("")}</div>` : `<p class="empty">No encontramos productos con esa búsqueda.</p>`));
    if ($("#q")) { $("#q").oninput = e => { st.q = e.target.value; catalogo(); }; if (keep) { const i = $("#q"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
    app().querySelectorAll("[data-c]").forEach(b => b.onclick = () => { st.cat = b.dataset.c || null; catalogo(); });
    app().querySelectorAll("[data-p]").forEach(b => b.onclick = () => { const id = b.dataset.p; cart.set(id, (cart.get(id) || 0) + 1); catalogo(); });
    app().querySelectorAll("[data-m]").forEach(b => b.onclick = () => { const id = b.dataset.m, q = (cart.get(id) || 0) - 1; q > 0 ? cart.set(id, q) : cart.delete(id); catalogo(); });
    barraCarrito();
  }
  async function carrito() {
    st.vista = "carrito"; barraCarrito();
    if (!cantEnCarrito()) return catalogo();
    st.entrega = st.entrega || "retiro";
    const e = INFO.entrega;
    const items = [...cart.entries()].map(([id, q]) => ({p: INFO.productos.find(x => K(x.id) === id), q})).filter(x => x.p);
    const envio = st.entrega === "envio" && e.envio ? e.envio.costo : 0;
    const filas = items.map(({p, q}) => `<div class="line"><span class="tx"><b>${esc(p.nombre)}</b><small>${esc(p.precio_txt)}${p.unidad === "m" ? " por metro" : " c/u"}</small></span>
      <div class="qty"><button data-m="${p.id}" aria-label="Quitar uno">−</button><span>${q}</span><button class="add" data-p="${p.id}" ${!p.ilimitado && q >= p.stock ? "disabled" : ""} aria-label="Agregar uno">+</button></div></div>`).join("");
    pantalla("Tu pedido", `<div class="box">${filas}<div class="tot sub"><span>Productos</span><span>${pesos(totalCarrito())}</span></div>${envio ? `<div class="tot sub"><span>Envío</span><span>${pesos(envio)}</span></div>` : ""}<div class="tot"><span>Total</span><span>${pesos(totalCarrito() + envio)}</span></div></div>
      ${e.retiro && e.envio ? `<div class="seg"><button data-e="retiro" class="${st.entrega === "retiro" ? "on" : ""}">Retiro en el local<small>Sin cargo</small></button><button data-e="envio" class="${st.entrega === "envio" ? "on" : ""}">Envío<small>${esc(e.envio.costo_txt)} · ${esc(e.envio.zona || "")}</small></button></div>` : ""}
      <div id="franjas">${cargando(1)}</div>
      <form id="f" novalidate>${camposPersona()}
        ${st.entrega === "envio" ? `<label class="f" for="dir">Dirección de entrega</label><input class="in" id="dir" placeholder="Calle, número y barrio" autocomplete="street-address" value="${esc(st.dir || "")}">` : ""}
        <label class="f" for="nota">Nota (opcional)</label><textarea class="in" id="nota" placeholder="${esc(T("nota_ph") || (INFO.rubro === "mates" ? "¿Lo querés para regalo? ¿Grabado?" : INFO.rubro === "cafe" ? "Sin azúcar, leche descremada…" : "Medidas, color, marca…"))}">${esc(st.nota || "")}</textarea>
        <button class="btn" id="ok">Confirmar pedido · ${pesos(totalCarrito() + envio)}</button>
        <p class="hint" style="text-align:center">${st.entrega === "envio" ? "Pagás al recibir o por transferencia." : ["rotiseria", "restaurante", "heladeria", "cafe"].includes(INFO.rubro) ? "Pagás cuando retirás." : "Pagás cuando retirás. Te guardamos los productos."}</p></form>`, catalogo);
    const guardarCampos = () => { st.dir = $("#dir") ? $("#dir").value : st.dir; st.nota = $("#nota").value; guardado.n = $("#n").value; guardado.t = $("#t").value; };
    app().querySelectorAll("[data-e]").forEach(b => b.onclick = () => { guardarCampos(); st.entrega = b.dataset.e; st.franja = null; carrito(); });
    app().querySelectorAll("[data-p]").forEach(b => b.onclick = () => { guardarCampos(); const id = b.dataset.p; cart.set(id, cart.get(id) + 1); carrito(); });
    app().querySelectorAll("[data-m]").forEach(b => b.onclick = () => { guardarCampos(); const id = b.dataset.m, q = cart.get(id) - 1; q > 0 ? cart.set(id, q) : cart.delete(id); carrito(); });
    let fr = [];
    try { fr = await call("franjas", {entrega: st.entrega}); } catch (er) { /* se muestra vacío */ }
    if (!$("#franjas")) return;
    if (!fr.length) { $("#franjas").innerHTML = `<p class="empty">No hay horarios disponibles por ahora.</p>`; return; }
    if (!st.franjaDia || !fr.find(d => d.fecha === st.franjaDia)) st.franjaDia = fr[0].fecha;
    const pintar = () => {
      const d = fr.find(x => x.fecha === st.franjaDia);
      $("#franjas").innerHTML = `<label class="f">${st.entrega === "envio" ? "¿Cuándo te lo llevamos?" : "¿Cuándo pasás a retirar?"}</label>
        <div class="chips">${fr.map(x => `<button type="button" class="chip ${x.fecha === st.franjaDia ? "on" : ""}" data-fd="${x.fecha}">${esc(x.nombre)}</button>`).join("")}</div>
        <div class="grid">${d.franjas.map(f => `<button type="button" class="slot ${st.franja === f.inicio ? "on" : ""}" data-f="${f.inicio}">${esc(f.hora)}</button>`).join("")}</div>`;
      $("#franjas").querySelectorAll("[data-fd]").forEach(b => b.onclick = () => { st.franjaDia = b.dataset.fd; pintar(); });
      $("#franjas").querySelectorAll("[data-f]").forEach(b => b.onclick = () => { st.franja = b.dataset.f; pintar(); });
    };
    pintar();
    $("#f").onsubmit = async ev => {
      ev.preventDefault();
      if (!st.franja) return error(st.entrega === "envio" ? "Elegí cuándo te lo llevamos." : "Elegí cuándo pasás a retirar.");
      await enviar("pedir", {items: items.map(({p, q}) => ({producto: p.id, cant: q})), entrega: st.entrega, inicio: st.franja, nombre: $("#n").value.trim(), telefono: $("#t").value.trim(),
                             direccion: $("#dir") ? $("#dir").value.trim() : "", nota: $("#nota").value.trim(), web: $("#web").value},
        async er => { if (er.tipo === "ocupado") { st.franja = null; return carrito(); } if (er.tipo === "stock") { INFO = await call("info"); items.forEach(({p}) => { const np = INFO.productos.find(x => K(x.id) === K(p.id)); if (np && !np.ilimitado && cart.get(K(p.id)) > np.stock) np.stock > 0 ? cart.set(K(p.id), np.stock) : cart.delete(K(p.id)); }); } });
    };
  }

  // ── Estadías ──────────────────────────────────────────────────────
  const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const sumar = (f, n) => { const d = new Date(f + "T12:00:00"); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const corta = f => new Date(f + "T12:00:00").toLocaleDateString("es-AR", {weekday: "short", day: "numeric", month: "numeric"});
  function fechas() {
    const cfg = INFO.estadia || {}, mn = cfg.min_noches || 1;
    st.desde = st.desde || sumar(hoyISO(), 7); st.hasta = st.hasta && st.hasta > st.desde ? st.hasta : sumar(st.desde, Math.max(mn, 2)); st.personas = st.personas || 2;
    const maxP = Math.max(...INFO.unidades.map(u => u.capacidad));
    pantalla("¿Cuándo venís?", `<form id="f" novalidate>
      <div class="seg" style="margin-bottom:0"><label class="f" style="margin:0">Entrada<input class="in" type="date" id="d1" min="${hoyISO()}" value="${st.desde}"></label>
      <label class="f" style="margin:0">Salida<input class="in" type="date" id="d2" min="${sumar(hoyISO(), 1)}" value="${st.hasta}"></label></div>
      <p class="hint" id="rango" style="margin:8px 0 0;font-weight:600;color:inherit"></p>
      <label class="f">¿Cuántas personas?</label><div class="chips">${[...Array(maxP)].map((_, i) => `<button type="button" class="chip ${st.personas === i + 1 ? "on" : ""}" data-pp="${i + 1}">${i + 1}</button>`).join("")}</div>
      <p class="hint">Entrada desde las ${esc(cfg.checkin || "14:00")} · salida hasta las ${esc(cfg.checkout || "10:00")}${mn > 1 ? ` · mínimo ${mn} noches` : ""}.</p>
      <button class="btn" id="ok">Ver disponibilidad</button></form>`);
    const rango = () => { const k = Math.round((new Date(st.hasta + "T12:00") - new Date(st.desde + "T12:00")) / 864e5);
      $("#rango").textContent = st.desde && st.hasta && k > 0 ? `Del ${corta(st.desde)} al ${corta(st.hasta)} · ${k} noche${k > 1 ? "s" : ""}` : "Elegí una salida posterior a la entrada"; };
    rango();
    $("#d1").onchange = e => { st.desde = e.target.value; if (st.hasta <= st.desde) { st.hasta = sumar(st.desde, Math.max(mn, 2)); $("#d2").value = st.hasta; } rango(); };
    $("#d2").onchange = e => { st.hasta = e.target.value; rango(); };
    app().querySelectorAll("[data-pp]").forEach(b => b.onclick = () => { st.personas = +b.dataset.pp; app().querySelectorAll("[data-pp]").forEach(x => x.classList.toggle("on", x === b)); });
    $("#f").onsubmit = e => { e.preventDefault(); unidades(); };
  }
  async function unidades() {
    let us;
    try { us = await call("disponibilidad", {desde: st.desde, hasta: st.hasta, personas: st.personas}); } catch (e) { return error(e.message); }
    const k = us[0] ? us[0].noches : 0;
    us.sort((a, b) => (b.libre - a.libre));
    pantalla("Elegí dónde", resumen([`<b>${esc(corta(st.desde))} → ${esc(corta(st.hasta))}</b>`, `<span>${k} noche${k > 1 ? "s" : ""}</span>`, `<span>${st.personas} persona${st.personas > 1 ? "s" : ""}</span>`]) +
      `<div class="list">${us.map(u => `<button class="opt" data-u="${u.id}" ${u.libre ? "" : "disabled"}><span class="av" style="background:${u.libre ? "#1F8A5B" : "#9AA0AC"}">🏡</span><span class="tx"><b>${esc(u.nombre)}</b>
        <small>${esc(u.desc || "")} · hasta ${u.capacidad} personas</small><small>${u.libre ? `${esc(u.precio_txt)} por noche · seña ${esc(u.sena_txt)}` : esc(u.motivo)}</small></span><span class="pr">${u.libre ? esc(u.total_txt) : ""}</span></button>`).join("")}</div>
      ${us.some(u => u.libre) ? "" : `<p class="empty">No hay lugar para esas fechas. Probá otras o escribinos.</p>`}`, fechas);
    app().querySelectorAll("[data-u]").forEach(b => b.onclick = () => datosEstadia(us.find(u => K(u.id) === b.dataset.u)));
  }
  function datosEstadia(u) {
    st.u = u;
    pantalla("Tus datos", resumen([`<b>${esc(u.nombre)}</b>`, `<span>${esc(corta(st.desde))} → ${esc(corta(st.hasta))}</span>`, `<span>${esc(u.total_txt)}</span>`]) +
      `<form id="f" novalidate>${camposPersona()}<label class="f" for="nota">¿Algo que tengamos que saber? (opcional)</label><textarea class="in" id="nota" placeholder="Llegamos tarde, venimos con mascota…"></textarea>
       <div class="info">Para confirmar la reserva transferís la seña de <b>${esc(u.sena_txt)}</b> dentro de las 24 h. El resto lo pagás al llegar.</div>
       <button class="btn" id="ok">Reservar</button></form>`, unidades);
    $("#f").onsubmit = async ev => {
      ev.preventDefault();
      await enviar("reservarEstadia", {unidad: u.id, desde: st.desde, hasta: st.hasta, personas: st.personas, nombre: $("#n").value.trim(), telefono: $("#t").value.trim(), nota: $("#nota").value.trim(), web: $("#web").value},
        e => { if (e.tipo === "ocupado") unidades(); });
    };
  }

  // ── Enviar y confirmar ────────────────────────────────────────────
  async function enviar(metodo, p, alFallar, extraErr) {
    const b = $("#ok"), txt = b.textContent;
    document.querySelectorAll(".err").forEach(e => e.remove());
    if (!p.nombre || p.nombre.length < 2) return error("Escribí tu nombre.");
    if ((p.telefono || "").replace(/\D/g, "").length < 10) return error("Revisá el celular: código de área y número. Ej: 387 612 4879");
    b.disabled = true; b.textContent = "Enviando…";
    try {
      const r = await call(metodo, p);
      recordar(p.nombre, p.telefono);
      if (metodo === "pedir") { cart.clear(); st.vista = "listo"; barraCarrito(); }
      listo(r);
    } catch (e) {
      b.disabled = false; b.textContent = txt;
      error(e.message, extraErr ? extraErr(e) : "");
      if (e.tipo === "ocupado" && alFallar) setTimeout(() => alFallar(e), 1600);
      else if (alFallar && e.tipo === "stock") { await alFallar(e); carrito(); setTimeout(() => error(e.message), 50); }
    }
  }
  function listo(r) {
    const cancelar = NOA.esDemo ? `${location.pathname}?demo=${NOA.demo}&c=${r.codigo}` : `${location.origin}/c/${r.codigo}`;
    const tit = {pedido: "¡Pedido recibido!", clase: "¡Lugar reservado!", estadia: "¡Reserva tomada!"}[r.tipo] || (["cafe", "restaurante"].includes(INFO.rubro) ? "¡Mesa reservada!" : INFO.rubro === "canchas" ? "¡Cancha reservada!" : INFO.rubro === "inmobiliaria" ? "¡Visita coordinada!" : INFO.rubro === "estudio" ? "¡Reunión agendada!" : "¡Turno confirmado!");
    pantalla("", `<div class="done"><div class="ok">✓</div><h2>${tit}</h2>
      <div class="det"><div><b>${esc(r.titulo)}</b>${r.precio ? " · " + esc(r.precio) : ""}</div><div>${r.tipo === "pedido" ? "" : "El "}${esc(r.cuando)}</div>${(r.detalle || []).map(d => `<div>${esc(d)}</div>`).join("")}</div></div>
      ${r.avisar ? `<a class="btn wa" href="${esc(r.avisar)}" target="_blank" rel="noopener">${r.tipo === "estadia" ? "Mandar el comprobante por WhatsApp" : "Avisar al negocio por WhatsApp"}</a>` : ""}
      <a class="btn sec" href="${esc(cancelar)}">${r.tipo === "pedido" ? "Cancelar el pedido" : r.tipo === "estadia" ? "Cancelar la reserva" : "Si no podés ir, cancelalo acá"}</a>
      <button class="btn sec" id="otra">${r.tipo === "pedido" ? "Seguir comprando" : "Hacer otra reserva"}</button>`);
    $(".head").remove();
    $("#otra").onclick = () => ir(TAB);
  }

  // ── Cancelar ──────────────────────────────────────────────────────
  async function cancelar(cod) {
    $("#tabs").innerHTML = "";
    let r;
    try { r = await call("reserva", {codigo: cod}); } catch (e) { pantalla("No encontramos esa reserva", `<p class="empty">Revisá el link o escribile al negocio.</p>`); return; }
    if (r.estado !== "confirmado") { pantalla("Esta reserva ya no está activa", `<div class="sum"><b>${esc(r.titulo)}</b><span>${esc(r.cuando)}</span><span>${esc(r.estado)}</span></div>`); return; }
    pantalla(r.tipo === "pedido" ? "¿Cancelás el pedido?" : "¿Cancelás tu reserva?", `<div class="sum"><b>${esc(r.titulo)}</b><span>El ${esc(r.cuando)}</span></div>
      <button class="btn" id="si" style="background:var(--crit)">Sí, cancelar</button><a class="btn sec" href="${NOA.esDemo ? `?demo=${NOA.demo}` : "/r/" + (NOA.slug || "")}">No, volver</a>`);
    $("#si").onclick = async () => {
      try { await call("cancelarReserva", {codigo: cod}); pantalla("Listo, cancelado", `<p class="empty">Liberamos el lugar. ¡Gracias por avisar!</p>${NOA.esDemo ? `<a class="btn sec" href="?demo=${NOA.demo}">Volver</a>` : ""}`); }
      catch (e) { error(e.message); }
    };
  }

  inicio();
})();
