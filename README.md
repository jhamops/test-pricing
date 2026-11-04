# Calculadora de precios · hecho por ILLAK

Escribe lo que te costó y te dice a cuánto venderlo **por docena** y **suelto**, cuánto ganas,
cuánto te queda después del IGV y la **clave del cuaderno** (`mes costo año %`, p. ej. `03 10 26 50`).

- **Una sola regla general**, no producto por producto:
  1. cuánto le sumas según lo que costó (a lo barato más %, a lo caro menos);
  2. lo barato se vende por docena y suelto, lo caro con un solo precio;
  3. redondeo según el precio: 10 céntimos, al sol, y lo caro **termina en 8** (98 y no 100: ya trae su rebaja);
  4. por producto, con un toque: normal, mucha competencia (menos %) o rentable (más %).
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
