/* NOA Labs · backend de demostración que corre en el navegador.
   Implementa las mismas reglas que el servidor Python (agenda, cupos, stock, caja)
   para que las demos de la web sean el sistema real con datos de ejemplo.
   Se instala en window.NOA_DEMO y lo usan cliente.html y panel.html. */
(function () {
  "use strict";
  const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
  const DC = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const pad = n => String(n).padStart(2, "0");
  const fdia = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fiso = d => `${fdia(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  const parse = s => { const [a, b = "00:00"] = s.split("T"); const [y, m, dd] = a.split("-").map(Number); const [h, mi] = b.split(":").map(Number); return new Date(y, m - 1, dd, h, mi); };
  const hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const wd = d => (d.getDay() + 6) % 7;
  const addMin = (d, m) => new Date(d.getTime() + m * 60000);
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const atTime = (d, t) => { const [h, m] = t.split(":").map(Number); const x = new Date(d); x.setHours(h, m, 0, 0); return x; };
  const pesos = n => "$" + Math.round(n).toLocaleString("es-AR");
  const larga = d => `${DIAS[wd(d)]} ${d.getDate()}/${d.getMonth() + 1} a las ${hm(d)}`;
  const nombreDia = (d, hoy) => { const a = fdia(d), h = fdia(hoy); if (a === h) return "Hoy"; if (a === fdia(addDays(hoy, 1))) return "Mañana"; return `${DC[wd(d)]} ${d.getDate()}/${d.getMonth() + 1}`; };
  const codigo = () => Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 8);
  const titulo = s => s.trim().toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase()).slice(0, 60);
  class Err extends Error { constructor(m, tipo) { super(m); this.tipo = tipo; } }

  // ── Precios (mismas reglas que el servidor) ──
  // Turno: si viene por obra social, el coseguro de esa cobertura; si no, la tarifa de ese día y horario o el precio del servicio.
  // tarifas del servicio: [{dias: [0..6] (vacío = todos), desde: "18:00", hasta: "24:00", precio}]
  function precioTurno(n, s, ini, cobertura) {
    const cobs = (n.coberturas || []).filter(o => o.activo !== false);
    if (cobertura && cobertura !== "particular") {
      const o = cobs.find(x => String(x.id) === String(cobertura));
      if (!o) throw new Err("Elegí con qué te atendés: particular o tu obra social.", "dato");
      return {precio: o.coseguro || 0, cobertura: o.nombre};
    }
    const h = hm(ini), w = wd(ini);
    const t = (s.tarifas || []).find(t => (!t.dias || !t.dias.length || t.dias.includes(w)) && h >= t.desde && h < t.hasta);
    return {precio: t ? t.precio : s.precio, cobertura: cobs.length ? "Particular" : null};
  }
  const DIAS_TXT = d => !d || !d.length || d.length === 7 ? "Todos los días" : d.length === 5 && [0, 1, 2, 3, 4].every(x => d.includes(x)) ? "Lunes a viernes"
    : d.length === 2 && d.includes(5) && d.includes(6) ? "Sábados y domingos" : d.map(x => ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][x]).join(", ");
  const tarifaTxt = t => `${DIAS_TXT(t.dias)} de ${t.desde} a ${t.hasta}`;
  // Estadía: precio de cada noche con la temporada (recargo o descuento en %) y el fin de semana (noches de viernes y sábado).
  function precioNoches(n, u, desde, hasta) {
    const cfg = n.estadia || {}, out = [];
    for (let d = parse(desde); fdia(d) < hasta; d = addDays(d, 1)) {
      const f = fdia(d), tags = []; let p = u.precio;
      const t = (cfg.temporadas || []).find(t => f >= t.desde && f <= t.hasta);
      if (t && t.recargo) { p *= 1 + t.recargo / 100; tags.push(t.nombre); }
      if (cfg.finde && [4, 5].includes(wd(d))) { p *= 1 + cfg.finde / 100; tags.push("fin de semana"); }
      out.push({fecha: f, precio: Math.round(p / 100) * 100, tags});
    }
    const g = {}; out.forEach(x => { const k = x.precio + "|" + x.tags.join("+"); (g[k] = g[k] || {precio: x.precio, tags: x.tags, n: 0}).n++; });
    const grupos = Object.values(g);
    const detalle = grupos.length > 1 || out.some(x => x.tags.length) ? grupos.map(x => `${x.n} noche${x.n > 1 ? "s" : ""}${x.tags.length ? " de " + x.tags.join(" y ") : ""} a ${pesos(x.precio)}`) : [];
    return {total: out.reduce((a, x) => a + x.precio, 0), noches: out, detalle};
  }

  // ── Planes de socios (gimnasio, danza, clubes) ──
  // {id, nombre, precio, dias (vigencia), actividades: [ids] (vacío = todas), por_semana (null = libre), clases (pack de N), suelta (se paga por clase)}
  function detallePlan(p, acts) {
    if (p.suelta) return "Una clase, la pagás en recepción";
    const a = p.actividades && p.actividades.length ? p.actividades.map(x => (acts.find(y => y.id == x) || {}).nombre).filter(Boolean).join(", ") : "Todas las actividades";
    const f = p.clases ? `${p.clases} clases` : p.por_semana ? `${p.por_semana} ${p.por_semana === 1 ? "vez" : "veces"} por semana` : "libre";
    const d = p.dias === 30 || !p.dias ? "por mes" : `por ${p.dias} días`;
    return `${a} · ${f} · ${d}`;
  }

  // ── Personal: el horario de cada día de una persona (mismas reglas que el servidor) ──
  // horario = {"0": [["09:00","13:00"],["16:00","20:00"]], ...} por día de la semana (0 = lunes).
  // personalDias = excepciones de una fecha: {persona, fecha, tipo: trabaja|franco|vacaciones|licencia, tramos, nota}.
  const TIPOS_P = {trabaja: "Trabaja", franco: "Franco", vacaciones: "Vacaciones", licencia: "Licencia"};
  const minutos = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const horasTramos = tr => tr.reduce((a, [x, y]) => a + (minutos(y) - minutos(x)) / 60, 0);
  function diaPersona(S, p, f) {
    const x = (S.personalDias || []).find(e => e.persona == p.id && e.fecha === f);
    if (x) return {tipo: x.tipo, tramos: x.tipo === "trabaja" ? x.tramos : [], nota: x.nota || "", cambiado: true};
    const tr = (p.horario || {})[String(wd(parse(f)))] || [];
    return {tipo: tr.length ? "trabaja" : "franco", tramos: tr, nota: "", cambiado: false};
  }
  function validarTramos(tr) {
    if (!Array.isArray(tr) || !tr.length || tr.length > 3) throw new Err("Poné el horario de entrada y salida.", "dato");
    const ok = tr.map(([a, b]) => [String(a || ""), String(b || "")]);
    for (const [a, b] of ok) {
      if (!/^\d{2}:\d{2}$/.test(a) || !/^\d{2}:\d{2}$/.test(b)) throw new Err("Poné las horas completas, por ejemplo 09:00.", "dato");
      if (minutos(b) <= minutos(a)) throw new Err(`La salida tiene que ser después de la entrada (${a} a ${b}).`, "dato");
    }
    ok.sort((x, y) => minutos(x[0]) - minutos(y[0]));
    for (let i = 1; i < ok.length; i++) if (minutos(ok[i][0]) < minutos(ok[i - 1][1])) throw new Err("Los dos turnos del día se superponen.", "dato");
    return ok;
  }

  function normTel(t) {
    let d = String(t || "").replace(/\D/g, "");
    if (d.startsWith("549")) d = d.slice(3); else if (d.startsWith("54")) d = d.slice(2);
    d = d.replace(/^0+/, "");
    if (d.length === 12) for (const n of [2, 3, 4]) if (d.slice(n, n + 2) === "15") { d = d.slice(0, n) + d.slice(n + 2); break; }
    return d.length === 10 ? "549" + d : null;
  }

  // ── Motor ─────────────────────────────────────────────────────────
  // Qué no puede hacer cada rol (mismo criterio que el servidor). El dueño puede todo.
  const ROLES = ["dueño", "encargado", "empleado"];
  const SOLO_DUENO_M = new Set(["caja", "movimiento", "numeros", "usuarios", "agregarUsuario", "cambiarUsuario", "aumentarPrecios", "actividad", "gastos", "agregarGasto", "cambiarGasto", "pagarGasto", "margenes", "comisiones", "pagarComision", "resumen"]);
  const NO_EMPLEADO_M = new Set(["catalogo", "editar", "agregarProducto", "agregarServicio", "agregarTarifa", "editarTarifa", "quitarTarifa", "agregarCobertura", "agregarPlan",
    "promos", "agregarPromo", "estadoPromo", "pedirCumple", "guardarConfig", "cerrarDia", "guardarFinde", "agregarTemporada", "quitarTemporada", "guardarIcal", "sincronizarIcal",
    "proveedores", "agregarProveedor", "asignarProveedor", "agregarPersona", "guardarDia", "ausencia", "volverBase", "quitarPersona"]);
  // Qué queda anotado en el registro de actividad (lo demás son consultas)
  const ACCION_M = {reservarTurno: "Cargó un turno", cancelarSerie: "Canceló un turno fijo", estadoTurno: "Cambió el estado de un turno", inscribir: "Anotó a alguien en una clase",
    asistencia: "Tomó asistencia", cobrarClase: "Cobró una clase suelta", estadoPedido: "Cambió el estado de un pedido", ajustarStock: "Movió el stock", ventaMostrador: "Registró una venta en el local",
    movimiento: "Cargó un movimiento en la caja", pagarCuota: "Registró el pago de una cuota", agregarSocio: "Dio de alta un socio", reservarEstadia: "Cargó una reserva de estadía",
    estadoEstadia: "Cambió una estadía", editar: "Cambió un dato del catálogo", agregarServicio: "Agregó un servicio", agregarProducto: "Agregó un producto", agregarTarifa: "Cambió los precios por horario",
    editarTarifa: "Cambió los precios por horario", quitarTarifa: "Cambió los precios por horario", aumentarPrecios: "Subió los precios", agregarPersona: "Cambió los horarios del personal",
    guardarDia: "Cambió los horarios del personal", ausencia: "Cargó una ausencia del personal", volverBase: "Cambió los horarios del personal", quitarPersona: "Dio de baja a alguien del personal",
    agregarPromo: "Creó un código de descuento", estadoPromo: "Cambió un código de descuento", agregarUsuario: "Creó un usuario", cambiarUsuario: "Cambió un usuario", cerrarDia: "Cambió los días cerrados",
    guardarConfig: "Cambió la configuración", avisarEspera: "Avisó a alguien de la lista de espera", quitarEspera: "Quitó a alguien de la lista de espera", marcarResena: "Pidió una reseña u opinión",
    cerrarCaja: "Cerró la caja", pagarComision: "Pagó una comisión", agregarPresupuesto: "Armó un presupuesto", estadoPresupuesto: "Cambió un presupuesto", agregarFiado: "Fió a un cliente", pagarFiado: "Cobró una cuenta", agregarGasto: "Agregó un gasto fijo", pagarGasto: "Pagó un gasto fijo", cambiarGasto: "Cambió un gasto fijo", agregarProveedor: "Agregó un proveedor",
    asignarProveedor: "Cambió el proveedor de un producto", marcarVuelta: "Le avisó que le toca volver", agregarCobertura: "Agregó una obra social", agregarPlan: "Agregó un plan",
    guardarFinde: "Cambió el recargo de fin de semana", agregarTemporada: "Agregó una temporada", quitarTemporada: "Quitó una temporada", pedirCumple: "Cambió la configuración"};
  const puedeRol = (rol, m) => rol === "dueño" || (!SOLO_DUENO_M.has(m) && (rol === "encargado" || !NO_EMPLEADO_M.has(m)));
  function crear(seed) {
    let ROL = "dueño", DETALLE_D = null;
    const S = seed();
    ['servicios', 'productos', 'clases', 'actividades', 'turnos', 'inscripciones', 'pedidos', 'estadias', 'unidades', 'bloqueos', 'socios', 'movimientos'].forEach(k => S[k] = S[k] || []);
    const n = S.negocio;
    const subs = [];
    let ids = 1000;
    S.numPedido = S.numPedido || 1000;
    const id = () => ++ids;
    const ahora = () => new Date();
    const emit = (tipo, data) => subs.forEach(f => { try { f(tipo, data); } catch (e) { console.error(e); } });

    const horariosDia = d => (n.cierres || []).includes(fdia(d)) ? [] : n.horarios.filter(h => h.dia === wd(d));
    const cliente = (nombre, tel, acepta = true) => {
      let c = S.clientes.find(x => x.telefono === tel);
      if (!c) { c = {id: id(), telefono: tel, nombre: titulo(nombre), acepta, alta: fiso(ahora())}; S.clientes.push(c); }
      else { c.nombre = titulo(nombre) || c.nombre; c.acepta = acepta; }
      return c;
    };
    const futuros = cid => S.turnos.filter(t => t.cliente === cid && t.estado === "confirmado" && parse(t.inicio) > ahora()).length
      + S.inscripciones.filter(i => i.cliente === cid && i.estado === "confirmado" && parse(i.inicio) > ahora()).length;
    const serv = sid => { const s = S.servicios.find(x => x.id == sid); if (!s) throw new Err("Ese servicio no existe."); return s; };
    const pros = () => S.profesionales || [];
    const personas = () => (S.personal || []).filter(p => p.activo !== false);
    const personaDePro = proId => personas().find(p => p.pro != null && p.pro == proId);
    const proTrabaja = (proId, ini, fin) => {
      const p = personaDePro(proId); if (!p) return true;
      const d = diaPersona(S, p, fdia(ini));
      return d.tipo === "trabaja" && d.tramos.some(([a, b]) => atTime(ini, a) <= ini && fin <= atTime(ini, b));
    };
    const prosDe = s => pros().filter(p => !s.pros || !s.pros.length || s.pros.includes(p.id));
    const duracion = (s, modalidad) => s.min + (modalidad === "domicilio" ? (s.margen || 0) : 0);
    const ocupa = (p, ini, fin) => S.turnos.some(t => t.estado === "confirmado" && t.pro === p && parse(t.inicio) < fin && parse(t.fin) > ini);
    const concurrentes = (ini, fin) => {
      const ts = S.turnos.filter(t => t.estado === "confirmado" && parse(t.inicio) < fin && parse(t.fin) > ini);
      const pts = [ini, ...ts.map(t => parse(t.inicio)).filter(x => x > ini && x < fin)];
      return Math.max(0, ...pts.map(p => ts.filter(t => parse(t.inicio) <= p && parse(t.fin) > p).length));
    };

    function libres(s, dia, proId, modalidad) {
      const d = typeof dia === "string" ? parse(dia) : dia;
      const dur = duracion(s, modalidad), paso = n.paso || 30, min = addMin(ahora(), n.anticipacion ?? 60);
      const cand = pros().length ? prosDe(s).filter(p => !proId || p.id == proId).filter(p => personaDePro(p.id) || !p.dias || p.dias.includes(wd(d)))
        .filter(p => !p.modalidad || p.modalidad === "ambos" || p.modalidad === (modalidad || "local")) : null;
      const out = [];
      for (const f of horariosDia(d)) {
        for (let t = atTime(d, f.desde); addMin(t, dur) <= atTime(d, f.hasta); t = addMin(t, paso)) {
          if (t < min) continue;
          const fin = addMin(t, dur);
          if (cand) { const p = cand.find(p => !ocupa(p.id, t, fin) && proTrabaja(p.id, t, fin)); if (p) out.push({inicio: fiso(t), hora: hm(t), pro: p.id}); }
          else if (concurrentes(t, fin) < (n.capacidad || 1)) out.push({inicio: fiso(t), hora: hm(t)});
        }
      }
      return out;
    }

    // ── Clases ─────────────────────────────────────────────────────
    const actividad = aid => S.actividades.find(a => a.id == aid);
    function ocurrencias(dias = 7) {
      const hoy = ahora(), out = [];
      for (let i = 0; i < dias; i++) {
        const d = addDays(hoy, i);
        if ((n.cierres || []).includes(fdia(d))) continue;
        for (const c of S.clases.filter(c => c.activa !== false && c.dias.includes(wd(d)))) {
          const ini = atTime(d, c.hora);
          if (ini < addMin(hoy, n.anticipacion_clase ?? 15)) continue;
          const insc = S.inscripciones.filter(x => x.clase === c.id && x.fecha === fdia(d) && x.estado === "confirmado");
          const a = actividad(c.actividad);
          out.push({id: `${c.id}|${fdia(d)}`, clase: c.id, fecha: fdia(d), inicio: fiso(ini), hora: c.hora, dia: nombreDia(d, hoy),
                    actividad: a.id, nombre: a.nombre, color: a.color, min: c.min, profe: c.profe, cupo: c.cupo, ocupados: insc.length});
        }
      }
      return out.sort((a, b) => a.inicio.localeCompare(b.inicio));
    }
    const socioDe = tel => (S.socios || []).find(s => s.telefono === tel);
    // ── Promos: códigos de descuento con %, vigencia, tope de usos y una vez por cliente ──
    const AREAS = {turnos: "Turnos y reservas", pedidos: "Pedidos", estadias: "Estadías"};
    const promoVigente = (pr, area) => pr.activo !== false && (!area || (pr.aplica || []).includes(area)) && (!pr.hasta || pr.hasta >= fdia(ahora())) &&
                                       (!pr.desde || pr.desde <= fdia(ahora())) && (!pr.usos_max || (pr.usos || 0) < pr.usos_max);
    function buscarPromo(cod, area, tel) {
      cod = String(cod || "").trim().toUpperCase(); if (!cod) return null;
      const pr = (n.promos || []).find(x => x.codigo === cod);
      if (!pr || !promoVigente(pr, area)) throw new Err(pr && pr.activo !== false && !(pr.aplica || []).includes(area) ? "Ese código no sirve para esto." : "Ese código no existe o ya no está vigente.", "codigo");
      if (tel && pr.una_vez !== false) { const c = S.clientes.find(x => x.telefono === tel); if (c && (pr.usados || []).includes(c.id)) throw new Err("Ya usaste ese código.", "codigo"); }
      return pr;
    }
    // Cuántos días faltan para el cumple y el saludo listo (con el código de cumpleaños, si el negocio armó uno).
    const cumpleDe = c => {
      if (!c.cumple) return {cumple: null};
      const [mm, dd] = c.cumple.split("-").map(Number), h = ahora(), hoy0 = new Date(h.getFullYear(), h.getMonth(), h.getDate());
      let prox = new Date(h.getFullYear(), mm - 1, dd); if (prox < hoy0) prox = new Date(h.getFullYear() + 1, mm - 1, dd);
      const faltan = Math.round((prox - hoy0) / 864e5), pc = (n.promos || []).find(x => x.cumple && promoVigente(x));
      const nom = (c.nombre || "").split(" ")[0];
      return {cumple: `${pad(dd)}/${pad(mm)}`, cumple_en: faltan,
              saludo: faltan <= 7 ? `https://wa.me/${c.telefono}?text=${encodeURIComponent(`¡${faltan === 0 ? "Feliz cumple" : "Se viene tu cumple"}, ${nom}! 🎉 Te saludamos de ${n.nombre}.${pc ? ` De regalo tenés ${pc.pct}% de descuento con el código ${pc.codigo}${pc.hasta ? ` hasta el ${pc.hasta.slice(8)}/${pc.hasta.slice(5, 7)}` : ""}. Usalo acá: ${n.link || ""}` : ""}`)}` : null};
    };
    const usarPromo = (pr, c) => { if (!pr) return; pr.usos = (pr.usos || 0) + 1; pr.usados = [...(pr.usados || []), c.id]; };
    const descuento = (pr, monto) => pr ? Math.round(monto * pr.pct / 100) : 0;
    // Cumpleaños "dd/mm" → "MM-DD"
    const leerCumple = x => { const m = String(x || "").trim().match(/^(\d{1,2})[\/\-. ](\d{1,2})$/); if (!m) return null; const d = +m[1], mm = +m[2];
      if (mm < 1 || mm > 12 || d < 1 || d > [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mm - 1]) return null; return `${pad(mm)}-${pad(d)}`; };
    const guardarCumple = (c, x) => { if (!x) return; const v = leerCumple(x); if (!v) throw new Err("Revisá el cumpleaños: día/mes, por ejemplo 15/03.", "dato"); c.cumple = v; };
    // Entradas vigentes de la lista de espera: de hoy en adelante, que nadie quitó y que la persona no reservó por su cuenta.
    const esperando = () => (S.espera || []).filter(e => e.estado !== "quitado" && e.fecha >= fdia(ahora()) &&
      !(e.ocurrencia ? S.inscripciones.some(i => `${i.clase}|${i.fecha}` === e.ocurrencia && i.cliente === e.cliente && i.estado === "confirmado")
                     : S.turnos.some(t => t.servicio === e.servicio && t.cliente === e.cliente && t.inicio.slice(0, 10) === e.fecha && t.estado !== "cancelado")));
    // Reseña en Google: el link de WhatsApp para pedirla, si el negocio cargó su link y a ese cliente no se le pidió en los últimos 120 días.
    // Después de la visita: el link a la encuesta de satisfacción (si no se le pidió en los últimos 120 días)
    const urlEncuesta = tok => { try { return new URL(`../app/cliente.html?demo=${n._demo}&e=${tok}`, location.href).href; } catch (e) { return `cliente.html?demo=${n._demo}&e=${tok}`; } };
    const resenaLink = c => !c || !c.telefono || (c.resena && (ahora() - parse(c.resena)) < 864e5 * 120) ? null
      : `https://wa.me/${c.telefono}?text=${encodeURIComponent(`¡Hola ${(c.nombre || "").split(" ")[0]}! Gracias por elegir ${n.nombre} 🙌 ¿Nos contás en 10 segundos cómo te fue? ${urlEncuesta("c" + c.id)}`)}`;
    const planes = () => (n.planes || []).filter(p => p.activo !== false);
    const planDe = so => (so && (n.planes || []).find(p => p.id == so.plan)) || null;
    const sueltaPlan = () => planes().find(p => p.suelta) || null;
    const vencePlan = (desde, pl) => { if (!pl || !pl.dias || pl.dias === 30) { const v = new Date(desde); v.setMonth(v.getMonth() + 1); return v; } return addDays(desde, pl.dias); };

    // ── Productos ──────────────────────────────────────────────────
    const prod = pid => S.productos.find(p => p.id == pid);
    const ent = () => n.entrega || {};
    // Pedidos para retirar que nadie vino a buscar: pasado el tiempo que guarda el negocio, vencen y vuelven al stock.
    const guardar = () => { const r = ent().retiro || {}; return {h: r.guardar_horas ?? 24, min: r.min || 30}; };
    const guardadoHasta = inicio => { const g = guardar(); return addMin(parse(inicio), g.min + g.h * 60); };
    const mpOk = () => !!(n.mp && n.mp.conectado);
    const presDict = p => {
      const c = S.clientes.find(x => x.id === p.cliente) || {}, estado = p.estado === "enviado" && p.validez < fdia(ahora()) ? "vencido" : p.estado;
      const auto = [p.auto, p.patente ? `(${p.patente})` : ""].filter(Boolean).join(" ");
      // En la demo cada pestaña tiene sus propios datos: el link lleva el presupuesto para que se vea en una pestaña nueva
      const datos = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify({n: p.numero, c: c.nombre, a: p.auto, pa: p.patente, i: p.items, v: p.validez, o: p.nota, e: p.estado})))));
      let link; try { link = new URL(`../app/cliente.html?demo=${n._demo}&pr=${p.codigo}&prd=${datos}`, location.href).href; } catch (e) { link = `cliente.html?demo=${n._demo}&pr=${p.codigo}&prd=${datos}`; }
      const msg = `¡Hola ${(c.nombre || "").split(" ")[0]}! Te paso el presupuesto N° ${p.numero} de ${n.nombre}${auto ? ` para tu ${auto}` : ""}: ${pesos(p.total)}. Lo ves completo y lo aceptás acá: ${link}`;
      return {...p, cliente: c.nombre, telefono: c.telefono, total_txt: pesos(p.total), estado, link, enviar: `https://wa.me/${c.telefono}?text=${encodeURIComponent(msg)}`};
    };
    const quienD = () => ROL === "dueño" ? "Dueño" : ROL === "encargado" ? "Lucho (ejemplo)" : "Caro (ejemplo)";
    const faltasDe = cid => (S.turnos || []).filter(t => t.cliente === cid && t.estado === "ausente" && (ahora() - parse(t.inicio)) < 864e5 * 180).length;
    function vencer() {
      for (const t of S.turnos || []) if (t.sena && !t.sena_pagada && t.estado === "confirmado" && parse(t.sena_vence) < ahora()) { t.estado = "cancelado"; emit("cancelado", t); }
      if (!ent().retiro || !S.pedidos) return;
      for (const p of S.pedidos) {
        if (p.entrega === "retiro" && ["reservado", "listo"].includes(p.estado) && guardadoHasta(p.inicio) < ahora()) {
          p.estado = "vencido"; p.nuevo = false;
          p.items.forEach(it => { const pr = prod(it.producto); if (pr && pr.stock != null) pr.stock += it.cant; });
          emit("vencido", p);
        }
      }
    }
    function franjas(tipo) {
      const e = ent(), cfg = tipo === "envio" ? e.envio : e.retiro;
      if (!cfg) return [];
      const hoy = ahora(), out = [];
      for (let i = 0; i < (cfg.dias || 4); i++) {
        const d = addDays(hoy, i), slots = [];
        for (const f of horariosDia(d)) {
          for (let t = atTime(d, f.desde); addMin(t, cfg.min) <= atTime(d, f.hasta); t = addMin(t, cfg.min)) {
            if (t < addMin(hoy, cfg.anticipacion)) continue;
            const usados = S.pedidos.filter(p => p.estado !== "cancelado" && p.entrega === tipo && p.inicio === fiso(t)).length;
            if (usados < cfg.cupo) slots.push({inicio: fiso(t), hora: cfg.min >= 60 ? `${hm(t)} a ${hm(addMin(t, cfg.min))}` : hm(t)});
          }
        }
        if (slots.length) out.push({fecha: fdia(d), nombre: nombreDia(d, hoy), franjas: slots});
      }
      return out;
    }

    // ── Estadías (cabañas, hostels, alquiler temporario) ───────────
    const unidad = uid => (S.unidades || []).find(u => u.id == uid);
    const fechaCorta = f => { const d = parse(f); return `${DC[wd(d)].toLowerCase()} ${d.getDate()}/${d.getMonth() + 1}`; };
    const noches = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
    const vigente = e => e.estado !== "cancelada" && !(e.estado === "pendiente" && (ahora() - parse(e.creado)) > 864e5);
    const bloqueada = (uid, desde, hasta) => (S.bloqueos || []).some(b => b.unidad == uid && b.desde < hasta && b.hasta > desde);
    const ocupada = (uid, desde, hasta, salvo) => bloqueada(uid, desde, hasta) || (S.estadias || []).some(e => e.unidad == uid && e.id !== salvo && vigente(e) && e.desde < hasta && e.hasta > desde);
    const origenIcal = url => /booking\./i.test(url) ? "Booking" : /airbnb\./i.test(url) ? "Airbnb" : /expedia|vrbo|despegar/i.test(url) ? "Otra plataforma" : "Calendario externo";

    // ── Caja ───────────────────────────────────────────────────────
    function estadoCaja() {
      const ult = (S.arqueos || [])[0], fondo = ult ? ult.contado - ult.retiro : 0;
      const desde = ult ? ult.cuando : `${fdia(ahora())}T00:00:00`;
      const ms = S.movimientos.filter(m => m.fecha > desde), suma = (t, md) => ms.filter(m => m.tipo === t && m.medio === md).reduce((a, m) => a + m.monto, 0);
      const ing = suma("ingreso", "Efectivo"), egr = suma("egreso", "Efectivo");
      const otros = [...new Set(ms.map(m => m.medio).filter(md => md !== "Efectivo"))].sort().map(md => ({medio: md, ingresos: suma("ingreso", md), egresos: suma("egreso", md)}));
      return {desde, fondo, ing, egr, esperado: fondo + ing - egr, otros};
    }
    const mov = (tipo, concepto, monto, cat, medio = "Efectivo", fecha = fiso(ahora())) => {
      const m = {id: id(), fecha, tipo, concepto, monto: Math.round(monto), cat, medio};
      S.movimientos.push(m); return m;
    };

    const api = {
      // ── Lado del cliente ─────────────────────────────────────────
      async info() {
        return {
          nombre: n.nombre, rubro: n.rubro, direccion: n.direccion, maps: n.maps, whatsapp: n.whatsapp,
          promos: Object.keys(AREAS).filter(a => (n.promos || []).some(pr => promoVigente(pr, a))), pedir_cumple: !!n.pedir_cumple,
          bienvenida: n.bienvenida, recurso: n.recurso || "Profesional", abre: [...new Set((n.horarios || []).map(h => h.dia))].sort(), elegir_pro: n.elegir_pro !== false,
          campos_extra: n.campos_extra || [], zona_domicilio: n.zona_domicilio, solo_socios: !!n.solo_socios,
          planes: planes().map(p => ({id: p.id, nombre: p.nombre, precio: p.precio, precio_txt: pesos(p.precio), detalle: detallePlan(p, S.actividades || []), suelta: !!p.suelta})),
          suelta: sueltaPlan() ? {precio: sueltaPlan().precio, precio_txt: pesos(sueltaPlan().precio)} : null,
          textos: n.textos || {},
          estadia: n.estadia || null,
          unidades: (S.unidades || []).filter(u => u.activo !== false).map(u => ({id: u.id, nombre: u.nombre, desc: u.desc, capacidad: u.capacidad, precio: u.precio, precio_txt: pesos(u.precio)})),
          coberturas: (n.coberturas || []).filter(o => o.activo !== false).map(o => ({id: o.id, nombre: o.nombre, coseguro: o.coseguro || 0, coseguro_txt: o.coseguro ? pesos(o.coseguro) : "Sin cargo"})),
          servicios: S.servicios.filter(s => s.activo !== false).map(s => ({id: s.id, nombre: s.nombre, cat: s.cat, desc: s.desc, precio: s.precio,
            tarifas: (s.tarifas || []).map(t => ({texto: tarifaTxt(t), precio_txt: pesos(t.precio)})),
            desde_txt: (s.tarifas || []).length ? `desde ${pesos(Math.min(s.precio, ...s.tarifas.map(t => t.precio)))}` : "", precio_txt: s.precio ? pesos(s.precio) : "Sin cargo",
                                             min: s.min, modalidad: s.modalidad || "local", pros: prosDe(s).map(p => p.id)})),
          profesionales: pros().map(p => ({id: p.id, nombre: p.nombre, rol: p.rol})),
          actividades: (S.actividades || []).filter(a => (S.clases || []).some(c => c.actividad === a.id && c.activa !== false)).map(a => ({id: a.id, nombre: a.nombre, desc: a.desc, color: a.color})),
          productos: (S.productos || []).filter(p => p.activo !== false).map(p => ({id: p.id, nombre: p.nombre, cat: p.cat, desc: p.desc, precio: p.precio, precio_txt: pesos(p.precio),
                                                    unidad: p.unidad || "u", stock: p.stock, ilimitado: p.stock == null})),
          entrega: {retiro: !!ent().retiro, envio: ent().envio ? {costo: ent().envio.costo, costo_txt: pesos(ent().envio.costo), zona: ent().envio.zona} : null},
        };
      },
      async dias({servicio, pro, modalidad}) {
        const s = serv(servicio), hoy = ahora(), out = [];
        for (let i = 0; i < (n.dias_agenda || 14) && out.length < 14; i++) {
          const d = addDays(hoy, i), k = libres(s, d, pro, modalidad).length;
          if (k) out.push({fecha: fdia(d), nombre: nombreDia(d, hoy), libres: k});
        }
        return out;
      },
      async horas({servicio, dia, pro, modalidad}) {
        const s = serv(servicio), hs = libres(s, dia, pro, modalidad);
        if (!(s.tarifas || []).length) return hs;
        return hs.map(x => { const pr = precioTurno(n, s, parse(x.inicio)).precio; return {...x, precio: pr, precio_txt: pesos(pr)}; });
      },
      async reservarTurno(p) {
        const s = serv(p.servicio), tel = normTel(p.telefono);
        if (!p.nombre || p.nombre.trim().length < 2) throw new Err("Escribí tu nombre.");
        if (!tel) throw new Err("Revisá el celular: código de área sin 0 y número sin 15. Ej: 387 612 4879");
        const modalidad = s.modalidad === "ambos" ? (p.modalidad || "local") : (s.modalidad || "local");
        if (modalidad === "domicilio" && !(n.textos && n.textos.modal && n.textos.modal.sin_dir) && !(p.direccion || "").trim()) throw new Err("Escribí la dirección.");
        for (const c of n.campos_extra || []) if (c.req && !((p.extra || {})[c.id] || "").trim()) throw new Err(`Completá: ${c.label}.`);
        const pt = precioTurno(n, s, parse(p.inicio), p.cobertura);
        const promo = buscarPromo(p.codigo, "turnos", tel), dto = descuento(promo, pt.precio);
        pt.precio -= dto;
        const c = cliente(p.nombre, tel, p.acepta !== false);
        guardarCumple(c, p.cumple);
        const panel = p.origen === "panel";
        if (!panel && futuros(c.id) >= 3) throw new Err("Ya tenés 3 reservas próximas. Cancelá alguna o escribile al negocio.");
        const ok = libres(s, p.inicio.slice(0, 10), p.pro, modalidad).find(x => x.inicio === p.inicio);
        if (!ok) throw new Err("Ese horario se acaba de ocupar. Elegí otro.", "ocupado");
        const ini = parse(p.inicio);
        const t = {id: id(), codigo: codigo(), servicio: s.id, pro: ok.pro || null, cliente: c.id, inicio: p.inicio,
                   fin: fiso(addMin(ini, duracion(s, modalidad))), estado: "confirmado", modalidad, direccion: p.direccion || "",
                   extra: p.extra || {}, origen: panel ? "panel" : "web", precio: pt.precio, cobertura: pt.cobertura, creado: fiso(ahora()), nuevo: !panel,
                   promo: promo ? promo.codigo : null};
        S.turnos.push(t); usarPromo(promo, c);
        let pagar = null;
        let pide = s.sena || 0;
        if (faltasDe(c.id) >= 2 && n.sena_faltadores) pide = Math.max(pide, Math.round(pt.precio * .3 / 100) * 100);   // faltó 2 veces: esta vez, con seña
        if (!panel && pide && pt.precio > 0 && mpOk()) {       // seña con Mercado Pago (en la demo, simulada)
          t.sena = Math.min(pide, pt.precio); t.sena_vence = fiso(addMin(ahora(), 30)); pagar = `#mp-demo:${t.codigo}`;
        }
        let serie = null;
        if (panel && p.repetir > 1) {      // turno fijo: la misma hora, todas las semanas
          t.serie = "se" + id(); const choques = []; let k = 1;
          for (let w = 1; w < Math.min(52, p.repetir); w++) {
            const ini2 = addDays(ini, 7 * w), dia2 = fdia(ini2);
            const libre = libres(s, dia2, t.pro || p.pro, modalidad).find(x => x.inicio === fiso(ini2) && (!t.pro || !x.pro || x.pro === t.pro));
            if (!libre) { choques.push(fechaCorta(dia2)); continue; }
            S.turnos.push({...t, id: id(), codigo: codigo(), promo: null, precio: precioTurno(n, s, ini2, p.cobertura).precio, pro: libre.pro || t.pro, inicio: fiso(ini2), fin: fiso(addMin(ini2, duracion(s, modalidad))), creado: fiso(ahora()), nuevo: false});
            k++;
          }
          serie = {semanas: k, choques};
        }
        emit("turno", t);
        const pr = pros().find(x => x.id === t.pro);
        return {ok: true, tipo: "turno", codigo: t.codigo, titulo: s.nombre, cuando: larga(ini), pagar, sena: pagar ? pesos(t.sena) : null, precio: pt.precio ? pesos(pt.precio) : (pt.cobertura && pt.cobertura !== "Particular" ? "Sin cargo" : ""),
                serie, detalle: [pagar ? `Para confirmarlo, pagá la seña de ${pesos(t.sena)} con Mercado Pago en los próximos 30 minutos. Si no, el turno se libera.` : "", promo ? `Código ${promo.codigo}: ${promo.pct}% de descuento (−${pesos(dto)})` : "", pr && n.elegir_pro !== false ? `Con ${pr.nombre}` : "", pt.cobertura && pt.cobertura !== "Particular" ? `Por ${pt.cobertura}${pt.precio ? ` · coseguro ${pesos(pt.precio)}` : ""}. Traé tu credencial.` : "", modalidad === "domicilio" ? `A domicilio: ${t.direccion}` : n.direccion ? `📍 ${n.direccion}` : ""].filter(Boolean),
                avisar: n.whatsapp ? `https://wa.me/${n.whatsapp}?text=${encodeURIComponent(`Hola! Soy ${c.nombre}, saqué turno de ${s.nombre} para el ${larga(ini)}.`)}` : null};
      },
      async clases() { return ocurrencias(7).map(o => ({...o, espera: esperando().filter(e => e.ocurrencia === o.id).length})); },
      // ── Lista de espera: clase completa o día sin turnos. El negocio ve cuándo se libera un lugar y avisa por WhatsApp. ──
      async anotarEspera(p) {
        const tel = normTel(p.telefono);
        if (!p.nombre || p.nombre.trim().length < 2) throw new Err("Escribí tu nombre.");
        if (!tel) throw new Err("Revisá el celular: código de área sin 0 y número sin 15. Ej: 387 612 4879");
        let x;
        if (p.ocurrencia) {
          const o = ocurrencias(7).find(o => o.id === p.ocurrencia);
          if (!o) throw new Err("Esa clase ya no está disponible.");
          if (o.ocupados < o.cupo) throw new Err("¡Se liberó un lugar! Volvé atrás y reservalo.", "hay");
          x = {ocurrencia: o.id, fecha: o.fecha};
        } else {
          const sv = serv(p.servicio); if (!sv) throw new Err("No existe.");
          const hoy = fdia(ahora()), tope = fdia(addDays(ahora(), 14));
          if (!p.dia || p.dia < hoy || p.dia > tope) throw new Err("Elegí un día de las próximas dos semanas.");
          if (!horariosDia(parse(p.dia)).length) throw new Err("Ese día no atendemos. Elegí otro.");
          if (libres(sv, p.dia, null, sv.modalidad === "domicilio" ? "domicilio" : "local").length) throw new Err("¡Ese día hay lugar! Volvé atrás y elegí el horario.", "hay");
          x = {servicio: sv.id, fecha: p.dia};
        }
        const c = cliente(p.nombre, tel, true);
        const mias = esperando().filter(e => e.cliente === c.id);
        if (mias.some(e => e.ocurrencia === x.ocurrencia && e.servicio === x.servicio && e.fecha === x.fecha)) throw new Err("Ya estás en la lista de espera para eso.");
        if (mias.length >= 3) throw new Err("Ya estás en 3 listas de espera. Esperá a que te avisen o escribile al negocio.");
        S.espera = S.espera || [];
        const e = {id: id(), ...x, cliente: c.id, estado: "esperando", creado: fiso(ahora()), nuevo: true};
        S.espera.push(e); emit("espera", e);
        const o = x.ocurrencia && ocurrencias(7).find(o => o.id === x.ocurrencia);
        return {ok: true, tipo: "espera", titulo: o ? `${o.nombre} con ${o.profe}` : serv(x.servicio).nombre,
                cuando: o ? larga(parse(o.inicio)) : larga(atTime(parse(x.fecha), "12:00")).split(" a las")[0],
                detalle: ["Si alguien cancela, el negocio te escribe por WhatsApp para ofrecerte el lugar.", "Estar en la lista no reserva el lugar: lo toma el primero que confirma."]};
      },
      async inscribir(p) {
        const tel = normTel(p.telefono);
        if (!p.nombre || p.nombre.trim().length < 2) throw new Err("Escribí tu nombre.");
        if (!tel) throw new Err("Revisá el celular: código de área sin 0 y número sin 15. Ej: 387 612 4879");
        const o = ocurrencias(7).find(x => x.id === p.ocurrencia);
        if (!o) throw new Err("Esa clase ya no está disponible.");
        if (p.cumple && !leerCumple(p.cumple)) throw new Err("Revisá el cumpleaños: día/mes, por ejemplo 15/03.", "dato");
        let cobro = 0, pack = false, so = null;
        if (n.solo_socios && p.origen !== "panel") {
          so = socioDe(tel);
          const pl = planDe(so), su = sueltaPlan(), act = actividad(o.actividad) || {}, ddmm = f => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
          let motivo = null, tipo = null;
          if (!so) { motivo = "No encontramos un socio con ese celular. Si sos nuevo, escribinos y te damos de alta."; tipo = "socio"; }
          else if (so.vence < o.fecha) { motivo = `Tu cuota venció el ${ddmm(so.vence)}. Pagala en recepción o por transferencia y reservá tu lugar.`; tipo = "cuota"; }
          else if (pl && pl.actividades && pl.actividades.length && !pl.actividades.some(a => a == o.actividad)) { motivo = `Tu plan ${pl.nombre} no incluye ${act.nombre}.`; tipo = "plan"; }
          else if (pl && pl.por_semana) {
            const lun = fdia(addDays(parse(o.fecha), -wd(parse(o.fecha)))), dom = fdia(addDays(parse(lun), 6)), c0 = S.clientes.find(x => x.telefono === tel);
            const k = c0 ? S.inscripciones.filter(i => i.cliente === c0.id && i.estado === "confirmado" && !i.cobro && i.fecha >= lun && i.fecha <= dom).length : 0;
            if (k >= pl.por_semana) { motivo = `Tu plan es de ${pl.por_semana} ${pl.por_semana === 1 ? "clase" : "clases"} por semana y ya tenés ${k} reservada${k === 1 ? "" : "s"} esa semana.`; tipo = "plan"; }
          } else if (pl && pl.clases && !(so.restantes > 0)) { motivo = `Ya usaste las ${pl.clases} clases de tu ${pl.nombre}. Renovalo en recepción.`; tipo = "plan"; }
          if (motivo) {
            if (p.suelta && su) cobro = su.precio;
            else throw new Err(motivo + (su ? ` También podés reservar esta clase suelta por ${pesos(su.precio)} y pagarla en recepción.` : ""), tipo);
          } else if (pl && pl.clases) pack = true;
        }
        if (o.ocupados >= o.cupo) throw new Err("Esa clase se llenó. Elegí otro horario.", "lleno");
        const c = cliente(p.nombre, tel, true);
        guardarCumple(c, p.cumple);
        if (S.inscripciones.some(i => i.clase === o.clase && i.fecha === o.fecha && i.cliente === c.id && i.estado === "confirmado"))
          throw new Err("Ya estás anotado en esa clase.");
        const tope = (n.planes || []).length ? 10 : 3;   // con planes, el límite lo pone el plan de cada socio
        if (p.origen !== "panel" && futuros(c.id) >= tope) throw new Err(`Ya tenés ${tope} reservas próximas. Cancelá alguna para sacar otra.`);
        const i = {id: id(), codigo: codigo(), clase: o.clase, fecha: o.fecha, inicio: o.inicio, cliente: c.id, estado: "confirmado", asistio: null, creado: fiso(ahora()), nuevo: true,
                   cobro, cobrado: false, pack};
        if (pack) so.restantes -= 1;
        S.inscripciones.push(i);
        emit("inscripcion", i);
        return {ok: true, tipo: "clase", codigo: i.codigo, titulo: `${o.nombre} con ${o.profe}`, cuando: larga(parse(o.inicio)),
                detalle: [`Quedan ${o.cupo - o.ocupados - 1} lugares`, cobro ? `Clase suelta: pagás ${pesos(cobro)} en recepción` : "",
                          pack ? `Te quedan ${so.restantes} clases de tu plan` : "", n.direccion ? `📍 ${n.direccion}` : ""].filter(Boolean),
                avisar: null};
      },
      async franjas({entrega}) { return franjas(entrega); },
      async pedir(p) {
        const tel = normTel(p.telefono);
        if (!p.items || !p.items.length) throw new Err("El pedido está vacío.");
        if (!p.nombre || p.nombre.trim().length < 2) throw new Err("Escribí tu nombre.");
        if (!tel) throw new Err("Revisá el celular: código de área sin 0 y número sin 15. Ej: 387 612 4879");
        const tipo = p.entrega === "envio" ? "envio" : "retiro";
        if (tipo === "envio" && !(p.direccion || "").trim()) throw new Err("Escribí la dirección de entrega.");
        const fr = franjas(tipo).flatMap(d => d.franjas).find(f => f.inicio === p.inicio);
        if (!fr) throw new Err("Ese horario ya no está disponible. Elegí otro.", "ocupado");
        const items = p.items.map(it => {
          const pr = prod(it.producto), cant = Number(it.cant);
          if (!pr || !(cant > 0)) throw new Err("Hay un producto inválido en el pedido.");
          if (pr.stock != null && pr.stock < cant) throw new Err(pr.stock ? `De ${pr.nombre} quedan solo ${pr.stock}. Ajustá la cantidad.` : `${pr.nombre} se acaba de agotar.`, "stock");
          return {producto: pr.id, nombre: pr.nombre, cant, precio: pr.precio, unidad: pr.unidad || "u"};
        });
        const promo = buscarPromo(p.codigo, "pedidos", tel), sub = items.reduce((a, it) => a + it.cant * it.precio, 0), dto = descuento(promo, sub);
        items.forEach(it => { const pr = prod(it.producto); if (pr.stock != null) pr.stock -= it.cant; });
        const c = cliente(p.nombre, tel, true);
        guardarCumple(c, p.cumple); usarPromo(promo, c);
        const envio = tipo === "envio" ? ent().envio.costo : 0;
        const ped = {id: id(), numero: ++S.numPedido, codigo: codigo(), cliente: c.id, items, envio, total: sub - dto + envio, descuento: dto, promo: promo ? promo.codigo : null,
                     entrega: tipo, inicio: p.inicio, franja: fr.hora, direccion: p.direccion || "", nota: (p.nota || "").slice(0, 300), estado: "reservado",
                     creado: fiso(ahora()), nuevo: true};
        S.pedidos.push(ped);
        emit("pedido", ped);
        const d = parse(p.inicio);
        return {ok: true, tipo: "pedido", codigo: ped.codigo, numero: ped.numero, titulo: `Pedido #${ped.numero}`, precio: pesos(ped.total),
                cuando: `${DIAS[wd(d)]} ${d.getDate()}/${d.getMonth() + 1}, ${tipo === "envio" ? "entre las " + fr.hora.replace(" a ", " y las ") : "a las " + fr.hora}`,
                detalle: [tipo === "envio" ? `Envío a ${ped.direccion}` : `Retirás en ${n.direccion || "el local"}`, ...items.map(it => `${it.cant} × ${it.nombre}`),
                          ...(promo ? [`Código ${promo.codigo}: ${promo.pct}% de descuento (−${pesos(dto)})`] : []),
                          ...(tipo === "retiro" ? [(() => { const g = guardadoHasta(p.inicio); return `Te lo guardamos hasta el ${DC[wd(g)].toLowerCase()} ${g.getDate()}/${g.getMonth() + 1} a las ${hm(g)}. Si no podés venir, cancelalo con el botón de abajo.`; })()] : [])],
                avisar: n.whatsapp ? `https://wa.me/${n.whatsapp}?text=${encodeURIComponent(`Hola! Soy ${c.nombre}, hice el pedido #${ped.numero} por la web.`)}` : null};
      },
      async reserva({codigo: cod}) {
        const t = S.turnos.find(x => x.codigo === cod);
        if (t) return {tipo: "turno", titulo: serv(t.servicio).nombre, cuando: larga(parse(t.inicio)), estado: t.estado, negocio: n.nombre, whatsapp: n.whatsapp};
        const i = S.inscripciones.find(x => x.codigo === cod);
        if (i) { const c = S.clases.find(x => x.id === i.clase); return {tipo: "clase", titulo: actividad(c.actividad).nombre, cuando: larga(parse(i.inicio)), estado: i.estado, negocio: n.nombre, whatsapp: n.whatsapp}; }
        const e = (S.estadias || []).find(x => x.codigo === cod);
        if (e) return {tipo: "estadia", titulo: unidad(e.unidad).nombre, cuando: `${fechaCorta(e.desde)} al ${fechaCorta(e.hasta)}`, estado: ["pendiente", "confirmada"].includes(e.estado) ? "confirmado" : e.estado, negocio: n.nombre, whatsapp: n.whatsapp};
        const p = S.pedidos.find(x => x.codigo === cod);
        if (p) return {tipo: "pedido", titulo: `Pedido #${p.numero}`, cuando: larga(parse(p.inicio)), estado: p.estado === "reservado" ? "confirmado" : p.estado, negocio: n.nombre, whatsapp: n.whatsapp};
        throw new Err("No encontramos esa reserva.");
      },
      async cancelarReserva({codigo: cod}) {
        const t = S.turnos.find(x => x.codigo === cod && x.estado === "confirmado" && parse(x.inicio) > ahora());
        if (t) { t.estado = "cancelado"; emit("cancelado", t); return {ok: true}; }
        const i = S.inscripciones.find(x => x.codigo === cod && x.estado === "confirmado" && parse(x.inicio) > ahora());
        if (i) { i.estado = "cancelado"; if (i.pack) { const c0 = S.clientes.find(x => x.id === i.cliente), so = c0 && socioDe(c0.telefono); if (so) so.restantes = (so.restantes || 0) + 1; } emit("cancelado", i); return {ok: true}; }
        const p = S.pedidos.find(x => x.codigo === cod && x.estado === "reservado");
        if (p) { api._cancelarPedido(p); return {ok: true}; }
        const e = (S.estadias || []).find(x => x.codigo === cod && ["pendiente", "confirmada"].includes(x.estado) && parse(x.desde) > ahora());
        if (e) { e.estado = "cancelada"; emit("cancelado", e); return {ok: true}; }
        throw new Err("Esa reserva ya no se puede cancelar desde acá. Escribile al negocio.");
      },
      _cancelarPedido(p) {
        p.estado = "cancelado";
        p.items.forEach(it => { const pr = prod(it.producto); if (pr && pr.stock != null) pr.stock += it.cant; });
        emit("cancelado", p);
      },

      // ── Panel del dueño ──────────────────────────────────────────
      async panel() {
        return {mp: {conectado: mpOk(), disponible: true, demo: true}, sena_faltadores: !!n.sena_faltadores, rol: ROL, usuario: ROL === "dueño" ? null : {id: "demo", nombre: ROL === "encargado" ? "Lucho (ejemplo)" : "Caro (ejemplo)"}, nombre: n.nombre, rubro: n.rubro, recurso: n.recurso || "Profesional", recursos: pros().map(p => ({id: p.id, nombre: p.nombre, rol: p.rol, color: p.color, dias: p.dias || null})),
                tiene: {presupuestos: n._demo === "taller", turnos: S.servicios.length > 0, clases: (S.clases || []).length > 0, productos: (S.productos || []).length > 0, socios: !!n.solo_socios, estadias: (S.unidades || []).length > 0},
                servicios: S.servicios.filter(s => s.activo !== false).map(s => ({id: s.id, nombre: s.nombre, precio: s.precio, min: s.min, pros: prosDe(s).map(p => p.id), modalidad: s.modalidad || "local"})),
                campos_extra: n.campos_extra || [], textos_modal: (n.textos && n.textos.modal) || null,
                productos: (S.productos || []).filter(p => p.activo !== false).map(p => ({id: p.id, nombre: p.nombre, cat: p.cat, precio: p.precio, stock: p.stock, unidad: p.unidad || "u"})),
                cuota: n.cuota, link: n.link, textos: n.textos || {}, resena_url: n.resena_url || null,
                planes: (n.planes || []).map(p => ({...p, activo: p.activo !== false, detalle: detallePlan(p, S.actividades || [])})), actividades: (S.actividades || []).map(a => ({id: a.id, nombre: a.nombre}))};
      },
      async agenda({dia}) {
        let d = dia ? parse(dia) : ahora();
        if (!dia && !(S.unidades || []).length) { for (let i = 0; i < 7; i++) { const x = addDays(ahora(), i), hs = horariosDia(x); if (hs.length && (i > 0 || hs.some(h => atTime(x, h.hasta) > ahora()))) { d = x; break; } } }
        const k = fdia(d);
        const cl = cid => S.clientes.find(c => c.id === cid) || {};
        const rec = (tel, txt) => `https://wa.me/${tel}?text=${encodeURIComponent(txt)}`;
        const turnos = S.turnos.filter(t => t.inicio.startsWith(k)).map(t => {
          const s = serv(t.servicio), c = cl(t.cliente), ini = parse(t.inicio);
          return {kind: "turno", id: t.id, hora: hm(ini), fin: hm(parse(t.fin)), inicio: t.inicio, titulo: s.nombre, cliente: c.nombre, telefono: c.telefono,
                  pro: t.pro, estado: t.estado, modalidad: t.modalidad, direccion: t.direccion, extra: t.extra, cobertura: t.cobertura || null, precio: pesos(t.precio || 0),
                  resena: t.estado === "asistio" ? resenaLink(c) : null, monto: t.precio || 0, origen: t.origen, nuevo: !!t.nuevo, serie: t.serie || null, promo: t.promo || null,
                  sena: t.sena || 0, sena_pagada: !!t.sena_pagada, faltas: faltasDe(t.cliente), esperando_sena: !!t.sena && !t.sena_pagada && t.estado === "confirmado",
                  recordar: c.acepta && t.estado === "confirmado" ? rec(c.telefono, `Hola ${(c.nombre || "").split(" ")[0]}! Te recordamos tu turno de ${s.nombre} el ${larga(ini)} en ${n.nombre}. Si no podés venir, avisanos por acá 🙏`) : null};
        });
        const clases = (S.clases || []).filter(c => c.dias.includes(wd(d))).map(c => {
          const a = actividad(c.actividad), ins = S.inscripciones.filter(i => i.clase === c.id && i.fecha === k && i.estado === "confirmado");
          return {kind: "clase", id: `${c.id}|${k}`, hora: c.hora, fin: hm(addMin(atTime(d, c.hora), c.min)), inicio: `${k}T${c.hora}:00`, titulo: a.nombre, color: a.color, profe: c.profe, cupo: c.cupo,
                  inscriptos: ins.map(i => ({id: i.id, nombre: cl(i.cliente).nombre, telefono: cl(i.cliente).telefono, asistio: i.asistio, nuevo: !!i.nuevo, cobro: i.cobro || 0, cobrado: !!i.cobrado})), nuevo: ins.some(i => i.nuevo),
                  espera: esperando().filter(e => e.ocurrencia === `${c.id}|${k}`).length};
        });
        const pedidos = S.pedidos.filter(p => p.inicio.startsWith(k)).map(p => {
          const c = cl(p.cliente);
          return {kind: "pedido", id: p.id, numero: p.numero, hora: hm(parse(p.inicio)), franja: p.franja, inicio: p.inicio, titulo: `Pedido #${p.numero}`, cliente: c.nombre, telefono: c.telefono,
                  items: p.items, total: pesos(p.total), monto: p.total, entrega: p.entrega, direccion: p.direccion, estado: p.estado, nota: p.nota, nuevo: !!p.nuevo,
                  avisar: rec(c.telefono, `Hola ${(c.nombre || "").split(" ")[0]}! Tu pedido #${p.numero} de ${n.nombre} ya está listo${p.entrega === "envio" ? " y sale para tu casa" : " para retirar"} 🙌`)};
        });
        const est = [];
        for (const e of (S.estadias || []).filter(e => !["cancelada"].includes(e.estado) && (e.desde === k || e.hasta === k))) {
          const c = cl(e.cliente), u = unidad(e.unidad), entra = e.desde === k, cfg = n.estadia || {};
          est.push({kind: "estadia", id: e.id, hora: entra ? cfg.checkin || "14:00" : cfg.checkout || "10:00", inicio: `${k}T${entra ? cfg.checkin || "14:00" : cfg.checkout || "10:00"}:00`,
                    titulo: `${entra ? "Entra" : "Sale"} · ${u.nombre}`, entra, cliente: c.nombre, telefono: c.telefono, personas: e.personas, noches: e.noches, estado: e.estado,
                    total: pesos(e.total), saldo: pesos(e.total - (e.pagado || 0)), nuevo: !!e.nuevo});
        }
        const items = [...turnos, ...clases, ...pedidos, ...est].sort((a, b) => a.inicio.localeCompare(b.inicio));
        const hoy = ahora();
        return {cerrado: (n.cierres || []).includes(k), dia: k, dia_semana: wd(d), nombre: `${DIAS[wd(d)]} ${d.getDate()}/${d.getMonth() + 1}`, es_hoy: k === fdia(hoy), items,
                resumen: {entradas: est.filter(e => e.entra).length, salidas: est.filter(e => !e.entra).length, turnos: turnos.filter(t => t.estado !== "cancelado").length, clases: clases.length, inscriptos: clases.reduce((a, c) => a + c.inscriptos.length, 0),
                          pedidos: pedidos.filter(p => p.estado !== "cancelado").length,
                          esperado: pesos(turnos.filter(t => t.estado !== "cancelado").reduce((a, t) => a + t.monto, 0) + pedidos.filter(p => p.estado !== "cancelado").reduce((a, p) => a + p.monto, 0))},
                horario: horariosDia(d)};
      },
      async estadoTurno({id: tid, estado}) {
        const t = S.turnos.find(x => x.id == tid); if (!t) throw new Err("No existe.");
        const antes = t.estado; t.estado = estado; t.nuevo = false;
        DETALLE_D = `${{asistio: "Marcó que vino", ausente: "Marcó que no vino", cancelado: "Canceló", confirmado: "Volvió a confirmar"}[estado]} · ${serv(t.servicio).nombre} de ${(S.clientes.find(c => c.id === t.cliente) || {}).nombre} (${parse(t.inicio).getDate()}/${parse(t.inicio).getMonth() + 1} ${hm(parse(t.inicio))})`;
        const resto = (t.precio || 0) - (t.sena_pagada ? t.sena : 0);
        if (estado === "asistio" && antes !== "asistio" && resto) mov("ingreso", `${serv(t.servicio).nombre} · ${(S.clientes.find(c => c.id === t.cliente) || {}).nombre}${t.sena_pagada ? " (resto, la seña ya entró)" : ""}`, resto, "Servicios");
        emit("cambio", t); return {ok: true};
      },
      async asistencia({id: iid, asistio}) {
        const i = S.inscripciones.find(x => x.id == iid); if (!i) throw new Err("No existe.");
        i.asistio = asistio; i.nuevo = false; emit("cambio", i); return {ok: true};
      },
      async pedidos({estado}) {
        const cl = cid => S.clientes.find(c => c.id === cid) || {};
        return S.pedidos.filter(p => !estado || (estado === "activos" ? ["reservado", "listo"].includes(p.estado) : p.estado === estado))
          .sort((a, b) => a.inicio.localeCompare(b.inicio)).map(p => {
            const d = parse(p.inicio), c = cl(p.cliente);
            return {...p, cuando: `${nombreDia(d, ahora())} ${p.franja}`, cliente: c.nombre, telefono: c.telefono, total_txt: pesos(p.total), resena: p.estado === "entregado" ? resenaLink(c) : null,
                    avisar: `https://wa.me/${c.telefono}?text=${encodeURIComponent(p.estado === "vencido" ? `Hola ${(c.nombre || "").split(" ")[0]}! Tu pedido #${p.numero} de ${n.nombre} venció porque no lo pudiste retirar. Si todavía lo querés, avisanos y te lo preparamos de nuevo.` : `Hola ${(c.nombre || "").split(" ")[0]}! Tu pedido #${p.numero} de ${n.nombre} ya está listo${p.entrega === "envio" ? " y sale para tu casa" : " para retirar"} 🙌`)}`};
          });
      },
      async estadoPedido({id: pid, estado}) {
        const p = S.pedidos.find(x => x.id == pid); if (!p) throw new Err("No existe.");
        p.nuevo = false;
        if (estado === "cancelado") { if (p.estado !== "cancelado" && p.estado !== "entregado") api._cancelarPedido(p); return {ok: true}; }
        if (p.estado === "cancelado") throw new Err("Ese pedido está cancelado.");
        if (p.estado === "vencido") {
          if (estado !== "entregado") throw new Err("Ese pedido venció. Si lo vino a buscar igual, marcalo como entregado.");
          const falta = p.items.find(it => { const pr = prod(it.producto); return pr && pr.stock != null && pr.stock < it.cant; });
          if (falta) throw new Err(`De ${falta.nombre} ya no queda stock suficiente. Corregí el stock y probá de nuevo.`, "stock");
          p.items.forEach(it => { const pr = prod(it.producto); if (pr && pr.stock != null) pr.stock -= it.cant; });
        }
        if (estado === "entregado" && p.estado !== "entregado") mov("ingreso", `Pedido #${p.numero}`, p.total, "Ventas", p.entrega === "envio" ? "Transferencia" : "Efectivo");
        p.estado = estado; emit("cambio", p); return {ok: true};
      },
      async stock() {
        const apartado = pid => S.pedidos.filter(p => ["reservado", "listo"].includes(p.estado)).reduce((a, p) => a + p.items.filter(i => i.producto === pid).reduce((x, i) => x + i.cant, 0), 0);
        return S.productos.map(p => ({id: p.id, nombre: p.nombre, cat: p.cat, precio: pesos(p.precio), costo: p.costo, stock: p.stock, minimo: p.minimo || 0, unidad: p.unidad || "u",
                                      apartado: apartado(p.id), ilimitado: p.stock == null, bajo: p.stock != null && p.stock <= (p.minimo || 0), proveedor: p.proveedor || null}));
      },
      async ajustarStock({id: pid, stock, vendido}) {
        if (ROL === "empleado" && !vendido) throw new Err("Tu usuario no tiene permiso para corregir el stock. Pedíselo al encargado o al dueño.", "permiso");
        const p = prod(pid); if (!p) throw new Err("No existe.");
        if (vendido) { if (p.stock != null && p.stock < vendido) throw new Err("No hay stock suficiente."); if (p.stock != null) p.stock -= vendido; mov("ingreso", `Venta en el local · ${p.nombre}`, p.precio * vendido, "Ventas"); S.ventaItems = [...(S.ventaItems || []), {producto: p.id, cant: vendido, precio: p.precio, costo: p.costo ?? null, cuando: fiso(ahora())}]; DETALLE_D = `Vendió ${vendido} × ${p.nombre} (${pesos(p.precio * vendido)})`; }
        else { const a = p.stock; p.stock = Math.max(0, Math.round(Number(stock))); DETALLE_D = `Corrigió el stock de ${p.nombre}: de ${a} a ${p.stock}`; }
        emit("stock", p); return {ok: true, stock: p.stock};
      },
      async socios() {
        const hoy = fdia(ahora());
        return (S.socios || []).map(s => { const pl = planDe(s);
          return {...s, vencida: s.vence < hoy, plan_id: pl ? pl.id : null, plan: pl ? pl.nombre : s.plan, precio: pl ? pl.precio : n.cuota || 0, restantes: pl && pl.clases ? (s.restantes || 0) : null}; })
          .sort((a, b) => a.vence.localeCompare(b.vence));
      },
      async pagarCuota({telefono, plan, medio}) {
        const s = socioDe(telefono); if (!s) throw new Err("No existe.");
        const pl = plan ? planes().find(p => p.id == plan) : planDe(s);
        if (plan && !pl) throw new Err("Ese plan no existe.");
        if (pl && pl.suelta) throw new Err("La clase suelta se cobra en cada clase, no como plan.");
        const vigente = s.vence >= fdia(ahora()) && (!pl || s.plan == pl.id);
        const base = vigente ? parse(s.vence) : ahora();
        s.vence = fdia(vencePlan(base, pl));
        if (pl) { s.plan = pl.id; if (pl.clases) s.restantes = (vigente ? (s.restantes || 0) : 0) + pl.clases; }
        const precio = pl ? pl.precio : (n.cuota || 0);
        mov("ingreso", `Cuota ${pl ? pl.nombre : s.plan} · ${s.nombre}`, precio, "Cuotas", medio || "Transferencia");
        emit("socio", s); return {ok: true, vence: s.vence, precio: pesos(precio)};
      },
      async agregarSocio({nombre, telefono, plan, medio}) {
        const tel = normTel(telefono);
        if (!nombre || nombre.trim().length < 2) throw new Err("Escribí el nombre.", "dato");
        if (!tel) throw new Err("Revisá el celular: código de área sin 0 y número sin 15. Ej: 387 612 4879", "dato");
        if (socioDe(tel)) throw new Err("Ya hay un socio con ese celular.", "dato");
        S.socios = S.socios || [];
        S.socios.push({telefono: tel, nombre: titulo(nombre), plan: plan || null, vence: fdia(addDays(ahora(), -1)), restantes: 0});
        return api.pagarCuota({telefono: tel, plan, medio});
      },
      async cobrarClase({id: iid, medio}) {
        const i = S.inscripciones.find(x => x.id == iid); if (!i) throw new Err("No existe.");
        if (!i.cobro || i.cobrado) throw new Err("Esa clase no tiene nada para cobrar.");
        const c0 = S.clientes.find(x => x.id === i.cliente) || {}, cl = S.clases.find(x => x.id === i.clase) || {};
        i.cobrado = true; mov("ingreso", `Clase suelta ${(actividad(cl.actividad) || {}).nombre || ""} · ${c0.nombre || ""}`, i.cobro, "Clases sueltas", medio || "Efectivo");
        emit("cambio", i); return {ok: true};
      },
      // Subir (o bajar) todos los precios de una vez, con redondeo. aplicar=false devuelve la vista previa.
      // ── Proveedores: a quién se le compra cada producto, para armarle el pedido de lo que falta ──
      // Para la demo: una clase completa con gente esperando y otra donde se liberó un lugar.
      _sembrarEspera() {
        S.espera = S.espera || [];
        const libresCl = (o, k) => S.clientes.filter(c => c.telefono && !S.inscripciones.some(i => `${i.clase}|${i.fecha}` === o.id && i.cliente === c.id && i.estado === "confirmado")).slice(k);
        const ocs = ocurrencias(7).filter(o => parse(o.inicio) > addDays(ahora(), 1) && o.cupo <= 30);
        const llena = ocs[0], casi = ocs.find(o => o.clase !== (llena || {}).clase);
        let k = 0;
        if (llena) {
          for (const c of libresCl(llena, 0).slice(0, llena.cupo - llena.ocupados))
            S.inscripciones.push({id: "e" + k, codigo: "esp" + k++, clase: llena.clase, fecha: llena.fecha, inicio: llena.inicio, cliente: c.id, estado: "confirmado", asistio: null, creado: fiso(ahora())});
          libresCl(llena, 0).slice(0, 2).forEach((c, j) => S.espera.push({id: "es" + j, ocurrencia: llena.id, fecha: llena.fecha, cliente: c.id, estado: "esperando", creado: fiso(addMin(ahora(), -300 + j * 60))}));
        }
        if (casi) {
          const falta = casi.cupo - casi.ocupados - 1;
          for (const c of libresCl(casi, 0).slice(0, Math.max(0, falta)))
            S.inscripciones.push({id: "e" + k, codigo: "esp" + k++, clase: casi.clase, fecha: casi.fecha, inicio: casi.inicio, cliente: c.id, estado: "confirmado", asistio: null, creado: fiso(ahora())});
          const c = libresCl(casi, 0).filter(c => !S.espera.some(e => e.cliente === c.id))[0]; if (c) S.espera.push({id: "es9", ocurrencia: casi.id, fecha: casi.fecha, cliente: c.id, estado: "esperando", creado: fiso(addMin(ahora(), -900))});
        }
        if (!S.clases.length && S.servicios.length && S.clientes.length > 3) {   // turnos: alguien que quería un día que estaba lleno; ahora alguien canceló
          for (let i = 1; i < 8; i++) { const d = addDays(ahora(), i); const sv = S.servicios.find(x => x.activo !== false);
            if (horariosDia(d).length && libres(sv, fdia(d), null, sv.modalidad === "domicilio" ? "domicilio" : "local").length) {
              S.espera.push({id: "es1", servicio: sv.id, fecha: fdia(d), cliente: S.clientes[3].id, estado: "esperando", creado: fiso(addMin(ahora(), -1500))}); break; } }
        }
      },
      async espera() {
        const ocs = ocurrencias(14), hoy = ahora();
        return esperando().map(e => {
          const c = S.clientes.find(x => x.id === e.cliente) || {}, o = e.ocurrencia && ocs.find(o => o.id === e.ocurrencia);
          if (e.ocurrencia && !o) return null;                                   // la clase ya pasó
          const sv = e.servicio && serv(e.servicio);
          const lib = o ? o.cupo - o.ocupados : libres(sv, e.fecha, null, sv.modalidad === "domicilio" ? "domicilio" : "local").length;
          const que = o ? `${o.nombre} ${o.hora}` : sv.nombre, cuando = o ? o.dia : nombreDia(parse(e.fecha), hoy);
          return {id: e.id, fecha: e.fecha, nombre: c.nombre, telefono: c.telefono, que, cuando, tipo: o ? "clase" : "turno", libres: Math.max(0, lib), hay_lugar: lib > 0,
                  avisado: e.avisado || null, nuevo: !!e.nuevo, creado: e.creado,
                  avisar: `https://wa.me/${c.telefono}?text=${encodeURIComponent(`¡Hola ${(c.nombre || "").split(" ")[0]}! Te escribimos de ${n.nombre}: se liberó un lugar en ${que} (${cuando.toLowerCase()}). Si lo querés, reservalo acá: ${n.link || ""} ¡Es para el primero que confirma!`)}`};
        }).filter(Boolean).sort((a, b) => (b.hay_lugar - a.hay_lugar) || a.fecha.localeCompare(b.fecha) || a.creado.localeCompare(b.creado));
      },
      async avisarEspera({id: eid}) { const e = (S.espera || []).find(x => x.id === eid); if (!e) throw new Err("No existe."); e.avisado = fiso(ahora()); e.nuevo = false; emit("espera", e); return {ok: true}; },
      async quitarEspera({id: eid}) { const e = (S.espera || []).find(x => x.id === eid); if (!e) throw new Err("No existe."); e.estado = "quitado"; emit("espera", e); return {ok: true}; },
      async cancelarSerie({serie}) {
        const ts = S.turnos.filter(t => t.serie === serie && t.estado === "confirmado" && parse(t.inicio) > ahora());
        if (!ts.length) throw new Err("No quedan turnos de esa serie.");
        ts.forEach(t => t.estado = "cancelado"); emit("turno", {}); return {ok: true, cancelados: ts.length};
      },
      async probarCodigo({codigo: cod, area}) {
        const pr = buscarPromo(cod, area, null);
        return {ok: true, pct: pr.pct, texto: `${pr.pct}% de descuento`};
      },
      async promos() {
        return {pedir_cumple: !!n.pedir_cumple, areas: Object.keys(AREAS).filter(a => a === "turnos" ? S.servicios.length : a === "pedidos" ? (S.productos || []).length : (S.unidades || []).length).map(a => ({id: a, nombre: AREAS[a]})),
                promos: (n.promos || []).map(pr => ({...pr, usados: undefined, vigente: promoVigente(pr), aplica_txt: (pr.aplica || []).map(a => AREAS[a]).join(", ")}))};
      },
      async agregarPromo(p) {
        const cod = String(p.codigo || "").trim().toUpperCase();
        if (!/^[A-Z0-9]{3,20}$/.test(cod)) throw new Err("El código va con letras y números, sin espacios (de 3 a 20). Ej: VERANO10", "dato");
        if ((n.promos || []).some(x => x.codigo === cod)) throw new Err("Ya tenés un código con ese nombre.", "dato");
        const pct = Math.round(Number(p.pct)); if (!(pct >= 1 && pct <= 90)) throw new Err("El descuento va de 1 a 90 %.", "dato");
        const aplica = (p.aplica || []).filter(a => AREAS[a]); if (!aplica.length) throw new Err("Elegí a qué se aplica.", "dato");
        const pr = {id: "pr" + id(), codigo: cod, pct, aplica, desde: p.desde || null, hasta: p.hasta || null, usos_max: p.usos_max ? Math.round(Number(p.usos_max)) : null, usos: 0,
                    una_vez: p.una_vez !== false, cumple: !!p.cumple, activo: true, usados: []};
        if (pr.cumple) (n.promos || []).forEach(x => x.cumple = false);
        n.promos = [...(n.promos || []), pr]; emit("catalogo", {}); return {ok: true, id: pr.id};
      },
      async estadoPromo({id: pid, activo, quitar}) {
        const pr = (n.promos || []).find(x => x.id === pid); if (!pr) throw new Err("No existe.");
        if (quitar) n.promos = n.promos.filter(x => x !== pr); else pr.activo = !!activo;
        return {ok: true};
      },
      async pedirCumple({activo}) { n.pedir_cumple = !!activo; return {ok: true}; },
      async proveedores() { return (n.proveedores || []).map(x => ({...x, productos: S.productos.filter(p => p.proveedor === x.id).length})); },
      async agregarProveedor({nombre, telefono}) {
        nombre = String(nombre || "").trim(); if (nombre.length < 2) throw new Err("Escribí el nombre del proveedor.", "dato");
        const tel = telefono ? normTel(telefono) : null; if (telefono && !tel) throw new Err("Revisá el celular del proveedor: código de área sin 0 y número sin 15.", "dato");
        n.proveedores = n.proveedores || []; const x = {id: "pv" + id(), nombre: nombre.slice(0, 60), telefono: tel};
        n.proveedores.push(x); emit("stock", {}); return {ok: true, id: x.id};
      },
      async asignarProveedor({producto, proveedor}) {
        const p = prod(producto); if (!p) throw new Err("No existe.");
        if (proveedor && !(n.proveedores || []).some(x => x.id === proveedor)) throw new Err("Ese proveedor no existe.");
        p.proveedor = proveedor || null; emit("stock", {}); return {ok: true};
      },
      async marcarResena({telefono}) {
        const c = S.clientes.find(x => x.telefono === telefono); if (!c) throw new Err("No existe.");
        c.resena = fiso(ahora()); return {ok: true};
      },
      async guardarConfig(p) {
        if (p.sena_faltadores !== undefined) n.sena_faltadores = !!p.sena_faltadores;
        if (p.mp_token !== undefined) {
          const tk = String(p.mp_token || "").trim();
          if (tk && !/^APP_USR-[\w-]{20,}$/.test(tk)) throw new Err("Pegá el Access Token de producción: empieza con APP_USR-", "dato");
          n.mp = {conectado: !!tk, cuenta: tk ? "tu cuenta (simulación)" : null};
          return {ok: true, cuenta: n.mp.cuenta};
        }
        if (p.resena_url !== undefined) {
          const u = String(p.resena_url || "").trim();
          if (u && !/^https:\/\/\S+$/i.test(u)) throw new Err("Pegá el link completo, que empiece con https://", "dato");
          n.resena_url = u || null;
        }
        emit("catalogo", {}); return {ok: true};
      },
      async aumentarPrecios({pct, que, redondeo, aplicar}) {
        const k = Number(pct), r = [100, 500, 1000].includes(Number(redondeo)) ? Number(redondeo) : 100;
        if (!(k >= -50 && k <= 300) || !k) throw new Err("Poné un porcentaje, por ejemplo 8.", "dato");
        const q = new Set(que && que.length ? que : ["servicios", "productos", "planes", "unidades"]);
        const nuevo = v => Math.max(r, Math.round(v * (1 + k / 100) / r) * r), out = [];
        const pasar = (tipo, nombre, obj, campo = "precio") => { if (!(obj[campo] > 0)) return; const d = nuevo(obj[campo]); out.push({tipo, nombre, antes: obj[campo], despues: d}); if (aplicar) obj[campo] = d; };
        if (q.has("servicios")) S.servicios.forEach(x => { pasar("Servicio", x.nombre, x); (x.tarifas || []).forEach(t => pasar("Horario", `${x.nombre} · ${tarifaTxt(t)}`, t)); });
        if (q.has("productos")) S.productos.forEach(x => pasar("Producto", x.nombre, x));
        if (q.has("planes")) (n.planes || []).forEach(x => pasar("Plan", x.nombre, x));
        if (q.has("unidades")) (S.unidades || []).forEach(x => pasar("Unidad", x.nombre, x));
        if (q.has("coberturas")) (n.coberturas || []).forEach(x => pasar("Coseguro", x.nombre, x, "coseguro"));
        if (aplicar) emit("catalogo", {});
        return {ok: true, aplicado: !!aplicar, cambios: out.map(x => ({...x, antes_txt: pesos(x.antes), despues_txt: pesos(x.despues)}))};
      },
      async agregarTarifa({servicio, dias, desde, hasta, precio}) {
        const sv = serv(servicio), pr = Math.round(Number(precio));
        if (!/^\d{2}:\d{2}$/.test(desde || "") || !/^\d{2}:\d{2}$/.test(hasta || "") || hasta <= desde) throw new Err("Poné desde y hasta qué hora, por ejemplo 18:00 a 24:00.", "dato");
        if (!(pr >= 0)) throw new Err("Poné el precio.", "dato");
        const ds = (dias || []).map(Number).filter(x => x >= 0 && x <= 6);
        sv.tarifas = sv.tarifas || [];
        if (sv.tarifas.some(t => (!t.dias.length || !ds.length || t.dias.some(x => ds.includes(x))) && desde < t.hasta && hasta > t.desde))
          throw new Err("Ese horario se pisa con otro precio que ya cargaste. Borralo o cambiá las horas.", "dato");
        sv.tarifas.push({dias: ds, desde, hasta, precio: pr}); emit("catalogo", sv); return {ok: true};
      },
      async editarTarifa({servicio, i, precio}) {
        const sv = serv(servicio), t = (sv.tarifas || [])[Number(i)]; if (!t) throw new Err("No existe.");
        const pr = Math.round(Number(precio)); if (!(pr >= 0)) throw new Err("Revisá el número."); t.precio = pr; emit("catalogo", sv); return {ok: true};
      },
      async quitarTarifa({servicio, i}) { const sv = serv(servicio); (sv.tarifas || []).splice(Number(i), 1); emit("catalogo", sv); return {ok: true}; },
      async agregarCobertura({nombre, coseguro}) {
        nombre = String(nombre || "").trim(); if (nombre.length < 2) throw new Err("Escribí el nombre de la obra social.", "dato");
        n.coberturas = n.coberturas || [];
        if (n.coberturas.some(o => o.nombre.toLowerCase() === nombre.toLowerCase())) throw new Err("Esa obra social ya está cargada.", "dato");
        const o = {id: "ob" + id(), nombre: nombre.slice(0, 60), coseguro: Math.max(0, Math.round(Number(coseguro) || 0))};
        n.coberturas.push(o); emit("catalogo", o); return {ok: true, id: o.id};
      },
      async guardarFinde({finde}) {
        const v = Number(finde); if (!(v >= -50 && v <= 200)) throw new Err("Poné un porcentaje entre -50 y 200.", "dato");
        n.estadia = {...(n.estadia || {}), finde: Math.round(v)}; emit("catalogo", {}); return {ok: true};
      },
      async agregarTemporada({nombre, desde, hasta, recargo}) {
        nombre = String(nombre || "").trim(); const r = Number(recargo);
        if (nombre.length < 2) throw new Err("Poné un nombre, por ejemplo Temporada alta.", "dato");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(desde || "") || !/^\d{4}-\d{2}-\d{2}$/.test(hasta || "") || hasta < desde) throw new Err("Revisá las fechas: la de fin tiene que ser igual o posterior.", "dato");
        if (!(r >= -50 && r <= 200)) throw new Err("Poné un porcentaje entre -50 y 200.", "dato");
        const ts = (n.estadia || {}).temporadas || [];
        if (ts.some(t => desde <= t.hasta && hasta >= t.desde)) throw new Err("Esas fechas se pisan con otra temporada.", "dato");
        n.estadia = {...(n.estadia || {}), temporadas: [...ts, {id: "t" + id(), nombre: nombre.slice(0, 40), desde, hasta, recargo: Math.round(r)}].sort((a, b) => a.desde.localeCompare(b.desde))};
        emit("catalogo", {}); return {ok: true};
      },
      async quitarTemporada({id: tid}) { n.estadia = {...(n.estadia || {}), temporadas: ((n.estadia || {}).temporadas || []).filter(t => t.id !== tid)}; emit("catalogo", {}); return {ok: true}; },
      async agregarPlan(p) {
        const nombre = String(p.nombre || "").trim(), precio = Math.round(Number(p.precio));
        if (nombre.length < 2 || !(precio > 0)) throw new Err("Completá nombre y precio.", "dato");
        const suelta = !!p.suelta, dias = suelta ? 1 : Math.round(Number(p.dias) || 30);
        if (dias < 1 || dias > 400) throw new Err("La duración tiene que ser entre 1 y 400 días.", "dato");
        const por_semana = !suelta && Number(p.por_semana) > 0 ? Math.round(Number(p.por_semana)) : null;
        const clases = !suelta && Number(p.clases) > 0 ? Math.round(Number(p.clases)) : null;
        if (por_semana && clases) throw new Err("Elegí veces por semana o cantidad de clases, no las dos.", "dato");
        if (suelta && planes().some(x => x.suelta)) throw new Err("Ya tenés una clase suelta cargada: cambiale el precio.", "dato");
        n.planes = n.planes || [];
        const x = {id: "pl" + id(), nombre: nombre.slice(0, 60), precio, dias, actividades: suelta ? [] : (p.actividades || []).map(a => isNaN(a) ? a : Number(a)), por_semana, clases, suelta};
        n.planes.push(x); emit("catalogo", x); return {ok: true, id: x.id};
      },
      async caja({mes}) {
        const m = mes || fdia(ahora()).slice(0, 7);
        const ms = S.movimientos.filter(x => x.fecha.startsWith(m)).sort((a, b) => b.fecha.localeCompare(a.fecha));
        const ing = ms.filter(x => x.tipo === "ingreso").reduce((a, x) => a + x.monto, 0), egr = ms.filter(x => x.tipo === "egreso").reduce((a, x) => a + x.monto, 0);
        const cats = {}; ms.forEach(x => { const k = `${x.tipo}|${x.cat}`; cats[k] = (cats[k] || 0) + x.monto; });
        const stockVal = (S.productos || []).filter(p => p.stock != null).reduce((a, p) => a + p.stock * (p.costo || p.precio * .6), 0);
        const saldo = (S.cajaInicial || 0) + S.movimientos.reduce((a, x) => a + (x.tipo === "ingreso" ? x.monto : -x.monto), 0);
        const pendientes = S.pedidos.filter(p => ["reservado", "listo"].includes(p.estado)).reduce((a, p) => a + p.total, 0);
        return {mes: m, movimientos: ms, ingresos: ing, egresos: egr, resultado: ing - egr,
                categorias: Object.entries(cats).map(([k, v]) => ({tipo: k.split("|")[0], cat: k.split("|")[1], monto: v})).sort((a, b) => b.monto - a.monto),
                balance: {caja: saldo, stock: Math.round(stockVal), a_cobrar: pendientes + (S.fiado || []).reduce((a, m) => a + (m.tipo === "debe" ? m.monto : -m.monto), 0), deudas: S.deudas || 0}, negocio: n.nombre};
      },
      // ── Cierre de caja: el efectivo que debería haber contra el que se contó ──
      async arqueo() {
        const e = estadoCaja(), ult = (S.arqueos || [])[0];
        const base = {desde: e.desde, ultimo: ult ? {cuando: ult.cuando, quien: ult.quien} : null};
        if (ROL !== "dueño") return {...base, ciego: true};
        return {...base, ciego: false, fondo: e.fondo, ingresos: e.ing, egresos: e.egr, esperado: e.esperado, otros: e.otros,
                cierres: (S.arqueos || []).map(a => ({...a, diferencia: a.contado - a.esperado, deja: a.contado - a.retiro}))};
      },
      async cerrarCaja({contado, retiro = 0, nota = ""}) {
        contado = Math.round(Number(contado)); retiro = Math.round(Number(retiro) || 0);
        if (!(contado >= 0)) throw new Err("Escribí cuánto efectivo contaste.", "dato");
        if (retiro > contado) throw new Err("No podés retirar más de lo que contaste.", "dato");
        const e = estadoCaja(), quien = ROL === "dueño" ? "Dueño" : ROL === "encargado" ? "Lucho (ejemplo)" : "Caro (ejemplo)";
        S.arqueos = [{cuando: fiso(ahora()), quien, fondo: e.fondo, esperado: e.esperado, contado, retiro, nota: String(nota || "").slice(0, 300) || null}, ...(S.arqueos || [])];
        const dif = contado - e.esperado;
        DETALLE_D = `Cerró la caja: contó ${pesos(contado)} en efectivo` + (ROL === "dueño" && dif ? ` (diferencia ${dif > 0 ? "+" : ""}${pesos(dif)})` : "");
        return ROL === "dueño" ? {ok: true, esperado: e.esperado, diferencia: dif} : {ok: true};
      },
      // ── Gastos fijos: lo que se paga todos los meses, con aviso del vencimiento ──
      async gastos() {
        const h = ahora(), mes = fdia(h).slice(0, 7), hoy0 = parse(fdia(h));
        const it = (n.gastos || []).map(g => {
          const v = new Date(h.getFullYear(), h.getMonth(), g.dia), dias = Math.round((v - hoy0) / 864e5);
          return {...g, vence: fdia(v), dias, pagado: g.pagado_mes === mes};
        }).sort((a, b) => (a.activo === false) - (b.activo === false) || a.pagado - b.pagado || a.dias - b.dias);
        return {items: it, alertas: it.filter(g => g.activo !== false && !g.pagado && g.dias <= 3).length,
                total: it.filter(g => g.activo !== false).reduce((a, g) => a + g.monto, 0)};
      },
      async agregarGasto({concepto, cat, monto, dia, medio}) {
        concepto = String(concepto || "").trim(); monto = Math.round(Number(monto)); dia = Math.round(Number(dia));
        if (concepto.length < 2) throw new Err("Escribí qué es (ej: alquiler).", "dato");
        if (!(monto > 0)) throw new Err("Escribí el monto.", "dato");
        if (!(dia >= 1 && dia <= 28)) throw new Err("El día de vencimiento va del 1 al 28.", "dato");
        n.gastos = [...(n.gastos || []), {id: "g" + id(), concepto: concepto.slice(0, 80), cat: String(cat || "Gastos fijos").slice(0, 40), monto, dia, medio: medio || "Transferencia", activo: true, pagado_mes: null}];
        return {ok: true};
      },
      async cambiarGasto({id: gid, monto, activo, quitar}) {
        const g = (n.gastos || []).find(x => x.id === gid); if (!g) throw new Err("No existe.");
        if (quitar) { n.gastos = n.gastos.filter(x => x !== g); return {ok: true}; }
        if (monto != null) { if (!(Number(monto) > 0)) throw new Err("Revisá el monto.", "dato"); g.monto = Math.round(Number(monto)); }
        if (activo != null) g.activo = !!activo;
        return {ok: true};
      },
      async pagarGasto({id: gid, monto, medio}) {
        const g = (n.gastos || []).find(x => x.id === gid); if (!g) throw new Err("No existe.");
        const mes = fdia(ahora()).slice(0, 7); if (g.pagado_mes === mes) throw new Err("Ya figura pagado este mes.");
        const m = Math.round(Number(monto || g.monto)); if (!(m > 0)) throw new Err("Revisá el monto.", "dato");
        mov("egreso", g.concepto, m, g.cat, medio || g.medio); g.pagado_mes = mes;
        DETALLE_D = `Pagó ${g.concepto} (${pesos(m)})`; emit("caja", {}); return {ok: true};
      },
      async movimiento(p) {
        if (!(Number(p.monto) > 0) || !(p.concepto || "").trim()) throw new Err("Completá concepto y monto.");
        const m = mov(p.tipo === "ingreso" ? "ingreso" : "egreso", p.concepto.trim(), Number(p.monto), p.cat || "Otros", p.medio || "Efectivo");
        emit("caja", m); return {ok: true};
      },

      // ── Estadías ─────────────────────────────────────────────────
      async disponibilidad({desde, hasta, personas}) {
        const cfg = n.estadia || {}, k = noches(desde, hasta);
        if (!(k > 0)) throw new Err("Elegí una fecha de salida posterior a la de entrada.");
        if (parse(desde) < parse(fdia(ahora()))) throw new Err("La fecha de entrada ya pasó.");
        if (k < (cfg.min_noches || 1)) throw new Err(`La estadía mínima es de ${cfg.min_noches} noches.`);
        return (S.unidades || []).filter(u => u.activo !== false).map(u => { const pn = precioNoches(n, u, desde, hasta); return {id: u.id, nombre: u.nombre, desc: u.desc, capacidad: u.capacidad,
          precio_txt: pesos(Math.round(pn.total / k)), noches: k, total: pn.total, total_txt: pesos(pn.total), sena_txt: pesos(Math.round(pn.total * (cfg.sena || 30) / 100)), detalle: pn.detalle,
          libre: !ocupada(u.id, desde, hasta) && u.capacidad >= Number(personas || 1), motivo: u.capacidad < Number(personas || 1) ? `Hasta ${u.capacidad} personas` : ocupada(u.id, desde, hasta) ? "Ocupada esas fechas" : ""}; });
      },
      async ocupacion({unidad: uid, desde}) {
        // días ocupados de los próximos 3 meses, para pintar el calendario
        const out = {}, d0 = parse(desde || fdia(ahora()));
        for (let i = 0; i < 95; i++) { const f = fdia(addDays(d0, i)), sig = fdia(addDays(d0, i + 1)); out[f] = (S.unidades || []).filter(u => !uid || u.id == uid).every(u => ocupada(u.id, f, sig)); }
        return out;
      },
      async reservarEstadia(p) {
        const tel = normTel(p.telefono), cfg = n.estadia || {};
        if (!p.nombre || p.nombre.trim().length < 2) throw new Err("Escribí tu nombre.");
        if (!tel) throw new Err("Revisá el celular: código de área sin 0 y número sin 15. Ej: 387 612 4879");
        const u = unidad(p.unidad); if (!u) throw new Err("Esa unidad no existe.");
        const k = noches(p.desde, p.hasta);
        if (!(k >= (cfg.min_noches || 1))) throw new Err(`La estadía mínima es de ${cfg.min_noches || 1} noches.`);
        if (Number(p.personas) > u.capacidad) throw new Err(`${u.nombre} es para hasta ${u.capacidad} personas.`);
        if (ocupada(u.id, p.desde, p.hasta)) throw new Err("Esas fechas se acaban de ocupar. Probá otras o elegí otra unidad.", "ocupado");
        const promo = buscarPromo(p.codigo, "estadias", tel), pn = precioNoches(n, u, p.desde, p.hasta), dto = descuento(promo, pn.total);
        const c = cliente(p.nombre, tel, true), total = pn.total - dto, sena = Math.round(total * (cfg.sena || 30) / 100);
        guardarCumple(c, p.cumple); usarPromo(promo, c);
        if (promo) pn.detalle.push(`Código ${promo.codigo}: ${promo.pct}% de descuento (−${pesos(dto)})`);
        const panel = p.origen === "panel";
        const e = {id: id(), codigo: codigo(), unidad: u.id, cliente: c.id, desde: p.desde, hasta: p.hasta, noches: k, personas: Number(p.personas || 1), total, sena, pagado: 0,
                   estado: panel ? "confirmada" : "pendiente", nota: (p.nota || "").slice(0, 300), origen: panel ? "panel" : "web", creado: fiso(ahora()), nuevo: !panel, promo: promo ? promo.codigo : null};
        if (panel) { e.pagado = sena; mov("ingreso", `Seña ${u.nombre} · ${c.nombre}`, sena, "Reservas", "Transferencia"); }
        S.estadias.push(e); emit("estadia", e);
        const pagar = !panel && mpOk() && sena > 0 ? `#mp-demo:${e.codigo}` : null;
        return {ok: true, tipo: "estadia", codigo: e.codigo, titulo: u.nombre, pagar, sena: pagar ? pesos(sena) : null, cuando: `${fechaCorta(p.desde)} al ${fechaCorta(p.hasta)} · ${k} noche${k > 1 ? "s" : ""}`, precio: pesos(total),
                detalle: [`${e.personas} persona${e.personas > 1 ? "s" : ""}`, ...pn.detalle, pagar ? `Para confirmar, pagá la seña de ${pesos(sena)} con Mercado Pago (se confirma sola) o transferila al alias ${cfg.alias || "—"} dentro de las 24 h.` : `Para confirmar, transferí la seña de ${pesos(sena)} al alias ${cfg.alias || "—"} dentro de las 24 h.`, `Entrada ${cfg.checkin || "14:00"} · salida ${cfg.checkout || "10:00"}`],
                avisar: n.whatsapp ? `https://wa.me/${n.whatsapp}?text=${encodeURIComponent(`Hola! Soy ${c.nombre}, reservé ${u.nombre} del ${fechaCorta(p.desde)} al ${fechaCorta(p.hasta)}. Te mando el comprobante de la seña.`)}` : null};
      },
      async estadias({desde}) {
        const d0 = parse(desde || fdia(addDays(ahora(), -1)));
        const cl = cid => S.clientes.find(c => c.id === cid) || {};
        return {desde: fdia(d0), dias: [...Array(21)].map((_, i) => { const d = addDays(d0, i); return {fecha: fdia(d), d: d.getDate(), dia: DC[wd(d)], hoy: fdia(d) === fdia(ahora())}; }),
                unidades: (S.unidades || []).map(u => ({id: u.id, nombre: u.nombre, capacidad: u.capacidad, precio: pesos(u.precio), ical: `demo-${u.id}`, externos: u.externos || []})),
                bloqueos: (S.bloqueos || []).filter(b => b.hasta >= fdia(d0)).map(b => ({...b, noches: noches(b.desde, b.hasta), cuando: `${fechaCorta(b.desde)} al ${fechaCorta(b.hasta)}`})),
                sincronizado: S._sync || null,
                reservas: (S.estadias || []).filter(e => e.estado !== "cancelada" && vigente(e) && e.hasta >= fdia(d0)).sort((a, b) => a.desde.localeCompare(b.desde)).map(e => {
                  const c = cl(e.cliente);
                  return {...e, cliente: c.nombre, telefono: c.telefono, unidad_nombre: unidad(e.unidad).nombre, total_txt: pesos(e.total), resena: e.estado === "finalizada" ? resenaLink(c) : null, sena_txt: pesos(e.sena), saldo_txt: pesos(e.total - e.pagado),
                          cuando: `${fechaCorta(e.desde)} al ${fechaCorta(e.hasta)}`,
                          avisar: `https://wa.me/${c.telefono}?text=${encodeURIComponent(e.estado === "pendiente" ? `Hola ${(c.nombre || "").split(" ")[0]}! Te recordamos transferir la seña de ${pesos(e.sena)} al alias ${(n.estadia || {}).alias} para confirmar tu reserva en ${n.nombre}.` : `Hola ${(c.nombre || "").split(" ")[0]}! Te esperamos el ${fechaCorta(e.desde)} en ${n.nombre}. La entrada es desde las ${(n.estadia || {}).checkin || "14:00"} 🏡`)}`};
                })};
      },
      async guardarIcal({unidad: uid, externos}) {
        const u = unidad(uid); if (!u) throw new Err("No existe esa unidad.");
        const ok = (externos || []).map(x => String(x || "").trim()).filter(Boolean);
        for (const x of ok) if (!/^https:\/\/[^\s]+$/i.test(x)) throw new Err("Pegá el link completo, que empiece con https://", "dato");
        if (ok.length > 5) throw new Err("Hasta 5 calendarios por unidad.", "dato");
        const antes = u.externos || []; u.externos = ok;
        S.bloqueos = (S.bloqueos || []).filter(b => b.unidad != uid || ok.includes(b.fuente));
        return {ok: true, quitados: antes.filter(x => !ok.includes(x)).length};
      },
      async sincronizarIcal() {
        // En la demo no hay internet de por medio: muestra lo que ya trajo la última sincronización.
        S._sync = "recién";
        return {ok: true, unidades: (S.unidades || []).filter(u => (u.externos || []).length).length, bloqueos: (S.bloqueos || []).length, errores: [], demo: true};
      },
      async estadoEstadia({id: eid, estado}) {
        const e = (S.estadias || []).find(x => x.id == eid); if (!e) throw new Err("No existe.");
        const u = unidad(e.unidad), c = S.clientes.find(x => x.id === e.cliente) || {};
        if (estado === "confirmada" && e.estado === "pendiente") { e.pagado = e.sena; mov("ingreso", `Seña ${u.nombre} · ${c.nombre}`, e.sena, "Reservas", "Transferencia"); }
        if (estado === "finalizada" && e.pagado < e.total) { mov("ingreso", `Saldo ${u.nombre} · ${c.nombre}`, e.total - e.pagado, "Reservas", "Efectivo"); e.pagado = e.total; }
        e.estado = estado; e.nuevo = false; emit("cambio", e); return {ok: true};
      },

      // ── Clientes y números ───────────────────────────────────────
      async clientes() {
        const hoyF = fdia(ahora()), out = [];
        for (const c of S.clientes) {
          const vis = [...S.turnos.filter(t => t.cliente === c.id && t.estado === "asistio").map(t => ({f: t.inicio, m: t.precio || 0, q: serv(t.servicio).nombre})),
                       ...S.pedidos.filter(p => p.cliente === c.id && p.estado === "entregado").map(p => ({f: p.inicio, m: p.total, q: [...p.items].sort((a, b) => b.cant * b.precio - a.cant * a.precio)[0].nombre})),
                       ...S.inscripciones.filter(i => i.cliente === c.id && i.asistio).map(i => ({f: i.inicio, m: 0, q: actividad(S.clases.find(x => x.id === i.clase).actividad).nombre})),
                       ...(S.estadias || []).filter(e => e.cliente === c.id && ["finalizada", "checkin", "confirmada"].includes(e.estado) && e.desde <= hoyF).map(e => ({f: e.desde, m: e.total, q: unidad(e.unidad).nombre}))]
            .sort((a, b) => b.f.localeCompare(a.f));
          const prox = [...S.turnos.filter(t => t.cliente === c.id && t.estado === "confirmado" && parse(t.inicio) > ahora()).map(t => t.inicio),
                        ...S.inscripciones.filter(i => i.cliente === c.id && i.estado === "confirmado" && parse(i.inicio) > ahora()).map(i => i.inicio),
                        ...S.pedidos.filter(p => p.cliente === c.id && ["reservado", "listo"].includes(p.estado)).map(p => p.inicio),
                        ...(S.estadias || []).filter(e => e.cliente === c.id && ["pendiente", "confirmada"].includes(e.estado) && e.desde >= hoyF).map(e => e.desde + "T12:00:00")].sort()[0];
          if (!vis.length && !prox) continue;
          const ult = vis[0] ? vis[0].f : null, dias = ult ? Math.floor((ahora() - parse(ult)) / 864e5) : null;
          const fav = Object.entries(vis.reduce((a, v) => (a[v.q] = (a[v.q] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1])[0];
          out.push({id: c.id, nombre: c.nombre, telefono: c.telefono, visitas: vis.length, gastado: vis.reduce((a, v) => a + v.m, 0), ultima: ult, hace: dias, favorito: fav ? fav[0] : "",
                    resena: vis.length && dias != null && dias <= 30 ? resenaLink(c) : null, resena_pedida: c.resena || null, ...cumpleDe(c), faltas: faltasDe(c.id),
                    proxima: prox || null, nuevo: c.alta && (ahora() - parse(c.alta)) < 864e5 * 30 && vis.length <= 1,
                    volver: dias != null && dias > 35 && !prox ? `https://wa.me/${c.telefono}?text=${encodeURIComponent(`Hola ${c.nombre.split(" ")[0]}! Hace un tiempo que no te vemos por ${n.nombre} 😊 ¿Te reservo ${fav ? fav[0].toLowerCase() : "un lugar"}? Sacá tu turno acá: ${n.link || ""}`)}` : null});
        }
        return out.sort((a, b) => b.gastado - a.gastado || b.visitas - a.visitas);
      },
      async numeros() {
        const h = ahora(), d30 = addDays(h, -30), d60 = addDays(h, -60), en = (f, a, b) => parse(f) >= a && parse(f) < b;
        const tAs = (a, b) => S.turnos.filter(t => en(t.inicio, a, b) && ["asistio", "ausente"].includes(t.estado));
        const pEn = (a, b) => S.pedidos.filter(p => p.estado === "entregado" && en(p.inicio, a, b));
        const iEn = (a, b) => S.inscripciones.filter(i => en(i.inicio, a, b) && i.asistio != null);
        const ing = (a, b) => tAs(a, b).filter(t => t.estado === "asistio").reduce((x, t) => x + (t.precio || 0), 0) + pEn(a, b).reduce((x, p) => x + p.total, 0)
                              + (S.estadias || []).filter(e => e.estado !== "cancelada" && en(e.desde + "T12:00:00", a, b)).reduce((x, e) => x + e.total, 0);
        const otros = (a, b) => S.movimientos.filter(m => m.tipo === "ingreso" && !["Servicios", "Ventas", "Reservas"].includes(m.cat) && en(m.fecha, a, b)).reduce((x, m) => x + m.monto, 0);
        const ahoraI = ing(d30, h) + otros(d30, h), antesI = ing(d60, d30) + otros(d60, d30);
        const at = tAs(d30, h), aus = at.filter(t => t.estado === "ausente").length;
        const ops = at.filter(t => t.estado === "asistio").length + pEn(d30, h).length + iEn(d30, h).filter(i => i.asistio).length;
        const ticket = ops ? ahoraI / Math.max(1, at.filter(t => t.estado === "asistio").length + pEn(d30, h).length) : 0;
        const kpis = [{l: "Facturado en 30 días", v: pesos(ahoraI), s: antesI ? `${ahoraI >= antesI ? "▲" : "▼"} ${Math.abs(Math.round(100 * (ahoraI - antesI) / antesI))} % vs. los 30 anteriores` : ""}];
        if (S.servicios.length) kpis.push({l: "Turnos atendidos", v: at.length - aus, s: `ausentismo ${at.length ? Math.round(100 * aus / at.length) : 0} %`});
        if (S.productos.length) kpis.push({l: "Pedidos entregados", v: pEn(d30, h).length, s: `ticket promedio ${pesos(ticket)}`});
        if (S.clases.length) { const ii = iEn(d30, h), cupo = ii.length ? ii.length : 1; kpis.push({l: "Asistencias a clases", v: ii.filter(i => i.asistio).length, s: `${Math.round(100 * ii.filter(i => !i.asistio).length / cupo)} % de anotados que faltó`}); }
        if ((S.unidades || []).length) { const occ = (S.estadias || []).filter(e => e.estado !== "cancelada").reduce((x, e) => { let q = 0; for (let i = 0; i < e.noches; i++) { const f = addDays(parse(e.desde), i); if (f >= d30 && f < h) q++; } return x + q; }, 0);
          kpis.push({l: "Ocupación 30 días", v: Math.round(100 * occ / (30 * S.unidades.length)) + " %", s: `${occ} noches vendidas`}); }
        // ranking
        const rk = {};
        at.filter(t => t.estado === "asistio").forEach(t => { const k = serv(t.servicio).nombre; rk[k] = rk[k] || {n: k, q: 0, m: 0}; rk[k].q++; rk[k].m += t.precio || 0; });
        pEn(d30, h).forEach(p => p.items.forEach(i => { rk[i.nombre] = rk[i.nombre] || {n: i.nombre, q: 0, m: 0}; rk[i.nombre].q += i.cant; rk[i.nombre].m += i.cant * i.precio; }));
        iEn(d30, h).filter(i => i.asistio).forEach(i => { const k = actividad(S.clases.find(c => c.id === i.clase).actividad).nombre; rk[k] = rk[k] || {n: k, q: 0, m: 0}; rk[k].q++; });
        const top = Object.values(rk).sort((a, b) => (b.m - a.m) || (b.q - a.q)).slice(0, 6);
        // horarios pico (día x franja)
        const pico = {}, evs = [...at, ...pEn(d30, h), ...iEn(d30, h)];
        evs.forEach(x => { const d = parse(x.inicio), k = `${wd(d)}|${d.getHours()}`; pico[k] = (pico[k] || 0) + 1; });
        const horas = [...new Set(evs.map(x => parse(x.inicio).getHours()))].sort((a, b) => a - b);
        // stock que se termina
        const venta = {};
        pEn(d30, h).forEach(p => p.items.forEach(i => venta[i.producto] = (venta[i.producto] || 0) + i.cant));
        const cobertura = S.productos.filter(p => p.stock != null && venta[p.id]).map(p => ({n: p.nombre, stock: p.stock, dias: Math.floor(p.stock / (venta[p.id] / 30))})).sort((a, b) => a.dias - b.dias).slice(0, 5);
        const cls = await api.clientes(), perdidos = cls.filter(c => c.volver);
        const rec = [];
        if (cobertura[0] && cobertura[0].dias <= 7) rec.push(`Reponé ${cobertura[0].n}: al ritmo de venta de este mes te alcanza para ${cobertura[0].dias <= 0 ? "menos de un día" : cobertura[0].dias + " días"}.`);
        if (perdidos.length) rec.push(`${perdidos.length} clientes que venían seguido no volvieron en más de 5 semanas. Escribiles desde la pestaña Clientes, con un toque cada uno.`);
        if (S.servicios.length && at.length && aus / at.length > 0.05) rec.push(`El ${Math.round(100 * aus / at.length)} % de los turnos no vino. Mandar el recordatorio el día anterior a todos suele bajarlo a la mitad.`);
        const dbaja = [0, 1, 2, 3, 4, 5].map(d => ({d, q: Object.entries(pico).filter(([k]) => k.startsWith(d + "|")).reduce((a, [, v]) => a + v, 0)})).filter(x => n.horarios.some(hh => hh.dia === x.d)).sort((a, b) => a.q - b.q)[0];
        if (dbaja && evs.length) rec.push(`El ${DIAS[dbaja.d]} es tu día más flojo. Una promo solo para ese día (por ejemplo 10 % off) llena horarios que hoy quedan vacíos.`);
        if (top[0]) rec.push(`${top[0].n} es lo que más plata te dejó este mes (${pesos(top[0].m || 0)}). Ponelo primero en tu link y en Instagram.`);
        if ((S.unidades || []).length) {
          const pend = (S.estadias || []).filter(e => e.estado === "pendiente" && vigente(e)).length;
          if (pend) rec.push(`${pend} reserva${pend > 1 ? "s esperan" : " espera"} la seña. Si no llega en 24 h la fecha se libera sola: recordales desde Estadías con un toque.`);
          let libres = 0, fin = 0;
          for (let i = 0; i < 14; i++) { const f = fdia(addDays(h, i)), sg = fdia(addDays(h, i + 1)); S.unidades.forEach(u => { if (!ocupada(u.id, f, sg)) { libres++; if ([4, 5].includes(wd(addDays(h, i)))) fin++; } }); }
          if (libres) rec.push(`Tenés ${libres} noches libres en las próximas dos semanas${fin ? `, ${fin} de viernes o sábado` : ""}. Un descuento por 3 noches o más entre semana suele llenarlas.`);
          rec.push("Conectá el calendario de cada cabaña con Booking y Airbnb para que una reserva en un lado bloquee la fecha en los otros.");
        }
        if (n.solo_socios) { const venc = (S.socios || []).filter(x => x.vence < fdia(h)).length; if (venc) rec.push(`${venc} socios tienen la cuota vencida. Avisales desde Socios: cada cuota recuperada son ${pesos(n.cuota)}.`); }
        const obras = {};
        if ((n.coberturas || []).length) tAs(d30, h).filter(t => t.estado === "asistio").forEach(t => { const k = t.cobertura || "Particular"; obras[k] = obras[k] || {nombre: k, turnos: 0, cobrado: 0}; obras[k].turnos++; obras[k].cobrado += t.precio || 0; });
        return {kpis, top: top.map(t => ({...t, m_txt: pesos(t.m)})), pico, horas, cobertura, recomendaciones: rec.slice(0, 3), perdidos: perdidos.length,
                obras: Object.values(obras).sort((a, b) => b.turnos - a.turnos).map(o => ({...o, cobrado_txt: pesos(o.cobrado)}))};
      },

      // ── Catálogo y configuración ─────────────────────────────────
      async catalogo() {
        const cfgE = n.estadia || {};
        return {servicios: S.servicios.map(s => ({id: s.id, nombre: s.nombre, cat: s.cat, precio: s.precio, min: s.min, activo: s.activo !== false, sena: s.sena || 0, repetir: s.repetir || null,
                                                  tarifas: (s.tarifas || []).map((t, i) => ({i, texto: tarifaTxt(t), precio: t.precio}))})),
                coberturas: (n.coberturas || []).map(o => ({id: o.id, nombre: o.nombre, coseguro: o.coseguro || 0, activo: o.activo !== false})),
                estadia: (S.unidades || []).length ? {finde: cfgE.finde || 0, temporadas: (cfgE.temporadas || []).map(t => ({...t}))} : null,
                productos: S.productos.map(p => ({id: p.id, nombre: p.nombre, cat: p.cat, precio: p.precio, costo: p.costo, minimo: p.minimo || 0, stock: p.stock, activo: p.activo !== false, unidad: p.unidad || "u"})),
                clases: S.clases.map(c => ({id: c.id, nombre: actividad(c.actividad).nombre, dias: c.dias.map(d => DC[d]).join(" "), hora: c.hora, cupo: c.cupo, profe: c.profe, activo: c.activa !== false})),
                unidades: (S.unidades || []).map(u => ({id: u.id, nombre: u.nombre, capacidad: u.capacidad, precio: u.precio, activo: u.activo !== false})),
                horarios: n.horarios.map(x => ({...x, dia_txt: DIAS[x.dia]})), cierres: [...(n.cierres || [])].sort(), cuota: n.cuota || null,
                planes: (n.planes || []).map(p => ({id: p.id, nombre: p.nombre, precio: p.precio, detalle: detallePlan(p, S.actividades || []), activo: p.activo !== false, suelta: !!p.suelta}))};
      },
      async editar({tipo, id: eid, campo, valor}) {
        const lista = {profesional: pros(), servicio: S.servicios, producto: S.productos, clase: S.clases, unidad: S.unidades || [], plan: n.planes || [], cobertura: n.coberturas || []}[tipo];
        const x = lista && lista.find(o => o.id == eid); if (!x) throw new Err("No existe.");
        const permitidos = {profesional: ["comision"], servicio: ["precio", "activo", "min", "sena", "repetir"], producto: ["precio", "costo", "minimo", "activo"], clase: ["cupo", "activo"], unidad: ["precio", "activo"], plan: ["precio", "activo"], cobertura: ["coseguro", "activo"]}[tipo];
        if (!permitidos.includes(campo)) throw new Err("Ese dato no se puede cambiar desde acá.");
        if (campo === "activo") { if (tipo === "clase") x.activa = !!valor; else x.activo = !!valor; }
        else { const v = Number(valor); if (!(v >= 0) || (campo === "cupo" && v < 1) || (campo === "min" && v < 5)) throw new Err("Revisá el número."); x[campo] = Math.round(v); }
        emit("catalogo", x); return {ok: true};
      },
      async agregarProducto(p) {
        if (!(p.nombre || "").trim() || !(Number(p.precio) > 0)) throw new Err("Completá nombre y precio.");
        const x = {id: id(), nombre: p.nombre.trim().slice(0, 80), cat: (p.cat || "Otros").trim() || "Otros", desc: (p.desc || "").slice(0, 120), precio: Math.round(Number(p.precio)),
                   costo: Number(p.costo) || null, stock: p.sin_stock ? null : Math.max(0, Math.round(Number(p.stock) || 0)), minimo: Math.round(Number(p.minimo) || 0), unidad: "u"};
        S.productos.push(x); emit("catalogo", x); return {ok: true};
      },
      async agregarServicio(p) {
        if (!(p.nombre || "").trim() || !(Number(p.min) >= 5)) throw new Err("Completá nombre y duración.");
        const x = {id: id(), nombre: p.nombre.trim().slice(0, 80), cat: (p.cat || "").trim() || (S.servicios[0] || {}).cat || "Servicios", desc: (p.desc || "").slice(0, 120),
                   precio: Math.round(Number(p.precio) || 0), min: Math.round(Number(p.min)), pros: p.pros && p.pros.length ? p.pros.map(Number) : (S.servicios[0] ? [...(S.servicios[0].pros || [])] : [])};
        if (!p.pros || !p.pros.length) x.pros = pros().map(q => q.id);
        S.servicios.push(x); emit("catalogo", x); return {ok: true};
      },
      async cerrarDia({fecha, abrir}) {
        n.cierres = n.cierres || [];
        if (abrir) n.cierres = n.cierres.filter(f => f !== fecha);
        else { if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || "")) throw new Err("Elegí la fecha."); if (!n.cierres.includes(fecha)) n.cierres.push(fecha); }
        emit("catalogo", {fecha}); return {ok: true, afectados: S.turnos.filter(t => t.estado === "confirmado" && t.inicio.startsWith(fecha)).length};
      },
      async ventaMostrador({items, medio, nombre, telefono}) {
        if (!items || !items.length) throw new Err("Agregá al menos un producto.");
        const telF = medio === "Fiado" ? normTel(telefono || "") : null;
        if (medio === "Fiado" && (String(nombre || "").trim().length < 2 || !telF)) throw new Err("Para fiar, escribí el nombre y el celular del cliente.", "dato");
        const lista = items.map(it => { const p = prod(it.producto), q = Number(it.cant); if (!p || !(q > 0)) throw new Err("Producto inválido."); if (p.stock != null && p.stock < q) throw new Err(`De ${p.nombre} quedan ${p.stock}.`); return {p, q}; });
        lista.forEach(({p, q}) => { if (p.stock != null) p.stock -= q; S.ventaItems = [...(S.ventaItems || []), {producto: p.id, cant: q, precio: p.precio, costo: p.costo ?? null, cuando: fiso(ahora())}]; });
        const total = lista.reduce((a, {p, q}) => a + p.precio * q, 0);
        const concepto = lista.length === 1 ? `${lista[0].q} ${lista[0].p.nombre}` : `${lista.length} productos`;
        if (telF) { const c = cliente(nombre, telF, true); S.fiado = [{cliente: c.id, tipo: "debe", monto: total, concepto, quien: quienD(), cuando: fiso(ahora())}, ...(S.fiado || [])]; DETALLE_D = `Le fió ${pesos(total)} a ${c.nombre} (${concepto})`; }
        else mov("ingreso", `Venta en el local · ${concepto}`, total, "Ventas", medio || "Efectivo");
        emit("stock", {}); return {ok: true, total: pesos(total)};
      },
      // ── Personal ─────────────────────────────────────────────────
      async personal({desde}) {
        const base = desde ? parse(desde) : ahora(), lun = addDays(base, -wd(base)), hoyF = fdia(ahora());
        const dias = [...Array(7)].map((_, i) => { const d = addDays(lun, i); return {fecha: fdia(d), d: d.getDate(), mes: d.getMonth() + 1, dia: DC[wd(d)], hoy: fdia(d) === hoyF}; });
        const corto = t => t.endsWith(":00") ? String(Number(t.slice(0, 2))) : `${Number(t.slice(0, 2))}:${t.slice(3)}`;
        return {desde: fdia(lun), dias, tipos: TIPOS_P,
                recursos: pros().map(p => ({id: p.id, nombre: p.nombre, usado: !!personaDePro(p.id)})), recurso: n.recurso || "Profesional",
                personas: personas().map(p => {
                  const semana = dias.map(d => { const x = diaPersona(S, p, d.fecha);
                    return {...x, fecha: d.fecha, horas: horasTramos(x.tramos), texto: x.tipo === "trabaja" ? x.tramos.map(([a, b]) => `${corto(a)} a ${corto(b)}`).join(" · ") : TIPOS_P[x.tipo]}; });
                  const pr = p.pro != null ? pros().find(x => x.id == p.pro) : null;
                  return {id: p.id, nombre: p.nombre, rol: p.rol || "", color: p.color, pro: p.pro ?? null, pro_nombre: pr ? pr.nombre : null, horario: p.horario || {},
                          semana, horas: semana.reduce((a, x) => a + x.horas, 0)};
                })};
      },
      _persona(pid) { const p = personas().find(x => x.id == pid); if (!p) throw new Err("No existe esa persona."); return p; },
      _afectados(p, fechas) {
        const set = new Set(fechas), out = [];
        if (p.pro != null) for (const t of S.turnos.filter(t => t.estado === "confirmado" && t.pro == p.pro && parse(t.inicio) > ahora() && set.has(t.inicio.slice(0, 10)))) {
          if (proTrabaja(p.pro, parse(t.inicio), parse(t.fin))) continue;
          const c = S.clientes.find(x => x.id === t.cliente) || {}, sv = S.servicios.find(x => x.id == t.servicio) || {};
          out.push({tipo: "turno", id: t.id, texto: `${larga(parse(t.inicio))} · ${sv.nombre || "Turno"} · ${c.nombre || ""}`,
                    avisar: c.telefono ? `https://wa.me/${c.telefono}?text=${encodeURIComponent(`Hola ${(c.nombre || "").split(" ")[0]}! Te escribimos de ${n.nombre}: ${p.nombre} no va a estar el ${larga(parse(t.inicio))}. ¿Te pasamos el turno a otro horario o con otra persona?`)}` : null});
        }
        const nom = p.nombre.toLowerCase();
        for (const c of (S.clases || []).filter(c => c.activa !== false && c.profe && nom.includes(String(c.profe).toLowerCase().replace(/^prof\.\s*/, "")))) {
          for (const f of fechas) {
            if (!c.dias.includes(wd(parse(f))) || parse(`${f}T${c.hora}`) < ahora()) continue;
            const x = diaPersona(S, p, f), ini = parse(`${f}T${c.hora}`), fin = addMin(ini, c.min || 60);
            if (x.tipo === "trabaja" && x.tramos.some(([a, b]) => atTime(ini, a) <= ini && fin <= atTime(ini, b))) continue;
            out.push({tipo: "clase", texto: `${larga(ini)} · ${(actividad(c.actividad) || {}).nombre || "Clase"}: buscá quién la da`});
          }
        }
        return out.sort((a, b) => a.texto.localeCompare(b.texto));
      },
      async guardarDia({persona, fecha, tipo, tramos, alcance, nota}) {
        const p = api._persona(persona);
        if (!TIPOS_P[tipo]) throw new Err("Elegí qué hace ese día.", "dato");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || "")) throw new Err("Fecha inválida.", "dato");
        const tr = tipo === "trabaja" ? validarTramos(tramos) : [];
        S.personalDias = (S.personalDias || []);
        let fechas = [fecha];
        if (alcance === "semanal") {
          if (!["trabaja", "franco"].includes(tipo)) throw new Err("Las vacaciones y licencias se cargan por fecha, no todas las semanas.", "dato");
          const w = wd(parse(fecha));
          p.horario = {...(p.horario || {}), [String(w)]: tr};
          S.personalDias = S.personalDias.filter(e => !(e.persona == p.id && e.fecha >= fecha && wd(parse(e.fecha)) === w));
          fechas = [...Array(9)].map((_, i) => fdia(addDays(parse(fecha), 7 * i)));
        } else {
          S.personalDias = S.personalDias.filter(e => !(e.persona == p.id && e.fecha === fecha));
          S.personalDias.push({persona: p.id, fecha, tipo, tramos: tr, nota: String(nota || "").slice(0, 120)});
        }
        emit("personal", {}); return {ok: true, afectados: api._afectados(p, fechas)};
      },
      async ausencia({persona, desde, hasta, tipo, nota}) {
        const p = api._persona(persona);
        if (!["vacaciones", "licencia", "franco"].includes(tipo)) throw new Err("Elegí vacaciones, licencia o franco.", "dato");
        if (!desde || !hasta || hasta < desde) throw new Err("La fecha de vuelta tiene que ser igual o posterior a la de salida.", "dato");
        const fechas = []; for (let d = parse(desde); fdia(d) <= hasta; d = addDays(d, 1)) fechas.push(fdia(d));
        if (fechas.length > 120) throw new Err("Cargá hasta 120 días por vez.", "dato");
        S.personalDias = (S.personalDias || []).filter(e => !(e.persona == p.id && fechas.includes(e.fecha)));
        fechas.forEach(f => S.personalDias.push({persona: p.id, fecha: f, tipo, tramos: [], nota: String(nota || "").slice(0, 120)}));
        emit("personal", {}); return {ok: true, dias: fechas.length, afectados: api._afectados(p, fechas)};
      },
      async volverBase({persona, fecha}) {
        const p = api._persona(persona);
        S.personalDias = (S.personalDias || []).filter(e => !(e.persona == p.id && e.fecha === fecha));
        emit("personal", {}); return {ok: true, afectados: api._afectados(p, [fecha])};
      },
      async agregarPersona({nombre, rol, pro}) {
        nombre = String(nombre || "").trim(); if (nombre.length < 2) throw new Err("Escribí el nombre.", "dato");
        if (pro != null && pro !== "" && personaDePro(pro)) throw new Err("Ese lugar de la agenda ya tiene a alguien asignado.", "dato");
        const horario = {}; (n.horarios || []).forEach(h => { (horario[String(h.dia)] = horario[String(h.dia)] || []).push([h.desde, h.hasta]); });
        const COL = ["#E8772E", "#2F6FDE", "#1F8A5B", "#7A5AF8", "#C2412D", "#0E7490", "#B45309", "#475569"];
        S.personal = S.personal || [];
        const p = {id: id(), nombre: titulo(nombre), rol: String(rol || "").slice(0, 40), color: COL[S.personal.length % COL.length], pro: pro === "" || pro == null ? null : pro, horario};
        S.personal.push(p); emit("personal", {}); return {ok: true, id: p.id};
      },
      async quitarPersona({persona}) { const p = api._persona(persona); p.activo = false; emit("personal", {}); return {ok: true}; },
      async novedades() { return []; },
      // ── Usuarios y roles. En la demo no hay login real: "Ver como" cambia el rol para mostrar qué ve cada uno. ──
      // A quién le toca volver: cada servicio puede tener "volver a los N días" (service del auto, corte, control…)
      async vuelta() {
        const h = ahora(), ult = new Map();
        for (const t of S.turnos) {
          const s = S.servicios.find(x => x.id === t.servicio);
          if (t.estado !== "asistio" || !s || !(s.repetir > 0)) continue;
          const k = `${t.cliente}|${t.servicio}|${(t.extra || {}).patente || ""}`;
          if (!ult.has(k) || ult.get(k).inicio < t.inicio) ult.set(k, t);
        }
        const hace = d => d >= 60 ? `${Math.round(d / 30)} meses` : d >= 14 ? `${Math.round(d / 7)} semanas` : `${d} días`;
        const out = [];
        for (const t of ult.values()) {
          const s = serv(t.servicio), c = S.clientes.find(x => x.id === t.cliente) || {}, d = Math.floor((h - parse(t.inicio)) / 864e5);
          if (d < s.repetir || S.turnos.some(x => x.cliente === t.cliente && x.estado === "confirmado" && parse(x.inicio) > h)) continue;
          if ((S.avisosVuelta || []).some(a => a.cliente === t.cliente && a.servicio === t.servicio && a.cuando > t.inicio)) continue;
          const ex = t.extra || {}, auto = [ex.auto, ex.patente ? `(${ex.patente})` : ""].filter(Boolean).join(" "), nom = (c.nombre || "").split(" ")[0];
          const msg = auto ? `¡Hola ${nom}! Te escribimos de ${n.nombre}: ya pasaron ${hace(d)} del último ${s.nombre.toLowerCase()} de tu ${auto}. ¿Te reservo un turno? Sacalo acá: ${n.link || ""}`
                           : `¡Hola ${nom}! Ya pasaron ${hace(d)} de tu último ${s.nombre.toLowerCase()} en ${n.nombre}. ¿Te reservo un turno? Sacalo acá: ${n.link || ""}`;
          out.push({cliente: c.nombre, telefono: c.telefono, servicio: s.nombre, servicio_id: s.id, hace: d, hace_txt: hace(d), auto: auto || null, avisar: `https://wa.me/${c.telefono}?text=${encodeURIComponent(msg)}`});
        }
        return out.sort((a, b) => b.hace - a.hace);
      },
      async marcarVuelta({telefono, servicio}) {
        const c = S.clientes.find(x => x.telefono === telefono), s = S.servicios.find(x => x.id == servicio);
        if (!c || !s) throw new Err("No existe.");
        S.avisosVuelta = [...(S.avisosVuelta || []), {cliente: c.id, servicio: s.id, cuando: fiso(ahora())}];
        DETALLE_D = `Le avisó a ${c.nombre} que le toca ${s.nombre.toLowerCase()}`; return {ok: true};
      },
      async encuesta({token}) {
        const c = token === "muestra" ? S.clientes[0] : S.clientes.find(x => "c" + x.id === token);
        if (!c) throw new Err("Este link de encuesta no es válido.");
        const ya = (S.opiniones || []).find(o => o.cliente === c.id && (ahora() - parse(o.cuando)) < 864e5 * 30);
        return {negocio: n.nombre, nombre: (c.nombre || "").split(" ")[0], ya: ya ? ya.nota : null};
      },
      async responderEncuesta({token, nota, comentario}) {
        const c = token === "muestra" ? S.clientes[0] : S.clientes.find(x => "c" + x.id === token);
        if (!c) throw new Err("Este link de encuesta no es válido.");
        nota = Math.round(Number(nota)); if (!(nota >= 1 && nota <= 5)) throw new Err("Elegí de 1 a 5 estrellas.");
        S.opiniones = S.opiniones || [];
        const ya = S.opiniones.find(o => o.cliente === c.id && (ahora() - parse(o.cuando)) < 864e5 * 30);
        const o = {cliente: c.id, nota, comentario: String(comentario || "").trim().slice(0, 500) || null, cuando: fiso(ahora())};
        if (ya) Object.assign(ya, o); else S.opiniones.unshift(o);
        emit("opinion", {nota}); return {ok: true, resena_url: n.resena_url || null};
      },
      async opiniones() {
        const lim = addDays(ahora(), -90), it = (S.opiniones || []).filter(o => parse(o.cuando) > lim).sort((a, b) => b.cuando.localeCompare(a.cuando));
        const notas = it.map(o => o.nota);
        return {cantidad: notas.length, promedio: notas.length ? Math.round(10 * notas.reduce((a, x) => a + x, 0) / notas.length) / 10 : null,
                por_nota: Object.fromEntries([1, 2, 3, 4, 5].map(k => [String(k), notas.filter(x => x === k).length])), muestra: urlEncuesta("muestra"),
                items: it.slice(0, 50).map(o => { const c = S.clientes.find(x => x.id === o.cliente) || {};
                  return {nombre: c.nombre, telefono: c.telefono, nota: o.nota, comentario: o.comentario, cuando: o.cuando,
                          contactar: o.nota <= 3 ? `https://wa.me/${c.telefono}?text=${encodeURIComponent(`Hola ${(c.nombre || "").split(" ")[0]}, te escribo de ${n.nombre}. Leí lo que nos contaste y quería pedirte disculpas y ver cómo lo solucionamos.`)}` : null}; })};
      },
      async margenes({dias = 30} = {}) {
        const lim = addDays(ahora(), -dias), acc = {};
        const sumar = (pid, cant, precio, costo) => { const a = acc[pid] = acc[pid] || {cant: 0, ing: 0, cos: 0}; a.cant += cant; a.ing += cant * precio; a.cos += cant * (costo ?? (prod(pid) || {}).costo ?? 0); };
        (S.ventaItems || []).filter(x => parse(x.cuando) > lim).forEach(x => sumar(x.producto, x.cant, x.precio, x.costo));
        (S.pedidos || []).filter(p => p.estado === "entregado" && parse(p.inicio) > lim).forEach(p => p.items.forEach(it => sumar(it.producto, it.cant, it.precio, null)));
        const items = (S.productos || []).map(p => { const a = acc[p.id] || {cant: 0, ing: 0, cos: 0}, sc = p.costo == null;
          return {id: p.id, nombre: p.nombre, vendido: a.cant, ingresos: a.ing, ganancia: sc ? null : a.ing - a.cos,
                  margen: sc ? null : a.ing ? Math.round(1000 * (a.ing - a.cos) / a.ing) / 10 : (p.precio ? Math.round(1000 * (p.precio - p.costo) / p.precio) / 10 : null), sin_costo: sc}; })
          .sort((a, b) => (b.ganancia ?? -1) - (a.ganancia ?? -1));
        const vend = items.filter(x => x.vendido);
        return {dias, items, ingresos: vend.reduce((a, x) => a + x.ingresos, 0), ganancia: vend.reduce((a, x) => a + (x.ganancia || 0), 0), sin_costo: items.filter(x => x.sin_costo).length};
      },
      async comisiones({mes} = {}) {
        const m = mes || fdia(ahora()).slice(0, 7);
        const items = pros().map(p => { const ts = S.turnos.filter(t => t.pro === p.id && t.estado === "asistio" && t.inicio.startsWith(m)), fac = ts.reduce((a, t) => a + (t.precio || 0), 0);
          return {id: p.id, nombre: p.nombre, pct: p.comision ?? null, turnos: ts.length, facturado: fac, a_pagar: p.comision ? Math.round(fac * p.comision / 100) : 0,
                  pagado: (S.movimientos || []).some(x => x.ref === `comision:${p.id}:${m}`)}; });
        return {mes: m, items, total: items.reduce((a, x) => a + x.a_pagar, 0)};
      },
      async pagarComision({id: pid, mes}) {
        const co = await api.comisiones({mes}), x = co.items.find(i => i.id == pid);
        if (!x) throw new Err("No existe.");
        if (x.pagado) throw new Err("Esa comisión ya figura pagada.");
        if (!x.a_pagar) throw new Err("No hay nada para pagar: cargá el % de comisión o no atendió turnos ese mes.");
        const mv = mov("egreso", `Comisión ${x.nombre} · ${co.mes}`, x.a_pagar, "Sueldos y comisiones"); mv.ref = `comision:${pid}:${co.mes}`;
        DETALLE_D = `Pagó la comisión de ${x.nombre} (${pesos(x.a_pagar)}, ${co.mes})`; return {ok: true};
      },
      async resumen() {
        const h = ahora(), hoy = fdia(h), man = fdia(addDays(h, 1));
        const mh = S.movimientos.filter(m => m.fecha.startsWith(hoy)), ing = mh.filter(m => m.tipo === "ingreso").reduce((a, m) => a + m.monto, 0), egr = mh.filter(m => m.tipo === "egreso").reduce((a, m) => a + m.monto, 0);
        const th = S.turnos.filter(t => t.inicio.startsWith(hoy)), tm = S.turnos.filter(t => t.inicio.startsWith(man) && t.estado === "confirmado").sort((a, b) => a.inicio.localeCompare(b.inicio));
        const im = S.inscripciones.filter(i => i.fecha === man && i.estado === "confirmado").length, pm = (S.pedidos || []).filter(p => p.inicio.startsWith(man) && ["reservado", "listo"].includes(p.estado)).length;
        const em = (S.estadias || []).filter(e => e.desde === man && ["pendiente", "confirmada"].includes(e.estado)).length;
        const pl = (k, a, b) => `${k} ${k === 1 ? a : b}`;
        const L = [`📊 Resumen de ${n.nombre} · ${DIAS[wd(h)]} ${h.getDate()}/${h.getMonth() + 1}`, "", `💰 Entró hoy: ${pesos(ing)}${egr ? ` · salió ${pesos(egr)}` : ""}`, `💵 En la caja debería haber ${pesos(estadoCaja().esperado)} en efectivo`];
        if (th.length) { const k = e => th.filter(t => t.estado === e).length;
          L.push(`📅 Turnos de hoy: ${th.length - k("cancelado")}${k("asistio") ? ` · vinieron ${k("asistio")}` : ""}${k("ausente") ? ` · faltaron ${k("ausente")}` : ""}${k("cancelado") ? ` · cancelaron ${k("cancelado")}` : ""}`); }
        const prox = [tm.length ? `${pl(tm.length, "turno", "turnos")} (el primero a las ${hm(parse(tm[0].inicio))})` : "", im ? pl(im, "reserva de clase", "reservas de clase") : "", pm ? pl(pm, "pedido", "pedidos") : "", em ? pl(em, "entrada de huéspedes", "entradas de huéspedes") : ""].filter(Boolean);
        L.push("🗓️ Mañana: " + (prox.length ? prox.join(", ") : "nada agendado todavía"));
        (await api.gastos()).items.filter(g => g.activo !== false && !g.pagado && g.dias <= 3).forEach(g => L.push(`⚠️ ${g.concepto} (${pesos(g.monto)}) ${g.dias < 0 ? "venció" : g.dias === 0 ? "vence hoy" : `vence en ${pl(g.dias, "día", "días")}`}`));
        const bajos = (S.productos || []).filter(p => p.stock != null && p.stock <= (p.minimo || 0)).length; if (bajos) L.push(`📦 ${pl(bajos, "producto", "productos")} para reponer`);
        const malas = (S.opiniones || []).filter(o => o.nota <= 3 && (h - parse(o.cuando)) < 864e5).length; if (malas) L.push(`⭐ ${malas} opinión${malas > 1 ? "es" : ""} con nota baja: mirala${malas > 1 ? "s" : ""} en Clientes`);
        const texto = L.join("\n");
        return {texto, whatsapp: n.whatsapp ? `https://wa.me/${n.whatsapp}?text=${encodeURIComponent(texto)}` : null};
      },
      async fiado() {
        const por = new Map();
        for (const m of S.fiado || []) { if (!por.has(m.cliente)) por.set(m.cliente, []); por.get(m.cliente).push(m); }
        const out = [];
        for (const [cid, ms] of por) {
          const saldo = ms.reduce((a, m) => a + (m.tipo === "debe" ? m.monto : -m.monto), 0); if (saldo <= 0) continue;
          const c = S.clientes.find(x => x.id === cid) || {}, desde = ms.filter(m => m.tipo === "debe").map(m => m.cuando).sort()[0];
          out.push({nombre: c.nombre, telefono: c.telefono, saldo, desde, dias: Math.floor((ahora() - parse(desde)) / 864e5), movimientos: ms.slice(0, 10),
                    recordar: `https://wa.me/${c.telefono}?text=${encodeURIComponent(`Hola ${(c.nombre || "").split(" ")[0]}! Te escribo de ${n.nombre} para recordarte que tenés un saldo de ${pesos(saldo)} en tu cuenta. Cuando puedas, pasá o avisame si querés que te pase el alias. ¡Gracias!`)}`});
        }
        out.sort((a, b) => b.saldo - a.saldo);
        return {total: out.reduce((a, x) => a + x.saldo, 0), clientes: out};
      },
      async agregarFiado({nombre, telefono, monto, concepto}) {
        const tel = normTel(telefono || ""); if (!tel) throw new Err("Revisá el celular: código de área sin 0 y número sin 15.", "dato");
        if (String(nombre || "").trim().length < 2) throw new Err("Escribí el nombre.", "dato");
        monto = Math.round(Number(monto)); if (!(monto > 0)) throw new Err("Escribí el monto.", "dato");
        const c = cliente(nombre, tel, true);
        S.fiado = [{cliente: c.id, tipo: "debe", monto, concepto: String(concepto || "").trim() || null, quien: quienD(), cuando: fiso(ahora())}, ...(S.fiado || [])];
        DETALLE_D = `Le fió ${pesos(monto)} a ${c.nombre}${concepto ? ` (${concepto})` : ""}`; return {ok: true};
      },
      async pagarFiado({telefono, monto, medio}) {
        const c = S.clientes.find(x => x.telefono === telefono); if (!c) throw new Err("No existe.");
        const saldo = (S.fiado || []).filter(m => m.cliente === c.id).reduce((a, m) => a + (m.tipo === "debe" ? m.monto : -m.monto), 0);
        monto = Math.round(Number(monto)); if (!(monto > 0)) throw new Err("Escribí el monto.", "dato");
        if (monto > saldo) throw new Err(`Debe ${pesos(saldo)}: no puede pagar más que eso.`, "dato");
        S.fiado.unshift({cliente: c.id, tipo: "pago", monto, concepto: null, quien: quienD(), cuando: fiso(ahora())});
        mov("ingreso", `Pago de cuenta · ${c.nombre}`, monto, "Cobro de fiado", medio || "Efectivo");
        DETALLE_D = `Cobró ${pesos(monto)} de la cuenta de ${c.nombre}`; return {ok: true, saldo: saldo - monto};
      },
      // ── Presupuestos (talleres) ──
      async presupuestos() { return (S.presupuestos || []).slice().sort((a, b) => b.numero - a.numero).map(presDict); },
      async agregarPresupuesto({nombre, telefono, auto, patente, items, validez_dias = 15, nota}) {
        const tel = normTel(telefono || ""); if (!tel) throw new Err("Revisá el celular: código de área sin 0 y número sin 15.", "dato");
        if (String(nombre || "").trim().length < 2) throw new Err("Escribí el nombre.", "dato");
        const its = (items || []).filter(i => String(i.desc || "").trim()).map(i => ({desc: String(i.desc).trim(), cant: Number(i.cant) || 1, precio: Math.round(Number(i.precio) || 0)}));
        if (!its.length) throw new Err("Agregá al menos un ítem.", "dato");
        const c = cliente(nombre, tel, true), numero = Math.max(0, ...(S.presupuestos || []).map(x => x.numero)) + 1;
        const p = {id: "pr" + id(), numero, cliente: c.id, auto: String(auto || "").trim() || null, patente: String(patente || "").trim().toUpperCase() || null, items: its,
                   total: its.reduce((a, i) => a + i.cant * i.precio, 0), validez: fdia(addDays(ahora(), Number(validez_dias) || 15)), nota: String(nota || "").trim() || null,
                   estado: "enviado", codigo: codigo(), creado: fiso(ahora())};
        S.presupuestos = [...(S.presupuestos || []), p];
        DETALLE_D = `Armó el presupuesto N° ${numero} para ${c.nombre} (${pesos(p.total)})`; return presDict(p);
      },
      async estadoPresupuesto({id: pid, acepta}) {
        const p = (S.presupuestos || []).find(x => x.id === pid); if (!p) throw new Err("No existe.");
        p.estado = acepta ? "aceptado" : "rechazado"; DETALLE_D = `Marcó el presupuesto N° ${p.numero} como ${p.estado}`; return {ok: true};
      },
      async verPresupuesto({codigo: cod}) {
        let p = (S.presupuestos || []).find(x => x.codigo === cod);
        if (!p) { try {
          const d = JSON.parse(decodeURIComponent(escape(atob(new URLSearchParams(location.search).get("prd")))));
          const c = cliente(d.c || "Cliente", "5493870000000", true);
          p = {id: "pr" + id(), numero: d.n, cliente: c.id, auto: d.a, patente: d.pa, items: d.i, total: d.i.reduce((a, i) => a + i.cant * i.precio, 0), validez: d.v, nota: d.o, estado: d.e, codigo: cod, creado: fiso(ahora())};
          S.presupuestos = [...(S.presupuestos || []), p];
        } catch (e) { throw new Err("No encontramos ese presupuesto."); } }
        const d = presDict(p), c = S.clientes.find(x => x.id === p.cliente) || {};
        return {slug: n._demo, negocio: n.nombre, numero: p.numero, nombre: (c.nombre || "").split(" ")[0], auto: p.auto, patente: p.patente,
                items: p.items.map(i => ({...i, precio_txt: pesos(i.precio), subtotal_txt: pesos(i.cant * i.precio)})), total_txt: pesos(p.total),
                validez: `${p.validez.slice(8)}/${p.validez.slice(5, 7)}/${p.validez.slice(0, 4)}`, nota: p.nota, estado: d.estado,
                whatsapp: n.whatsapp ? `https://wa.me/${n.whatsapp}?text=${encodeURIComponent(`Hola! Tengo una consulta sobre el presupuesto N° ${p.numero}.`)}` : null};
      },
      async responderPresupuesto({codigo: cod, acepta}) {
        const p = (S.presupuestos || []).find(x => x.codigo === cod); if (!p) throw new Err("No encontramos ese presupuesto.");
        if (p.estado !== "enviado") throw new Err("Este presupuesto ya fue respondido.");
        if (p.validez < fdia(ahora())) throw new Err("Este presupuesto venció. Escribinos y te lo actualizamos.");
        p.estado = acepta ? "aceptado" : "rechazado"; emit("presupuesto", {numero: p.numero, acepta}); return {ok: true, slug: n._demo};
      },
      async actividad({quien} = {}) {
        const it = S.actividad || [];
        return {quienes: [...new Set(it.map(x => x.quien))].sort(), items: it.filter(x => !quien || x.quien === quien).slice(0, 200)};
      },
      async usuarios() { return (n.usuarios || []).map(u => ({...u, clave: undefined})); },
      async agregarUsuario({nombre, usuario, clave, rol}) {
        usuario = String(usuario || "").trim().toLowerCase();
        if (!nombre || String(nombre).trim().length < 2) throw new Err("Escribí el nombre.", "dato");
        if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) throw new Err("El usuario va en minúsculas, sin espacios (letras, números, punto o guion). Ej: caro.salon", "dato");
        if (!ROLES.includes(rol)) throw new Err("Elegí el rol.", "dato");
        if (String(clave || "").length < 8 || (/^\d+$/.test(clave) && new Set(clave).size < 3)) throw new Err("La contraseña tiene que tener al menos 8 caracteres (y no 11111111).", "dato");
        if ((n.usuarios || []).some(u => u.usuario === usuario)) throw new Err("Ese usuario ya existe. Probá con otro (por ejemplo, agregale el nombre del negocio).", "dato");
        const u = {id: "us" + id(), nombre: String(nombre).trim(), usuario, rol, activo: true, ultimo: null};
        n.usuarios = [...(n.usuarios || []), u]; return {ok: true, usuario: u};
      },
      async cambiarUsuario({id: uid, activo, clave, rol}) {
        const u = (n.usuarios || []).find(x => x.id === uid); if (!u) throw new Err("No existe.");
        if (rol != null) { if (!ROLES.includes(rol)) throw new Err("Elegí el rol.", "dato"); u.rol = rol; }
        if (clave != null && String(clave).length < 8) throw new Err("La contraseña tiene que tener al menos 8 caracteres (y no 11111111).", "dato");
        if (activo != null) u.activo = !!activo;
        return {ok: true};
      },
      async salir() { return {ok: true}; },
      // Demo: simula que Mercado Pago aprobó el pago de la seña (no se cobra nada).
      _pagarSenaDemo(cod) {
        const t = S.turnos.find(x => x.codigo === cod);
        if (t) {
          if (t.estado === "cancelado") throw new Err("Pasaron los 30 minutos y el turno se liberó. Sacá uno nuevo.");
          if (!t.sena_pagada) { t.sena_pagada = fiso(ahora()); const c = S.clientes.find(x => x.id === t.cliente) || {}; mov("ingreso", `Seña ${serv(t.servicio).nombre} · ${c.nombre}`, t.sena, "Servicios", "Mercado Pago"); emit("sena", t); }
          return {ok: true, monto: pesos(t.sena)};
        }
        const e = (S.estadias || []).find(x => x.codigo === cod); if (!e) throw new Err("No existe.");
        if (e.estado === "pendiente") { e.pagado = e.sena; e.estado = "confirmada"; const c = S.clientes.find(x => x.id === e.cliente) || {}; mov("ingreso", `Seña ${unidad(e.unidad).nombre} · ${c.nombre}`, e.sena, "Reservas", "Mercado Pago"); emit("sena", e); }
        return {ok: true, monto: pesos(e.sena)};
      },
      _verComo(r) { if (ROLES.includes(r)) ROL = r; },
      suscribir(f) { subs.push(f); return () => { const i = subs.indexOf(f); if (i >= 0) subs.splice(i, 1); }; },
      _S: S,
    };
    // Antes de cada consulta, vencer lo que nadie retiró (como hace el servidor). Y cada minuto, por si la página queda abierta.
    // También controla el permiso del rol, igual que el servidor.
    for (const k of Object.keys(api)) {
      if (typeof api[k] !== "function" || k.startsWith("_") || k === "suscribir") continue;
      const f = api[k]; api[k] = function () {
        if (!puedeRol(ROL, k)) return Promise.reject(new Err("Tu usuario no tiene permiso para esto. Pedíselo al dueño.", "permiso"));
        vencer();
        const args = arguments, panelM = ACCION_M[k] && !(["reservarTurno", "inscribir", "reservarEstadia"].includes(k) && !(args[0] && args[0].origen === "panel"));
        if (!panelM) return f.apply(api, args);
        DETALLE_D = null;
        return Promise.resolve(f.apply(api, args)).then(r => {
          S.actividad = S.actividad || [];
          S.actividad.unshift({quien: ROL === "dueño" ? "Dueño" : ROL === "encargado" ? "Lucho (ejemplo)" : "Caro (ejemplo)", rol: ROL, accion: DETALLE_D || ACCION_M[k], cuando: fiso(ahora())});
          return r;
        });
      };
    }
    if (typeof setInterval === "function") setInterval(vencer, 60000);
    return api;
  }

  // ── Datos de ejemplo ──────────────────────────────────────────────
  const hoy = () => new Date();
  const H = (dias, desde, hasta) => dias.map(dia => ({dia, desde, hasta}));
  const LV = [0, 1, 2, 3, 4];
  const NOMBRES = ["Lucía Gómez", "Sofía Ruiz", "Valentina Díaz", "Martina López", "Camila Torres", "Florencia Paz", "Agustina Vera", "Julieta Ríos",
                   "Micaela Sosa", "Paula Correa", "Carla Medina", "Rocío Aguirre", "Natalia Cruz", "Belén Ortiz", "Daniela Cáceres", "Romina Juárez",
                   "Martín Flores", "Nicolás Herrera", "Matías Romero", "Facundo Ibáñez", "Joaquín Mendoza", "Lautaro Vargas", "Tomás Quiroga", "Franco Guzmán",
                   "Santiago Arias", "Ezequiel Toledo", "Gonzalo Benítez", "Ignacio Moreno", "Leandro Sánchez", "Diego Castro"];
  const NOM = ["Lucía", "Sofía", "Valentina", "Martina", "Camila", "Florencia", "Agustina", "Julieta", "Micaela", "Paula", "Carla", "Rocío", "Natalia", "Belén", "Daniela", "Romina",
               "Martín", "Nicolás", "Matías", "Facundo", "Joaquín", "Lautaro", "Tomás", "Franco", "Santiago", "Ezequiel", "Gonzalo", "Ignacio", "Leandro", "Diego", "Mariana", "Gabriela",
               "Pablo", "Hernán", "Cecilia", "Verónica", "Sebastián", "Andrea", "Emilia", "Bruno"];
  const APE = ["Gómez", "Ruiz", "Díaz", "López", "Torres", "Paz", "Vera", "Ríos", "Sosa", "Correa", "Medina", "Aguirre", "Cruz", "Ortiz", "Cáceres", "Juárez", "Flores", "Herrera",
               "Romero", "Ibáñez", "Mendoza", "Vargas", "Quiroga", "Guzmán", "Arias", "Toledo", "Benítez", "Moreno", "Sánchez", "Castro", "Zerpa", "Saravia", "Chocobar", "Mamaní", "Cruz", "Tolaba"];
  for (let i = 0; NOMBRES.length < 90; i++) { const x = `${NOM[(i * 7) % NOM.length]} ${APE[(i * 11 + 5) % APE.length]}`; if (!NOMBRES.includes(x)) NOMBRES.push(x); }
  let rnd = 7; const R = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
  const telDe = i => `549387555${String(1000 + i).slice(-4)}`;
  const clientesBase = (k = 20, off = 0) => NOMBRES.slice(off, off + k).map((nombre, i) => ({id: i + 1, nombre, telefono: telDe(i + off), acepta: true}));
  const movsBase = (lista) => {
    const out = [], h = hoy(); let i = 1;
    for (const [dia, tipo, concepto, monto, cat, medio] of lista) {
      const d = new Date(h.getFullYear(), h.getMonth(), Math.min(dia, h.getDate()), 10 + (i % 8), (i * 7) % 60);
      out.push({id: 500 + i++, fecha: `${fdia(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`, tipo, concepto, monto, cat, medio: medio || "Efectivo"});
    }
    return out;
  };
  const habiles = (S, k) => { const out = []; for (let i = 0; out.length < k && i < 14; i++) { const x = addDays(hoy(), i), hs = S.negocio.horarios.filter(h => h.dia === wd(x)); if (hs.length && (i > 0 || hs.some(h => atTime(x, h.hasta) > hoy()))) out.push(x); } return out; };
  // Coloca k turnos de ejemplo en un día respetando horarios, profesionales y capacidad
  let seedN = 0;
  function colocarTurnos(S, dia, k, pasadoForzado) {
    const h = hoy();
    for (let j = 0; j < k; j++) {
      const s = S.servicios[Math.floor(R() * S.servicios.length)];
      const modal = s.modalidad === "domicilio" ? "domicilio" : (s.modalidad === "ambos" && R() < .3 ? "domicilio" : "local");
      const dur = s.min + (modal === "domicilio" ? (s.margen || 0) : 0);
      const cand = [];
      for (const f of S.negocio.horarios.filter(x => x.dia === wd(dia))) for (let t = atTime(dia, f.desde); addMin(t, dur) <= atTime(dia, f.hasta); t = addMin(t, S.negocio.paso || 30)) cand.push(t);
      if (!cand.length) continue;
      const t = cand[Math.floor(R() * cand.length)], fin = addMin(t, dur);
      const prosOk = (S.profesionales || []).filter(p => (!s.pros || s.pros.includes(p.id)) && (!p.dias || p.dias.includes(wd(dia))) && (!p.modalidad || p.modalidad === "ambos" || p.modalidad === modal));
      const libre = prosOk.find(p => !S.turnos.some(x => x.pro === p.id && x.estado !== "cancelado" && parse(x.inicio) < fin && parse(x.fin) > t));
      if (prosOk.length && !libre) continue;
      if (!prosOk.length && S.turnos.filter(x => x.estado !== "cancelado" && parse(x.inicio) < fin && parse(x.fin) > t).length >= (S.negocio.capacidad || 1)) continue;
      const c = S.clientes[Math.floor(Math.pow(R(), 1.6) * S.clientes.length)];
      const pasado = pasadoForzado || fin < h, r = R();
      S.turnos.push({id: 20000 + seedN, codigo: "seed" + seedN++, servicio: s.id, pro: libre ? libre.id : null, cliente: c.id, inicio: fiso(t), fin: fiso(fin),
                     estado: pasado ? (r < .9 ? "asistio" : r < .97 ? "ausente" : "cancelado") : "confirmado", modalidad: modal,
                     direccion: modal === "domicilio" ? ["Barrio Grand Bourg", "Barrio Tres Cerritos", "Villa San Lorenzo", "Barrio Castañares"][j % 4] + ", Salta" : "",
                     extra: S.extraSeed ? S.extraSeed(seedN) : {}, origen: R() < .62 ? "web" : "panel", ...(() => {
                       const cob = (S.negocio.coberturas || []).length ? (seedN % 5 < 2 ? "particular" : S.negocio.coberturas[seedN % S.negocio.coberturas.length].id) : null;
                       const pt = precioTurno(S.negocio, s, t, cob); return {precio: pt.precio, cobertura: pt.cobertura}; })(), creado: fiso(addDays(t, -2))});
    }
  }
  function sembrarTurnos(api, S, cuantos, dias = 3) {
    rnd = 11;
    habiles(S, dias).forEach((dia, d) => colocarTurnos(S, dia, cuantos[d] || 0));
  }
  const pasados = (S, k) => { const out = []; for (let i = 1; out.length < k && i < 120; i++) { const x = addDays(hoy(), -i); if (S.negocio.horarios.some(h => h.dia === wd(x))) out.push(x); } return out; };
  // Historia de las últimas semanas: alimenta Clientes, Números y la caja del mes
  function historia(S, {porDia = 0, pedidosDia = 0, semanas = 7, clasesLlenas = 0} = {}) {
    rnd = 23;
    const dias = pasados(S, semanas * 6);
    const factor = d => [0.8, 0.9, 1, 1, 1.25, 1.35, 0.7][wd(d)];
    if (porDia) dias.forEach(d => colocarTurnos(S, d, Math.round(porDia * factor(d) * (0.75 + R() * 0.5)), true));
    if (pedidosDia && S.productos.length) {
      let k = 0;
      for (const d of dias) {
        const n = Math.round(pedidosDia * factor(d) * (0.6 + R() * 0.8));
        for (let j = 0; j < n; j++) {
          const items = [], usados = new Set(), m = 1 + Math.floor(R() * 3);
          for (let q = 0; q < m; q++) {
            const p = S.productos[Math.floor(Math.pow(R(), 1.4) * S.productos.length)];
            if (usados.has(p.id)) continue; usados.add(p.id);
            items.push({producto: p.id, nombre: p.nombre, cant: p.unidad === "m" ? 5 + Math.floor(R() * 20) : 1 + Math.floor(R() * 2), precio: p.precio, unidad: p.unidad || "u"});
          }
          const hs = S.negocio.horarios.filter(x => x.dia === wd(d)); if (!hs.length) continue;
          const f = hs[Math.floor(R() * hs.length)], t = addMin(atTime(d, f.desde), Math.floor(R() * Math.max(1, (min(f.hasta) - min(f.desde)) / 30)) * 30);
          const envio = S.negocio.entrega && S.negocio.entrega.envio && R() < .3 ? S.negocio.entrega.envio.costo : 0;
          const c = S.clientes[Math.floor(Math.pow(R(), 1.5) * S.clientes.length)];
          S.pedidos.push({id: 40000 + k, numero: 0, codigo: "hp" + k++, cliente: c.id, items, envio, total: items.reduce((a, i) => a + i.cant * i.precio, 0) + envio,
                          entrega: envio ? "envio" : "retiro", inicio: fiso(t), franja: hm(t), direccion: envio ? "Barrio Castañares, Salta" : "", nota: "",
                          estado: R() < .95 ? "entregado" : "cancelado", creado: fiso(addDays(t, -1)), historico: true});
        }
      }
      // numeración correlativa por fecha
      S.pedidos.sort((a, b) => a.inicio.localeCompare(b.inicio)).forEach(p => { if (p.historico) p.numero = ++S.numPedido; });
    }
    if (clasesLlenas && S.clases.length) {
      let k = 0;
      for (const d of dias.slice(0, 30)) {
        for (const c of S.clases.filter(c => c.dias.includes(wd(d)))) {
          const n = Math.floor(c.cupo * (clasesLlenas * (0.6 + R() * 0.5))), usados = new Set();
          for (let j = 0; j < Math.min(n, c.cupo); j++) {
            const si = Math.floor(Math.pow(R(), 1.3) * S.clientes.length); if (usados.has(si)) continue; usados.add(si);
            S.inscripciones.push({id: 60000 + k, codigo: "hc" + k++, clase: c.id, fecha: fdia(d), inicio: fiso(atTime(d, c.hora)), cliente: S.clientes[si].id,
                                  estado: "confirmado", asistio: R() < .86, creado: fiso(addDays(d, -1))});
          }
        }
      }
    }
    // Caja del mes: los cobros salen de lo que pasó, día por día
    const mes = fdia(hoy()).slice(0, 7);
    S.movimientos = S.movimientos.filter(m => !(m.tipo === "ingreso" && ["Servicios", "Ventas"].concat(S.negocio.solo_socios ? ["Cuotas"] : []).includes(m.cat)));
    let mi = 9000;
    if (S.negocio.solo_socios) (S.socios || []).forEach((so, i) => {
      const h0 = hoy(), pago = new Date(h0.getFullYear(), h0.getMonth(), 1 + (i % 10), 10);
      if (so.vence >= fdia(h0) && pago <= h0) S.movimientos.push({id: mi++, fecha: `${fdia(pago)}T${pad(9 + i % 11)}:${pad((i * 7) % 60)}:00`, tipo: "ingreso", concepto: `Cuota ${((S.negocio.planes || []).find(p => p.id === so.plan) || {nombre: so.plan}).nombre} · ${so.nombre}`, monto: ((S.negocio.planes || []).find(p => p.id === so.plan) || {precio: S.negocio.cuota}).precio, cat: "Cuotas", medio: i % 3 ? "Transferencia" : "Efectivo"});
    });
    for (const d of dias.filter(d => fdia(d).startsWith(mes))) {
      const k = fdia(d);
      const tur = S.turnos.filter(t => t.estado === "asistio" && t.inicio.startsWith(k)).reduce((a, t) => a + (t.precio || 0), 0);
      const ped = S.pedidos.filter(p => p.estado === "entregado" && p.inicio.startsWith(k)).reduce((a, p) => a + p.total, 0);
      if (tur) S.movimientos.push({id: mi++, fecha: `${k}T20:30:00`, tipo: "ingreso", concepto: "Turnos del día", monto: tur, cat: "Servicios", medio: "Varios"});
      if (ped) S.movimientos.push({id: mi++, fecha: `${k}T20:45:00`, tipo: "ingreso", concepto: "Pedidos entregados", monto: ped, cat: "Ventas", medio: "Varios"});
      if (S.productos.length && S.negocio.rubro !== "cafe") { const v = Math.round((ped * (0.6 + R())) / 100) * 100; if (v) S.movimientos.push({id: mi++, fecha: `${k}T21:00:00`, tipo: "ingreso", concepto: "Ventas en el local", monto: v, cat: "Ventas", medio: "Varios"}); }
    }
  }
  const min = t => { const [a, b] = t.split(":").map(Number); return a * 60 + b; };

  const SEEDS = {
    belleza: () => {
      const S = {
        negocio: {nombre: "Salón Ámbar", rubro: "belleza", direccion: "Barrio Tres Cerritos, Salta", maps: "https://maps.google.com/?q=Tres+Cerritos+Salta", whatsapp: "5493870000000",
                  horarios: [...H(LV, "09:00", "20:00"), ...H([5], "09:00", "14:00")], paso: 30, anticipacion: 60, dias_agenda: 21, recurso: "Profesional",
                  bienvenida: "¡Hola! Gracias por escribir a Salón Ámbar 💛 Sacá tu turno en 1 minuto acá:", link: "salonambar.com.ar/turnos"},
        profesionales: [{id: 1, nombre: "Caro", rol: "Uñas", color: "#E8772E", dias: [0, 1, 2, 3, 4, 5]}, {id: 2, nombre: "Juli", rol: "Peluquería", color: "#2F6FDE", dias: [1, 2, 3, 4, 5]},
                        {id: 3, nombre: "Meli", rol: "Pestañas y cejas", color: "#24946A", dias: [0, 1, 2, 3, 4]},
                        {id: 4, nombre: "Lu", rol: "Uñas", color: "#7A5AF8", dias: [2, 3, 4, 5]}],
        servicios: [
          {id: 1, cat: "Uñas", nombre: "Esmaltado semipermanente", desc: "Manos, color a elección", precio: 12000, min: 60, pros: [1, 4]},
          {id: 2, cat: "Uñas", nombre: "Kapping gel", desc: "Refuerzo sobre uña natural", precio: 15000, min: 90, pros: [1, 4]},
          {id: 3, cat: "Uñas", nombre: "Esculpidas", desc: "Largo y forma a elección", precio: 22000, min: 120, pros: [1, 4]},
          {id: 4, cat: "Uñas", nombre: "Retiro", desc: "De semi o gel", precio: 5000, min: 30, pros: [1, 4]},
          {id: 5, cat: "Peluquería", nombre: "Corte y peinado", desc: "Lavado incluido", precio: 10000, min: 45, pros: [2]},
          {id: 6, cat: "Peluquería", nombre: "Color raíz", desc: "Con lavado y secado", precio: 25000, min: 120, pros: [2]},
          {id: 7, cat: "Peluquería", nombre: "Mechas balayage", desc: "Incluye matizado", precio: 48000, min: 180, pros: [2]},
          {id: 8, cat: "Peluquería", nombre: "Brushing", desc: "", precio: 8000, min: 45, pros: [2]},
          {id: 9, cat: "Pestañas y cejas", nombre: "Lifting de pestañas", desc: "Con tinte", precio: 14000, min: 60, pros: [3]},
          {id: 10, cat: "Pestañas y cejas", nombre: "Perfilado de cejas", desc: "Con pinza o hilo", precio: 6000, min: 30, pros: [3]},
          {id: 11, cat: "Pestañas y cejas", nombre: "Extensiones pelo a pelo", desc: "Primera colocación", precio: 28000, min: 120, pros: [3]}],
        clientes: clientesBase(60), turnos: [], inscripciones: [], clases: [], actividades: [], productos: [], pedidos: [],
        movimientos: movsBase([[1, "egreso", "Alquiler del local", 380000, "Alquiler", "Transferencia"], [2, "egreso", "Esmaltes y geles (proveedor)", 96000, "Insumos", "Transferencia"],
                               [3, "ingreso", "Servicios de la semana", 412000, "Servicios"], [5, "egreso", "Luz", 42000, "Servicios públicos", "Débito"],
                               [8, "ingreso", "Servicios de la semana", 468000, "Servicios"], [10, "egreso", "Tinturas y oxidantes", 74000, "Insumos", "Transferencia"],
                               [15, "ingreso", "Servicios de la semana", 451000, "Servicios"], [16, "egreso", "Internet", 21000, "Servicios públicos", "Débito"]]),
        cajaInicial: 150000,
      };
      S._post = api => { historia(S, {porDia: 9}); sembrarTurnos(api, S, [16, 12, 9]); };
      return S;
    },
    taller: () => {
      const S = {
        negocio: {nombre: "Taller Ruta 9", rubro: "taller", direccion: "Av. Bolivia y Ruta 9, Salta", maps: "https://maps.google.com/?q=Salta", whatsapp: "5493870000000",
                  horarios: [...H(LV, "08:00", "18:00"), ...H([5], "08:30", "13:00")], paso: 30, anticipacion: 120, dias_agenda: 14, recurso: "Elevador", elegir_pro: false,
                  zona_domicilio: "Salta Capital, Vaqueros y San Lorenzo",
                  campos_extra: [{id: "auto", label: "Auto (marca, modelo y año)", ph: "Ej: Fiat Cronos 2021", req: true}, {id: "patente", label: "Patente", ph: "AB 123 CD", req: true},
                                 {id: "problema", label: "¿Qué le pasa? (opcional)", ph: "Ruido al frenar, luz de motor…", req: false}],
                  bienvenida: "¡Hola! Te habla Taller Ruta 9 🔧 Pedí turno (en el taller o a domicilio) acá:", link: "tallerruta9.com.ar/turnos"},
        profesionales: [{id: 1, nombre: "Elevador 1", rol: "", color: "#E8772E", modalidad: "local"}, {id: 2, nombre: "Elevador 2", rol: "", color: "#2F6FDE", modalidad: "local"},
                        {id: 3, nombre: "Móvil", rol: "Domicilio", color: "#24946A", modalidad: "domicilio"}],
        servicios: [
          {id: 1, cat: "Mantenimiento", nombre: "Service completo", desc: "Aceite, filtros y revisión de 30 puntos", precio: 85000, min: 120, modalidad: "ambos", margen: 60, pros: [1, 2, 3]},
          {id: 2, cat: "Mantenimiento", nombre: "Cambio de aceite y filtro", desc: "Aceite sintético incluido", precio: 52000, min: 60, modalidad: "ambos", margen: 60, pros: [1, 2, 3]},
          {id: 3, cat: "Frenos y tren delantero", nombre: "Pastillas de freno", desc: "Mano de obra, sin repuesto", precio: 38000, min: 90, modalidad: "local", pros: [1, 2]},
          {id: 4, cat: "Frenos y tren delantero", nombre: "Alineación y balanceo", desc: "Las cuatro ruedas", precio: 35000, min: 60, modalidad: "local", pros: [1, 2]},
          {id: 5, cat: "Diagnóstico", nombre: "Diagnóstico con escáner", desc: "Lectura de fallas y presupuesto", precio: 25000, min: 45, modalidad: "ambos", margen: 45, pros: [1, 2, 3]},
          {id: 6, cat: "Diagnóstico", nombre: "Revisión antes de la VTV", desc: "Te decimos qué arreglar antes de ir", precio: 30000, min: 60, modalidad: "local", pros: [1, 2]},
          {id: 7, cat: "Urgencias", nombre: "Batería (prueba o cambio)", desc: "Vamos adonde quedó el auto", precio: 18000, min: 30, modalidad: "domicilio", margen: 45, pros: [3]}],
        clientes: clientesBase(50, 16), turnos: [], inscripciones: [], clases: [], actividades: [], productos: [], pedidos: [],
        extraSeed: i => ({auto: ["Fiat Cronos 2021", "Toyota Hilux 2018", "VW Gol Trend 2016", "Peugeot 208 2022", "Ford Ranger 2019", "Renault Kangoo 2017"][i % 6],
                          patente: ["AE 512 KD", "AC 903 LP", "AA 118 QT", "AF 271 MZ", "AD 640 RS", "OKM 451"][i % 6], problema: i % 3 ? "" : "Ruido en el tren delantero"}),
        movimientos: movsBase([[1, "egreso", "Alquiler del galpón", 520000, "Alquiler", "Transferencia"], [3, "ingreso", "Trabajos de la semana", 1240000, "Servicios"],
                               [4, "egreso", "Repuestos (proveedor)", 610000, "Repuestos", "Transferencia"], [9, "ingreso", "Trabajos de la semana", 1385000, "Servicios"],
                               [11, "egreso", "Combustible del móvil", 85000, "Movilidad"], [16, "ingreso", "Trabajos de la semana", 1190000, "Servicios"]]),
        cajaInicial: 400000,
      };
      S._post = api => { historia(S, {porDia: 6}); sembrarTurnos(api, S, [9, 7, 5]); };
      return S;
    },
    gimnasio: () => {
      const act = [{id: 1, nombre: "Funcional", desc: "Fuerza y resistencia en circuito", color: "#E8772E"}, {id: 2, nombre: "Crossfit", desc: "Alta intensidad", color: "#C2412D"},
                   {id: 3, nombre: "Spinning", desc: "Bici fija con música", color: "#2F6FDE"}, {id: 4, nombre: "Boxeo", desc: "Técnica y guantes", color: "#18212F"},
                   {id: 5, nombre: "Yoga", desc: "Movilidad y respiración", color: "#24946A"}, {id: 6, nombre: "Musculación", desc: "Sala de pesas por turno", color: "#7A5AF8"}];
      const clases = []; let cid = 1;
      const C = (actividad, dias, horas, min, cupo, profe) => horas.forEach(hora => clases.push({id: cid++, actividad, dias, hora, min, cupo, profe}));
      C(1, LV, ["07:00", "09:00", "18:00", "19:00"], 50, 15, "Nico");
      C(2, LV, ["08:00", "19:30", "20:30"], 60, 12, "Fede");
      C(3, [0, 2, 4], ["07:30", "18:30"], 45, 20, "Vale");
      C(4, [1, 3], ["20:00"], 60, 16, "Rodrigo"); C(4, [5], ["10:00"], 60, 16, "Rodrigo");
      C(5, [1, 3], ["09:30"], 60, 12, "Ana"); C(5, [5], ["11:00"], 60, 12, "Ana");
      C(6, LV, ["07:00", "08:00", "09:00", "10:00", "17:00", "18:00", "19:00", "20:00", "21:00"], 60, 25, "Sala"); C(6, [5], ["09:00", "10:00", "11:00", "12:00"], 60, 25, "Sala");
      const socios = NOMBRES.map((nombre, i) => {
        const v = addDays(hoy(), i === 1 ? -6 : i % 9 === 4 ? -2 : i % 7 === 3 ? 2 : 6 + (i * 3) % 24);
        const plan = i % 17 === 8 ? "quincena" : i % 13 === 6 ? "pack8" : ["libre", "3x", "2x", "musc"][i % 4];
        return {telefono: telDe(i), nombre, plan, vence: fdia(plan === "quincena" ? addDays(hoy(), 9) : v), restantes: plan === "pack8" ? 5 : 0};
      });
      const S = {
        negocio: {nombre: "Gimnasio Altura", rubro: "gimnasio", direccion: "Av. Paraguay 2100, Salta", maps: "https://maps.google.com/?q=Salta", whatsapp: "5493870000000",
                  horarios: [...H(LV, "07:00", "22:00"), ...H([5], "09:00", "13:00")], anticipacion_clase: 15, solo_socios: true, cuota: 35000,
                  planes: [{id: "musc", nombre: "Musculación", precio: 30000, dias: 30, actividades: [6], por_semana: null, clases: null},
                           {id: "2x", nombre: "Clases 2 veces por semana", precio: 28000, dias: 30, actividades: [1, 2, 3, 4, 5], por_semana: 2, clases: null},
                           {id: "3x", nombre: "Clases 3 veces por semana", precio: 35000, dias: 30, actividades: [1, 2, 3, 4, 5], por_semana: 3, clases: null},
                           {id: "libre", nombre: "Pase libre", precio: 45000, dias: 30, actividades: [], por_semana: null, clases: null},
                           {id: "quincena", nombre: "Quincena", precio: 22000, dias: 15, actividades: [], por_semana: null, clases: null},
                           {id: "pack8", nombre: "Pack 8 clases", precio: 26000, dias: 45, actividades: [1, 2, 3, 4, 5], por_semana: null, clases: 8},
                           {id: "suelta", nombre: "Clase suelta", precio: 5000, dias: 1, actividades: [], por_semana: null, clases: null, suelta: true}],
                  bienvenida: "¡Hola! Somos Gimnasio Altura 💪 Reservá tu lugar en las clases acá:", link: "gimnasioaltura.com.ar/clases",
                  textos: {prueba: "Probá con el celular 387 555 1000 (Lucía, pase libre), 387 555 1001 (Sofía, cuota vencida) o 387 555 1003 (Martina, solo musculación: probá anotarla en crossfit)."}},
        actividades: act, clases, socios, clientes: socios.map((s, i) => ({id: i + 1, nombre: s.nombre, telefono: s.telefono, acepta: true})),
        servicios: [], turnos: [], inscripciones: [], productos: [], pedidos: [],
        movimientos: movsBase([[1, "egreso", "Alquiler", 900000, "Alquiler", "Transferencia"], [2, "ingreso", "Cuotas del día", 420000, "Cuotas", "Transferencia"],
                               [3, "ingreso", "Cuotas del día", 385000, "Cuotas", "Transferencia"], [5, "egreso", "Sueldos profes (adelanto)", 650000, "Sueldos", "Transferencia"],
                               [7, "ingreso", "Cuotas del día", 280000, "Cuotas", "Efectivo"], [10, "egreso", "Luz", 168000, "Servicios públicos", "Débito"],
                               [12, "ingreso", "Cuotas del día", 245000, "Cuotas", "Transferencia"], [15, "egreso", "Mantenimiento de bicis", 95000, "Mantenimiento"]]),
        cajaInicial: 600000,
      };
      S._post = () => {
        historia(S, {clasesLlenas: 0.55});
        rnd = 5; let k = 1;
        for (const dia of habiles(S, 3)) {
          const f = fdia(dia);
          for (const c of clases.filter(c => c.dias.includes(wd(dia)))) {
            const lleno = Math.floor(c.cupo * (c.actividad === 6 ? .3 + R() * .4 : .4 + R() * .55));
            const usados = new Set();
            for (let j = 0; j < lleno; j++) {
              const si = 2 + Math.floor(R() * (S.clientes.length - 2));
              if (usados.has(si)) continue; usados.add(si);
              const ini = atTime(dia, c.hora);
              S.inscripciones.push({id: 3000 + k, codigo: "seedc" + k++, clase: c.id, fecha: f, inicio: fiso(ini), cliente: S.clientes[si].id,
                                    estado: "confirmado", asistio: ini < hoy() ? R() < .85 : null, creado: fiso(hoy())});
            }
          }
        }
      };
      return S;
    },
    mates: () => {
      const P = (id, cat, nombre, desc, precio, stock, minimo, costo) => ({id, cat, nombre, desc, precio, stock, minimo, costo});
      const S = {
        negocio: {nombre: "Matería Puna", rubro: "mates", direccion: "Paseo Balcarce 450, Salta", maps: "https://maps.google.com/?q=Balcarce+Salta", whatsapp: "5493870000000",
                  horarios: [...H(LV, "10:00", "13:30"), ...H(LV, "17:00", "21:30"), ...H([5], "10:00", "14:00")],
                  entrega: {retiro: {min: 30, cupo: 4, anticipacion: 30, dias: 5}, envio: {min: 120, cupo: 3, anticipacion: 120, dias: 5, costo: 4000, zona: "Salta Capital"}},
                  bienvenida: "¡Hola! Matería Puna 🧉 Mirá el catálogo con stock y precios, y reservá para retirar o recibir:", link: "materiapuna.com.ar"},
        productos: [
          P(1, "Mates", "Mate imperial de calabaza", "Virola de alpaca cincelada", 38000, 4, 2, 21000), P(2, "Mates", "Mate camionero", "Calabaza seleccionada, cuero crudo", 28000, 6, 2, 15000),
          P(3, "Mates", "Mate de algarrobo", "Torneado a mano en Salta", 15000, 9, 3, 7000), P(4, "Mates", "Mate torpedo", "Calabaza forrada en cuero", 22000, 3, 2, 11500),
          P(5, "Mates", "Mate de vidrio forrado", "Ideal para empezar", 9500, 12, 4, 4500),
          P(6, "Bombillas", "Bombilla pico de loro de alpaca", "Filtro desarmable", 14000, 7, 3, 7000), P(7, "Bombillas", "Bombilla de acero", "Resorte, fácil de limpiar", 6500, 20, 5, 3000),
          P(8, "Bombillas", "Bombilla chata de alpaca", "Trabajo artesanal", 9000, 2, 2, 4800),
          P(9, "Termos", "Termo acero 1 L pico cebador", "Mantiene 24 h", 45000, 5, 2, 29000), P(10, "Termos", "Termo acero 1,2 L", "Con manija", 52000, 2, 1, 34000),
          P(11, "Yerbas", "Yerba barbacuá 1 kg", "Secado a leña", 6800, 30, 10, 4200), P(12, "Yerbas", "Yerba orgánica 500 g", "Sin palo", 4200, 18, 6, 2500),
          P(13, "Materas", "Matera de cuero", "Con lugar para termo, mate y yerbera", 42000, 3, 1, 23000), P(14, "Materas", "Yerbera y azucarera", "Lata con tapa", 11000, 8, 3, 5500),
          P(15, "Sets", "Set matero completo", "Mate imperial, bombilla, termo y matera", 125000, 2, 1, 72000)],
        clientes: clientesBase(55), servicios: [], turnos: [], inscripciones: [], clases: [], actividades: [], pedidos: [], numPedido: 1041,
        movimientos: movsBase([[1, "egreso", "Alquiler del local", 450000, "Alquiler", "Transferencia"], [2, "ingreso", "Ventas del día", 186000, "Ventas"],
                               [3, "egreso", "Calabazas (artesano)", 240000, "Mercadería", "Transferencia"], [4, "ingreso", "Ventas del día", 224000, "Ventas", "Transferencia"],
                               [8, "ingreso", "Ventas del día", 152000, "Ventas"], [9, "egreso", "Yerba (distribuidora)", 168000, "Mercadería", "Transferencia"],
                               [12, "ingreso", "Ventas del día", 310000, "Ventas", "Transferencia"], [14, "egreso", "Luz", 38000, "Servicios públicos", "Débito"],
                               [16, "ingreso", "Ventas del día", 198000, "Ventas"]]),
        cajaInicial: 250000,
      };
      S._post = api => { historia(S, {pedidosDia: 3}); sembrarPedidos(S, [[2, 1, 7, 1], [11, 2], [3, 1, 6, 1], [5, 1]]); };
      return S;
    },
    ferreteria: () => {
      const P = (id, cat, nombre, desc, precio, stock, minimo, costo, unidad) => ({id, cat, nombre, desc, precio, stock, minimo, costo, unidad});
      const S = {
        negocio: {nombre: "Ferretería Norte", rubro: "ferreteria", direccion: "Av. San Martín 1800, Salta", maps: "https://maps.google.com/?q=Salta", whatsapp: "5493870000000",
                  horarios: [...H(LV, "08:30", "13:00"), ...H(LV, "16:30", "20:30"), ...H([5], "08:30", "13:30")],
                  entrega: {retiro: {min: 30, cupo: 5, anticipacion: 30, dias: 4}, envio: {min: 120, cupo: 4, anticipacion: 180, dias: 4, costo: 5000, zona: "Salta Capital"}},
                  bienvenida: "¡Hola! Ferretería Norte 🔩 Fijate precio y stock y dejá tu pedido listo para retirar o con envío:", link: "ferreterianorte.com.ar"},
        productos: [
          P(1, "Electricidad", "Tomacorriente doble 10 A", "Blanco, para embutir", 3200, 25, 8, 1700), P(2, "Electricidad", "Llave de luz de un punto", "Blanca", 2800, 30, 8, 1400),
          P(3, "Electricidad", "Cable unipolar 2,5 mm", "Por metro, normalizado", 950, 300, 100, 520, "m"), P(4, "Electricidad", "Lámpara LED 12 W", "Luz fría, E27", 2500, 40, 10, 1200),
          P(5, "Electricidad", "Zapatilla 5 tomas con llave", "Cable de 1,5 m", 9800, 6, 3, 5200), P(6, "Electricidad", "Disyuntor diferencial 2x25 A", "30 mA", 28000, 3, 2, 17500),
          P(7, "Plomería", "Cinta de teflón", "19 mm x 10 m", 900, 60, 15, 380), P(8, "Plomería", "Canilla monocomando de cocina", "Cromada, pico alto", 48000, 3, 1, 29000),
          P(9, "Plomería", "Flexible de 40 cm", "Mallado, 1/2\"", 4500, 15, 5, 2300), P(10, "Plomería", "Llave de paso 1/2\"", "Esférica", 7800, 8, 3, 4100),
          P(11, "Pinturería", "Látex interior 20 L", "Blanco mate", 98000, 5, 2, 64000), P(12, "Pinturería", "Rodillo 22 cm", "Lana sintética", 6500, 12, 4, 3200),
          P(13, "Pinturería", "Pincel 2\"", "Cerda natural", 2900, 20, 5, 1300),
          P(14, "Herramientas", "Martillo carpintero", "Mango de fibra", 12000, 7, 2, 6500), P(15, "Herramientas", "Set de destornilladores x6", "Punta imantada", 15000, 5, 2, 8000),
          P(16, "Herramientas", "Cinta métrica 5 m", "Con freno", 6900, 10, 3, 3400), P(17, "Herramientas", "Taladro percutor 650 W", "Con maletín", 85000, 2, 1, 56000),
          P(18, "Herramientas", "Set de mechas x10", "Para hormigón y madera", 12500, 6, 2, 6200),
          P(19, "Bulonería", "Tarugos 8 mm x100", "Con tope", 3500, 18, 5, 1500), P(20, "Bulonería", "Tornillos 6x40 x100", "Cabeza Phillips", 4800, 14, 5, 2200)],
        clientes: clientesBase(70, 10), servicios: [], turnos: [], inscripciones: [], clases: [], actividades: [], pedidos: [], numPedido: 2318,
        movimientos: movsBase([[1, "egreso", "Alquiler del local", 620000, "Alquiler", "Transferencia"], [2, "ingreso", "Ventas del día", 540000, "Ventas"],
                               [3, "egreso", "Proveedor de electricidad", 780000, "Mercadería", "Transferencia"], [4, "ingreso", "Ventas del día", 612000, "Ventas", "Transferencia"],
                               [8, "ingreso", "Ventas del día", 488000, "Ventas"], [10, "egreso", "Pinturería (distribuidora)", 920000, "Mercadería", "Transferencia"],
                               [12, "ingreso", "Ventas del día", 701000, "Ventas", "Transferencia"], [15, "egreso", "Sueldo empleado", 750000, "Sueldos", "Transferencia"],
                               [16, "ingreso", "Ventas del día", 566000, "Ventas"]]),
        cajaInicial: 900000, deudas: 380000,
      };
      S._post = () => { historia(S, {pedidosDia: 6}); sembrarPedidos(S, [[1, 4, 2, 2, 3, 15], [7, 2, 9, 2], [11, 1, 12, 2, 13, 2], [19, 1, 20, 1]]); };
      return S;
    },
    cafe: () => {
      const P = (id, cat, nombre, desc, precio, stock, minimo, costo) => ({id, cat, nombre, desc, precio, stock, minimo, costo});
      const S = {
        negocio: {nombre: "Café Amanecer", rubro: "cafe", direccion: "Calle Caseros 620, Salta", maps: "https://maps.google.com/?q=Caseros+Salta", whatsapp: "5493870000000",
                  horarios: [...H([0, 1, 2, 3, 4, 5], "07:30", "21:00"), ...H([6], "08:30", "13:00")], paso: 30, anticipacion: 30, dias_agenda: 10, recurso: "Mesa", elegir_pro: false,
                  entrega: {retiro: {min: 15, guardar_horas: 3, cupo: 4, anticipacion: 15, dias: 3}},
                  bienvenida: "¡Hola! Café Amanecer ☕ Pedí para llevar sin hacer fila o reservá tu mesa acá:", link: "cafeamanecer.com.ar",
                  textos: {productos: "Pedí para llevar", turnos: "Reservar mesa"}},
        profesionales: [{id: 1, nombre: "Mesa 1", rol: "2 personas"}, {id: 2, nombre: "Mesa 2", rol: "2 personas"}, {id: 3, nombre: "Mesa 3", rol: "4 personas"},
                        {id: 4, nombre: "Mesa 4", rol: "4 personas"}, {id: 5, nombre: "Mesa 5", rol: "6 personas"}],
        servicios: [{id: 1, cat: "Mesas", nombre: "Mesa para 2", desc: "Hasta 90 minutos", precio: 0, min: 90, pros: [1, 2, 3, 4]},
                    {id: 2, cat: "Mesas", nombre: "Mesa para 4", desc: "Hasta 90 minutos", precio: 0, min: 90, pros: [3, 4, 5]},
                    {id: 3, cat: "Mesas", nombre: "Mesa para 6", desc: "Cumpleaños y reuniones, hasta 2 horas", precio: 0, min: 120, pros: [5]}],
        productos: [
          P(1, "Café para llevar", "Café con leche", "Grande, 350 ml", 3200, null, 0, 900), P(2, "Café para llevar", "Americano", "350 ml", 2800, null, 0, 700),
          P(3, "Café para llevar", "Capuchino", "Con canela", 3600, null, 0, 1000), P(4, "Café para llevar", "Licuado de banana", "Con leche", 4500, null, 0, 1500),
          P(5, "Café para llevar", "Jugo de naranja exprimido", "500 ml", 3800, null, 0, 1400),
          P(6, "Panadería del día", "Medialunas de manteca x6", "Recién horneadas", 5400, 9, 3, 2200), P(7, "Panadería del día", "Chipá x10", "", 4800, 6, 2, 1900),
          P(8, "Panadería del día", "Tostado de jamón y queso", "Pan de miga", 5900, 14, 4, 2300), P(9, "Panadería del día", "Alfajor de maicena", "Con coco", 1800, 20, 5, 600),
          P(10, "Pastelería", "Porción de chocotorta", "", 5500, 8, 2, 1800), P(11, "Pastelería", "Budín de limón entero", "Con glaseado", 8500, 3, 1, 3200),
          P(12, "Para regalar", "Box desayuno sorpresa", "Café, jugo, medialunas, alfajores y tarjeta", 28000, 3, 1, 12000)],
        clientes: clientesBase(70, 4), turnos: [], inscripciones: [], clases: [], actividades: [], pedidos: [], numPedido: 870,
        movimientos: movsBase([[1, "egreso", "Alquiler", 700000, "Alquiler", "Transferencia"], [2, "ingreso", "Ventas del día", 395000, "Ventas"],
                               [3, "egreso", "Harina, manteca y lácteos", 260000, "Mercadería", "Transferencia"], [4, "ingreso", "Ventas del día", 428000, "Ventas", "Transferencia"],
                               [8, "ingreso", "Ventas del día", 512000, "Ventas"], [9, "egreso", "Café en grano 5 kg", 185000, "Mercadería", "Transferencia"],
                               [12, "ingreso", "Ventas del día", 476000, "Ventas", "Transferencia"], [15, "egreso", "Sueldos", 1200000, "Sueldos", "Transferencia"],
                               [16, "ingreso", "Ventas del día", 455000, "Ventas"]]),
        cajaInicial: 300000,
      };
      S._post = api => { historia(S, {porDia: 4, pedidosDia: 8}); sembrarTurnos(api, S, [6, 4, 3]); sembrarPedidos(S, [[1, 2, 6, 1], [3, 1, 9, 2], [8, 2], [12, 1]]); };
      return S;
    },

    almacen: () => {
      const P = (id, cat, nombre, desc, precio, stock, minimo, costo) => ({id, cat, nombre, desc, precio, stock, minimo, costo});
      const S = {
        negocio: {nombre: "Despensa La Esquina", rubro: "almacen", direccion: "Barrio Tres Cerritos, Salta", maps: "https://maps.google.com/?q=Tres+Cerritos+Salta", whatsapp: "5493870000000",
                  horarios: [...H([0, 1, 2, 3, 4, 5], "08:00", "13:30"), ...H([0, 1, 2, 3, 4, 5], "17:00", "21:30"), ...H([6], "09:00", "13:00")],
                  entrega: {retiro: {min: 30, cupo: 5, anticipacion: 30, dias: 3}, envio: {min: 60, cupo: 4, anticipacion: 60, dias: 3, costo: 1500, zona: "Tres Cerritos y alrededores"}},
                  bienvenida: "¡Hola! Despensa La Esquina 🛒 Armá tu pedido acá: te lo llevamos o lo pasás a buscar.", link: "despensalaesquina.com.ar", textos: {nota_ph: "Si no hay alguna marca, ¿la cambiamos por otra?"}},
        productos: [
          P(1, "Almacén", "Aceite de girasol 1,5 L", "", 3900, 24, 8, 2900), P(2, "Almacén", "Arroz largo fino 1 kg", "", 1650, 30, 10, 1150), P(3, "Almacén", "Fideos tirabuzón 500 g", "", 1100, 40, 12, 720),
          P(4, "Almacén", "Harina 000 1 kg", "", 980, 25, 8, 640), P(5, "Almacén", "Azúcar 1 kg", "", 1350, 30, 10, 950), P(6, "Almacén", "Yerba mate 1 kg", "Con palo", 5900, 18, 6, 4300),
          P(7, "Almacén", "Puré de tomate 520 g", "", 900, 30, 10, 580), P(8, "Lácteos", "Leche entera 1 L", "Sachet", 1450, 36, 12, 1080), P(9, "Lácteos", "Yogur bebible 1 L", "Frutilla o vainilla", 2300, 12, 4, 1600),
          P(10, "Lácteos", "Queso cremoso ½ kg", "Al corte", 5200, 8, 3, 3600), P(11, "Lácteos", "Manteca 200 g", "", 2600, 10, 4, 1850), P(12, "Lácteos", "Huevos maple x30", "", 6900, 6, 2, 5200),
          P(13, "Bebidas", "Gaseosa cola 2,25 L", "", 3200, 24, 8, 2300), P(14, "Bebidas", "Agua mineral 2 L", "", 1200, 30, 10, 750), P(15, "Bebidas", "Cerveza lata 473 ml", "Bien fría", 1500, 48, 12, 1000),
          P(16, "Bebidas", "Vino tinto 750 ml", "Malbec de Cafayate", 4500, 12, 4, 3000), P(17, "Limpieza", "Lavandina 1 L", "", 950, 20, 6, 600), P(18, "Limpieza", "Detergente 750 ml", "", 1800, 14, 5, 1200),
          P(19, "Limpieza", "Papel higiénico x4", "Doble hoja", 2900, 16, 5, 2000), P(20, "Panadería", "Pan francés 1 kg", "Del día", 2200, 10, 3, 1300)],
        clientes: clientesBase(70, 3), numPedido: 3100,
        movimientos: movsBase([[1, "egreso", "Alquiler del local", 380000, "Alquiler", "Transferencia"], [3, "egreso", "Distribuidora (almacén)", 690000, "Mercadería", "Transferencia"],
                               [8, "egreso", "Lácteos (proveedor)", 240000, "Mercadería", "Transferencia"], [10, "egreso", "Luz", 64000, "Servicios públicos", "Débito"],
                               [15, "egreso", "Bebidas (distribuidora)", 410000, "Mercadería", "Transferencia"]]), cajaInicial: 220000, deudas: 150000,
      };
      S._post = () => { historia(S, {pedidosDia: 9}); sembrarPedidos(S, [[1, 1, 8, 2, 20, 1], [13, 2, 15, 6], [6, 1, 5, 1], [12, 1, 11, 1]]); };
      return S;
    },
    ropa: () => {
      let pid = 0;
      const P = (cat, nombre, desc, precio, talles, costo) => Object.entries(talles).map(([t, st]) => ({id: ++pid, cat, nombre: `${nombre} · ${t}`, desc, precio, stock: st, minimo: 1, costo}));
      const S = {
        negocio: {nombre: "Tienda Cardón", rubro: "ropa", direccion: "Calle Alberdi 280, Salta", maps: "https://maps.google.com/?q=Alberdi+Salta", whatsapp: "5493870000000",
                  horarios: [...H(LV, "10:00", "13:00"), ...H(LV, "17:00", "21:30"), ...H([5], "10:00", "14:00"), ...H([5], "17:00", "21:00")],
                  entrega: {retiro: {min: 60, guardar_horas: 48, cupo: 4, anticipacion: 60, dias: 5}, envio: {min: 180, cupo: 3, anticipacion: 240, dias: 5, costo: 3500, zona: "Salta Capital"}},
                  bienvenida: "¡Hola! Tienda Cardón 🌵 Mirá talles y stock reales y reservá tu prenda acá:", link: "tiendacardon.com.ar", textos: {nota_ph: "¿Es para regalo? Lo envolvemos."}},
        productos: [
          ...P("Remeras", "Remera algodón blanca", "100 % algodón peinado", 14900, {S: 2, M: 5, L: 3, XL: 0}, 6500),
          ...P("Remeras", "Remera estampada Cerro", "Estampa propia", 17900, {S: 1, M: 4, L: 2}, 7800),
          ...P("Jeans", "Jean mom celeste", "Tiro alto", 42000, {"38": 2, "40": 3, "42": 1}, 21000),
          ...P("Jeans", "Jean recto negro", "Elastizado", 39000, {"40": 2, "42": 2, "44": 1}, 19500),
          ...P("Buzos", "Buzo canguro gris", "Frisa invierno", 38000, {M: 3, L: 2}, 18000),
          ...P("Camperas", "Campera de jean", "Con corderito", 65000, {M: 2, L: 1}, 33000),
          ...P("Accesorios", "Gorra bordada", "Talle único", 12000, {"Único": 10}, 5000),
          ...P("Accesorios", "Riñonera de cuero", "Hecha en Salta", 18000, {"Única": 6}, 8500)],
        clientes: clientesBase(60, 0), numPedido: 540,
        movimientos: movsBase([[1, "egreso", "Alquiler del local", 520000, "Alquiler", "Transferencia"], [4, "egreso", "Taller de confección", 860000, "Mercadería", "Transferencia"],
                               [11, "egreso", "Publicidad en Instagram", 60000, "Publicidad", "Tarjeta"], [15, "egreso", "Sueldo vendedora", 650000, "Sueldos", "Transferencia"]]),
        cajaInicial: 350000, deudas: 420000,
      };
      S._post = () => { historia(S, {pedidosDia: 2}); sembrarPedidos(S, [[2, 1], [10, 1, 18, 1], [17, 1]]); };
      return S;
    },
    restaurante: () => {
      const P = (id, cat, nombre, desc, precio, stock, minimo, costo) => ({id, cat, nombre, desc, precio, stock, minimo, costo});
      const todos = [0, 1, 2, 3, 4, 5, 6];
      const S = {
        negocio: {nombre: "Restó del Paseo", rubro: "restaurante", direccion: "Paseo Güemes 150, Salta", maps: "https://maps.google.com/?q=Paseo+Guemes+Salta", whatsapp: "5493870000000",
                  horarios: [...H(todos, "12:00", "15:30"), ...H([1, 2, 3, 4, 5, 6], "20:00", "23:30")], paso: 30, anticipacion: 60, dias_agenda: 14, recurso: "Mesa", elegir_pro: false,
                  entrega: {retiro: {min: 15, guardar_horas: 3, cupo: 4, anticipacion: 30, dias: 2}, envio: {min: 30, cupo: 3, anticipacion: 45, dias: 2, costo: 2000, zona: "Hasta 3 km"}},
                  bienvenida: "¡Hola! Restó del Paseo 🍷 Reservá tu mesa o pedí para llevar desde acá:", link: "restodelpaseo.com.ar",
                  textos: {productos: "Pedir para llevar", turnos: "Reservar mesa", servicio_titulo: "¿Para cuántos?", nota_ph: "Sin cebolla, empanadas fritas…"}},
        profesionales: [1, 2, 3, 4, 5, 6, 7, 8].map(i => ({id: i, nombre: `Mesa ${i}`, rol: i <= 2 ? "2 personas" : i <= 6 ? "4 personas" : "6 personas"})),
        servicios: [{id: 1, cat: "Mesas", nombre: "Mesa para 2", desc: "Salón o vereda", precio: 0, min: 120, pros: [1, 2, 3, 4, 5, 6]},
                    {id: 2, cat: "Mesas", nombre: "Mesa para 4", desc: "", precio: 0, min: 120, pros: [3, 4, 5, 6, 7, 8]},
                    {id: 3, cat: "Mesas", nombre: "Mesa para 6", desc: "Cumpleaños y reuniones", precio: 0, min: 150, pros: [7, 8]}],
        productos: [
          P(1, "Regionales", "Empanadas salteñas x12", "Carne cortada a cuchillo", 14400, 20, 5, 6500), P(2, "Regionales", "Locro (porción)", "Con su salsita picante", 9500, 15, 4, 4000),
          P(3, "Regionales", "Humita en chala", "", 4800, 20, 5, 1800), P(4, "Regionales", "Tamales x2", "", 6000, 12, 4, 2400),
          P(5, "Platos", "Milanesa napolitana con papas", "Para compartir", 13500, null, 0, 5500), P(6, "Platos", "Bife de chorizo con guarnición", "", 19000, null, 0, 9000),
          P(7, "Postres", "Flan casero con dulce de leche", "", 4500, 10, 3, 1500), P(8, "Bebidas", "Gaseosa 1,5 L", "", 3500, null, 0, 1800)],
        clientes: clientesBase(80, 2), numPedido: 2210,
        movimientos: movsBase([[1, "egreso", "Alquiler", 950000, "Alquiler", "Transferencia"], [2, "egreso", "Carnicería", 720000, "Mercadería", "Transferencia"],
                               [6, "egreso", "Verdulería", 180000, "Mercadería", "Efectivo"], [9, "egreso", "Gas", 120000, "Servicios públicos", "Débito"], [15, "egreso", "Sueldos", 2400000, "Sueldos", "Transferencia"]]),
        cajaInicial: 500000,
      };
      S._post = api => { historia(S, {porDia: 6, pedidosDia: 7}); sembrarTurnos(api, S, [10, 7, 5]); sembrarPedidos(S, [[1, 1, 3, 2], [2, 2, 8, 1], [5, 1, 7, 2]]); };
      return S;
    },
    rotiseria: () => {
      const P = (id, cat, nombre, desc, precio, stock, minimo, costo) => ({id, cat, nombre, desc, precio, stock, minimo, costo});
      const todos = [0, 1, 2, 3, 4, 5, 6];
      const S = {
        negocio: {nombre: "Rotisería Doña Rosa", rubro: "rotiseria", direccion: "Av. Entre Ríos 900, Salta", maps: "https://maps.google.com/?q=Entre+Rios+Salta", whatsapp: "5493870000000",
                  horarios: [...H(todos, "11:00", "14:30"), ...H(todos, "19:30", "22:30")],
                  entrega: {retiro: {min: 15, guardar_horas: 3, cupo: 5, anticipacion: 20, dias: 2}, envio: {min: 30, cupo: 3, anticipacion: 45, dias: 2, costo: 1800, zona: "Hasta 3 km"}},
                  bienvenida: "¡Hola! Rotisería Doña Rosa 🍗 Encargá acá y retirá sin esperar:", link: "rotiseriadonarosa.com.ar", textos: {productos: "Encargar", nota_ph: "Pollo bien dorado, sin sal…"}},
        productos: [
          P(1, "Pollos", "Pollo al spiedo entero", "Con chimichurri", 12500, 14, 3, 6000), P(2, "Pollos", "Medio pollo al spiedo", "", 6800, 10, 3, 3200),
          P(3, "Guarniciones", "Papas fritas (porción)", "Para 2", 4000, null, 0, 1200), P(4, "Guarniciones", "Ensalada rusa", "½ kg", 3800, 10, 3, 1400),
          P(5, "Comidas", "Milanesas de carne x2", "", 7500, 20, 5, 3500), P(6, "Comidas", "Tarta de verdura", "Entera", 8500, 6, 2, 3500),
          P(7, "Comidas", "Pastel de papa", "Para 3", 9000, 8, 2, 3800), P(8, "Comidas", "Empanadas x6", "Carne o pollo", 7200, 20, 5, 3200)],
        clientes: clientesBase(70, 5), numPedido: 7740,
        movimientos: movsBase([[1, "egreso", "Alquiler", 420000, "Alquiler", "Transferencia"], [2, "egreso", "Pollos (granja)", 980000, "Mercadería", "Transferencia"],
                               [9, "egreso", "Gas", 95000, "Servicios públicos", "Débito"], [15, "egreso", "Sueldos", 1100000, "Sueldos", "Transferencia"]]), cajaInicial: 180000,
      };
      S._post = () => { historia(S, {pedidosDia: 14}); sembrarPedidos(S, [[1, 1, 3, 1], [2, 1, 4, 1], [5, 2, 3, 1], [8, 2], [1, 2]]); };
      return S;
    },
    heladeria: () => {
      const P = (id, cat, nombre, desc, precio, stock, minimo, costo) => ({id, cat, nombre, desc, precio, stock, minimo, costo});
      const S = {
        negocio: {nombre: "Heladería Glaciar", rubro: "heladeria", direccion: "Av. Belgrano 1500, Salta", maps: "https://maps.google.com/?q=Belgrano+Salta", whatsapp: "5493870000000",
                  horarios: H([0, 1, 2, 3, 4, 5, 6], "13:00", "23:30"),
                  entrega: {retiro: {min: 15, guardar_horas: 3, cupo: 6, anticipacion: 15, dias: 2}, envio: {min: 30, cupo: 4, anticipacion: 40, dias: 2, costo: 1500, zona: "Hasta 4 km"}},
                  bienvenida: "¡Hola! Heladería Glaciar 🍦 Pedí tu helado acá: te lo llevamos o lo retirás sin fila.", link: "heladeriaglaciar.com.ar",
                  textos: {productos: "Pedir helado", nota_ph: "Gustos: dulce de leche, chocolate, frutilla, limón…"}},
        productos: [
          P(1, "Helado por peso", "¼ kg (hasta 3 gustos)", "Escribí los gustos en la nota", 5500, null, 0, 1800), P(2, "Helado por peso", "½ kg (hasta 3 gustos)", "", 9800, null, 0, 3300),
          P(3, "Helado por peso", "1 kg (hasta 4 gustos)", "", 17500, null, 0, 6200), P(4, "Postres helados", "Torta helada", "Para 10 personas", 24000, 4, 1, 9000),
          P(5, "Postres helados", "Almendrado entero", "", 14000, 5, 2, 5200), P(6, "Postres helados", "Bombón suizo x8", "", 9000, 10, 3, 3500),
          P(7, "Para llevar", "Palito bombón", "", 1800, 40, 10, 600), P(8, "Para llevar", "Cucuruchos x12", "Para servir en casa", 3500, 15, 4, 1300)],
        clientes: clientesBase(80, 1), numPedido: 1500,
        movimientos: movsBase([[1, "egreso", "Alquiler", 600000, "Alquiler", "Transferencia"], [3, "egreso", "Leche, crema y azúcar", 820000, "Mercadería", "Transferencia"],
                               [10, "egreso", "Luz (cámaras de frío)", 310000, "Servicios públicos", "Débito"], [15, "egreso", "Sueldos", 1500000, "Sueldos", "Transferencia"]]), cajaInicial: 260000,
      };
      S._post = () => { historia(S, {pedidosDia: 12}); sembrarPedidos(S, [[3, 1], [2, 1, 7, 2], [4, 1], [1, 2]]); };
      return S;
    },
    canchas: () => {
      const todos = [0, 1, 2, 3, 4, 5];
      const S = {
        negocio: {nombre: "Pádel Norte", rubro: "canchas", direccion: "Av. Bolivia 4200, Salta", maps: "https://maps.google.com/?q=Bolivia+Salta", whatsapp: "5493870000000",
                  horarios: [...H(todos, "08:00", "23:30"), ...H([6], "09:00", "22:00")], paso: 30, anticipacion: 30, dias_agenda: 10, recurso: "Cancha",
                  bienvenida: "¡Hola! Pádel Norte 🎾 Mirá qué canchas hay libres y reservá al toque:", link: "padelnorte.com.ar",
                  textos: {turnos: "Reservar cancha", servicio_titulo: "¿Qué querés jugar?", pro_titulo: "¿Qué cancha?", pro_todos: "La que esté libre"}},
        profesionales: [{id: 1, nombre: "Cancha 1", rol: "Pádel · blindex", color: "#2F6FDE"}, {id: 2, nombre: "Cancha 2", rol: "Pádel · blindex", color: "#1F8A5B"},
                        {id: 3, nombre: "Cancha 3", rol: "Pádel · techada", color: "#E8772E"}, {id: 4, nombre: "Fútbol 5", rol: "Sintético", color: "#7A5AF8"}],
        servicios: [{id: 1, cat: "Pádel", nombre: "Pádel · 1 hora", desc: "Precio por cancha", precio: 16000, min: 60, pros: [1, 2, 3],
                     tarifas: [{dias: [0, 1, 2, 3, 4], desde: "18:00", hasta: "24:00", precio: 20000}, {dias: [5, 6], desde: "08:00", hasta: "24:00", precio: 20000}]},
                    {id: 2, cat: "Pádel", nombre: "Pádel · 1 hora y media", desc: "Precio por cancha", precio: 22000, min: 90, pros: [1, 2, 3],
                     tarifas: [{dias: [0, 1, 2, 3, 4], desde: "18:00", hasta: "24:00", precio: 28000}, {dias: [5, 6], desde: "08:00", hasta: "24:00", precio: 28000}]},
                    {id: 3, cat: "Fútbol 5", nombre: "Fútbol 5 · 1 hora", desc: "Pecheras incluidas", precio: 36000, min: 60, pros: [4],
                     tarifas: [{dias: [], desde: "19:00", hasta: "24:00", precio: 44000}]}],
        clientes: clientesBase(80, 12),
        movimientos: movsBase([[1, "egreso", "Alquiler del predio", 1200000, "Alquiler", "Transferencia"], [5, "egreso", "Luz (iluminación)", 380000, "Servicios públicos", "Débito"],
                               [10, "egreso", "Pelotas y redes", 140000, "Insumos", "Tarjeta"], [15, "egreso", "Sueldos", 1300000, "Sueldos", "Transferencia"]]), cajaInicial: 450000,
      };
      S._post = api => { historia(S, {porDia: 14}); sembrarTurnos(api, S, [22, 18, 14]); };
      return S;
    },
    danza: () => {
      const act = [{id: 1, nombre: "Folklore", desc: "Zamba, chacarera y gato", color: "#E8772E"}, {id: 2, nombre: "Tango", desc: "Inicial e intermedio", color: "#18212F"},
                   {id: 3, nombre: "Salsa y bachata", desc: "En pareja o solo", color: "#C2412D"}, {id: 4, nombre: "Ballet infantil", desc: "De 5 a 10 años", color: "#EC4899"},
                   {id: 5, nombre: "Ritmos latinos", desc: "Cardio con música", color: "#2F6FDE"}, {id: 6, nombre: "Urbano", desc: "Para chicos de 11 a 17", color: "#7A5AF8"}];
      const clases = []; let cid = 1;
      const C = (actividad, dias, horas, min, cupo, profe) => horas.forEach(hora => clases.push({id: cid++, actividad, dias, hora, min, cupo, profe}));
      C(1, [0, 2], ["19:00", "20:30"], 75, 20, "Prof. Mario"); C(2, [1, 3], ["20:00"], 90, 16, "Prof. Inés"); C(3, [1, 3], ["21:30"], 60, 20, "Prof. Leo");
      C(4, [0, 2, 4], ["17:00"], 60, 14, "Prof. Sofi"); C(5, [0, 2, 4], ["18:15"], 60, 25, "Prof. Leo"); C(6, [1, 3], ["18:00"], 60, 18, "Prof. Tati"); C(1, [5], ["10:30"], 90, 20, "Prof. Mario");
      const socios = NOMBRES.slice(0, 45).map((nombre, i) => ({telefono: telDe(i), nombre, plan: i === 3 || i % 5 === 3 ? "1x" : i % 3 === 0 ? "2x" : "libre", restantes: 0, vence: fdia(addDays(hoy(), i === 1 ? -4 : i % 8 === 5 ? -1 : 3 + (i * 5) % 26))}));
      const S = {
        negocio: {nombre: "Academia Danza Norte", rubro: "danza", direccion: "Calle España 750, Salta", maps: "https://maps.google.com/?q=Espana+Salta", whatsapp: "5493870000000",
                  horarios: [...H(LV, "16:00", "22:30"), ...H([5], "10:00", "13:00")], anticipacion_clase: 30, solo_socios: true, cuota: 28000,
                  planes: [{id: "1x", nombre: "1 clase por semana", precio: 18000, dias: 30, actividades: [], por_semana: 1, clases: null},
                           {id: "2x", nombre: "2 clases por semana", precio: 28000, dias: 30, actividades: [], por_semana: 2, clases: null},
                           {id: "libre", nombre: "Libre", precio: 38000, dias: 30, actividades: [], por_semana: null, clases: null},
                           {id: "suelta", nombre: "Clase suelta", precio: 6000, dias: 1, actividades: [], por_semana: null, clases: null, suelta: true}],
                  bienvenida: "¡Hola! Academia Danza Norte 💃 Reservá tu lugar en la clase de hoy acá:", link: "danzanorte.com.ar/clases",
                  textos: {prueba: "Probá con el celular 387 555 1000 (Lucía, 2 clases por semana), 387 555 1001 (Sofía, cuota vencida) o 387 555 1003 (1 clase por semana).", socio: "alumno"}},
        actividades: act, clases, socios, clientes: socios.map((s, i) => ({id: i + 1, nombre: s.nombre, telefono: s.telefono, acepta: true})),
        movimientos: movsBase([[1, "egreso", "Alquiler del salón", 520000, "Alquiler", "Transferencia"], [2, "ingreso", "Cuotas del día", 196000, "Cuotas", "Transferencia"],
                               [4, "ingreso", "Cuotas del día", 224000, "Cuotas", "Transferencia"], [6, "egreso", "Honorarios profes", 560000, "Sueldos", "Transferencia"],
                               [9, "ingreso", "Cuotas del día", 140000, "Cuotas", "Efectivo"], [12, "egreso", "Luz", 58000, "Servicios públicos", "Débito"]]), cajaInicial: 210000,
      };
      S._post = () => {
        historia(S, {clasesLlenas: 0.6});
        rnd = 9; let k = 1;
        for (const dia of habiles(S, 3)) for (const c of clases.filter(c => c.dias.includes(wd(dia)))) {
          const usados = new Set(), lleno = Math.floor(c.cupo * (.45 + R() * .5));
          for (let j = 0; j < lleno; j++) { const si = 2 + Math.floor(R() * (S.clientes.length - 2)); if (usados.has(si)) continue; usados.add(si);
            S.inscripciones.push({id: 3000 + k, codigo: "seedd" + k++, clase: c.id, fecha: fdia(dia), inicio: fiso(atTime(dia, c.hora)), cliente: S.clientes[si].id, estado: "confirmado", asistio: null, creado: fiso(hoy())}); }
        }
      };
      return S;
    },
    cabanas: () => {
      const S = {
        negocio: {nombre: "Cabañas Los Alisos", rubro: "cabanas", direccion: "San Lorenzo, Salta", maps: "https://maps.google.com/?q=San+Lorenzo+Salta", whatsapp: "5493870000000",
                  horarios: H([0, 1, 2, 3, 4, 5, 6], "08:00", "22:00"),
                  estadia: {sena: 30, checkin: "14:00", checkout: "10:00", alias: "losalisos.cabanas", min_noches: 2, finde: 15,
                            temporadas: (() => { const y = hoy().getFullYear(); return [
                              {id: "alta", nombre: "temporada alta", desde: `${y}-12-20`, hasta: `${y + 1}-02-28`, recargo: 25},
                              {id: "invierno", nombre: "vacaciones de invierno", desde: `${y + 1}-07-06`, hasta: `${y + 1}-07-26`, recargo: 20},
                              {id: "baja", nombre: "temporada baja", desde: `${y + 1}-04-15`, hasta: `${y + 1}-06-15`, recargo: -15}]; })()},
                  bienvenida: "¡Hola! Cabañas Los Alisos 🌿 Mirá la disponibilidad y el precio de tus fechas y reservá acá:", link: "cabanaslosalisos.com.ar",
                  textos: {estadias: "Reservar"}},
        unidades: [{id: 1, nombre: "Cabaña Algarrobo", desc: "1 dormitorio, hogar a leña, galería con vista al cerro", capacidad: 2, precio: 55000},
                   {id: 2, nombre: "Cabaña Ceibo", desc: "2 dormitorios, parrilla propia", capacidad: 4, precio: 78000},
                   {id: 3, nombre: "Cabaña Lapacho", desc: "2 dormitorios, cocina completa", capacidad: 4, precio: 78000},
                   {id: 4, nombre: "Cabaña Cardón", desc: "3 dormitorios, ideal familias, pileta a 20 m", capacidad: 6, precio: 98000},
                   {id: 5, nombre: "Suite Molle", desc: "Monoambiente con jacuzzi", capacidad: 2, precio: 62000}],
        clientes: clientesBase(70, 6),
        movimientos: movsBase([[2, "egreso", "Limpieza y lavandería", 260000, "Mantenimiento", "Transferencia"], [5, "egreso", "Luz y gas", 190000, "Servicios públicos", "Débito"],
                               [9, "egreso", "Jardinero y pileta", 150000, "Mantenimiento", "Efectivo"], [15, "egreso", "Sueldo encargado", 700000, "Sueldos", "Transferencia"]]), cajaInicial: 900000,
      };
      S._post = () => {
        rnd = 31; let k = 0; const h = hoy();
        for (const u of S.unidades) {
          let d = addDays(h, -35 + Math.floor(R() * 3));
          while (d < addDays(h, 50)) {
            const nn = 2 + Math.floor(R() * 4), desde = fdia(d), hasta = fdia(addDays(d, nn));
            if (R() < (d > addDays(h, 7) ? 0.45 : 0.7)) {
              const c = S.clientes[Math.floor(Math.pow(R(), 1.3) * S.clientes.length)], total = u.precio * nn, sena = Math.round(total * .3);
              const fin = parse(hasta) <= h, dentro = parse(desde) <= h && parse(hasta) > h, lejos = parse(desde) > addDays(h, 12);
              const est = fin ? "finalizada" : dentro ? "checkin" : lejos && R() < .09 ? "pendiente" : "confirmada";
              S.estadias.push({id: 7000 + k, codigo: "seede" + k++, unidad: u.id, cliente: c.id, desde, hasta, noches: nn, personas: Math.min(u.capacidad, 2 + Math.floor(R() * u.capacidad)),
                               total, sena, pagado: est === "finalizada" ? total : est === "pendiente" ? 0 : sena, estado: est, nota: "", origen: R() < .6 ? "web" : "panel",
                               creado: fiso(est === "pendiente" ? addMin(h, -180) : addDays(parse(desde), -10))});
            }
            d = addDays(d, nn + Math.floor(R() * 3));
          }
        }
        // Reservas que entraron por Booking y Airbnb (llegan por el calendario de cada plataforma)
        const ext = {2: "https://admin.booking.com/hotel/hoteladmin/ical.html?t=demo-ceibo", 3: "https://www.airbnb.com.ar/calendar/ical/demo-lapacho.ics", 4: "https://admin.booking.com/hotel/hoteladmin/ical.html?t=demo-cardon"};
        S.bloqueos = []; let bq = 0;
        for (const [uid, url] of Object.entries(ext)) {
          const u = S.unidades.find(x => x.id == uid); u.externos = [url];
          for (let i = 1, n = 0; i < 26 && n < 2; i++) {
            const desde = fdia(addDays(h, i)), hasta = fdia(addDays(h, i + 2));
            if (!S.estadias.some(e => e.unidad == u.id && e.estado !== "cancelada" && e.desde < hasta && e.hasta > desde) && !S.bloqueos.some(b => b.unidad == u.id && b.desde < hasta && b.hasta > desde)) {
              S.bloqueos.push({id: "bq" + bq++, unidad: u.id, desde, hasta, fuente: url, origen: /airbnb/.test(url) ? "Airbnb" : "Booking"}); n++; i += 6;
            }
          }
        }
        S._sync = "hace un rato";
        const mes = fdia(h).slice(0, 7);
        S.estadias.filter(e => e.desde.startsWith(mes) && e.desde <= fdia(h)).forEach((e, i) => S.movimientos.push({id: 9500 + i, fecha: `${e.desde}T15:00:00`, tipo: "ingreso", concepto: `Estadía ${S.unidades.find(u => u.id === e.unidad).nombre}`, monto: e.total, cat: "Reservas", medio: "Transferencia"}));
      };
      return S;
    },
    inmobiliaria: () => {
      const V = (id, cat, nombre, desc, pros) => ({id, cat, nombre, desc, precio: 0, min: 30, pros});
      const S = {
        negocio: {nombre: "Norte Propiedades", rubro: "inmobiliaria", direccion: "Calle Mitre 350, Salta", maps: "https://maps.google.com/?q=Mitre+Salta", whatsapp: "5493870000000",
                  horarios: [...H(LV, "09:00", "13:00"), ...H(LV, "16:00", "20:00"), ...H([5], "10:00", "13:00")], paso: 30, anticipacion: 120, dias_agenda: 14, recurso: "Asesor", elegir_pro: false,
                  campos_extra: [{id: "busca", label: "¿Para vivir o para invertir? (opcional)", ph: "Ej: para vivir con mi pareja, sin mascotas", req: false}],
                  bienvenida: "¡Hola! Norte Propiedades 🏠 Mirá las propiedades disponibles y coordiná la visita acá:", link: "norteprop.com.ar",
                  textos: {turnos: "Coordinar visita", servicio_titulo: "¿Qué propiedad querés ver?"}},
        profesionales: [{id: 1, nombre: "Laura", rol: "Alquileres", color: "#2F6FDE"}, {id: 2, nombre: "Diego", rol: "Ventas", color: "#E8772E"}],
        servicios: [V(1, "Alquiler", "Depto 2 ambientes · Centro", "$420.000 por mes + expensas · 55 m² · balcón", [1]), V(2, "Alquiler", "Casa 3 dormitorios · Tres Cerritos", "$750.000 por mes · patio y cochera", [1]),
                    V(3, "Alquiler", "Monoambiente · Plaza 9 de Julio", "$280.000 por mes · amoblado", [1]), V(4, "Alquiler", "Local comercial · Av. Belgrano", "$900.000 por mes · 80 m² a la calle", [1]),
                    V(5, "Venta", "Casa 3 dormitorios · San Lorenzo", "USD 145.000 · lote de 600 m² · pileta", [2]), V(6, "Venta", "Depto 2 dormitorios · Grand Bourg", "USD 78.000 · apto crédito", [2]),
                    V(7, "Venta", "Lote · Vaqueros", "USD 32.000 · 900 m² · con servicios", [2])],
        clientes: clientesBase(60, 20),
        movimientos: movsBase([[1, "egreso", "Alquiler de la oficina", 450000, "Alquiler", "Transferencia"], [3, "ingreso", "Comisión alquiler Centro", 420000, "Comisiones", "Transferencia"],
                               [8, "egreso", "Publicación en portales", 120000, "Publicidad", "Tarjeta"], [12, "ingreso", "Comisión venta Grand Bourg", 2300000, "Comisiones", "Transferencia"]]), cajaInicial: 600000,
      };
      S.extraSeed = i => ({busca: ["Para vivir con mi pareja", "Para invertir", "", "Somos 4, con perro", ""][i % 5]});
      S._post = api => { historia(S, {porDia: 4}); sembrarTurnos(api, S, [7, 6, 4]); };
      return S;
    },
    consultorio: () => {
      const S = {
        negocio: {nombre: "Consultorio Integral Lerma", rubro: "consultorio", direccion: "Calle Lerma 420, Salta", maps: "https://maps.google.com/?q=Lerma+Salta", whatsapp: "5493870000000",
                  horarios: [...H(LV, "08:00", "20:00"), ...H([5], "09:00", "13:00")], paso: 15, anticipacion: 120, dias_agenda: 21, recurso: "Profesional",
                  coberturas: [{id: "osde", nombre: "OSDE", coseguro: 0}, {id: "swiss", nombre: "Swiss Medical", coseguro: 4000},
                               {id: "ips", nombre: "IPS Salta", coseguro: 6000}, {id: "galeno", nombre: "Galeno", coseguro: 3000}],
                  campos_extra: [{id: "afiliado", label: "Número de afiliado (si venís por obra social)", ph: "Ej: 12345678", req: false},
                                 {id: "motivo", label: "Motivo de la consulta (opcional)", ph: "Ej: dolor de rodilla", req: false}],
                  bienvenida: "¡Hola! Consultorio Integral Lerma 🩺 Sacá tu turno con el profesional que quieras acá:", link: "consultoriolerma.com.ar/turnos"},
        profesionales: [{id: 1, nombre: "Dra. Sofía Paz", rol: "Odontología", color: "#2F6FDE", dias: [0, 1, 2, 3, 4]}, {id: 2, nombre: "Lic. Martín Ríos", rol: "Kinesiología", color: "#1F8A5B", dias: [0, 2, 4, 5]},
                        {id: 3, nombre: "Lic. Carla Vega", rol: "Nutrición", color: "#E8772E", dias: [1, 3]}],
        servicios: [{id: 1, cat: "Odontología", nombre: "Consulta y limpieza", desc: "", precio: 25000, min: 45, pros: [1]}, {id: 2, cat: "Odontología", nombre: "Arreglo de caries", desc: "Por pieza", precio: 35000, min: 45, pros: [1]},
                    {id: 3, cat: "Odontología", nombre: "Blanqueamiento", desc: "En consultorio", precio: 90000, min: 90, pros: [1]},
                    {id: 4, cat: "Kinesiología", nombre: "Evaluación inicial", desc: "Traé estudios si tenés", precio: 20000, min: 60, pros: [2]}, {id: 5, cat: "Kinesiología", nombre: "Sesión de kinesiología", desc: "", precio: 18000, min: 45, pros: [2]},
                    {id: 6, cat: "Nutrición", nombre: "Primera consulta", desc: "Plan personalizado", precio: 22000, min: 60, pros: [3]}, {id: 7, cat: "Nutrición", nombre: "Control", desc: "", precio: 15000, min: 30, pros: [3]}],
        clientes: clientesBase(80, 8),
        movimientos: movsBase([[1, "egreso", "Alquiler del consultorio", 480000, "Alquiler", "Transferencia"], [4, "egreso", "Insumos odontológicos", 210000, "Insumos", "Transferencia"],
                               [10, "egreso", "Luz e internet", 72000, "Servicios públicos", "Débito"], [15, "egreso", "Secretaria", 550000, "Sueldos", "Transferencia"]]), cajaInicial: 300000,
      };
      S.extraSeed = i => ({afiliado: i % 5 < 2 ? "" : String(10000000 + i * 7919).slice(0, 8), motivo: ["", "Control anual", "Dolor de espalda", ""][i % 4]});
      S._post = api => { historia(S, {porDia: 10}); sembrarTurnos(api, S, [14, 12, 10]); };
      return S;
    },
    estudio: () => {
      const S = {
        negocio: {nombre: "Estudio Contable Figueroa", rubro: "estudio", direccion: "Calle Caseros 1100, Salta", maps: "https://maps.google.com/?q=Caseros+Salta", whatsapp: "5493870000000",
                  horarios: [...H(LV, "09:00", "13:00"), ...H(LV, "16:00", "19:30")], paso: 30, anticipacion: 180, dias_agenda: 21, recurso: "Contador",
                  campos_extra: [{id: "cuit", label: "CUIT (opcional)", ph: "20-12345678-9", req: false}, {id: "tema", label: "Contanos brevemente el tema (opcional)", ph: "Ej: me pasé de categoría", req: false}],
                  bienvenida: "¡Hola! Estudio Contable Figueroa 📊 Agendá tu reunión (en el estudio o por videollamada) acá:", link: "estudiofigueroa.com.ar",
                  textos: {turnos: "Agendar reunión", servicio_titulo: "¿Qué necesitás?", modal: {sin_dir: true, local: {t: "En el estudio", s: "Calle Caseros 1100", i: "🏢"}, domicilio: {t: "Por videollamada", s: "Te mandamos el link de Meet", i: "💻"}}}},
        profesionales: [{id: 1, nombre: "Cr. Luis Figueroa", rol: "Impuestos y empresas", color: "#18212F"}, {id: 2, nombre: "Cra. Ana López", rol: "Monotributo y sueldos", color: "#2F6FDE"}],
        servicios: [{id: 1, cat: "Monotributo", nombre: "Consulta de monotributo", desc: "Categoría, pagos, dudas", precio: 15000, min: 30, modalidad: "ambos", pros: [1, 2]},
                    {id: 2, cat: "Monotributo", nombre: "Alta de monotributo", desc: "Trámite completo en ARCA", precio: 25000, min: 45, modalidad: "ambos", pros: [2]},
                    {id: 3, cat: "Monotributo", nombre: "Recategorización", desc: "", precio: 12000, min: 30, modalidad: "ambos", pros: [2]},
                    {id: 4, cat: "Impuestos", nombre: "Ganancias y Bienes Personales", desc: "Declaración anual", precio: 45000, min: 60, modalidad: "ambos", pros: [1]},
                    {id: 5, cat: "Empresas", nombre: "Consulta para empresas", desc: "Sociedades, IVA, balance", precio: 30000, min: 60, modalidad: "ambos", pros: [1]},
                    {id: 6, cat: "Empresas", nombre: "Sueldos y cargas sociales", desc: "Consulta", precio: 20000, min: 45, modalidad: "ambos", pros: [2]}],
        clientes: clientesBase(60, 25),
        movimientos: movsBase([[1, "egreso", "Alquiler de la oficina", 420000, "Alquiler", "Transferencia"], [2, "ingreso", "Abonos mensuales", 1850000, "Abonos", "Transferencia"],
                               [5, "egreso", "Sistema contable", 95000, "Software", "Tarjeta"], [15, "egreso", "Sueldo administrativa", 620000, "Sueldos", "Transferencia"]]), cajaInicial: 800000,
      };
      S.extraSeed = i => ({cuit: i % 3 ? "" : `27-${30000000 + i * 7311}-${i % 10}`, tema: ["", "Me pasé de categoría", "Quiero facturar como monotributista", ""][i % 4]});
      S._post = api => { historia(S, {porDia: 5}); sembrarTurnos(api, S, [7, 6, 5]); };
      return S;
    },
  };

  function sembrarPedidos(S, listas) {
    const h = hoy(), e = S.negocio.entrega;
    let k = 0;
    for (const lista of listas) {
      const tipo = k % 2 && e.envio ? "envio" : "retiro", cfg = e[tipo];
      // primera franja posible desde ahora + anticipación, dentro del horario
      let t = null;
      for (let d = 0; d < 4 && !t; d++) {
        const dia = addDays(h, d);
        for (const f of S.negocio.horarios.filter(x => x.dia === wd(dia))) {
          for (let x = atTime(dia, f.desde); addMin(x, cfg.min) <= atTime(dia, f.hasta); x = addMin(x, cfg.min)) {
            if (x >= addMin(h, cfg.anticipacion + 30 * (k + 1))) { t = x; break; }
          }
          if (t) break;
        }
      }
      if (!t) continue;
      const items = [];
      for (let i = 0; i < lista.length; i += 2) {
        const p = S.productos.find(x => x.id === lista[i]);
        if (p.stock != null) p.stock -= lista[i + 1];
        items.push({producto: p.id, nombre: p.nombre, cant: lista[i + 1], precio: p.precio, unidad: p.unidad || "u"});
      }
      const envio = tipo === "envio" ? cfg.costo : 0, c = S.clientes[(k * 5 + 3) % S.clientes.length];
      S.pedidos.push({id: 4000 + k, numero: ++S.numPedido, codigo: "seedp" + k, cliente: c.id, items, envio, total: items.reduce((a, i) => a + i.cant * i.precio, 0) + envio,
                      entrega: tipo, inicio: fiso(t), franja: cfg.min >= 60 ? `${hm(t)} a ${hm(addMin(t, cfg.min))}` : hm(t), direccion: tipo === "envio" ? "Barrio Castañares, Salta" : "",
                      nota: k === 0 ? "Si se puede, envolver para regalo" : "", estado: k === 2 ? "listo" : "reservado", creado: fiso(h)});
      k++;
    }
    // Uno de hace dos días que nadie vino a buscar: al abrir la demo vence y vuelve al stock.
    if (e.retiro && listas.length) {
      const t = atTime(addDays(h, -2), "11:00"), lista = listas[0], items = [];
      for (let i = 0; i < lista.length; i += 2) {
        const p = S.productos.find(x => x.id === lista[i]);
        if (p.stock != null) p.stock -= lista[i + 1];
        items.push({producto: p.id, nombre: p.nombre, cant: lista[i + 1], precio: p.precio, unidad: p.unidad || "u"});
      }
      const c = S.clientes[7 % S.clientes.length];
      S.pedidos.push({id: 4099, numero: ++S.numPedido, codigo: "seedpv", cliente: c.id, items, envio: 0, total: items.reduce((a, i) => a + i.cant * i.precio, 0),
                      entrega: "retiro", inicio: fiso(t), franja: hm(t), direccion: "", nota: "", estado: "reservado", creado: fiso(addDays(h, -3))});
    }
  }

  // ── Personal de ejemplo de cada negocio ─────────────────────────
  // t: tramos del día ("A" = apertura, "C" = cierre); se recortan al horario del negocio. dias: días que trabaja (0 = lunes).
  // pro: nombre del profesional o recurso de la agenda que atiende. vac: vacaciones la semana que viene. lic: licencia mañana. tarde: pasado mañana entra a las 15.
  const PERSONAL = {
    belleza: [{pro: "Caro"}, {pro: "Juli", vac: 1}, {pro: "Meli", tarde: 1}, {pro: "Lu"}, {nombre: "Paula", rol: "Recepción", lic: 1}],
    taller: [{nombre: "Ramón Díaz", rol: "Mecánico", dias: [0, 1, 2, 3, 4]}, {nombre: "Hugo Sosa", rol: "Mecánico", dias: [0, 1, 2, 3, 4, 5], vac: 1}, {nombre: "Sergio Ruiz", rol: "Mecánico a domicilio", pro: "Móvil", dias: [0, 1, 2, 3, 4], tarde: 1}],
    consultorio: [{pro: "Dra. Sofía Paz"}, {pro: "Lic. Martín Ríos", vac: 1}, {pro: "Lic. Carla Vega"}, {nombre: "Romina", rol: "Secretaria", lic: 1}],
    estudio: [{pro: "Cr. Luis Figueroa"}, {pro: "Cra. Ana López", vac: 1}, {nombre: "Marta", rol: "Administrativa", tarde: 1}],
    inmobiliaria: [{pro: "Laura"}, {pro: "Diego", vac: 1}, {nombre: "Silvia", rol: "Secretaria", lic: 1}],
    gimnasio: [{nombre: "Nico", rol: "Profe", clases: 1}, {nombre: "Fede", rol: "Profe", clases: 1}, {nombre: "Vale", rol: "Profe", clases: 1}, {nombre: "Rodrigo", rol: "Profe", clases: 1}, {nombre: "Ana", rol: "Profe", clases: 1},
               {nombre: "Lorena", rol: "Recepción", t: [["A", "14:00"]], vac: 1}, {nombre: "Matías", rol: "Recepción", t: [["14:00", "C"]], lic: 1}],
    danza: [{nombre: "Prof. Mario", rol: "Folklore", clases: 1}, {nombre: "Prof. Inés", rol: "Clásico", clases: 1}, {nombre: "Prof. Leo", rol: "Urbano", clases: 1},
            {nombre: "Prof. Sofi", rol: "Contemporáneo", clases: 1}, {nombre: "Prof. Tati", rol: "Infantil", clases: 1}, {nombre: "Carina", rol: "Secretaría", vac: 1}],
    canchas: [{nombre: "Pablo", rol: "Encargado mañana", t: [["A", "16:00"]]}, {nombre: "Gustavo", rol: "Encargado noche", t: [["16:00", "C"]], lic: 1}, {nombre: "Emiliano", rol: "Mantenimiento", t: [["A", "14:00"]], dias: [0, 2, 4], vac: 1}],
    mates: [{nombre: "Valeria", rol: "Vendedora", t: [["A", "14:00"]], tarde: 1}, {nombre: "Tomás", rol: "Vendedor", t: [["14:00", "C"]], vac: 1}],
    ferreteria: [{nombre: "Carlos", rol: "Mostrador"}, {nombre: "Lucas", rol: "Depósito y envíos", dias: [0, 1, 2, 3, 4], vac: 1}, {nombre: "Andrea", rol: "Caja", t: [["A", "14:00"]], lic: 1}],
    almacen: [{nombre: "Rosa", rol: "Caja", t: [["A", "15:00"]]}, {nombre: "Jorge", rol: "Caja", t: [["15:00", "C"]], lic: 1}, {nombre: "Brian", rol: "Reparto", t: [["10:00", "13:00"], ["17:00", "20:00"]], vac: 1}],
    ropa: [{nombre: "Agustina", rol: "Vendedora"}, {nombre: "Micaela", rol: "Vendedora", dias: [3, 4, 5], vac: 1}, {nombre: "Julieta", rol: "Redes y envíos", t: [["A", "14:00"]], dias: [0, 1, 2, 3, 4], tarde: 1}],
    cafe: [{nombre: "Sebastián", rol: "Barista", t: [["A", "15:00"]]}, {nombre: "Florencia", rol: "Moza", t: [["A", "15:00"]], lic: 1}, {nombre: "Nahuel", rol: "Barista", t: [["15:00", "C"]]}, {nombre: "Camila", rol: "Moza", t: [["15:00", "C"]], vac: 1}],
    restaurante: [{nombre: "Raúl", rol: "Cocina"}, {nombre: "Leandro", rol: "Mozo"}, {nombre: "Josefina", rol: "Moza", lic: 1}, {nombre: "Ariel", rol: "Bacha", vac: 1}],
    rotiseria: [{nombre: "Mabel", rol: "Cocina"}, {nombre: "Diego", rol: "Mostrador", lic: 1}, {nombre: "Franco", rol: "Reparto", t: [["11:30", "14:30"], ["19:30", "C"]], vac: 1}],
    heladeria: [{nombre: "Antonella", rol: "Atención", t: [["A", "17:00"]]}, {nombre: "Ezequiel", rol: "Atención", t: [["17:00", "C"]], lic: 1}, {nombre: "Ramiro", rol: "Reparto", t: [["18:00", "C"]], vac: 1}],
    cabanas: [{nombre: "Norma", rol: "Limpieza", t: [["08:00", "14:00"]]}, {nombre: "Raúl", rol: "Mantenimiento", t: [["08:00", "16:00"]], dias: [0, 1, 2, 3, 4, 5], vac: 1}, {nombre: "Lucía", rol: "Recepción", t: [["14:00", "22:00"]], lic: 1}],
  };
  // Las reservas de ejemplo tienen que respetar el plan de cada socio (actividades, veces por semana, pack, vencimiento).
  function ajustarAPlanes(S) {
    const pls = (S.negocio || {}).planes; if (!pls || !pls.length || !S.inscripciones) return S;
    const so = {}; (S.socios || []).forEach(x => so[x.telefono] = x);
    const cli = {}; (S.clientes || []).forEach(c => cli[c.id] = c);
    const cuenta = {};
    S.inscripciones.sort((a, b) => a.inicio.localeCompare(b.inicio));
    S.inscripciones = S.inscripciones.filter(i => {
      if (i.estado !== "confirmado") return true;
      const c = cli[i.cliente], s0 = c && so[c.telefono]; if (!s0) return true;
      const pl = pls.find(p => p.id === s0.plan); if (!pl) return true;
      const cl = (S.clases || []).find(x => x.id === i.clase) || {};
      if (pl.actividades && pl.actividades.length && !pl.actividades.includes(cl.actividad)) return false;
      if (pl.por_semana) {
        const d = parse(i.fecha), k = `${c.id}|${fdia(addDays(d, -wd(d)))}`;
        cuenta[k] = (cuenta[k] || 0) + 1; if (cuenta[k] > pl.por_semana) return false;
      }
      return true;
    });
    return S;
  }

  function sembrarPersonal(rubro, S) {
    const lista = PERSONAL[rubro]; if (!lista || S.personal) return S;
    const n = S.negocio, h = hoy(), COL = ["#E8772E", "#2F6FDE", "#1F8A5B", "#7A5AF8", "#C2412D", "#0E7490", "#B45309", "#475569"];
    const abiertos = [...new Set(n.horarios.map(x => x.dia))].sort();
    // tramos de la persona recortados al horario del negocio de ese día
    const recortar = (t, dia) => {
      const out = [];
      for (const f of n.horarios.filter(x => x.dia === dia)) for (let [a, b] of t) {
        a = a === "A" ? f.desde : a; b = b === "C" ? f.hasta : b;
        const x = minutos(a) > minutos(f.desde) ? a : f.desde, y = minutos(b) < minutos(f.hasta) ? b : f.hasta;
        if (minutos(y) > minutos(x)) out.push([x, y]);
      }
      return out.sort((p, q) => minutos(p[0]) - minutos(q[0]));
    };
    S.personal = []; S.personalDias = [];
    lista.forEach((d, i) => {
      const pr = d.pro ? (S.profesionales || []).find(p => p.nombre === d.pro) : null;
      let dias = d.dias || (pr && pr.dias) || abiertos;
      if (!d.dias && !(pr && pr.dias) && abiertos.length >= 6) dias = abiertos.filter(x => x !== i % 6);   // un franco por semana
      const horario = {};
      for (const w of abiertos) horario[String(w)] = dias.includes(w) ? recortar(d.t || [["A", "C"]], w) : [];
      if (d.clases) {   // profes: su horario son sus clases (las que están a menos de hora y media se juntan)
        const hhmm = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
        for (const w of abiertos) {
          const cs = (S.clases || []).filter(c => c.profe === d.nombre && c.dias.includes(w)).map(c => [minutos(c.hora), minutos(c.hora) + (c.min || 60)]).sort((x, y) => x[0] - y[0]);
          const tr = [];
          for (const [x, y] of cs) { const u = tr[tr.length - 1]; if (u && x - u[1] <= 90) u[1] = Math.max(u[1], y); else tr.push([x, y]); }
          horario[String(w)] = tr.map(([x, y]) => [hhmm(x), hhmm(y)]);
        }
      }
      S.personal.push({id: 9000 + i, nombre: d.nombre || d.pro, rol: d.rol || (pr ? (pr.rol || n.recurso || "Profesional") : ""), color: (pr && pr.color) || COL[i % COL.length], pro: pr ? pr.id : null, horario});
      const per = S.personal[S.personal.length - 1];
      if (d.vac) { const lun = addDays(h, 7 - wd(h)); for (let k = 0; k < 7; k++) S.personalDias.push({persona: per.id, fecha: fdia(addDays(lun, k)), tipo: "vacaciones", tramos: [], nota: "Vacaciones de verano"}); }
      if (d.lic) S.personalDias.push({persona: per.id, fecha: fdia(addDays(h, 1)), tipo: "licencia", tramos: [], nota: "Turno médico"});
      if (d.tarde) { const f = addDays(h, 2), tr = recortar([["15:00", "C"]], wd(f)); if (tr.length) S.personalDias.push({persona: per.id, fecha: fdia(f), tipo: "trabaja", tramos: tr, nota: "Entra más tarde"}); }
    });
    // Los turnos de ejemplo que caen cuando esa persona no trabaja pasan a otra persona libre o se sacan.
    const libre = (pro, ini, fin) => {
      const per = S.personal.find(x => x.pro === pro); if (!per) return true;
      const x = diaPersona(S, per, fdia(ini));
      return x.tipo === "trabaja" && x.tramos.some(([a, b]) => atTime(ini, a) <= ini && fin <= atTime(ini, b));
    };
    S.turnos = (S.turnos || []).filter(t => {
      if (t.estado !== "confirmado" || t.pro == null || libre(t.pro, parse(t.inicio), parse(t.fin))) return true;
      const sv = (S.servicios || []).find(x => x.id == t.servicio) || {};
      const otro = (S.profesionales || []).find(p => p.id !== t.pro && (!sv.pros || !sv.pros.length || sv.pros.includes(p.id)) && libre(p.id, parse(t.inicio), parse(t.fin))
        && !S.turnos.some(u => u !== t && u.estado === "confirmado" && u.pro === p.id && parse(u.inicio) < parse(t.fin) && parse(u.fin) > parse(t.inicio)));
      if (otro) { t.pro = otro.id; return true; }
      return false;
    });
    return S;
  }

  window.NOA_DEMO_CREAR = function (rubro) {
    const seed = SEEDS[rubro];
    if (!seed) throw new Error("Rubro de demo desconocido: " + rubro);
    let S0;
    const api = crear(() => (S0 = seed()));
    if (S0._post) S0._post(api);
    S0.negocio.resena_url = S0.negocio.resena_url || "https://g.page/r/ejemplo-de-tu-negocio/review";
    S0.negocio._demo = rubro;
    {   // opiniones de ejemplo
      const cs = S0.clientes || [], com = [[5, "Súper atentos, volvemos seguro"], [5, null], [4, "Muy bien, un poco de espera"], [5, "Excelente"], [2, "Me hicieron esperar 30 minutos y nadie avisó"], [4, null], [5, null], [3, "Bien, pero caro"]];
      S0.opiniones = cs.length > 10 ? com.map(([nota, comentario], i) => ({cliente: cs[i + 2].id, nota, comentario, cuando: fiso(new Date(Date.now() - (i * 3 + 1) * 864e5))})) : [];
    }   // en la demo, un link de ejemplo
    if ((S0.productos || []).length && !S0.negocio.proveedores) {   // dos proveedores de ejemplo, repartidos por categoría
      S0.negocio.proveedores = [{id: "pv1", nombre: "Distribuidora del Norte", telefono: "5493875550001"}, {id: "pv2", nombre: "Mayorista Güemes", telefono: "5493875550002"}];
      const cats = [...new Set(S0.productos.map(p => p.cat))];
      S0.productos.forEach(p => { if (p.stock != null) p.proveedor = cats.indexOf(p.cat) % 2 ? "pv2" : "pv1"; });
      const cs = S0.productos.filter(p => p.stock != null && p.minimo);
      if (!cs.some(p => p.stock <= p.minimo)) [cs[1], cs[4]].filter(Boolean).forEach(p => p.stock = p.minimo);   // que se vea el pedido armado
    }
    // "Volver a los N días" de ejemplo, y algunas visitas viejas para que se vea a quién le toca
    const REP = {taller: [/service|aceite/i, 180], belleza: [/corte/i, 35], consultorio: [/limpieza|control|consulta/i, 180]};
    if (REP[rubro]) {
      const [re, dias] = REP[rubro], svs = S0.servicios.filter(x => re.test(x.nombre));
      svs.forEach(x => x.repetir = dias);
      const sv = svs[0], autos = [["Gol Trend", "AB123CD"], ["Corolla", "AD456EF"], ["Hilux", "AC789GH"]];
      if (sv) S0.clientes.slice(-3).forEach((c, i) => {
        const ini = new Date(Date.now() - (dias + 10 + i * 20) * 864e5); ini.setHours(10, 0, 0, 0);
        S0.turnos.push({id: "old" + i, codigo: "old" + i, servicio: sv.id, pro: null, cliente: c.id, inicio: fiso(ini), fin: fiso(new Date(ini.getTime() + sv.min * 60000)), estado: "asistio",
                        modalidad: "local", direccion: "", extra: rubro === "taller" ? {auto: autos[i][0], patente: autos[i][1]} : {}, origen: "panel", precio: sv.precio, creado: fiso(ini), nuevo: false});
      });
    }
    if (rubro === "taller" && (S0.clientes || []).length > 4) {     // presupuestos de ejemplo
      const c = S0.clientes, d = k => fdia(new Date(Date.now() + k * 864e5)), h = k => fiso(new Date(Date.now() - k * 864e5));
      S0.presupuestos = [
        {id: "pr1", numero: 41, cliente: c[2].id, auto: "Corolla", patente: "AD456EF", items: [{desc: "Kit de distribución", cant: 1, precio: 145000}, {desc: "Bomba de agua", cant: 1, precio: 62000}, {desc: "Mano de obra", cant: 1, precio: 55000}], total: 262000, validez: d(12), nota: "Incluye líquido refrigerante", estado: "enviado", codigo: "presej41", creado: h(1)},
        {id: "pr2", numero: 40, cliente: c[4].id, auto: "Gol Trend", patente: "AB123CD", items: [{desc: "Pastillas de freno delanteras", cant: 1, precio: 38000}, {desc: "Rectificado de discos", cant: 2, precio: 12000}, {desc: "Mano de obra", cant: 1, precio: 25000}], total: 87000, validez: d(8), nota: null, estado: "aceptado", codigo: "presej40", creado: h(4)},
        {id: "pr3", numero: 39, cliente: c[1].id, auto: "Hilux", patente: "AC789GH", items: [{desc: "Embrague completo", cant: 1, precio: 410000}, {desc: "Mano de obra", cant: 1, precio: 90000}], total: 500000, validez: d(-3), nota: null, estado: "enviado", codigo: "presej39", creado: h(18)}];
    }
    if (["almacen", "ferreteria", "mates", "rotiseria"].includes(rubro) && (S0.clientes || []).length > 6) {    // cuentas de ejemplo
      const h = d => fiso(new Date(Date.now() - d * 864e5)), c = S0.clientes;
      S0.fiado = [{cliente: c[3].id, tipo: "pago", monto: 5000, concepto: null, quien: "Caro", cuando: h(2)}, {cliente: c[3].id, tipo: "debe", monto: 12800, concepto: "compras de la semana", quien: "Caro", cuando: h(9)},
                  {cliente: c[6].id, tipo: "debe", monto: 4300, concepto: "pan, leche y yerba", quien: "Dueño", cuando: h(4)}, {cliente: c[1].id, tipo: "debe", monto: 21500, concepto: "pedido del mes", quien: "Dueño", cuando: h(38)}];
    }
    if (["belleza", "consultorio", "taller", "estudio"].includes(rubro)) (S0.profesionales || []).forEach((p, i) => p.comision = rubro === "consultorio" ? 60 : 40 + (i % 2) * 5);
    if (["canchas", "cabanas", "belleza"].includes(rubro)) {      // señas con Mercado Pago (simuladas en la demo)
      S0.negocio.mp = {conectado: true, cuenta: "tu cuenta (simulación)"};
      if (rubro === "canchas") S0.servicios.forEach(s => s.sena = Math.min(5000, Math.round(s.precio * .3 / 500) * 500));
      if (rubro === "belleza") S0.servicios.filter(s => s.precio >= 15000).forEach(s => s.sena = 5000);
    }
    if (rubro !== "inmobiliaria") {     // promos de ejemplo y algunos cumpleaños cerca
      const area = (S0.unidades || []).length ? "estadias" : (S0.productos || []).length ? "pedidos" : (S0.servicios || []).length ? "turnos" : null;
      if (area) S0.negocio.promos = S0.negocio.promos || [
        {id: "pr1", codigo: "BIENVENIDA10", pct: 10, aplica: [area], desde: null, hasta: null, usos_max: 50, usos: 7, una_vez: true, cumple: false, activo: true, usados: []},
        {id: "pr2", codigo: "CUMPLE15", pct: 15, aplica: [area], desde: null, hasta: null, usos_max: null, usos: 2, una_vez: true, cumple: true, activo: true, usados: []}];
      S0.negocio.pedir_cumple = S0.negocio.pedir_cumple ?? true;
      const hace = h => fiso(new Date(Date.now() - h * 3600e3));
      const dd = new Date().getDate(), mesA = fdia(new Date()).slice(0, 7);
      S0.negocio.gastos = S0.negocio.gastos || [
        {id: "g1", concepto: "Alquiler del local", cat: "Alquiler", monto: rubro === "cabanas" ? 0 : 450000, dia: Math.min(28, dd + 2), medio: "Transferencia", activo: true, pagado_mes: null},
        {id: "g2", concepto: "Luz", cat: "Servicios", monto: 68000, dia: Math.max(1, dd - 3), medio: "Transferencia", activo: true, pagado_mes: null},
        {id: "g3", concepto: "Internet", cat: "Servicios", monto: 32000, dia: 10, medio: "Débito automático", activo: true, pagado_mes: dd >= 10 ? mesA : null},
        {id: "g4", concepto: "Monotributo", cat: "Impuestos", monto: 58000, dia: 20, medio: "Transferencia", activo: true, pagado_mes: dd >= 21 ? mesA : null}].filter(g => g.monto);
      S0.arqueos = [{cuando: hace(16), quien: "Caro", fondo: 20000, esperado: 87400, contado: 86900, retiro: 66900, nota: null},
                    {cuando: hace(40), quien: "Dueño", fondo: 20000, esperado: 64200, contado: 64200, retiro: 44200, nota: "Depositado en el banco"}];
      S0.actividad = [{quien: "Caro", rol: "empleado", accion: "Marcó que vino · cliente de las 9:00", cuando: hace(2)}, {quien: "Lucho", rol: "encargado", accion: "Cambió un dato del catálogo", cuando: hace(5)},
                      {quien: "Caro", rol: "empleado", accion: "Cerró la caja", cuando: hace(20)}, {quien: "Dueño", rol: "dueño", accion: "Subió los precios", cuando: hace(50)}];
      S0.negocio.usuarios = S0.negocio.usuarios || [{id: "us1", nombre: "Caro", usuario: `caro.${rubro}`, rol: "empleado", activo: true, ultimo: fiso(new Date(Date.now() - 3 * 3600e3))},
                                                     {id: "us2", nombre: "Lucho", usuario: `lucho.${rubro}`, rol: "encargado", activo: true, ultimo: fiso(new Date(Date.now() - 26 * 3600e3))}];
      const h = new Date();
      (S0.clientes || []).forEach((c, i) => { if (i % 9 === 4) { const d = new Date(h.getTime() + ((i * 5) % 40) * 864e5); c.cumple = `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; } });
    }
    sembrarPersonal(rubro, ajustarAPlanes(S0));     // después de todo lo sembrado: horarios del personal y planes coherentes
    if (!["cabanas", "inmobiliaria"].includes(rubro) && (S0.clases || S0.servicios)) api._sembrarEspera();
    return api;
  };
  window.NOA_DEMO_RUBROS = Object.keys(SEEDS);
  window.NOA_DEMO_SEEDS = Object.fromEntries(Object.entries(SEEDS).map(([r, f]) => [r, () => sembrarPersonal(r, ajustarAPlanes(f()))]));
})();
