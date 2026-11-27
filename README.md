# NOA Labs · sitio web

Sitio estático de NOA Labs (Salta, Argentina): página principal, seis rubros con 18 demos y páginas legales. No necesita servidor ni base de datos: es HTML, CSS y JavaScript puro.

Las demos son **el sistema real** (los mismos archivos que usa el servidor) corriendo con datos de ejemplo en el navegador: a la izquierda el celular del cliente, que arranca en el WhatsApp con el link, y a la derecha el panel del dueño, que se actualiza al instante. Los Excel se arman en el navegador con `app/noa-xlsx.js`, sin librerías de afuera.

## Estructura

```
index.html                    Página principal
demo/index.html?r=<rubro>     Demo de cada rubro (hay un selector arriba para cambiar):
   Servicios:    belleza, taller, consultorio, estudio
   Deporte:      gimnasio, canchas, danza
   Comercios:    mates, ferreteria, almacen, ropa
   Gastronomía:  cafe, restaurante, rotiseria, heladeria
   Alojamiento:  cabanas, inmobiliaria
app/                          Página del cliente, panel del dueño, Excel y las reglas de la demo (noa-demo-backend.js)
noa-planta/index.html         Industria: dashboard, mapa, equipos, vibraciones, repuestos, OT
legales/                      Términos, privacidad, cookies, reembolsos, terceros, accesibilidad,
                              botón de arrepentimiento y botón de baja (los arma build_legales.py)
404.html                      Página de error
assets/                       Estilos, scripts del sitio, fotos y videos de las demos
robots.txt, sitemap.xml       SEO básico
.nojekyll                     Para que GitHub Pages publique todo tal cual
```

Si ya tenías subida una versión anterior en GitHub, borrá las carpetas `noa-llave`, `noa-estudio`, `noa-mostrador`, `noa-mesa`, `noa-club` y `noa-turno`, y los archivos `assets/js/noa-llave.js` y `assets/js/noa-estudio.js` (ya no se usan).

## Cambiar el número de WhatsApp

Abrí `assets/js/site.js` y cambiá la línea:

```js
const WHATSAPP = "5493872265167";
```

Formato: `549` + característica sin 0 + número sin 15. Ejemplo: 387 15 226-5167 → `5493872265167`.
El texto que se ve está en `herramientas/build_index.py` y en `WA_TXT` de `web/herramientas/build_legales.py`: cambialo ahí y regenerá las páginas.

## Estadísticas de visitas (opcional, gratis)

Creá una cuenta en https://www.goatcounter.com con un código, por ejemplo `noalabs`. Después abrí `assets/js/site.js` y completá:

```js
const GOATCOUNTER = "noalabs";
```

Desde goatcounter.com ves cuánta gente entra, desde dónde llega y qué páginas mira. No usa cookies.

## Probarlo en tu compu

Abrí `index.html` con doble clic, o mejor, desde la carpeta del proyecto:

```bash
python -m http.server 8000
```

y entrá a http://localhost:8000

## Publicarlo (elegí una opción)

### Opción A · GitHub Pages (gratis, recomendada)

1. Creá un repositorio nuevo en GitHub, por ejemplo `noalabs-web` (público).
2. Subí todos los archivos de esta carpeta (arrastrándolos en la web de GitHub, o con git):
   ```bash
   git init
   git add .
   git commit -m "Sitio NOA Labs"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/noalabs-web.git
   git push -u origin main
   ```
3. En el repositorio: **Settings → Pages → Source: Deploy from a branch → main / (root)** → Save.
4. En 1 o 2 minutos queda en `https://TU_USUARIO.github.io/noalabs-web/`.
5. Para que el link sea `https://noalabsarg.github.io` (sin carpeta al final), el repositorio tiene que estar en la organización `noalabsarg` y llamarse exactamente `noalabsarg.github.io`.
6. Dominio propio (`noalabs.com.ar`). El archivo `CNAME` (en la raíz) le dice a GitHub Pages qué dominio usar: apenas llega al repo,
   `noalabsarg.github.io` empieza a redirigir al dominio. Por eso **primero el DNS y después subir el `CNAME`**, si no la web queda caída un rato.
   1. NIC Argentina no administra registros DNS: hay que **delegar** el dominio. Creá una cuenta gratis en https://dash.cloudflare.com, agregá `noalabs.com.ar` (plan Free) y anotá los 2 *nameservers* que te da.
   2. En https://nic.ar: **Mis dominios → noalabs.com.ar → Delegaciones** y cargá esos 2 nameservers (sin IP). Tarda de minutos a unas horas.
   3. En Cloudflare → **DNS → Records**, todos con la nube en gris ("DNS only", si no GitHub no puede sacar el certificado):
      - 4 registros **A**, nombre `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
      - 4 registros **AAAA**, nombre `@`: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`
      - 1 registro **CNAME**, nombre `www` → `noalabsarg.github.io`
   4. En GitHub, organización `noalabsarg` → **Settings → Pages → Add a domain** → `noalabs.com.ar`: te da un registro **TXT** para cargar en Cloudflare y después **Verify**. Así nadie más puede usar el dominio en otro GitHub.
   5. Recién ahora subí la web con el `CNAME` (o cargá `noalabs.com.ar` a mano en el repo → **Settings → Pages → Custom domain**). Cuando dé el tilde verde y el certificado (puede tardar hasta un día), activá **Enforce HTTPS** ahí mismo.
   6. Queda una sola versión: `www.noalabs.com.ar` y `noalabsarg.github.io` redirigen solas (301) a `https://noalabs.com.ar`.
   7. En Google Search Console agregá la propiedad `noalabs.com.ar` (tipo Dominio, con otro TXT en Cloudflare) y mandá `https://noalabs.com.ar/sitemap.xml`.

### Opción B · Netlify (gratis)

Entrá a https://app.netlify.com/drop y arrastrá la carpeta completa. Para el dominio: **Domain settings → Add custom domain → noalabs.com.ar** y cargá en Cloudflare (o el DNS que uses) los registros que te indica.

### Opción C · Amazon Web Services (AWS Amplify)

1. En la consola de AWS abrí **Amplify → Create new app → Deploy without Git** y subí la carpeta comprimida en .zip (o conectá el repositorio de GitHub para que se actualice solo con cada push).
2. En **Hosting → Custom domains** agregá `noalabs.com.ar` y cargá en tu DNS los registros que te indica.

(También funciona con S3 + CloudFront: bucket con "Static website hosting" activado, `index.html` como documento índice y `404.html` como documento de error.)

## Antes de publicar

- [ ] Número de WhatsApp definitivo en `assets/js/site.js` e `index.html`.
- [ ] Revisar con un abogado o contador los textos de `legales/` y agregar titular y CUIT si corresponde.
- [ ] Confirmar el usuario de Instagram (`@noalabsarg`).
- [ ] Actualizar "QUEDAN 5 LUGARES" en `index.html` a medida que se sumen negocios.
- [ ] Si se agregan clientes reales, sumar una sección "Ya trabajan con NOA Labs" con su autorización.

## Notas

- Las demos usan datos ficticios y se reinician al recargar.
- Tipografías: Anton, Archivo e IBM Plex Mono (Google Fonts).
- Fotos: propias, tomadas en la Puna salteña y la Quebrada de Humahuaca.

## Antes de cobrar el primer trabajo

En `legales/` faltan los datos del titular (nombre, CUIT, domicilio y un mail de contacto), que la ley de comercio
electrónico pide que estén a la vista. Mientras no estén, las páginas dicen que se publican al terminar la inscripción.
Para cargarlos: completá `TITULAR`, `CUIT`, `DOMICILIO` y `EMAIL` arriba de todo en `herramientas/build_legales.py` y corré `python3 herramientas/build_legales.py`,
o pedímelo y lo hago.

## Fuentes tipográficas

Archivo, Anton e IBM Plex Mono están en `assets/fonts/` (licencia SIL OFL, incluida). Se sirven desde la propia web,
así el navegador de quien visita no se conecta a Google.
