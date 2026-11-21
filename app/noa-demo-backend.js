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

  function normTel(t) {
    let d = String(t || "").replace(/\D/g, "");
    if (d.startsWith("549")) d = d.slice(3); else if (d.startsWith("54")) d = d.slice(2);
    d = d.replace(/^0+/, "");
    if (d.length === 12) for (const n of [2, 3, 4]) if (d.slice(n, n + 2) === "15") { d = d.slice(0, n) + d.slice(n + 2); break; }
    return d.length === 10 ? "549" + d : null;
  }

  // ── Motor ─────────────────────────────────────────────────────────
  function crear(seed) {
    const S = seed();
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
      const cand = pros().length ? prosDe(s).filter(p => !proId || p.id == proId).filter(p => !p.dias || p.dias.includes(wd(d)))
        .filter(p => !p.modalidad || p.modalidad === "ambos" || p.modalidad === (modalidad || "local")) : null;
      const out = [];
      for (const f of horariosDia(d)) {
        for (let t = atTime(d, f.desde); addMin(t, dur) <= atTime(d, f.hasta); t = addMin(t, paso)) {
          if (t < min) continue;
          const fin = addMin(t, dur);
          if (cand) { const p = cand.find(p => !ocupa(p.id, t, fin)); if (p) out.push({inicio: fiso(t), hora: hm(t), pro: p.id}); }
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
        for (const c of S.clases.filter(c => c.dias.includes(wd(d)))) {
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

    // ── Productos ──────────────────────────────────────────────────
    const prod = pid => S.productos.find(p => p.id == pid);
    const ent = () => n.entrega || {};
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

    // ── Caja ───────────────────────────────────────────────────────
    const mov = (tipo, concepto, monto, cat, medio = "Efectivo", fecha = fiso(ahora())) => {
      const m = {id: id(), fecha, tipo, concepto, monto: Math.round(monto), cat, medio};
      S.movimientos.push(m); return m;
    };

    const api = {
      // ── Lado del cliente ─────────────────────────────────────────
      async info() {
        return {
          nombre: n.nombre, rubro: n.rubro, direccion: n.direccion, maps: n.maps, whatsapp: n.whatsapp,
          bienvenida: n.bienvenida, recurso: n.recurso || "Profesional", elegir_pro: n.elegir_pro !== false,
          campos_extra: n.campos_extra || [], zona_domicilio: n.zona_domicilio, solo_socios: !!n.solo_socios,
          textos: n.textos || {},
          servicios: S.servicios.map(s => ({id: s.id, nombre: s.nombre, cat: s.cat, desc: s.desc, precio: s.precio, precio_txt: s.precio ? pesos(s.precio) : "Sin cargo",
                                             min: s.min, modalidad: s.modalidad || "local", pros: prosDe(s).map(p => p.id)})),
          profesionales: pros().map(p => ({id: p.id, nombre: p.nombre, rol: p.rol})),
          actividades: (S.actividades || []).map(a => ({id: a.id, nombre: a.nombre, desc: a.desc, color: a.color})),
          productos: (S.productos || []).map(p => ({id: p.id, nombre: p.nombre, cat: p.cat, desc: p.desc, precio: p.precio, precio_txt: pesos(p.precio),
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
      async horas({servicio, dia, pro, modalidad}) { return libres(serv(servicio), dia, pro, modalidad); },
      async reservarTurno(p) {
        const s = serv(p.servicio), tel = normTel(p.telefono);
        if (!p.nombre || p.nombre.trim().length < 2) throw new Err("Escribí tu nombre.");
        if (!tel) throw new Err("Revisá el celular: código de área sin 0 y número sin 15. Ej: 387 612 4879");
        const modalidad = s.modalidad === "ambos" ? (p.modalidad || "local") : (s.modalidad || "local");
        if (modalidad === "domicilio" && !(p.direccion || "").trim()) throw new Err("Escribí la dirección donde está el auto.");
        for (const c of n.campos_extra || []) if (c.req && !((p.extra || {})[c.id] || "").trim()) throw new Err(`Completá: ${c.label}.`);
        const c = cliente(p.nombre, tel, p.acepta !== false);
        if (futuros(c.id) >= 3) throw new Err("Ya tenés 3 reservas próximas. Cancelá alguna o escribile al negocio.");
        const ok = libres(s, p.inicio.slice(0, 10), p.pro, modalidad).find(x => x.inicio === p.inicio);
        if (!ok) throw new Err("Ese horario se acaba de ocupar. Elegí otro.", "ocupado");
        const ini = parse(p.inicio);
        const t = {id: id(), codigo: codigo(), servicio: s.id, pro: ok.pro || null, cliente: c.id, inicio: p.inicio,
                   fin: fiso(addMin(ini, duracion(s, modalidad))), estado: "confirmado", modalidad, direccion: p.direccion || "",
                   extra: p.extra || {}, origen: "web", precio: s.precio, creado: fiso(ahora()), nuevo: true};
        S.turnos.push(t);
        emit("turno", t);
        const pr = pros().find(x => x.id === t.pro);
        return {ok: true, tipo: "turno", codigo: t.codigo, titulo: s.nombre, cuando: larga(ini), precio: s.precio ? pesos(s.precio) : "",
                detalle: [pr && n.elegir_pro !== false ? `Con ${pr.nombre}` : "", modalidad === "domicilio" ? `A domicilio: ${t.direccion}` : n.direccion ? `📍 ${n.direccion}` : ""].filter(Boolean),
                avisar: n.whatsapp ? `https://wa.me/${n.whatsapp}?text=${encodeURIComponent(`Hola! Soy ${c.nombre}, saqué turno de ${s.nombre} para el ${larga(ini)}.`)}` : null};
      },
      async clases() { return ocurrencias(7); },
      async inscribir(p) {
        const tel = normTel(p.telefono);
        if (!p.nombre || p.nombre.trim().length < 2) throw new Err("Escribí tu nombre.");
        if (!tel) throw new Err("Revisá el celular: código de área sin 0 y número sin 15. Ej: 387 612 4879");
        const o = ocurrencias(7).find(x => x.id === p.ocurrencia);
        if (!o) throw new Err("Esa clase ya no está disponible.");
        if (n.solo_socios) {
          const so = socioDe(tel);
          if (!so) throw new Err(`No encontramos un socio con ese celular. Si sos nuevo, escribinos y te damos de alta.`, "socio");
          if (so.vence < o.fecha) throw new Err(`Tu cuota venció el ${so.vence.slice(8, 10)}/${so.vence.slice(5, 7)}. Pagala en recepción o por transferencia y reservá tu lugar.`, "cuota");
        }
        if (o.ocupados >= o.cupo) throw new Err("Esa clase se llenó. Elegí otro horario.", "lleno");
        const c = cliente(p.nombre, tel, true);
        if (S.inscripciones.some(i => i.clase === o.clase && i.fecha === o.fecha && i.cliente === c.id && i.estado === "confirmado"))
          throw new Err("Ya estás anotado en esa clase.");
        if (futuros(c.id) >= 3) throw new Err("Ya tenés 3 reservas próximas. Cancelá alguna para sacar otra.");
        const i = {id: id(), codigo: codigo(), clase: o.clase, fecha: o.fecha, inicio: o.inicio, cliente: c.id, estado: "confirmado", asistio: null, creado: fiso(ahora()), nuevo: true};
        S.inscripciones.push(i);
        emit("inscripcion", i);
        return {ok: true, tipo: "clase", codigo: i.codigo, titulo: `${o.nombre} con ${o.profe}`, cuando: larga(parse(o.inicio)),
                detalle: [`Quedan ${o.cupo - o.ocupados - 1} lugares`, n.direccion ? `📍 ${n.direccion}` : ""].filter(Boolean),
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
        items.forEach(it => { const pr = prod(it.producto); if (pr.stock != null) pr.stock -= it.cant; });
        const c = cliente(p.nombre, tel, true);
        const envio = tipo === "envio" ? ent().envio.costo : 0;
        const ped = {id: id(), numero: ++S.numPedido, codigo: codigo(), cliente: c.id, items, envio, total: items.reduce((a, it) => a + it.cant * it.precio, 0) + envio,
                     entrega: tipo, inicio: p.inicio, franja: fr.hora, direccion: p.direccion || "", nota: (p.nota || "").slice(0, 300), estado: "reservado",
                     creado: fiso(ahora()), nuevo: true};
        S.pedidos.push(ped);
        emit("pedido", ped);
        const d = parse(p.inicio);
        return {ok: true, tipo: "pedido", codigo: ped.codigo, numero: ped.numero, titulo: `Pedido #${ped.numero}`, precio: pesos(ped.total),
                cuando: `${DIAS[wd(d)]} ${d.getDate()}/${d.getMonth() + 1}, ${tipo === "envio" ? "entre las " + fr.hora.replace(" a ", " y las ") : "a las " + fr.hora}`,
                detalle: [tipo === "envio" ? `Envío a ${ped.direccion}` : `Retirás en ${n.direccion || "el local"}`, ...items.map(it => `${it.cant} × ${it.nombre}`)],
                avisar: n.whatsapp ? `https://wa.me/${n.whatsapp}?text=${encodeURIComponent(`Hola! Soy ${c.nombre}, hice el pedido #${ped.numero} por la web.`)}` : null};
      },
      async reserva({codigo: cod}) {
        const t = S.turnos.find(x => x.codigo === cod);
        if (t) return {tipo: "turno", titulo: serv(t.servicio).nombre, cuando: larga(parse(t.inicio)), estado: t.estado, negocio: n.nombre, whatsapp: n.whatsapp};
        const i = S.inscripciones.find(x => x.codigo === cod);
        if (i) { const c = S.clases.find(x => x.id === i.clase); return {tipo: "clase", titulo: actividad(c.actividad).nombre, cuando: larga(parse(i.inicio)), estado: i.estado, negocio: n.nombre, whatsapp: n.whatsapp}; }
        const p = S.pedidos.find(x => x.codigo === cod);
        if (p) return {tipo: "pedido", titulo: `Pedido #${p.numero}`, cuando: larga(parse(p.inicio)), estado: p.estado === "reservado" ? "confirmado" : p.estado, negocio: n.nombre, whatsapp: n.whatsapp};
        throw new Err("No encontramos esa reserva.");
      },
      async cancelarReserva({codigo: cod}) {
        const t = S.turnos.find(x => x.codigo === cod && x.estado === "confirmado" && parse(x.inicio) > ahora());
        if (t) { t.estado = "cancelado"; emit("cancelado", t); return {ok: true}; }
        const i = S.inscripciones.find(x => x.codigo === cod && x.estado === "confirmado" && parse(x.inicio) > ahora());
        if (i) { i.estado = "cancelado"; emit("cancelado", i); return {ok: true}; }
        const p = S.pedidos.find(x => x.codigo === cod && x.estado === "reservado");
        if (p) { api._cancelarPedido(p); return {ok: true}; }
        throw new Err("Esa reserva ya no se puede cancelar desde acá. Escribile al negocio.");
      },
      _cancelarPedido(p) {
        p.estado = "cancelado";
        p.items.forEach(it => { const pr = prod(it.producto); if (pr && pr.stock != null) pr.stock += it.cant; });
        emit("cancelado", p);
      },

      // ── Panel del dueño ──────────────────────────────────────────
      async panel() {
        return {nombre: n.nombre, rubro: n.rubro, recurso: n.recurso || "Profesional", recursos: pros().map(p => ({id: p.id, nombre: p.nombre, rol: p.rol, color: p.color, dias: p.dias || null})),
                tiene: {turnos: S.servicios.length > 0, clases: (S.clases || []).length > 0, productos: (S.productos || []).length > 0, socios: !!n.solo_socios},
                cuota: n.cuota, link: n.link, textos: n.textos || {}};
      },
      async agenda({dia}) {
        let d = dia ? parse(dia) : ahora();
        if (!dia) { for (let i = 0; i < 7; i++) { const x = addDays(ahora(), i), hs = horariosDia(x); if (hs.length && (i > 0 || hs.some(h => atTime(x, h.hasta) > ahora()))) { d = x; break; } } }
        const k = fdia(d);
        const cl = cid => S.clientes.find(c => c.id === cid) || {};
        const rec = (tel, txt) => `https://wa.me/${tel}?text=${encodeURIComponent(txt)}`;
        const turnos = S.turnos.filter(t => t.inicio.startsWith(k)).map(t => {
          const s = serv(t.servicio), c = cl(t.cliente), ini = parse(t.inicio);
          return {kind: "turno", id: t.id, hora: hm(ini), fin: hm(parse(t.fin)), inicio: t.inicio, titulo: s.nombre, cliente: c.nombre, telefono: c.telefono,
                  pro: t.pro, estado: t.estado, modalidad: t.modalidad, direccion: t.direccion, extra: t.extra, precio: pesos(t.precio || 0), monto: t.precio || 0, origen: t.origen, nuevo: !!t.nuevo,
                  recordar: c.acepta && t.estado === "confirmado" ? rec(c.telefono, `Hola ${(c.nombre || "").split(" ")[0]}! Te recordamos tu turno de ${s.nombre} el ${larga(ini)} en ${n.nombre}. Si no podés venir, avisanos por acá 🙏`) : null};
        });
        const clases = (S.clases || []).filter(c => c.dias.includes(wd(d))).map(c => {
          const a = actividad(c.actividad), ins = S.inscripciones.filter(i => i.clase === c.id && i.fecha === k && i.estado === "confirmado");
          return {kind: "clase", id: `${c.id}|${k}`, hora: c.hora, fin: hm(addMin(atTime(d, c.hora), c.min)), inicio: `${k}T${c.hora}:00`, titulo: a.nombre, color: a.color, profe: c.profe, cupo: c.cupo,
                  inscriptos: ins.map(i => ({id: i.id, nombre: cl(i.cliente).nombre, telefono: cl(i.cliente).telefono, asistio: i.asistio, nuevo: !!i.nuevo})), nuevo: ins.some(i => i.nuevo)};
        });
        const pedidos = S.pedidos.filter(p => p.inicio.startsWith(k)).map(p => {
          const c = cl(p.cliente);
          return {kind: "pedido", id: p.id, numero: p.numero, hora: hm(parse(p.inicio)), franja: p.franja, inicio: p.inicio, titulo: `Pedido #${p.numero}`, cliente: c.nombre, telefono: c.telefono,
                  items: p.items, total: pesos(p.total), monto: p.total, entrega: p.entrega, direccion: p.direccion, estado: p.estado, nota: p.nota, nuevo: !!p.nuevo,
                  avisar: rec(c.telefono, `Hola ${(c.nombre || "").split(" ")[0]}! Tu pedido #${p.numero} de ${n.nombre} ya está listo${p.entrega === "envio" ? " y sale para tu casa" : " para retirar"} 🙌`)};
        });
        const items = [...turnos, ...clases, ...pedidos].sort((a, b) => a.inicio.localeCompare(b.inicio));
        const hoy = ahora();
        return {dia: k, dia_semana: wd(d), nombre: `${DIAS[wd(d)]} ${d.getDate()}/${d.getMonth() + 1}`, es_hoy: k === fdia(hoy), items,
                resumen: {turnos: turnos.filter(t => t.estado !== "cancelado").length, clases: clases.length, inscriptos: clases.reduce((a, c) => a + c.inscriptos.length, 0),
                          pedidos: pedidos.filter(p => p.estado !== "cancelado").length,
                          esperado: pesos(turnos.filter(t => t.estado !== "cancelado").reduce((a, t) => a + t.monto, 0) + pedidos.filter(p => p.estado !== "cancelado").reduce((a, p) => a + p.monto, 0))},
                horario: horariosDia(d)};
      },
      async estadoTurno({id: tid, estado}) {
        const t = S.turnos.find(x => x.id == tid); if (!t) throw new Err("No existe.");
        const antes = t.estado; t.estado = estado; t.nuevo = false;
        if (estado === "asistio" && antes !== "asistio" && t.precio) mov("ingreso", `${serv(t.servicio).nombre} · ${(S.clientes.find(c => c.id === t.cliente) || {}).nombre}`, t.precio, "Servicios");
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
            return {...p, cuando: `${nombreDia(d, ahora())} ${p.franja}`, cliente: c.nombre, telefono: c.telefono, total_txt: pesos(p.total),
                    avisar: `https://wa.me/${c.telefono}?text=${encodeURIComponent(`Hola ${(c.nombre || "").split(" ")[0]}! Tu pedido #${p.numero} de ${n.nombre} ya está listo${p.entrega === "envio" ? " y sale para tu casa" : " para retirar"} 🙌`)}`};
          });
      },
      async estadoPedido({id: pid, estado}) {
        const p = S.pedidos.find(x => x.id == pid); if (!p) throw new Err("No existe.");
        p.nuevo = false;
        if (estado === "cancelado") { if (p.estado !== "cancelado" && p.estado !== "entregado") api._cancelarPedido(p); return {ok: true}; }
        if (estado === "entregado" && p.estado !== "entregado") mov("ingreso", `Pedido #${p.numero}`, p.total, "Ventas", p.entrega === "envio" ? "Transferencia" : "Efectivo");
        p.estado = estado; emit("cambio", p); return {ok: true};
      },
      async stock() {
        const apartado = pid => S.pedidos.filter(p => ["reservado", "listo"].includes(p.estado)).reduce((a, p) => a + p.items.filter(i => i.producto === pid).reduce((x, i) => x + i.cant, 0), 0);
        return S.productos.map(p => ({id: p.id, nombre: p.nombre, cat: p.cat, precio: pesos(p.precio), costo: p.costo, stock: p.stock, minimo: p.minimo || 0, unidad: p.unidad || "u",
                                      apartado: apartado(p.id), ilimitado: p.stock == null, bajo: p.stock != null && p.stock <= (p.minimo || 0)}));
      },
      async ajustarStock({id: pid, stock, vendido}) {
        const p = prod(pid); if (!p) throw new Err("No existe.");
        if (vendido) { if (p.stock != null && p.stock < vendido) throw new Err("No hay stock suficiente."); if (p.stock != null) p.stock -= vendido; mov("ingreso", `Venta en el local · ${p.nombre}`, p.precio * vendido, "Ventas"); }
        else p.stock = Math.max(0, Math.round(Number(stock)));
        emit("stock", p); return {ok: true, stock: p.stock};
      },
      async socios() {
        const hoy = fdia(ahora());
        return (S.socios || []).map(s => ({...s, vencida: s.vence < hoy})).sort((a, b) => a.vence.localeCompare(b.vence));
      },
      async pagarCuota({telefono}) {
        const s = socioDe(telefono); if (!s) throw new Err("No existe.");
        const base = s.vence < fdia(ahora()) ? ahora() : parse(s.vence);
        const v = new Date(base); v.setMonth(v.getMonth() + 1); s.vence = fdia(v);
        mov("ingreso", `Cuota ${s.plan} · ${s.nombre}`, n.cuota, "Cuotas", "Transferencia");
        emit("socio", s); return {ok: true, vence: s.vence};
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
                balance: {caja: saldo, stock: Math.round(stockVal), a_cobrar: pendientes, deudas: S.deudas || 0}, negocio: n.nombre};
      },
      async movimiento(p) {
        if (!(Number(p.monto) > 0) || !(p.concepto || "").trim()) throw new Err("Completá concepto y monto.");
        const m = mov(p.tipo === "ingreso" ? "ingreso" : "egreso", p.concepto.trim(), Number(p.monto), p.cat || "Otros", p.medio || "Efectivo");
        emit("caja", m); return {ok: true};
      },
      async novedades() { return []; },
      suscribir(f) { subs.push(f); return () => { const i = subs.indexOf(f); if (i >= 0) subs.splice(i, 1); }; },
      _S: S,
    };
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
  // Llena turnos de ejemplo en la agenda (hoy y los próximos días) respetando las reglas
  function sembrarTurnos(api, S, cuantos, dias = 3) {
    const h = hoy();
    rnd = 11;
    let hechos = 0;
    const hs = habiles(S, dias);
    for (let d = 0; d < hs.length; d++) {
      const dia = hs[d];
      for (let k = 0; k < cuantos[d] && hechos < 200; k++) {
        const s = S.servicios[Math.floor(R() * S.servicios.length)];
        const cand = [];
        const dur = s.min;
        for (const f of S.negocio.horarios.filter(x => x.dia === wd(dia))) {
          for (let t = atTime(dia, f.desde); addMin(t, dur) <= atTime(dia, f.hasta); t = addMin(t, S.negocio.paso || 30)) cand.push(t);
        }
        if (!cand.length) continue;
        const t = cand[Math.floor(R() * cand.length)], fin = addMin(t, dur);
        const modal = s.modalidad === "domicilio" ? "domicilio" : "local";
        const prosOk = (S.profesionales || []).filter(p => (!s.pros || s.pros.includes(p.id)) && (!p.dias || p.dias.includes(wd(dia))) && (!p.modalidad || p.modalidad === "ambos" || p.modalidad === modal));
        const libre = prosOk.find(p => !S.turnos.some(x => x.pro === p.id && x.estado !== "cancelado" && parse(x.inicio) < fin && parse(x.fin) > t));
        if (prosOk.length && !libre) continue;
        if (!prosOk.length && S.turnos.filter(x => x.estado !== "cancelado" && parse(x.inicio) < fin && parse(x.fin) > t).length >= (S.negocio.capacidad || 1)) continue;
        const c = S.clientes[Math.floor(R() * S.clientes.length)];
        const pasado = fin < h;
        S.turnos.push({id: 2000 + hechos, codigo: "seed" + hechos, servicio: s.id, pro: libre ? libre.id : null, cliente: c.id, inicio: fiso(t), fin: fiso(fin),
                       estado: pasado ? (R() < .9 ? "asistio" : "ausente") : "confirmado", modalidad: s.modalidad === "domicilio" ? "domicilio" : "local",
                       direccion: s.modalidad === "domicilio" ? "Barrio Grand Bourg, Salta" : "", extra: S.extraSeed ? S.extraSeed(hechos) : {},
                       origen: R() < .6 ? "web" : "panel", precio: s.precio, creado: fiso(h)});
        hechos++;
      }
    }
  }

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
        clientes: clientesBase(16), turnos: [], inscripciones: [], clases: [], actividades: [], productos: [], pedidos: [],
        movimientos: movsBase([[1, "egreso", "Alquiler del local", 380000, "Alquiler", "Transferencia"], [2, "egreso", "Esmaltes y geles (proveedor)", 96000, "Insumos", "Transferencia"],
                               [3, "ingreso", "Servicios de la semana", 412000, "Servicios"], [5, "egreso", "Luz", 42000, "Servicios públicos", "Débito"],
                               [8, "ingreso", "Servicios de la semana", 468000, "Servicios"], [10, "egreso", "Tinturas y oxidantes", 74000, "Insumos", "Transferencia"],
                               [15, "ingreso", "Servicios de la semana", 451000, "Servicios"], [16, "egreso", "Internet", 21000, "Servicios públicos", "Débito"]]),
        cajaInicial: 150000,
      };
      S._post = api => sembrarTurnos(api, S, [16, 12, 9]);
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
        clientes: clientesBase(14, 16), turnos: [], inscripciones: [], clases: [], actividades: [], productos: [], pedidos: [],
        extraSeed: i => ({auto: ["Fiat Cronos 2021", "Toyota Hilux 2018", "VW Gol Trend 2016", "Peugeot 208 2022", "Ford Ranger 2019", "Renault Kangoo 2017"][i % 6],
                          patente: ["AE 512 KD", "AC 903 LP", "AA 118 QT", "AF 271 MZ", "AD 640 RS", "OKM 451"][i % 6], problema: i % 3 ? "" : "Ruido en el tren delantero"}),
        movimientos: movsBase([[1, "egreso", "Alquiler del galpón", 520000, "Alquiler", "Transferencia"], [3, "ingreso", "Trabajos de la semana", 1240000, "Servicios"],
                               [4, "egreso", "Repuestos (proveedor)", 610000, "Repuestos", "Transferencia"], [9, "ingreso", "Trabajos de la semana", 1385000, "Servicios"],
                               [11, "egreso", "Combustible del móvil", 85000, "Movilidad"], [16, "ingreso", "Trabajos de la semana", 1190000, "Servicios"]]),
        cajaInicial: 400000,
      };
      S._post = api => sembrarTurnos(api, S, [9, 7, 5]);
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
        return {telefono: telDe(i), nombre, plan: i % 4 === 0 ? "Pase libre" : "3 veces por semana", vence: fdia(v)};
      });
      const S = {
        negocio: {nombre: "Gimnasio Altura", rubro: "gimnasio", direccion: "Av. Paraguay 2100, Salta", maps: "https://maps.google.com/?q=Salta", whatsapp: "5493870000000",
                  horarios: [...H(LV, "07:00", "22:00"), ...H([5], "09:00", "13:00")], anticipacion_clase: 15, solo_socios: true, cuota: 35000,
                  bienvenida: "¡Hola! Somos Gimnasio Altura 💪 Reservá tu lugar en las clases acá:", link: "gimnasioaltura.com.ar/clases",
                  textos: {prueba: "Probá con el celular 387 555 1000 (Lucía, cuota al día) o 387 555 1001 (Sofía, cuota vencida)."}},
        actividades: act, clases, socios, clientes: socios.map((s, i) => ({id: i + 1, nombre: s.nombre, telefono: s.telefono, acepta: true})),
        servicios: [], turnos: [], inscripciones: [], productos: [], pedidos: [],
        movimientos: movsBase([[1, "egreso", "Alquiler", 900000, "Alquiler", "Transferencia"], [2, "ingreso", "Cuotas del día", 420000, "Cuotas", "Transferencia"],
                               [3, "ingreso", "Cuotas del día", 385000, "Cuotas", "Transferencia"], [5, "egreso", "Sueldos profes (adelanto)", 650000, "Sueldos", "Transferencia"],
                               [7, "ingreso", "Cuotas del día", 280000, "Cuotas", "Efectivo"], [10, "egreso", "Luz", 168000, "Servicios públicos", "Débito"],
                               [12, "ingreso", "Cuotas del día", 245000, "Cuotas", "Transferencia"], [15, "egreso", "Mantenimiento de bicis", 95000, "Mantenimiento"]]),
        cajaInicial: 600000,
      };
      S._post = () => {
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
        clientes: clientesBase(18), servicios: [], turnos: [], inscripciones: [], clases: [], actividades: [], pedidos: [], numPedido: 1041,
        movimientos: movsBase([[1, "egreso", "Alquiler del local", 450000, "Alquiler", "Transferencia"], [2, "ingreso", "Ventas del día", 186000, "Ventas"],
                               [3, "egreso", "Calabazas (artesano)", 240000, "Mercadería", "Transferencia"], [4, "ingreso", "Ventas del día", 224000, "Ventas", "Transferencia"],
                               [8, "ingreso", "Ventas del día", 152000, "Ventas"], [9, "egreso", "Yerba (distribuidora)", 168000, "Mercadería", "Transferencia"],
                               [12, "ingreso", "Ventas del día", 310000, "Ventas", "Transferencia"], [14, "egreso", "Luz", 38000, "Servicios públicos", "Débito"],
                               [16, "ingreso", "Ventas del día", 198000, "Ventas"]]),
        cajaInicial: 250000,
      };
      S._post = api => sembrarPedidos(S, [[2, 1, 7, 1], [11, 2], [3, 1, 6, 1], [5, 1]]);
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
        clientes: clientesBase(20, 10), servicios: [], turnos: [], inscripciones: [], clases: [], actividades: [], pedidos: [], numPedido: 2318,
        movimientos: movsBase([[1, "egreso", "Alquiler del local", 620000, "Alquiler", "Transferencia"], [2, "ingreso", "Ventas del día", 540000, "Ventas"],
                               [3, "egreso", "Proveedor de electricidad", 780000, "Mercadería", "Transferencia"], [4, "ingreso", "Ventas del día", 612000, "Ventas", "Transferencia"],
                               [8, "ingreso", "Ventas del día", 488000, "Ventas"], [10, "egreso", "Pinturería (distribuidora)", 920000, "Mercadería", "Transferencia"],
                               [12, "ingreso", "Ventas del día", 701000, "Ventas", "Transferencia"], [15, "egreso", "Sueldo empleado", 750000, "Sueldos", "Transferencia"],
                               [16, "ingreso", "Ventas del día", 566000, "Ventas"]]),
        cajaInicial: 900000, deudas: 380000,
      };
      S._post = () => sembrarPedidos(S, [[1, 4, 2, 2, 3, 15], [7, 2, 9, 2], [11, 1, 12, 2, 13, 2], [19, 1, 20, 1]]);
      return S;
    },
    cafe: () => {
      const P = (id, cat, nombre, desc, precio, stock, minimo, costo) => ({id, cat, nombre, desc, precio, stock, minimo, costo});
      const S = {
        negocio: {nombre: "Café Amanecer", rubro: "cafe", direccion: "Calle Caseros 620, Salta", maps: "https://maps.google.com/?q=Caseros+Salta", whatsapp: "5493870000000",
                  horarios: [...H([0, 1, 2, 3, 4, 5], "07:30", "21:00"), ...H([6], "08:30", "13:00")], paso: 30, anticipacion: 30, dias_agenda: 10, recurso: "Mesa", elegir_pro: false,
                  entrega: {retiro: {min: 15, cupo: 4, anticipacion: 15, dias: 3}},
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
        clientes: clientesBase(18, 4), turnos: [], inscripciones: [], clases: [], actividades: [], pedidos: [], numPedido: 870,
        movimientos: movsBase([[1, "egreso", "Alquiler", 700000, "Alquiler", "Transferencia"], [2, "ingreso", "Ventas del día", 395000, "Ventas"],
                               [3, "egreso", "Harina, manteca y lácteos", 260000, "Mercadería", "Transferencia"], [4, "ingreso", "Ventas del día", 428000, "Ventas", "Transferencia"],
                               [8, "ingreso", "Ventas del día", 512000, "Ventas"], [9, "egreso", "Café en grano 5 kg", 185000, "Mercadería", "Transferencia"],
                               [12, "ingreso", "Ventas del día", 476000, "Ventas", "Transferencia"], [15, "egreso", "Sueldos", 1200000, "Sueldos", "Transferencia"],
                               [16, "ingreso", "Ventas del día", 455000, "Ventas"]]),
        cajaInicial: 300000,
      };
      S._post = api => { sembrarTurnos(api, S, [6, 4, 3]); sembrarPedidos(S, [[1, 2, 6, 1], [3, 1, 9, 2], [8, 2], [12, 1]]); };
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
  }

  window.NOA_DEMO_CREAR = function (rubro) {
    const seed = SEEDS[rubro];
    if (!seed) throw new Error("Rubro de demo desconocido: " + rubro);
    let S0;
    const api = crear(() => (S0 = seed()));
    if (S0._post) S0._post(api);
    return api;
  };
  window.NOA_DEMO_RUBROS = Object.keys(SEEDS);
  window.NOA_DEMO_SEEDS = SEEDS;
})();
