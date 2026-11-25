# Arma las páginas legales de noalabs-web/legales/ con el mismo encabezado y pie.
# Los datos del titular quedan en None hasta tenerlos: la página lo dice tal cual, sin inventar nada.
from html import escape as e
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "legales"   # correr: python3 herramientas/build_legales.py
ACT = "noviembre de 2026"

TITULAR = "Ian Herrera"       # ej: "Ian Herrera Schein"  (nombre y apellido, o razón social si hacen una sociedad)
CUIT = "20-44445990-6"          # ej: "20-12345678-9"
DOMICILIO = "Luis Piedrabuena 780, Salta Capital, provincia de Salta"     # ej: "Calle 123, Salta Capital"  (dirección física: la pide la Res. 270/2020)
EMAIL = "herreraian07@gmail.com"         # ej: "hola@noalabs.com.ar"
WA_TXT = "+54 9 387 612-4879"
HORARIO = "de lunes a sábado, de 9 a 20"   # confirmar con Ian el horario real

DEFENSA = "https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario"
LEY_24240 = "https://www.argentina.gob.ar/normativa/nacional/ley-24240-638/texto"
LEY_25326 = "https://www.argentina.gob.ar/normativa/nacional/ley-25326-64790/texto"
AAIP = "https://www.argentina.gob.ar/aaip/datospersonales"


def titular_html():
    if TITULAR and CUIT and DOMICILIO:
        mail = f' Correo: <a href="mailto:{e(EMAIL)}">{e(EMAIL)}</a>.' if EMAIL else ""
        return (f"<p>NOA Labs es el nombre comercial de <b>{e(TITULAR)}</b>, CUIT {e(CUIT)}, con domicilio en {e(DOMICILIO)}.{mail}</p>")
    return ("<p>NOA Labs es un emprendimiento de Salta, Argentina. El nombre del titular, su CUIT y su domicilio se publican "
            "en esta página cuando termine la inscripción en ARCA, antes de cobrar el primer trabajo.</p>")


def contacto_html():
    items = [f'<li>WhatsApp: <a data-wa="Hola NOA Labs, tengo una consulta." href="../index.html#contacto">{WA_TXT}</a></li>',
             '<li>Instagram: <a href="https://www.instagram.com/noalabsarg/" target="_blank" rel="noopener">@noalabsarg</a></li>']
    if EMAIL:
        items.insert(1, f'<li>Correo: <a href="mailto:{e(EMAIL)}">{e(EMAIL)}</a></li>')
    return f"<ul>{''.join(items)}</ul><p>Atendemos {HORARIO}.</p>"


LINKS = [("terminos", "Términos y condiciones"), ("privacidad", "Política de privacidad"), ("cookies", "Política de cookies"),
         ("integraciones", "Servicios de terceros"), ("accesibilidad", "Accesibilidad")]


def pie(base):
    ls = "".join(f'<a href="{base}legales/{a}.html">{t}</a>' for a, t in LINKS)
    return f'''<footer class="foot">
  <div class="wrap legal-btns"><a class="lbtn" href="{base}legales/arrepentimiento.html">Botón de arrepentimiento</a><a class="lbtn" href="{base}legales/baja.html">Botón de baja</a></div>
  <div class="wrap fbottom legal-links"><span>© <span data-year>2026</span> NOA Labs · Salta, Argentina</span><nav aria-label="Legales">{ls}</nav></div>
</footer>'''


GC = ('<script>/* Estadísticas de visitas (GoatCounter, sin cookies): solo en la web pública */if(["noalabsarg.github.io","noalabs.com.ar","www.noalabs.com.ar"].includes(location.hostname)){var g=document.createElement("script");g.async=true;g.src="https://gc.zgo.at/count.js";g.dataset.goatcounter="https://noalabs.goatcounter.com/count";document.head.appendChild(g);}</script>')


def pagina(slug, titulo, cuerpo, extra_js=""):
    html = f'''<!DOCTYPE html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(titulo)} · NOA Labs</title>
<meta name="description" content="{e(titulo)} de NOA Labs, Salta, Argentina.">{'\n<meta name="robots" content="noindex">' if slug == "reembolsos" else ""}
<link rel="icon" href="../assets/img/favicon.png">
<link rel="stylesheet" href="../assets/fonts/fuentes.css">
<link rel="stylesheet" href="../assets/css/site.css">
</head>
<body>
<a class="skip" href="#contenido">Ir al contenido</a>
<header class="top"><div class="wrap"><a class="brand" href="../index.html"><img src="../assets/img/noa-labs-icono.png" alt=""><span>NOA LABS<span class="sl">/</span></span></a><nav class="nav" style="display:flex" aria-label="Principal"><a href="../index.html">← Volver al inicio</a></nav></div></header>
<main class="doc" id="contenido"><h1 class="disp">{e(titulo)}<span class="sl">/</span></h1><p class="upd">Última actualización: {ACT}</p>
{cuerpo}
</main>
{pie("../")}
<script src="../assets/js/site.js"></script>
{extra_js}{GC}
</body>
</html>
'''
    (OUT / f"{slug}.html").write_text(html)
    print("ok", slug)


# ─────────────────────────────── Privacidad ───────────────────────────────
pagina("privacidad", "Política de privacidad", f'''
<p>Acá contamos qué datos personales usamos, para qué, con quién los compartimos y cómo podés pedir que los veamos, corrijamos o borremos. Se aplica la <a href="{LEY_25326}" target="_blank" rel="noopener">Ley 25.326 de Protección de los Datos Personales</a> y su reglamentación.</p>

<h2>1. Quién es responsable</h2>
{titular_html()}
<p>Según el caso, cumplimos dos papeles distintos:</p>
<ul>
<li><b>Responsables</b> de los datos de quien visita esta web, nos escribe o nos contrata.</li>
<li><b>Encargados del tratamiento</b> de los datos que cada negocio cliente carga en su sistema (sus clientes, reservas, ventas, empleados). Ahí el responsable es el negocio: nosotros solo guardamos y procesamos esos datos por su cuenta, para prestarle el servicio, como dice el artículo 25 de la ley. No los usamos para otra cosa, no los vendemos ni se los pasamos a nadie, y al terminar el servicio se los devolvemos y los borramos.</li>
</ul>

<h2>2. Qué datos usamos y para qué</h2>
<p><b>Si visitás esta web.</b> La web no tiene registro de usuarios ni guarda lo que escribís. El formulario de diagnóstico no manda nada a ningún servidor: arma el mensaje y abre tu WhatsApp para que lo envíes vos. Para saber cuántas personas entran usamos GoatCounter, que no usa cookies ni identifica a nadie: cuenta visitas por página, de qué sitio llegaron, el navegador, el tamaño de pantalla y el país aproximado. Las fuentes tipográficas están alojadas en esta misma web, así que tu navegador no se conecta a Google para mostrarlas.</p>
<p><b>Si nos escribís</b> por WhatsApp o Instagram, usamos tu nombre, tu número o usuario y lo que nos contás, solo para responderte y armar una propuesta. Si no llegamos a trabajar juntos, borramos la conversación dentro de los 12 meses.</p>
<p><b>Si nos contratás</b>, guardamos tu nombre, el de tu negocio, tus datos de contacto y los de facturación, para cumplir el contrato, cobrar y emitir facturas. Esos datos los conservamos el tiempo que exigen las normas impositivas.</p>
<p><b>Si reservás o comprás en un negocio que usa NOA.</b> El sistema guarda tu nombre, tu celular, lo que reservaste o pediste y, solo si lo completás, tu cumpleaños (día y mes, sin año), para que el negocio te salude. Si respondés la encuesta después de tu visita, se guardan tu nota y tu comentario. Todo eso lo ve el negocio para atenderte y avisarte por WhatsApp. Si pagás una seña, el pago se hace en Mercado Pago: el sistema no ve ni guarda datos de tu tarjeta ni de tu cuenta. En tu propio celular, la página de reservas recuerda tu nombre y tu número para no pedírtelos de nuevo (ver la <a href="cookies.html">política de cookies</a>).</p>
<p><b>Si trabajás en un negocio que usa NOA</b> y entrás al panel con usuario: guardamos tu nombre, tu usuario, tu contraseña cifrada (nadie la puede leer, ni nosotros) y un registro de lo que hacés en el panel (por ejemplo, “cobró una venta”), que ve el dueño del negocio.</p>

<h2>3. Con quién compartimos datos</h2>
<p>Solo con los proveedores técnicos que hacen funcionar el servicio, y solo lo necesario. La lista completa, con qué datos recibe cada uno y dónde están, está en <a href="integraciones.html">servicios de terceros</a>. En resumen: la base de datos está en Supabase y el sistema en Amazon Web Services, ambos con servidores en San Pablo, Brasil; esta web la aloja GitHub. No vendemos datos ni los usamos para publicidad.</p>
<p>También podemos tener que entregar datos si lo ordena un juez o una autoridad con facultades legales para pedirlo.</p>

<h2>4. Datos que salen del país</h2>
<p>Los servidores de la base de datos y del sistema están en Brasil, y algunos proveedores son empresas de Estados Unidos. Para esas transferencias nos apoyamos en los acuerdos de protección de datos que esos proveedores firman con sus clientes, que los obligan a cuidar los datos con medidas de seguridad y a usarlos solo para prestar su servicio. Al usar el servicio, quedás informado de que tus datos se guardan en esos servidores.</p>

<h2>5. Cómo los cuidamos</h2>
<ul>
<li>Todo viaja cifrado (HTTPS/TLS) y la base de datos cifra lo que guarda.</li>
<li>Cada negocio ve solo sus datos; cada empleado, solo lo que su rol le permite.</li>
<li>Las contraseñas se guardan cifradas y el ingreso tiene tope de intentos.</li>
<li>Todas las noches se saca una copia cifrada de la base, que se guarda en otro servidor durante 14 días.</li>
</ul>
<p>Ningún sistema es invulnerable. Si alguna vez hubiera un incidente que afecte tus datos, te avisamos a vos o al negocio responsable apenas lo sepamos, con lo que pasó y qué hicimos.</p>

<h2>6. Tus derechos</h2>
<p>Podés pedir <b>ver</b> qué datos tuyos tenemos, <b>corregirlos</b>, <b>actualizarlos</b> o <b>borrarlos</b>, y oponerte a que los usemos para mandarte novedades. Escribinos por los medios del punto 8 diciendo qué querés y con un dato que nos permita encontrarte (por ejemplo, tu número de celular). Te respondemos el pedido de acceso dentro de los 10 días corridos y los de corrección o borrado dentro de los 5 días hábiles, que son los plazos de la ley. Es gratis.</p>
<p>Si tus datos los cargó un negocio (porque reservaste o compraste ahí), lo más rápido es pedírselo al negocio; si nos escribís a nosotros, se lo pasamos y lo ayudamos a resolverlo dentro de esos plazos.</p>
<p class="legal">El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley N° 25.326. La Agencia de Acceso a la Información Pública, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales. Sitio de la Agencia: <a href="{AAIP}" target="_blank" rel="noopener">argentina.gob.ar/aaip/datospersonales</a>.</p>

<h2>7. Menores de edad</h2>
<p>Nuestros servicios son para negocios y sus clientes adultos. Si sos menor de 18 años, reservá o comprá con la ayuda de una persona adulta responsable.</p>

<h2>8. Contacto</h2>
{contacto_html()}

<h2>9. Cambios</h2>
<p>Si cambiamos esta política, actualizamos la fecha de arriba. Si el cambio es importante, se lo avisamos antes a los negocios clientes.</p>
''')

# ─────────────────────────────── Términos ───────────────────────────────
pagina("terminos", "Términos y condiciones", f'''
<h2>1. Quiénes somos</h2>
{titular_html()}
<p>Hacemos sistemas de reservas, pedidos, stock y caja, páginas web y presencia digital para negocios del NOA.</p>

<h2>2. Cómo se contrata</h2>
<p>La web informa qué hacemos y cuánto cuesta. Cada trabajo se acuerda por escrito antes de empezar (por WhatsApp o por mail alcanza): qué incluye, plazos, precio de instalación y abono mensual. Lo que no figura en esa propuesta aceptada no forma parte del servicio.</p>

<h2>3. Precios y pagos</h2>
<p>Los precios de la web son finales y en pesos argentinos. La instalación se paga mitad al aceptar la propuesta y mitad al entregar. El abono mensual se paga por mes adelantado y cubre el servidor, la base de datos, las copias de seguridad, el soporte y las mejoras chicas acordadas. Los cambios grandes se cotizan aparte, por escrito, antes de hacerlos. Si cambiamos el precio del abono, te avisamos con al menos 30 días; si no estás de acuerdo, podés dar de baja sin costo.</p>

<h2>4. Arrepentimiento, reembolsos y baja</h2>
<p>Tenés 10 días corridos para arrepentirte de la contratación sin dar motivos, con devolución total, desde el <a href="arrepentimiento.html">botón de arrepentimiento</a>. Podés dar de baja el abono cuando quieras desde el <a href="baja.html">botón de baja</a>. <a class="sutil" href="reembolsos.html">Más detalles</a>.</p>

<h2>5. Lo que hacemos nosotros</h2>
<ul>
<li>Mantener el sistema funcionando, actualizado y con copias de seguridad.</li>
<li>Responder consultas {HORARIO}, y lo que frene la caja o la agenda apenas lo veamos, cualquier día. Arreglar sin cargo lo que no funcione como se acordó.</li>
<li>Avisarte con anticipación cuando haya que hacer un mantenimiento que corte el servicio.</li>
</ul>
<p>Hacemos todo lo razonable para que el sistema esté disponible siempre, pero puede haber cortes por fallas de proveedores (servidores, internet, Meta, Mercado Pago) que no dependen de nosotros.</p>

<h2>6. Lo que hace el negocio cliente</h2>
<ul>
<li>Cargar datos correctos y usar el sistema para fines legales.</li>
<li>Cuidar las claves y los links de su panel y de sus empleados, y avisarnos si se filtran.</li>
<li>Tener derecho a usar las fotos, logos y textos que nos pasa para su página.</li>
<li>Como responsable de los datos de sus clientes, informarles cómo los usa y, si corresponde, inscribir su base en el Registro Nacional de Bases de Datos de la Agencia de Acceso a la Información Pública. Lo ayudamos con el trámite.</li>
</ul>

<h2>7. Datos del negocio y de sus clientes</h2>
<p>Los datos que carga el negocio son del negocio. Los tratamos solo por su cuenta y para prestarle el servicio, con las medidas de seguridad descriptas en la <a href="privacidad.html">política de privacidad</a>, sin usarlos para otra cosa ni cederlos a terceros, salvo a los proveedores técnicos listados en <a href="integraciones.html">servicios de terceros</a>. Cuando el negocio quiere, se los exporta en planillas de Excel. Al terminar el servicio, se los entregamos completos y los borramos de nuestros servidores dentro de los 30 días, salvo que nos pida conservarlos más o que una ley obligue a guardarlos.</p>

<h2>8. Propiedad intelectual</h2>
<p>El software de NOA Labs es nuestro. Mientras el abono esté al día, el negocio tiene derecho a usarlo para su actividad. Los contenidos del negocio (su marca, fotos, textos, precios y datos) siguen siendo suyos. Las fotos de paisajes del NOA son de autoría propia; no se pueden copiar ni usar sin permiso. Las capturas y videos de las demos muestran nuestro propio sistema con datos ficticios. Las fuentes tipográficas de la web son libres, bajo licencia SIL Open Font License.</p>

<h2>9. Servicios de terceros</h2>
<p>Algunas funciones usan servicios de otras empresas: WhatsApp, Instagram y Facebook (Meta), Mercado Pago, Google, Booking o Airbnb. Sus costos y condiciones los pone cada empresa. Por ejemplo, la comisión de Mercado Pago por cada seña la paga el negocio a Mercado Pago, y la plata de las señas va directo a la cuenta del negocio: NOA Labs no la cobra ni la retiene.</p>

<h2>10. Responsabilidad</h2>
<p>Respondemos por lo que hacemos mal. No respondemos por cortes o cambios de servicios de terceros, ni por el uso que el negocio haga del sistema o de los datos. Nada de esto limita los derechos que la Ley 24.240 de Defensa del Consumidor les da a quienes contratan como consumidores.</p>

<h2>11. Demos</h2>
<p>Las demostraciones de esta web usan datos ficticios, no guardan nada en ningún servidor y se reinician al recargar la página.</p>

<h2>12. Cambios en estos términos</h2>
<p>Si los cambiamos, actualizamos la fecha de arriba y se lo avisamos a los negocios clientes con al menos 30 días. Los cambios no se aplican a trabajos ya acordados.</p>

<h2>13. Ley aplicable y reclamos</h2>
<p>Se aplican las leyes de la República Argentina. Ante cualquier diferencia, primero intentamos resolverla hablando. Si no se puede, intervienen los tribunales ordinarios de la ciudad de Salta, sin perjuicio del derecho de quien contrata como consumidor de hacer el reclamo en su propio domicilio.</p>
<p>Defensa del consumidor: podés consultar la <a href="{LEY_24240}" target="_blank" rel="noopener">Ley 24.240</a> y hacer reclamos en la <a href="{DEFENSA}" target="_blank" rel="noopener">Ventanilla Federal Única de Reclamos de Defensa del Consumidor</a> o la oficina de defensa del consumidor de tu provincia.</p>

<h2>14. Contacto</h2>
{contacto_html()}
''')

# ─────────────────────────────── Cookies ───────────────────────────────
pagina("cookies", "Política de cookies", '''
<p><b>En corto: no usamos cookies.</b> Ni esta web ni los sistemas que instalamos guardan cookies de seguimiento, de publicidad ni de análisis. Por eso no te mostramos un cartel para aceptarlas.</p>

<h2>Qué es una cookie</h2>
<p>Es un archivito que una página guarda en tu navegador para reconocerte después. Se usan mucho para medir visitas o mostrar publicidad.</p>

<h2>Qué usamos en lugar de cookies</h2>
<ul>
<li><b>Estadísticas de visitas (GoatCounter).</b> Cuenta cuántas personas entran a cada página sin cookies y sin identificar a nadie. Solo corre en la web pública de NOA Labs, no en los sistemas de los negocios.</li>
<li><b>Memoria de la página de reservas.</b> Cuando reservás en un negocio que usa NOA, tu celular recuerda tu nombre y tu número (en el almacenamiento local del navegador, no en una cookie) para no pedírtelos la próxima vez. Ese dato queda en tu teléfono, no viaja a ningún lado por sí solo y lo borrás cuando quieras desde la configuración del navegador (“Borrar datos de sitios”).</li>
<li><b>Ingreso al panel.</b> El panel del negocio se abre con un link privado; no deja cookies.</li>
</ul>

<h2>Páginas de otras empresas</h2>
<p>Si desde nuestras páginas vas a WhatsApp, Instagram, Mercado Pago o Google, esas empresas usan sus propias cookies según sus políticas. Están listadas en <a href="integraciones.html">servicios de terceros</a>.</p>

<h2>¿Hace falta un cartel de consentimiento?</h2>
<p>En Argentina no hay una ley específica de cookies; se aplica la Ley 25.326 de datos personales a la información que identifica a una persona. Como no guardamos cookies ni identificamos a quien visita la web, no corresponde pedir consentimiento. Si algún día sumamos una herramienta que use cookies, vamos a pedir permiso antes de activarla y a actualizar esta página.</p>
''')

# ─────────────────────────────── Reembolsos ───────────────────────────────
pagina("reembolsos", "Política de reembolsos", '''
<h2>Arrepentimiento: 10 días, devolución total</h2>
<p>Si contrataste a distancia (por WhatsApp, Instagram o esta web), tenés 10 días corridos desde que aceptaste la propuesta para arrepentirte, sin dar motivos y sin costo, como dicen el artículo 34 de la Ley 24.240 y el artículo 1110 del Código Civil y Comercial. Usá el <a href="arrepentimiento.html">botón de arrepentimiento</a>: no hace falta registrarse. Te devolvemos todo lo que pagaste por el mismo medio, dentro de los 10 días, y no te cobramos nada por lo que ya hayamos hecho.</p>

<h2>Si cancelás después de los 10 días</h2>
<ul>
<li><b>Antes de la entrega:</b> te devolvemos el anticipo menos las horas ya trabajadas, que te mostramos detalladas.</li>
<li><b>Después de la entrega:</b> la instalación no se devuelve, porque el trabajo ya está hecho. Si algo no funciona como se acordó, lo arreglamos sin cargo.</li>
</ul>

<h2>Abono mensual</h2>
<p>Se paga por mes adelantado. Podés darlo de baja cuando quieras desde el <a href="baja.html">botón de baja</a>: no se cobra el mes siguiente y el sistema sigue andando hasta el final del mes ya pagado. El mes en curso no se devuelve, salvo que la baja sea por una falla nuestra que no hayamos arreglado.</p>

<h2>Señas que cobra un negocio</h2>
<p>Las señas que pagan los clientes de un negocio por Mercado Pago van directo a la cuenta del negocio. La devolución de una seña la decide y la hace el negocio, según sus propias reglas; NOA Labs no cobra ni retiene esa plata.</p>
''')

# ─────────────────────────────── Botón de arrepentimiento ───────────────────────────────
FORM_JS = '<script src="../assets/js/legales.js"></script>\n'
pagina("arrepentimiento", "Botón de arrepentimiento", '''
<p>Si contrataste un servicio de NOA Labs hace 10 días corridos o menos, podés arrepentirte sin dar motivos y te devolvemos todo lo que pagaste. No hace falta registrarse ni tener usuario.</p>
<form class="lead-form legal-form" id="f-legal" data-tipo="ARR" novalidate>
  <label for="lf-n">Nombre y apellido</label><input id="lf-n" autocomplete="name" required>
  <label for="lf-c">Celular o mail donde te respondemos</label><input id="lf-c" autocomplete="tel" required>
  <label for="lf-s">Qué contrataste y cuándo <span class="opt">(opcional)</span></label><input id="lf-s" placeholder="Ej: instalación del sistema, el 20/11">
  <p class="err" id="lf-err" role="alert"></p>
  <button class="btn btn-primary" type="submit">Arrepentirme de la contratación</button>
</form>
<div id="lf-ok" class="legal-ok" hidden tabindex="-1"></div>
<h2>Qué pasa después</h2>
<p>Al tocar el botón, se genera un código de trámite que se ve en pantalla y va en el mensaje. Dentro de las 24 horas te confirmamos por el mismo medio que recibimos el pedido, con ese código, y en los 10 días siguientes te devolvemos el dinero por el mismo medio con el que pagaste.</p>
<p>Si no podés usar WhatsApp, escribinos por Instagram a <a href="https://www.instagram.com/noalabsarg/" target="_blank" rel="noopener">@noalabsarg</a> con el mismo texto.</p>
''', FORM_JS)

# ─────────────────────────────── Botón de baja ───────────────────────────────
pagina("baja", "Botón de baja", '''
<p>Podés dar de baja el abono mensual cuando quieras, sin penalidades, sin registrarte y sin dar motivos.</p>
<form class="lead-form legal-form" id="f-legal" data-tipo="BAJ" novalidate>
  <label for="lf-n">Nombre y apellido</label><input id="lf-n" autocomplete="name" required>
  <label for="lf-c">Celular o mail donde te respondemos</label><input id="lf-c" autocomplete="tel" required>
  <label for="lf-s">Nombre del negocio <span class="opt">(opcional)</span></label><input id="lf-s" autocomplete="organization">
  <p class="err" id="lf-err" role="alert"></p>
  <button class="btn btn-primary" type="submit">Dar de baja el servicio</button>
</form>
<div id="lf-ok" class="legal-ok" hidden tabindex="-1"></div>
<h2>Qué pasa después</h2>
<ul>
<li>Al tocar el botón se genera un código de trámite. Dentro de las 24 horas te confirmamos la baja por el mismo medio, con ese código.</li>
<li>No se cobra el mes siguiente. El sistema sigue andando hasta el final del mes ya pagado.</li>
<li>Te entregamos una copia completa de tus datos en planillas de Excel y, dentro de los 30 días, los borramos de nuestros servidores.</li>
</ul>
''', FORM_JS)

# ─────────────────────────────── Integraciones ───────────────────────────────
TERCEROS = [
    ("Supabase", "Base de datos de los sistemas", "Todos los datos que carga cada negocio", "Servidores de AWS en San Pablo, Brasil", "https://supabase.com/privacy"),
    ("Amazon Web Services (Lightsail)", "Servidor donde corre el sistema y las copias de seguridad", "Los mismos, mientras se procesan; copias cifradas", "San Pablo, Brasil", "https://aws.amazon.com/privacy/"),
    ("GitHub", "Aloja esta web y el código", "Datos técnicos de la visita (como cualquier servidor web)", "Estados Unidos", "https://docs.github.com/es/site-policy/privacy-policies/github-general-privacy-statement"),
    ("GoatCounter", "Contar visitas a esta web, sin cookies", "Página vista, sitio de origen, navegador, pantalla y país aproximado; no guarda la IP", "Exterior", "https://www.goatcounter.com/help/privacy"),
    ("Meta (WhatsApp, Instagram, Facebook)", "Hablar con nosotros y con los negocios; links de reserva", "Lo que escribís en esas apps (lo maneja Meta)", "Estados Unidos y otros", "https://www.whatsapp.com/legal/privacy-policy"),
    ("Mercado Pago", "Cobrar señas y pagos de los negocios", "Tus datos de pago los cargás en Mercado Pago; el sistema solo recibe si el pago se aprobó", "Argentina", "https://www.mercadopago.com.ar/privacidad"),
    ("Google", "Link para dejar una reseña (si el negocio lo activa); Search Console para aparecer en búsquedas", "Ninguno desde nuestros sistemas: la reseña la escribís en Google", "Estados Unidos", "https://policies.google.com/privacy"),
    ("Booking y Airbnb", "Sincronizar calendarios de alojamientos", "Solo fechas ocupadas, sin datos de huéspedes", "Unión Europea / Estados Unidos", "https://www.booking.com/content/privacy.html"),
]
filas = "".join(f"<tr><th scope=\"row\">{e(a)}</th><td>{e(b)}</td><td>{e(c)}</td><td>{e(d)}</td><td><a href=\"{u}\" target=\"_blank\" rel=\"noopener\">Ver política<span class=\"vh\"> de {e(a)}</span></a></td></tr>" for a, b, c, d, u in TERCEROS)
pagina("integraciones", "Servicios de terceros", f'''
<p>Estas son todas las empresas que intervienen en esta web o en los sistemas que instalamos, qué hace cada una y qué datos recibe. Ninguna recibe datos para hacer publicidad.</p>
<div class="tabla-legal" role="region" aria-label="Lista de servicios de terceros" tabindex="0"><table>
<thead><tr><th scope="col">Empresa</th><th scope="col">Para qué</th><th scope="col">Qué datos recibe</th><th scope="col">Dónde</th><th scope="col">Política</th></tr></thead>
<tbody>{filas}</tbody></table></div>
<p>No usamos Google Analytics, píxeles de Facebook ni herramientas de publicidad. Las fuentes tipográficas se sirven desde esta web, no desde Google.</p>
<p>Si sumamos un proveedor nuevo, lo agregamos a esta lista antes de usarlo.</p>
''')

# ─────────────────────────────── Accesibilidad ───────────────────────────────
pagina("accesibilidad", "Accesibilidad", '''
<p>Queremos que cualquier persona pueda usar esta web y los sistemas que instalamos, también con lector de pantalla, solo con el teclado o con la vista cansada.</p>
<h2>Qué tomamos como referencia</h2>
<p>Las Pautas de Accesibilidad para el Contenido Web (WCAG) 2.1, nivel AA, del W3C. Son las mismas pautas, en su versión 2.0, que adoptó la Oficina Nacional de Tecnologías de Información para la Ley 26.653 de accesibilidad web.</p>
<h2>Qué revisamos</h2>
<ul>
<li>Contraste de colores de textos y botones (mínimo 4,5 a 1).</li>
<li>Que todo se pueda usar con el teclado (Tab, Enter, Esc) y que se vea dónde está el foco.</li>
<li>Textos alternativos en las imágenes que dan información; las decorativas se ocultan a los lectores de pantalla.</li>
<li>Formularios con etiquetas, mensajes de error que se anuncian y un enlace para saltar al contenido.</li>
<li>Que la página respete la opción del sistema de reducir animaciones.</li>
</ul>
<p>La última revisión fue en noviembre de 2026, con la herramienta automática axe-core sobre la página de inicio, las páginas legales, las 18 demos (página del cliente y panel) y la página de ingreso, más una prueba manual de reserva usando solo el teclado.</p>
<h2>Lo que todavía no está perfecto</h2>
<p>En las demos, el celular y la ventana del panel son una simulación dentro de la página: con lector de pantalla se usan mejor abriendo cada parte por separado. Los videos de las demos no tienen sonido ni narración.</p>
<h2>Avisanos si algo no funciona</h2>
<p>Si encontrás una barrera, escribinos por <a data-wa="Hola NOA Labs, encontré un problema de accesibilidad en la web." href="../index.html#contacto">WhatsApp</a> o Instagram contándonos en qué página y qué pasó. Lo arreglamos.</p>
''')
