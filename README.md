# Calculadora de precios · hecho por ILLAK

Escribe lo que te costó y te dice a cuánto venderlo **por docena** y **suelto**, cuánto ganas,
cuánto te queda después del IGV y la **clave del cuaderno** (`mes costo año %`, p. ej. `03 10 26 50`).

- Precio de compra → tarjeta → flete → **ganancia** (botones de 5 en 5, de 15 a 85, u «Otro»).
  El precio cambia al momento. Sin sugerencias: la ganancia la elige ella (se recuerda la última).
- **La lista es una tabla** para llenar rápido: compra, cantidad, flete, ganancia (− / +), precio,
  ganancia por unidad y clave. **Flete de toda la compra** arriba: «S/ 60 ÷ 36 unidades = S/ 1.67 c/u»,
  y marca los que no tienen cantidad.
- **Descargar Excel** (`precios-AAAA-MM-DD.xlsx`): una fila por producto, números como números,
  soles con formato, y los totales. La librería (`vendor/xlsx.full.min.js`, SheetJS 0.18.5) se
  carga solo al tocar el botón.
- La tarjeta (3 %) va siempre dentro del precio (se divide entre 0.97); el flete se suma sin ganancia.
- **Por docena solo si ella lo marca** («Por docena» al llenar, «x12» en cada fila): sale la docena
  c/u y el suelto. Si no, un solo precio. Lo caro termina en 8 (opcional en ⚙).
- Se guarda solo en el equipo (misma dirección = mismos datos, aunque se actualice la página).

## Archivos

| | |
|---|---|
| `index.html`, `estilos.css`, `app.js` | la página |
| `precios.js` | la cuenta (sin pantalla) |
| `precios-reales.js` | sus 38 precios reales (costo → precio), sin nombres |
| `precios.test.mjs` | pruebas: `node --test` (la escalera se mide contra esos 38: error medio ≤ 5 %) |
| `marca/` | escudo e íconos de ILLAK |
| `vendor/xlsx.full.min.js` | SheetJS 0.18.5 para el Excel |

## Publicar en Vercel

1. vercel.com → **Add New… → Project** → importar `jhamops/test-pricing`.
2. Framework: **Other**. Build command: vacío. Output directory: vacío (la raíz).
3. **Deploy.** Cada push a `main` la vuelve a publicar.
4. (Opcional) **Settings → Domains** → `precios.illak.app`, y en el DNS de illak.app un
   `CNAME precios → cname.vercel-dns.com`.

Probar en local: `python3 -m http.server` y abrir http://localhost:8000.

## Varios a la vez: foto, PDF o lista

- **PDF de la factura con texto** (la electrónica del proveedor): se lee con pdf.js, al instante y exacto.
- **Foto o PDF escaneado**: Tesseract (OCR) en el mismo navegador. Antes se endereza la hoja, se pasa a
  blanco y negro y se borran las rayas de la tabla. El importe (cantidad × precio) corrige el punto
  decimal perdido y la cantidad mal leída.
- **Google Lens / Texto en vivo**: «Copiar texto» y «Pegar lo copiado». Si Lens copia la tabla por
  columnas, se vuelven a armar las filas.
- Se saltan encabezado, totales y pie (RUC, fecha, IGV…). Nada sale del equipo.
- Librerías en `vendor/` (tesseract.js 7, modelo español `best_int`, pdf.js 4.10 legacy; Apache-2.0).
  Se descargan la primera vez que se usan (~6 MB) y el navegador las guarda.
