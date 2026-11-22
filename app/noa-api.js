/* Conexión de las páginas con el sistema.
   - En la demo (?demo=rubro) usa el backend del navegador (noa-demo-backend.js).
   - En producción llama al servidor Python por /api/... */
window.NOA = (function () {
  "use strict";
  const q = new URLSearchParams(location.search);
  const demo = q.get("demo");
  const partes = location.pathname.split("/").filter(Boolean);
  const clave = partes[0] === "p" ? partes[1] : null;
  let slug = ["r", "e"].includes(partes[0]) ? partes[1] : null;
  const encuesta = partes[0] === "e" ? partes[2] : q.get("e");
  const presupuesto = partes[0] === "pr" ? partes[1] : q.get("pr");
  const codigoUrl = partes[0] === "c" ? partes[1] : q.get("c");

  let back = null;
  if (demo) {
    try { back = window.parent && window.parent !== window && window.parent.NOA_DEMO && window.parent.NOA_DEMO[demo]; } catch (e) { back = null; }
    if (!back && window.NOA_DEMO_CREAR) back = window.NOA_DEMO_CREAR(demo);
  }

  const qs = o => { const u = new URLSearchParams(); Object.entries(o || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") u.set(k, v); }); const s = u.toString(); return s ? "?" + s : ""; };
  async function http(metodo, url, cuerpo) {
    const r = await fetch(url, {method: metodo, headers: cuerpo ? {"Content-Type": "application/json"} : {}, body: cuerpo ? JSON.stringify(cuerpo) : undefined});
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(typeof j.detail === "string" ? j.detail : (j.detail && j.detail.msg) || "Algo falló. Probá de nuevo."); e.tipo = j.detail && j.detail.tipo; throw e; }
    return j;
  }
  const P = `/api/panel/${clave}`;
  const A0 = () => `/api/${slug}`;
  const rutas = {
    info: () => http("GET", `${A0()}/info`),
    dias: p => http("GET", `${A0()}/dias${qs(p)}`),
    horas: p => http("GET", `${A0()}/horas${qs(p)}`),
    reservarTurno: p => p.origen === "panel" ? http("POST", `${P}/turnos`, p) : http("POST", `${A0()}/turnos`, p),
    clases: () => http("GET", `${A0()}/clases`),
    inscribir: p => p.origen === "panel" ? http("POST", `${P}/inscripciones`, p) : http("POST", `${A0()}/inscripciones`, p),
    disponibilidad: p => http("GET", `${A0()}/disponibilidad${qs(p)}`),
    reservarEstadia: p => p.origen === "panel" ? http("POST", `${P}/estadias`, p) : http("POST", `${A0()}/estadias`, p),
    franjas: p => http("GET", `${A0()}/franjas${qs(p)}`),
    pedir: p => http("POST", `${A0()}/pedidos`, p),
    reserva: p => http("GET", `/api/reserva/${p.codigo}`),
    cancelarReserva: p => http("POST", `/api/reserva/${p.codigo}/cancelar`),
    panel: () => http("GET", P),
    agenda: p => http("GET", `${P}/agenda${qs(p)}`),
    estadoTurno: p => http("POST", `${P}/turnos/${p.id}`, {estado: p.estado}),
    asistencia: p => http("POST", `${P}/inscripciones/${p.id}`, {asistio: p.asistio}),
    pedidos: p => http("GET", `${P}/pedidos${qs(p)}`),
    estadoPedido: p => http("POST", `${P}/pedidos/${p.id}`, {estado: p.estado}),
    stock: () => http("GET", `${P}/stock`),
    ajustarStock: p => http("POST", `${P}/stock/${p.id}`, {stock: p.stock, vendido: p.vendido}),
    socios: () => http("GET", `${P}/socios`),
    pagarCuota: p => http("POST", `${P}/socios/pago`, p),
    agregarSocio: p => http("POST", `${P}/socios`, p),
    cobrarClase: p => http("POST", `${P}/inscripciones/${p.id}/cobro`, {medio: p.medio || "Efectivo"}),
    anotarEspera: p => http("POST", `${A0()}/espera`, {ocurrencia: p.ocurrencia || null, servicio: p.servicio || null, dia: p.dia || null, nombre: p.nombre, telefono: p.telefono, web: p.web || ""}),
    espera: () => http("GET", `${P}/espera`),
    avisarEspera: p => http("POST", `${P}/espera/${p.id}/avisado`, {}),
    quitarEspera: p => http("POST", `${P}/espera/${p.id}/quitar`, {}),
    cancelarSerie: p => http("POST", `${P}/turnos/serie/${p.serie}/cancelar`, {}),
    probarCodigo: p => http("GET", `${A0()}/codigo${qs({codigo: p.codigo, area: p.area})}`),
    promos: () => http("GET", `${P}/promos`),
    agregarPromo: p => http("POST", `${P}/promos`, {codigo: p.codigo, pct: Number(p.pct), aplica: p.aplica || [], desde: p.desde || null, hasta: p.hasta || null,
                                                    usos_max: p.usos_max ? Number(p.usos_max) : null, una_vez: p.una_vez !== false, cumple: !!p.cumple}),
    estadoPromo: p => http("POST", `${P}/promos/${p.id}`, {activo: !!p.activo, quitar: !!p.quitar}),
    pedirCumple: p => http("POST", `${P}/config`, {pedir_cumple: !!p.activo}),
    arqueo: () => http("GET", `${P}/arqueo`),
    cerrarCaja: p => http("POST", `${P}/arqueo`, {contado: Number(p.contado), retiro: Number(p.retiro || 0), nota: p.nota || ""}),
    gastos: () => http("GET", `${P}/gastos`),
    agregarGasto: p => http("POST", `${P}/gastos`, {concepto: p.concepto, cat: p.cat || "Gastos fijos", monto: Number(p.monto), dia: Number(p.dia), medio: p.medio || "Transferencia"}),
    cambiarGasto: p => http("POST", `${P}/gastos/${p.id}`, {monto: p.monto != null ? Number(p.monto) : null, activo: p.activo ?? null, quitar: !!p.quitar}),
    pagarGasto: p => http("POST", `${P}/gastos/${p.id}/pagar`, {monto: p.monto ? Number(p.monto) : null, medio: p.medio || null}),
    vuelta: () => http("GET", `${P}/clientes/vuelta`),
    marcarVuelta: p => http("POST", `${P}/clientes/vuelta`, {telefono: p.telefono, servicio: String(p.servicio)}),
    encuesta: p => http("GET", `${A0()}/encuesta/${p.token}`),
    responderEncuesta: p => http("POST", `${A0()}/encuesta/${p.token}`, {nota: Number(p.nota), comentario: p.comentario || ""}),
    opiniones: () => http("GET", `${P}/clientes/opiniones`),
    margenes: p => http("GET", `${P}/margenes${qs({dias: p && p.dias})}`),
    comisiones: p => http("GET", `${P}/comisiones${qs({mes: p && p.mes})}`),
    pagarComision: p => http("POST", `${P}/comisiones/${p.id}/pagar${qs({mes: p.mes})}`, {}),
    resumen: () => http("GET", `${P}/resumen`),
    fiado: () => http("GET", `${P}/fiado`),
    agregarFiado: p => http("POST", `${P}/fiado`, {nombre: p.nombre, telefono: p.telefono, monto: Number(p.monto), concepto: p.concepto || ""}),
    pagarFiado: p => http("POST", `${P}/fiado/pago`, {telefono: p.telefono, monto: Number(p.monto), medio: p.medio || "Efectivo"}),
    presupuestos: () => http("GET", `${P}/presupuestos`),
    agregarPresupuesto: p => http("POST", `${P}/presupuestos`, {nombre: p.nombre, telefono: p.telefono, auto: p.auto || "", patente: p.patente || "", items: p.items, validez_dias: Number(p.validez_dias) || 15, nota: p.nota || ""}),
    estadoPresupuesto: p => http("POST", `${P}/presupuestos/${p.id}`, {acepta: !!p.acepta}),
    verPresupuesto: p => http("GET", `/api/presupuesto/${p.codigo}`),
    responderPresupuesto: p => http("POST", `/api/presupuesto/${p.codigo}/responder`, {acepta: !!p.acepta}),
    actividad: p => http("GET", `${P}/actividad${qs({quien: p && p.quien})}`),
    usuarios: () => http("GET", `${P}/usuarios`),
    agregarUsuario: p => http("POST", `${P}/usuarios`, {nombre: p.nombre, usuario: p.usuario, clave: p.clave, rol: p.rol}),
    cambiarUsuario: p => http("POST", `${P}/usuarios/${p.id}`, {activo: p.activo ?? null, clave: p.clave ?? null, rol: p.rol ?? null}),
    salir: () => http("POST", `${P}/salir`, {}),
    proveedores: () => http("GET", `${P}/proveedores`),
    agregarProveedor: p => http("POST", `${P}/proveedores`, {nombre: p.nombre, telefono: p.telefono || null}),
    asignarProveedor: p => http("POST", `${P}/productos/${p.producto}/proveedor`, {proveedor: p.proveedor || null}),
    marcarResena: p => http("POST", `${P}/clientes/resena`, {telefono: p.telefono}),
    guardarConfig: p => http("POST", `${P}/config`, p),
    aumentarPrecios: p => http("POST", `${P}/precios/aumento`, {pct: Number(p.pct), redondeo: Number(p.redondeo) || 100, que: p.que || [], aplicar: !!p.aplicar}),
    agregarTarifa: p => http("POST", `${P}/servicios/${p.servicio}/tarifas`, {dias: p.dias || [], desde: p.desde, hasta: p.hasta, precio: Number(p.precio)}),
    editarTarifa: p => http("POST", `${P}/servicios/${p.servicio}/tarifas/${p.i}`, {precio: Number(p.precio)}),
    quitarTarifa: p => http("POST", `${P}/servicios/${p.servicio}/tarifas/${p.i}/quitar`),
    agregarCobertura: p => http("POST", `${P}/coberturas`, {nombre: p.nombre, coseguro: Number(p.coseguro) || 0}),
    guardarFinde: p => http("POST", `${P}/estadia/finde`, {finde: Number(p.finde)}),
    agregarTemporada: p => http("POST", `${P}/estadia/temporadas`, {nombre: p.nombre, desde: p.desde, hasta: p.hasta, recargo: Number(p.recargo)}),
    quitarTemporada: p => http("POST", `${P}/estadia/temporadas/${p.id}/quitar`),
    agregarPlan: p => http("POST", `${P}/planes`, {nombre: p.nombre, precio: Number(p.precio), dias: Number(p.dias) || 30, actividades: (p.actividades || []).map(String),
                                                    por_semana: p.por_semana ? Number(p.por_semana) : null, clases: p.clases ? Number(p.clases) : null, suelta: !!p.suelta}),
    caja: p => http("GET", `${P}/caja${qs(p)}`),
    movimiento: p => http("POST", `${P}/movimientos`, p),
    novedades: p => http("GET", `${P}/novedades${qs(p)}`),
    estadias: p => http("GET", `${P}/estadias${qs(p)}`),
    estadoEstadia: p => http("POST", `${P}/estadias/${p.id}`, {estado: p.estado}),
    personal: p => http("GET", `${P}/personal${qs(p)}`),
    agregarPersona: p => http("POST", `${P}/personal`, {nombre: p.nombre, rol: p.rol, pro: p.pro || null}),
    guardarDia: p => http("POST", `${P}/personal/${p.persona}/dia`, {fecha: p.fecha, tipo: p.tipo, tramos: p.tramos || [], alcance: p.alcance || "dia", nota: p.nota || ""}),
    ausencia: p => http("POST", `${P}/personal/${p.persona}/ausencia`, {desde: p.desde, hasta: p.hasta, tipo: p.tipo, nota: p.nota || ""}),
    volverBase: p => http("POST", `${P}/personal/${p.persona}/base`, {fecha: p.fecha}),
    quitarPersona: p => http("POST", `${P}/personal/${p.persona}/baja`),
    guardarIcal: p => http("POST", `${P}/unidades/${p.unidad}/calendarios`, {externos: p.externos}),
    sincronizarIcal: () => http("POST", `${P}/calendarios/sincronizar`),
    clientes: () => http("GET", `${P}/clientes`),
    numeros: () => http("GET", `${P}/numeros`),
    catalogo: () => http("GET", `${P}/catalogo`),
    editar: p => http("POST", `${P}/catalogo/${p.tipo}/${p.id}`, {campo: p.campo, valor: p.valor}),
    agregarProducto: p => http("POST", `${P}/productos`, p),
    agregarServicio: p => http("POST", `${P}/servicios`, p),
    cerrarDia: p => http("POST", `${P}/cierres`, p),
    ventaMostrador: p => http("POST", `${P}/ventas`, p),
  };

  function call(metodo, params) {
    if (back) return back[metodo](params || {});
    return rutas[metodo](params || {});
  }

  // Avisos en vivo: en la demo los manda el backend del navegador; en producción se consulta cada 20 s.
  function suscribir(f) {
    if (back) return back.suscribir(f);
    if (!clave) return () => {};
    let desde = new Date().toISOString();
    const t = setInterval(async () => {
      try { const ns = await rutas.novedades({desde}); if (ns.length) { desde = ns[ns.length - 1].creado; ns.forEach(x => f(x.tipo, x)); } } catch (e) { /* sin conexión: reintenta */ }
    }, 20000);
    return () => clearInterval(t);
  }

  const verComo = r => { if (back && back._verComo) back._verComo(r); };
  return {call, suscribir, verComo, encuesta, presupuesto, demo, clave, get slug() { return slug; }, set slug(v) { slug = v; }, codigoUrl, esDemo: !!back};
})();
