# Calculadora de precios · hecho por ILLAK

Escribe lo que te costó y te dice a cuánto venderlo **por docena** y **suelto**, cuánto ganas,
cuánto te queda después del IGV y la **clave del cuaderno** (`mes costo año %`, p. ej. `03 10 26 50`).

- **Como trabaja ella:** precio de compra → tarjeta → flete → **toca el porcentaje** (de 5 en 5,
  de 15 a 85, o «Otro» con cualquiera) y el precio cambia al momento. La cantidad es opcional.
- El botón con borde punteado es el **sugerido** para ese costo (la escalera de «Tu regla»,
  ajustada con sus 38 precios reales); ella toca el que quiera, también en cada producto de la lista.
- Lo barato sale por docena y suelto (opcional); lo caro termina en 8 (opcional: 98 y no 100).
- **La tarjeta (3 %) va siempre dentro del precio** (se divide entre 0.97); el flete se suma sin ganancia encima.
- Uno por uno (Enter y sigues) o **varios pegados** de una factura, lista o WhatsApp.
- **Flete**: el de un producto (entre sus unidades) o el de toda la compra (repartido).
- **La comisión de tarjeta (3 %) va siempre dentro del precio**, pague como pague: se divide entre 0.97.
- La regla se cambia en ⚙ con ejemplos que se actualizan solos, y se guarda solo en el equipo
  (si borras los datos del navegador, se pierde). Sin servidor ni base de datos.

## Archivos

| | |
|---|---|
| `index.html`, `estilos.css`, `app.js` | la página |
| `precios.js` | la cuenta (sin pantalla) |
| `precios-reales.js` | sus 38 precios reales (costo → precio), sin nombres |
| `precios.test.mjs` | pruebas: `node --test` (la escalera se mide contra esos 38: error medio ≤ 5 %) |
| `marca/` | escudo e íconos de ILLAK |

## Publicar en Vercel

1. vercel.com → **Add New… → Project** → importar `jhamops/test-pricing`.
2. Framework: **Other**. Build command: vacío. Output directory: vacío (la raíz).
3. **Deploy.** Cada push a `main` la vuelve a publicar.
4. (Opcional) **Settings → Domains** → `precios.illak.app`, y en el DNS de illak.app un
   `CNAME precios → cname.vercel-dns.com`.

Probar en local: `python3 -m http.server` y abrir http://localhost:8000.
