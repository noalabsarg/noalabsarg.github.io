/* NOA Labs · scripts del sitio */
(function(){
  /* WhatsApp: cambiar acá cuando esté el chip de NOA Labs (formato 549 + característica + número, sin 15 ni espacios) */
  const WHATSAPP = "5493876124879";
  window.NOA_WA = WHATSAPP;
  const MSG = encodeURIComponent("Hola NOA Labs, quiero contarles sobre mi negocio.");
  /* Estadísticas de visitas (opcional y gratis): creá una cuenta en goatcounter.com y poné acá tu código,
     por ejemplo "noalabs". Vacío = sin estadísticas. */
  const GOATCOUNTER = "";
  if (GOATCOUNTER){ const g = document.createElement("script"); g.async = true; g.src = "https://gc.zgo.at/count.js"; g.dataset.goatcounter = `https://${GOATCOUNTER}.goatcounter.com/count`; document.head.appendChild(g); }
  document.querySelectorAll("[data-wa]").forEach(a => {
    const extra = a.getAttribute("data-wa");
    a.href = `https://wa.me/${WHATSAPP}?text=${extra ? encodeURIComponent(extra) : MSG}`;
    a.target = "_blank"; a.rel = "noopener";
  });
  document.querySelectorAll("[data-year]").forEach(e => e.textContent = new Date().getFullYear());

  /* formulario de diagnóstico: arma el mensaje y abre WhatsApp */
  const lead = document.getElementById("lead");
  if (lead) lead.addEventListener("submit", e => {
    e.preventDefault();
    const v = id => document.getElementById(id).value.trim(), err = document.getElementById("l-err");
    if (!v("l-n")) { err.textContent = "Escribí tu nombre"; return; }
    if (!v("l-r")) { err.textContent = "Elegí el rubro de tu negocio"; return; }
    err.textContent = "";
    const txt = `Hola NOA Labs, soy ${v("l-n")}${v("l-b") ? ` de ${v("l-b")}` : ""} (${v("l-r")}, ${v("l-c")}). Quiero el diagnóstico gratis.${v("l-m") ? ` Me gustaría resolver: ${v("l-m")}` : ""}`;
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(txt)}`, "_blank", "noopener");
  });
  lead && lead.addEventListener("input", () => document.getElementById("l-err").textContent = "");

  /* videos de las demos: se reproducen solo cuando están en pantalla */
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const vids = document.querySelectorAll(".screen video");
  if (!still && "IntersectionObserver" in window){
    const io = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting){ x.target.preload = "auto"; x.target.play().catch(() => {}); } else x.target.pause(); }), {threshold:.35});
    vids.forEach(v => io.observe(v));
  } else vids.forEach(v => { v.removeAttribute("autoplay"); v.pause(); });

  /* menú móvil */
  const btn = document.querySelector(".menu-btn"), nav = document.querySelector(".nav");
  if (btn && nav){
    btn.addEventListener("click", () => { const o = nav.classList.toggle("open"); btn.setAttribute("aria-expanded", o); });
    nav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => { nav.classList.remove("open"); btn.setAttribute("aria-expanded", false); }));
  }

  /* curvas de nivel del héroe */
  const c = document.getElementById("topo");
  if (c){
    const ctx = c.getContext("2d"), still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w, h, t = 0;
    const size = () => { const r = c.getBoundingClientRect(), d = devicePixelRatio || 1; w = c.width = r.width * d; h = c.height = r.height * d; };
    function draw(){
      ctx.clearRect(0, 0, w, h); const d = devicePixelRatio || 1;
      for (let i = 0; i < 16; i++){
        ctx.beginPath(); const base = h * (0.16 + i * 0.056);
        for (let x = 0; x <= w; x += 8 * d){
          const k = x / w;
          const y = base + Math.sin(k * 5.2 + i * .55 + t) * h * .035 + Math.sin(k * 11 + i * 1.3 - t * .6) * h * .012 - Math.exp(-Math.pow((k - .3) * 3.2, 2)) * h * (.16 - i * .006);
          x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.strokeStyle = i % 4 === 0 ? "rgba(232,119,46,.5)" : "rgba(174,185,204,.14)";
        ctx.lineWidth = (i % 4 === 0 ? 1.6 : 1) * d; ctx.stroke();
      }
      if (!still){ t += .0025; requestAnimationFrame(draw); }
    }
    size(); addEventListener("resize", size); draw();
  }
})();
