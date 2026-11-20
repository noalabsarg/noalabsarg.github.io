# NOA Labs · sitio web

Sitio estático de NOA Labs (Salta, Argentina): página principal, seis demos funcionales, una por rubro y páginas legales. No necesita servidor ni base de datos: es HTML, CSS y JavaScript puro, así que se puede subir a cualquier hosting estático.

## Estructura

```
index.html              Página principal
noa-mostrador/index.html  Comercios: stock, ventas, clientes, alertas, reportes + WhatsApp simulado
noa-mesa/index.html       Gastronomía: salón, cocina, reservas, carta, caja + WhatsApp simulado
noa-club/index.html       Deporte: ingreso en vivo, socios, clases con cupo, cobros, finanzas + WhatsApp simulado
noa-llave/index.html      Alojamiento e inmuebles: calendario, reservas, propiedades, alquileres + WhatsApp simulado
noa-turno/index.html      Servicios: agenda, clientes, recordatorios, vehículos, reportes + WhatsApp simulado
noa-planta/index.html     Industria: dashboard, mapa, equipos, vibraciones, repuestos, OT
legales/                  Términos, privacidad y baja del servicio
404.html                  Página de error
assets/css/               site.css (sitio) y app.css (demos)
assets/js/                site.js, app-common.js y un archivo por demo
assets/img/               Fotos de la Puna, logo, íconos y capturas de las demos
assets/video/             Videos cortos de cada demo (se ven dentro de las laptops de la home)
robots.txt, sitemap.xml SEO básico
```

## Cambiar el número de WhatsApp

Abrí `assets/js/site.js` y cambiá la línea:

```js
const WHATSAPP = "5493876124879";
```

Formato: `549` + característica sin 0 + número sin 15. Ejemplo: 387 15 612-4879 → `5493876124879`.
Después buscá `+54 9 387 612-4879` en `index.html` y reemplazalo por el número nuevo (es el texto que se ve).

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
6. Dominio propio (`noalabs.com.ar`), cuando lo tengas:
   1. Registrá el dominio en https://nic.ar con tu CUIT y clave fiscal.
   2. NIC Argentina no administra registros DNS: hay que **delegar** el dominio. Creá una cuenta gratis en https://dash.cloudflare.com, agregá `noalabs.com.ar` (plan Free) y copiá los 2 *nameservers* que te da.
   3. En NIC Argentina: **Mis dominios → noalabs.com.ar → Delegaciones** y cargá esos 2 nameservers. La delegación puede tardar unas horas.
   4. En Cloudflare → **DNS → Records** agregá (con la nube en gris, "DNS only"):
      - 4 registros **A** para `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
      - 1 registro **CNAME** para `www` → `noalabsarg.github.io`
   5. Creá en la raíz del repositorio un archivo llamado `CNAME` (sin extensión) que tenga solo esta línea: `noalabs.com.ar`
   6. En GitHub: **Settings → Pages → Custom domain** → `noalabs.com.ar` → Save. Cuando aparezca el tilde verde, activá **Enforce HTTPS**.

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
- [ ] Cuando tengas el dominio: cambiar `noalabsarg.github.io` por `noalabs.com.ar` en `sitemap.xml` y `robots.txt`.
- [ ] Actualizar "QUEDAN 5 LUGARES" en `index.html` a medida que se sumen negocios.
- [ ] Si se agregan clientes reales, sumar una sección "Ya trabajan con NOA Labs" con su autorización.

## Notas

- Las demos usan datos ficticios y se reinician al recargar.
- Tipografías: Anton, Archivo e IBM Plex Mono (Google Fonts).
- Fotos: propias, tomadas en la Puna salteña y la Quebrada de Humahuaca.
