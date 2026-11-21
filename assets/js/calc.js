/* NOA Labs · calculadora "¿cuánta plata se te escapa por mes?"
   Usa los números que carga el dueño del negocio. Las únicas tasas fijas son las publicadas en las fuentes [n]. */
(function(){
  const root = document.getElementById("calc");
  if (!root) return;
  const ars = n => "$" + Math.round(n).toLocaleString("es-AR");
  const R = {
    comercio: {
      label:"Comercio",
      fields:[
        {id:"msg", l:"Consultas por WhatsApp o Instagram por día que contestás tarde o nunca", v:8},
        {id:"conv", l:"De cada 10 consultas que sí contestás a tiempo, ¿cuántas terminan en venta?", v:3},
        {id:"tk", l:"Ticket promedio ($)", v:25000},
        {id:"vm", l:"Ventas del mes ($)", v:12000000}
      ],
      calc:f => { const lostMsg = f.msg * 26 * (f.conv / 10) * f.tk, oos = f.vm * .04;
        return {lost:lostMsg + oos, rec:lostMsg * .6 + oos * .5,
          how:`${f.msg} consultas × 26 días × ${f.conv} de cada 10 × ${ars(f.tk)} = ${ars(lostMsg)} en consultas perdidas, más el 4 % de las ventas que se pierde por faltantes de stock [5] = ${ars(oos)}. Para lo que recuperás, contamos solo el 60 % de las consultas y la mitad de los faltantes.`}; }
    },
    gastro: {
      label:"Gastronomía",
      fields:[
        {id:"ped", l:"Pedidos por mes que entran por apps de delivery", v:300},
        {id:"tk", l:"Ticket promedio de esos pedidos ($)", v:28000},
        {id:"com", l:"Comisión que te cobra la app (%)", v:25},
        {id:"dir", l:"De esos clientes, ¿qué porcentaje podría pedirte directo por WhatsApp? (%)", v:30}
      ],
      calc:f => { const com = f.ped * f.tk * f.com / 100;
        return {lost:com, rec:com * f.dir / 100,
          how:`${f.ped} pedidos × ${ars(f.tk)} × ${f.com} % = ${ars(com)} por mes en comisiones. En Argentina las apps cobran entre el 18 y el 33 % [7]. Si el ${f.dir} % de esos clientes te pide directo, ese porcentaje de la comisión queda en tu caja.`}; }
    },
    deporte: {
      label:"Deporte",
      fields:[
        {id:"soc", l:"Socios activos", v:200},
        {id:"cuota", l:"Cuota mensual ($)", v:35000},
        {id:"venc", l:"Socios con la cuota vencida hoy", v:25}
      ],
      calc:f => { const bajas = f.soc * .336 / 12, perd = bajas * f.cuota * 6, mora = f.venc * f.cuota;
        return {lost:perd + mora, rec:perd * .3 + mora * .7,
          how:`En la industria, uno de cada tres socios se va por año (retención 66,4 % [9]): con ${f.soc} socios son unas ${bajas.toFixed(1).replace(".", ",")} bajas por mes, y cada una se lleva unos 6 meses de cuota (${ars(bajas * f.cuota * 6)}). A eso se suman ${f.venc} cuotas vencidas sin cobrar (${ars(mora)}). Para lo que recuperás contamos el 30 % de las bajas, con aviso cuando un socio deja de venir y clases grupales con cupo [10], y el 70 % de la morosidad, con aviso automático y acceso bloqueado.`}; }
    },
    aloja: {
      label:"Alojamiento",
      fields:[
        {id:"noc", l:"Noches por mes que vendés por Booking, Airbnb u otras plataformas", v:60},
        {id:"tar", l:"Tarifa promedio por noche ($)", v:85000},
        {id:"com", l:"Comisión de la plataforma (%)", v:15},
        {id:"dir", l:"¿Qué porcentaje de esos huéspedes podría reservarte directo? (%)", v:30}
      ],
      calc:f => { const com = f.noc * f.tar * f.com / 100;
        return {lost:com, rec:com * f.dir / 100,
          how:`${f.noc} noches × ${ars(f.tar)} × ${f.com} % = ${ars(com)} por mes en comisiones. Booking cobra entre el 10 y el 25 %, en general cerca del 15 % [8]. Cada reserva que entra directo por tu WhatsApp o tu web no paga comisión.`}; }
    },
    servicios: {
      label:"Servicios",
      fields:[
        {id:"tur", l:"Turnos por semana", v:60},
        {id:"aus", l:"¿Cuántos de esos turnos se pierden por ausencias? (%)", v:15},
        {id:"pre", l:"Precio promedio del servicio ($)", v:30000}
      ],
      calc:f => { const lost = f.tur * 4.3 * f.aus / 100 * f.pre;
        return {lost, rec:lost * .34,
          how:`${f.tur} turnos × 4,3 semanas × ${f.aus} % de ausencias × ${ars(f.pre)} = ${ars(lost)} por mes en horarios vacíos. Los recordatorios automáticos bajan las ausencias un 34 % en promedio [11].`}; }
    },
    profesionales: {
      label:"Profesionales",
      fields:[
        {id:"cli", l:"Clientes que atendés por mes", v:40},
        {id:"hs", l:"Horas por mes que perdés por cliente pidiendo documentación y respondiendo lo mismo", v:1},
        {id:"vh", l:"¿Cuánto vale tu hora de trabajo? ($)", v:25000},
        {id:"aut", l:"¿Qué parte de ese trabajo se podría automatizar? (%)", v:50}
      ],
      calc:f => { const lost = f.cli * f.hs * f.vh;
        return {lost, rec:lost * f.aut / 100,
          how:`${f.cli} clientes × ${String(f.hs).replace(".", ",")} h × ${ars(f.vh)} = ${ars(lost)} por mes en horas que no facturás. En una encuesta a 150 contadores de EE.UU., el 69 % dijo que pierde demasiado tiempo juntando documentación de clientes [16]. Lo que recuperás depende de la parte que se automatiza: ese porcentaje lo ponés vos.`}; }
    },
    industria: {
      label:"Industria",
      fields:[
        {id:"hs", l:"Horas por mes de parada no programada por roturas", v:12},
        {id:"ch", l:"¿Cuánto te cuesta una hora de parada? (producción perdida + horas extra) ($)", v:900000}
      ],
      calc:f => { const lost = f.hs * f.ch;
        return {lost, rec:lost * .35,
          how:`${f.hs} horas × ${ars(f.ch)} = ${ars(lost)} por mes. Según el Departamento de Energía de EE.UU., el mantenimiento predictivo baja las paradas entre un 35 y un 45 % y elimina entre el 70 y el 75 % de las roturas [12]. Acá contamos el 35 %.`}; }
    }
  };
  const tabs = root.querySelector(".calc-tabs"), form = root.querySelector(".calc-fields"), out = root.querySelector(".calc-out");
  let cur = "comercio";
  tabs.innerHTML = Object.entries(R).map(([k, r]) => `<button type="button" role="tab" data-r="${k}" aria-selected="${k === cur}">${r.label}</button>`).join("");
  function draw(){
    const r = R[cur];
    tabs.querySelectorAll("button").forEach(b => b.setAttribute("aria-selected", b.dataset.r === cur));
    form.innerHTML = r.fields.map(f => `<label>${f.l}<input type="number" inputmode="numeric" min="0" id="c-${f.id}" value="${f.v}"></label>`).join("");
    form.querySelectorAll("input").forEach(i => i.addEventListener("input", calc));
    calc();
  }
  function calc(){
    const r = R[cur], f = {};
    r.fields.forEach(x => { const v = parseFloat(form.querySelector("#c-" + x.id).value); f[x.id] = isFinite(v) && v >= 0 ? v : 0; });
    const res = r.calc(f);
    out.innerHTML = `<p class="k">Se te escapan por mes, aproximadamente</p><p class="big">${ars(res.lost)}</p>
      <p class="k">Lo que podés recuperar con NOA Labs</p><p class="big sun">${ars(res.rec)}<small> por mes · ${ars(res.rec * 12)} por año</small></p>
      <p class="how">${res.how}</p>
      <a class="btn btn-primary" data-wa-calc href="#contacto">Quiero medirlo en mi negocio</a>`;
    const a = out.querySelector("[data-wa-calc]");
    a.href = `https://wa.me/${window.NOA_WA}?text=${encodeURIComponent(`Hola NOA Labs, hice la cuenta en la web para mi negocio (${r.label.toLowerCase()}): se me escapan unos ${ars(res.lost)} por mes. Quiero el diagnóstico gratis.`)}`;
    a.target = "_blank"; a.rel = "noopener";
  }
  tabs.addEventListener("click", e => { const b = e.target.closest("button"); if (b){ cur = b.dataset.r; draw(); } });
  document.querySelectorAll("[data-calc]").forEach(a => a.addEventListener("click", () => { cur = a.dataset.calc; draw(); }));
  draw();
})();
