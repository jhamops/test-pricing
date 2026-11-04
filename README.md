# Calculadora de precios · hecho por ILLAK

Escribe lo que te costó y te dice a cuánto venderlo **por docena** y **suelto**, cuánto ganas,
cuánto te queda después del IGV y la **clave del cuaderno** (`mes costo año %`, p. ej. `03 10 26 50`).

- Uno por uno (Enter y sigues) o **varios pegados** de una factura, lista o WhatsApp.
- **Flete** de la compra repartido entre las unidades.
- **Tu regla** (porcentaje por familia y, para lo demás, según lo que costó): se cambia en ⚙ y se
  guarda solo en el equipo. Viene con la que sale del cuaderno de marzo 2026.
- Sin servidor ni base de datos: los costos no salen del equipo.

## Archivos

| | |
|---|---|
| `index.html`, `estilos.css`, `app.js` | la página |
| `precios.js` | la cuenta (sin pantalla) |
| `precios.test.mjs` | pruebas: `node --test` (contra los precios reales del cuaderno) |
| `marca/` | escudo e íconos de ILLAK |

## Publicar en Vercel

1. vercel.com → **Add New… → Project** → importar `jhamops/test-pricing`.
2. Framework: **Other**. Build command: vacío. Output directory: vacío (la raíz).
3. **Deploy.** Cada push a `main` la vuelve a publicar.
4. (Opcional) **Settings → Domains** → `precios.illak.app`, y en el DNS de illak.app un
   `CNAME precios → cname.vercel-dns.com`.

Probar en local: `python3 -m http.server` y abrir http://localhost:8000.
