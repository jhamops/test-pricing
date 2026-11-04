/**
 * La pantalla. La cuenta vive en `precios.js` (con sus pruebas); aquí solo se escribe,
 * se muestra y se guarda en este equipo (localStorage).
 *
 * Cómo trabaja ella: precio de compra → tarjeta → flete → toca la ganancia (de 5 en 5, o
 * cualquiera). La lista es una tabla para llenar rápido, con el flete de toda la compra
 * repartido a la vista, y sale a Excel.
 */
import {
    PORCENTAJES, REGLA_INICIAL, calcular, clave, filasExcel, fleteDe as fleteDeCalc, fleteDelProducto, fletePorUnidad,
    leerPegado, redondearPrecio, textoParaCopiar,
} from './precios.js';

const GUARDADO = 'illak-calculadora-v3';
const $ = (id) => document.getElementById(id);
const soles = (n) => `S/ ${Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (t) => {
    const n = Number(String(t ?? '').replace(',', '.').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
};
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const copia = (o) => JSON.parse(JSON.stringify(o));

// ── Estado (se guarda en este equipo) ──────────────────────────────────────
let estado = { productos: [], flete: '', ultimoPct: 40, regla: copia(REGLA_INICIAL) };
try {
    const g = JSON.parse(localStorage.getItem(GUARDADO) || 'null');
    if (g && Array.isArray(g.productos)) {
        estado = { ...estado, ...g, regla: { ...copia(REGLA_INICIAL), ...(g.regla || {}) } };
    } else {
        const viejo = JSON.parse(localStorage.getItem('illak-calculadora-v2') || localStorage.getItem('illak-calculadora-v1') || 'null');
        if (viejo && Array.isArray(viejo.productos)) {
            estado.productos = viejo.productos.map((p) => ({ id: p.id, nombre: p.nombre, costo: p.costo, cantidad: p.cantidad, pct: null, flete: '' }));
            estado.flete = viejo.flete || '';
        }
    }
} catch { /* sin guardado: se empieza de cero */ }
const guardar = () => { try { localStorage.setItem(GUARDADO, JSON.stringify(estado)); } catch { /* modo privado */ } };
// Sin sugerencias: lo que no tenía ganancia elegida toma la última que usó.
for (const p of estado.productos) if (p.pct == null || p.pct === '') p.pct = estado.ultimoPct;
guardar();
let siguienteId = estado.productos.reduce((m, p) => Math.max(m, p.id), 0) + 1;

// ── Tema ───────────────────────────────────────────────────────────────────
try { const t = localStorage.getItem('illak-calculadora-tema'); if (t) document.documentElement.dataset.theme = t; } catch { /* nada */ }
$('tema').addEventListener('click', () => {
    const oscuroAhora = document.documentElement.dataset.theme
        ? document.documentElement.dataset.theme === 'dark'
        : matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = oscuroAhora ? 'light' : 'dark';
    try { localStorage.setItem('illak-calculadora-tema', document.documentElement.dataset.theme); } catch { /* nada */ }
});

// ── La cuenta ──────────────────────────────────────────────────────────────
const fleteDe = (p) => fleteDeCalc(p, estado.productos, num(estado.flete));
const resultado = (p) => calcular({ costo: p.costo, pct: p.pct, docena: Boolean(p.docena), flete: fleteDe(p) }, estado.regla);
const conTarjeta = () => estado.regla.tarjetaSiempre !== false && Number(estado.regla.tarjeta) > 0;

// ── Aviso con «Deshacer» ───────────────────────────────────────────────────
let reloj = null;
function avisar(texto, deshacer = null) {
    const a = $('aviso');
    a.innerHTML = `<span>${esc(texto)}</span>${deshacer ? '<button type="button">Deshacer</button>' : ''}`;
    a.hidden = false;
    if (deshacer) a.querySelector('button').onclick = () => { deshacer(); a.hidden = true; };
    clearTimeout(reloj);
    reloj = setTimeout(() => { a.hidden = true; }, deshacer ? 7000 : 2500);
}

// ── Arriba: precio de compra, tarjeta, flete y ganancia ────────────────────
let pctNuevo = estado.ultimoPct;
let docenaNueva = false; // ¿lo vende por docena (por mayor)? Lo marca ella.

function htmlPorcentajes(actual) {
    const esOtro = !PORCENTAJES.includes(Number(actual));
    return PORCENTAJES.map((n) => `<button type="button" class="pct" data-pct="${n}" aria-pressed="${!esOtro && Number(actual) === n}">${n}</button>`).join('')
        + `<label class="pct-otro${esOtro ? ' activo' : ''}"><span>Otro</span><input data-pct-otro inputmode="decimal" value="${esOtro ? esc(actual) : ''}" placeholder="—" aria-label="Otro porcentaje"><span aria-hidden="true">%</span></label>`;
}
function marcarPorcentajes() {
    const esOtro = !PORCENTAJES.includes(Number(pctNuevo));
    $('nuevo-pct').querySelectorAll('[data-pct]').forEach((b) => b.setAttribute('aria-pressed', String(!esOtro && Number(b.dataset.pct) === Number(pctNuevo))));
    $('nuevo-pct').querySelector('.pct-otro').classList.toggle('activo', esOtro);
}

function vistaPrevia() {
    marcarPorcentajes();
    const costo = num($('nuevo-costo').value);
    const caja = $('vista-previa');
    if (!(costo > 0)) { caja.innerHTML = ''; caja.classList.remove('lleno'); return; }
    const r = calcular({ costo, pct: pctNuevo, docena: docenaNueva, flete: fleteDelProducto($('nuevo-flete').value.replace(',', '.'), num($('nuevo-cant').value)) }, estado.regla);
    const redondeado = !r.porDocena && Math.abs(r.sinRedondear - r.suelto) >= 0.5;
    caja.classList.add('lleno');
    caja.innerHTML = r.porDocena
        ? `<span class="grande">Docena <b>${soles(r.docenaUnidad)}</b> c/u · suelto <b>${soles(r.suelto)}</b></span><span class="gana-mini">ganas ${soles(r.ganas)}</span>`
        : `<span class="grande"><b>${soles(r.suelto)}</b></span>${redondeado ? `<span class="antes-red">antes ${soles(r.sinRedondear)}</span>` : ''}<span class="gana-mini">ganas ${soles(r.ganasSuelto)}</span>`;
}
['nuevo-costo', 'nuevo-cant', 'nuevo-flete'].forEach((id) => $(id).addEventListener('input', vistaPrevia));
$('nuevo-docena').addEventListener('click', () => {
    docenaNueva = !docenaNueva;
    $('nuevo-docena').setAttribute('aria-pressed', String(docenaNueva));
    vistaPrevia();
});
$('nuevo-pct').innerHTML = htmlPorcentajes(pctNuevo);
$('nuevo-pct').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pct]');
    if (!b) return;
    pctNuevo = Number(b.dataset.pct);
    $('nuevo-pct').querySelector('[data-pct-otro]').value = '';
    vistaPrevia();
});
$('nuevo-pct').addEventListener('input', (e) => {
    if (!e.target.matches('[data-pct-otro]') || e.target.value.trim() === '') return;
    pctNuevo = num(e.target.value);
    vistaPrevia();
});
// La tarjeta: un solo número para todo (0 = no va en el precio).
const pintarTarjeta = () => { $('nuevo-tarjeta').value = conTarjeta() ? estado.regla.tarjeta : 0; };
pintarTarjeta();
$('nuevo-tarjeta').addEventListener('input', (e) => {
    const t = num(e.target.value);
    if (t > 0) estado.regla.tarjeta = t;
    estado.regla.tarjetaSiempre = t > 0;
    guardar(); vistaPrevia(); repintarFilas(); pintarResumen();
});
$('nuevo-nombre').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('nuevo-costo').focus(); } });

$('form-nuevo').addEventListener('submit', (e) => {
    e.preventDefault();
    const costo = num($('nuevo-costo').value);
    if (!(costo > 0)) { $('nuevo-costo').focus(); avisar('Falta el precio de compra.'); return; }
    estado.ultimoPct = pctNuevo;
    agregar([{ nombre: $('nuevo-nombre').value.trim(), costo, cantidad: num($('nuevo-cant').value) || null, flete: $('nuevo-flete').value.trim(), pct: pctNuevo, docena: docenaNueva }]);
    ['nuevo-nombre', 'nuevo-costo', 'nuevo-cant', 'nuevo-flete'].forEach((id) => { $(id).value = ''; });
    vistaPrevia();
    $('nuevo-nombre').focus();
});

function agregar(lista) {
    const nuevos = lista.map((x, i) => ({
        id: siguienteId++, nombre: x.nombre || `Producto ${estado.productos.length + i + 1}`,
        costo: x.costo, cantidad: x.cantidad, pct: x.pct ?? estado.ultimoPct, flete: x.flete || '', docena: Boolean(x.docena),
    }));
    estado.productos = [...nuevos.reverse(), ...estado.productos]; // lo último, arriba
    guardar();
    pintarTodo(new Set(nuevos.map((p) => p.id)));
}

// ── La lista (tabla) ───────────────────────────────────────────────────────
function celdasCalculadas(p) {
    const r = resultado(p);
    if (!r) return { compra: '', precio: '<span class="falta">—</span>', ganas: '', clave: '' };
    const conFlete = r.costoConFlete !== Number(p.costo) ? `<small>con flete ${soles(r.costoConFlete)}</small>` : '';
    const precio = r.porDocena
        ? `<b>${soles(r.docenaUnidad)}</b><small>docena · suelto ${soles(r.suelto)}</small>`
        : `<b>${soles(r.suelto)}</b>${Math.abs(r.sinRedondear - r.suelto) >= 0.5 ? `<small>antes ${soles(r.sinRedondear)}</small>` : ''}`;
    const ganas = `<b>${soles(r.porDocena ? r.ganas : r.ganasSuelto)}</b><small>${estado.regla.conFactura ? 'sin IGV ' : 'neto '}${soles(r.teQueda)}</small>`;
    return { compra: conFlete, precio, ganas, clave: `<button type="button" class="clave" data-accion="clave" title="Copiar">${esc(clave(p.costo, r.porcentaje))}</button>` };
}

function htmlFila(p, nuevo) {
    const c = celdasCalculadas(p);
    const faltaCant = num(estado.flete) > 0 && !(Number(p.cantidad) > 0);
    return `
    <tr class="fila${nuevo ? ' nuevo' : ''}" data-id="${p.id}">
        <td data-label="Producto" class="col-nombre"><input class="nombre" data-campo="nombre" value="${esc(p.nombre)}" aria-label="Producto"></td>
        <td data-label="Compra" class="num"><span class="con-sol"><span aria-hidden="true">S/</span><input data-campo="costo" inputmode="decimal" value="${esc(p.costo)}" aria-label="Precio de compra"></span><span class="calc" data-c="compra">${c.compra}</span></td>
        <td data-label="Cant." class="num"><input class="cant${faltaCant ? ' falta-cant' : ''}" data-campo="cantidad" inputmode="numeric" placeholder="—" value="${p.cantidad ?? ''}" aria-label="Cantidad"></td>
        <td data-label="Flete" class="num"><span class="con-sol"><span aria-hidden="true">S/</span><input data-campo="flete" inputmode="decimal" placeholder="—" value="${esc(p.flete ?? '')}" aria-label="Flete de este producto"></span></td>
        <td data-label="Ganancia" class="num">
            <span class="paso-pct">
                <button type="button" data-accion="menos" aria-label="5 menos">−</button>
                <input data-campo="pct" inputmode="decimal" value="${esc(p.pct)}" aria-label="Ganancia en por ciento"><span aria-hidden="true">%</span>
                <button type="button" data-accion="mas" aria-label="5 más">+</button>
            </span>
        </td>
        <td data-label="Docena"><button type="button" class="interr chico" data-accion="docena" aria-pressed="${Boolean(p.docena)}" aria-label="Por docena">x12</button></td>
        <td data-label="Precio" class="num calc" data-c="precio">${c.precio}</td>
        <td data-label="Ganas c/u" class="num calc" data-c="ganas">${c.ganas}</td>
        <td data-label="Clave" class="calc" data-c="clave">${c.clave}</td>
        <td class="col-quitar"><button type="button" class="quitar" data-accion="quitar" aria-label="Quitar ${esc(p.nombre)}">✕</button></td>
    </tr>`;
}

function repintarFila(tr, p) {
    const c = celdasCalculadas(p);
    tr.querySelectorAll('[data-c]').forEach((el) => { el.innerHTML = c[el.dataset.c]; });
    tr.querySelector('.cant').classList.toggle('falta-cant', num(estado.flete) > 0 && !(Number(p.cantidad) > 0));
}
function repintarFilas() {
    document.querySelectorAll('#lista .fila').forEach((tr) => {
        const p = estado.productos.find((x) => x.id === Number(tr.dataset.id));
        if (p) repintarFila(tr, p);
    });
}

function pintarTodo(nuevos = new Set()) {
    const hay = estado.productos.length > 0;
    $('lista').innerHTML = estado.productos.map((p) => htmlFila(p, nuevos.has(p.id))).join('');
    $('barra').hidden = !hay;
    $('tabla-caja').hidden = !hay;
    $('vacio').hidden = hay;
    $('flete').value = estado.flete || '';
    pintarResumen();
}

const ICONOS = {
    caja: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/></svg>',
    sube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/></svg>',
    moneda: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6.5V8M12 16v1.5"/></svg>',
};

function pintarResumen() {
    const ps = estado.productos;
    $('cuenta').innerHTML = `${ps.length} ${ps.length === 1 ? 'producto' : 'productos'}`;
    // El flete de toda la compra: cuánto toca por unidad, y a cuáles les falta la cantidad.
    const total = num(estado.flete);
    const unidades = ps.reduce((s, p) => s + (Number(p.cantidad) > 0 ? Number(p.cantidad) : 0), 0);
    const sinCant = ps.filter((p) => !(Number(p.cantidad) > 0)).length;
    const nota = $('nota-flete');
    if (total > 0 && unidades > 0) {
        nota.innerHTML = `${soles(total)} ÷ ${unidades} unidades = <b>${soles(fletePorUnidad(total, ps))} c/u</b>${sinCant ? ` · <span class="aviso-cant">${sinCant} sin cantidad: no les toca</span>` : ''}`;
    } else if (total > 0) {
        nota.innerHTML = '<span class="aviso-cant">Pon la cantidad de cada producto para repartirlo.</span>';
    } else {
        nota.textContent = 'Se reparte entre las unidades de la lista.';
    }

    const t = $('totales');
    const { totales } = filasExcel(ps, estado.regla, total);
    if (!totales) { t.hidden = true; return; }
    t.hidden = false;
    t.innerHTML = `
        <div class="cifra neutro"><span class="icono" aria-hidden="true">${ICONOS.caja}</span><div><span>Invertiste</span><strong>${soles(totales.invertido)}</strong></div></div>
        <div class="cifra ok"><span class="icono" aria-hidden="true">${ICONOS.sube}</span><div><span>Ganas si vendes todo</span><strong>${soles(totales.ganas)}</strong></div></div>
        <div class="cifra ok"><span class="icono" aria-hidden="true">${ICONOS.moneda}</span><div><span>${estado.regla.conFactura ? 'Sin IGV' : 'Neto'}</span><strong>${soles(totales.queda)}</strong></div></div>`;
}

// Escribir en una fila: solo se repintan sus celdas calculadas (no se pierde el cursor).
$('lista').addEventListener('input', (e) => {
    const tr = e.target.closest('.fila');
    const campo = e.target.dataset.campo;
    if (!tr || !campo) return;
    const p = estado.productos.find((x) => x.id === Number(tr.dataset.id));
    if (!p) return;
    const v = e.target.value;
    if (campo === 'nombre') p.nombre = v;
    else if (campo === 'costo') p.costo = num(v);
    else if (campo === 'cantidad') p.cantidad = num(v) || null;
    else if (campo === 'flete') p.flete = v.trim();
    else if (campo === 'pct') { if (v.trim() === '') return; p.pct = num(v); estado.ultimoPct = p.pct; }
    guardar();
    // La cantidad cambia el reparto del flete de toda la compra: se repintan todas.
    if (campo === 'cantidad' && num(estado.flete) > 0) repintarFilas();
    else if (campo !== 'nombre') repintarFila(tr, p);
    pintarResumen();
});

$('lista').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-accion]');
    if (!b) return;
    const tr = b.closest('.fila');
    const p = estado.productos.find((x) => x.id === Number(tr.dataset.id));
    if (!p) return;
    const accion = b.dataset.accion;
    if (accion === 'mas' || accion === 'menos') {
        // De 5 en 5, cayendo en múltiplos de 5 (47 → 50 o 45).
        const base = Number(p.pct) || 0;
        p.pct = Math.max(0, accion === 'mas' ? Math.floor(base / 5) * 5 + 5 : Math.ceil(base / 5) * 5 - 5);
        estado.ultimoPct = p.pct;
        tr.querySelector('[data-campo="pct"]').value = p.pct;
        guardar(); repintarFila(tr, p); pintarResumen();
    }
    if (accion === 'docena') {
        p.docena = !p.docena;
        b.setAttribute('aria-pressed', String(p.docena));
        guardar(); repintarFila(tr, p); pintarResumen();
    }
    if (accion === 'quitar') {
        const antes = [...estado.productos];
        estado.productos = estado.productos.filter((x) => x.id !== p.id);
        guardar(); pintarTodo();
        avisar(`Quitaste «${p.nombre}».`, () => { estado.productos = antes; guardar(); pintarTodo(); });
    }
    if (accion === 'clave') {
        const r = resultado(p);
        if (r) { await copiarTexto(clave(p.costo, r.porcentaje)); avisar('Clave copiada.'); }
    }
});

$('flete').addEventListener('input', (e) => {
    estado.flete = e.target.value;
    guardar(); repintarFilas(); pintarResumen();
});

// ── Excel ──────────────────────────────────────────────────────────────────
/** La librería de Excel (880 KB) se baja recién al tocar el botón. */
function cargarXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise((ok, mal) => {
        const s = document.createElement('script');
        s.src = 'vendor/xlsx.full.min.js';
        s.onload = () => ok(window.XLSX);
        s.onerror = () => mal(new Error('No se pudo cargar'));
        document.head.append(s);
    });
}
$('excel').addEventListener('click', async () => {
    const boton = $('excel');
    boton.disabled = true;
    try {
        const XLSX = await cargarXlsx();
        const hoy = new Date();
        const { columnas, filas, totales } = filasExcel(estado.productos, estado.regla, num(estado.flete), hoy);
        const aoa = [columnas, ...filas];
        if (totales) {
            aoa.push([]);
            aoa.push(['Invertiste', totales.invertido]);
            aoa.push(['Ganas si vendes todo', totales.ganas]);
            aoa.push([estado.regla.conFactura ? 'Te queda (sin IGV)' : 'Te queda', totales.queda]);
        }
        if (num(estado.flete) > 0) aoa.push(['Flete de toda la compra', num(estado.flete)]);
        const hoja = XLSX.utils.aoa_to_sheet(aoa);
        hoja['!cols'] = columnas.map((c, i) => ({ wch: i === 0 ? Math.max(14, ...filas.map((f) => String(f[0]).length)) + 2 : Math.max(10, c.length + 2) }));
        // Soles con dos decimales en las columnas de plata (y en los totales).
        const plata = [1, 3, 4, 7, 8, 9, 10, 11];
        for (let f = 1; f < aoa.length; f++) {
            for (let c = 0; c < aoa[f].length; c++) {
                const celda = hoja[XLSX.utils.encode_cell({ r: f, c })];
                if (celda && celda.t === 'n' && (f > filas.length ? c === 1 : plata.includes(c))) celda.z = '"S/ "#,##0.00';
            }
        }
        const libro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(libro, hoja, 'Precios');
        const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
        XLSX.writeFile(libro, `precios-${fecha}.xlsx`);
        avisar('Excel descargado.');
    } catch {
        avisar('No se pudo generar el Excel. Vuelve a intentar.');
    } finally {
        boton.disabled = false;
    }
});

// ── Copiar, imprimir, vaciar ───────────────────────────────────────────────
async function copiarTexto(t) {
    try { await navigator.clipboard.writeText(t); } catch {
        const a = document.createElement('textarea');
        a.value = t; document.body.append(a); a.select();
        try { document.execCommand('copy'); } catch { /* nada */ }
        a.remove();
    }
}
$('copiar-todo').addEventListener('click', async () => {
    const filas = estado.productos.map((p) => ({ nombre: p.nombre, costo: p.costo, r: resultado(p) })).filter((f) => f.r);
    await copiarTexto(textoParaCopiar(filas));
    avisar(`Copiaste ${filas.length} ${filas.length === 1 ? 'precio' : 'precios'}.`);
});
$('imprimir').addEventListener('click', () => window.print());
$('vaciar').addEventListener('click', () => {
    const antes = { productos: [...estado.productos], flete: estado.flete };
    estado.productos = []; estado.flete = '';
    guardar(); pintarTodo();
    avisar('Lista vacía.', () => { Object.assign(estado, antes); guardar(); pintarTodo(); });
    $('nuevo-nombre').focus();
});

// ── Pegar varios ───────────────────────────────────────────────────────────
const dPegar = $('dialogo-pegar');
$('abrir-pegar').addEventListener('click', () => { $('pegado').value = ''; vistaPegado(); dPegar.showModal(); $('pegado').focus(); });
function vistaPegado() {
    const l = leerPegado($('pegado').value);
    $('vista-pegado').textContent = $('pegado').value.trim()
        ? (l.length ? `${l.length} ${l.length === 1 ? 'producto' : 'productos'}: ${l.slice(0, 3).map((x) => `${x.nombre} (${soles(x.costo)})`).join(', ')}${l.length > 3 ? '…' : ''}` : 'No encontré ningún precio.')
        : '';
    $('pegar-agregar').disabled = !l.length;
}
$('pegado').addEventListener('input', vistaPegado);
dPegar.addEventListener('close', () => {
    if (dPegar.returnValue !== 'agregar') return;
    const l = leerPegado($('pegado').value);
    if (l.length) { agregar(l.map((x) => ({ ...x, pct: pctNuevo }))); avisar(`Agregaste ${l.length}.`); }
});

// ── Tu regla ───────────────────────────────────────────────────────────────
const dRegla = $('dialogo-regla');
function pintarEjemplos() {
    const R = estado.regla;
    const barato = calcular({ costo: 3, pct: 50, docena: true }, R);
    $('ej-docena').innerHTML = `Ej.: costó ${soles(3)}, +50 % → docena ${soles(barato.docenaUnidad)} c/u, suelto ${soles(barato.suelto)}.`;
    $('ej-redondeo').innerHTML = `Ej.: ${soles(4.36)} → <b>${soles(redondearPrecio(4.36, R))}</b> · ${soles(64.7)} → <b>${soles(redondearPrecio(64.7, R))}</b> · ${soles(203.85)} → <b>${soles(redondearPrecio(203.85, R))}</b>`;
}
function pintarRegla() {
    const R = estado.regla;
    pintarEjemplos();
    $('regla-8-on').checked = R.terminaEn8On !== false;
    $('regla-suelto').value = R.recargoSuelto;
    $('regla-al-sol').value = R.redondeoAlSolDesde;
    $('regla-en-8').value = R.terminaEn8Desde;
    $('regla-factura').checked = R.conFactura;
    $('regla-tarjeta-siempre').checked = R.tarjetaSiempre !== false;
    $('regla-tarjeta').value = R.tarjeta;
}
$('abrir-regla').addEventListener('click', () => { pintarRegla(); dRegla.showModal(); });
dRegla.addEventListener('input', (e) => {
    const t = e.target, R = estado.regla;
    if (t.id === 'regla-8-on') R.terminaEn8On = t.checked;
    else if (t.id === 'regla-suelto') R.recargoSuelto = num(t.value);
    else if (t.id === 'regla-al-sol') R.redondeoAlSolDesde = num(t.value);
    else if (t.id === 'regla-en-8') R.terminaEn8Desde = num(t.value) || 1e9;
    else if (t.id === 'regla-factura') R.conFactura = t.checked;
    else if (t.id === 'regla-tarjeta-siempre') R.tarjetaSiempre = t.checked;
    else if (t.id === 'regla-tarjeta') R.tarjeta = num(t.value);
    guardar();
    pintarEjemplos(); repintarFilas(); pintarResumen(); vistaPrevia(); pintarTarjeta();
});
$('regla-reiniciar').addEventListener('click', () => {
    const antes = copia(estado.regla);
    estado.regla = copia(REGLA_INICIAL);
    guardar(); pintarRegla(); repintarFilas(); pintarResumen(); vistaPrevia(); pintarTarjeta();
    avisar('Regla de siempre.', () => { estado.regla = antes; guardar(); pintarRegla(); repintarFilas(); pintarResumen(); });
});

pintarTodo();
vistaPrevia();
$('nuevo-nombre').focus({ preventScroll: true });
