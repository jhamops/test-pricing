/**
 * La pantalla. La cuenta vive en `precios.js` (con sus pruebas); aquí solo se escribe,
 * se muestra y se guarda en este equipo (localStorage).
 */
import { REGLA_INICIAL, calcular, clave, familiaDe, fletePorUnidad, leerPegado, textoParaCopiar } from './precios.js';

const GUARDADO = 'illak-calculadora-v1';
const $ = (id) => document.getElementById(id);
const soles = (n) => `S/ ${Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (t) => {
    const n = Number(String(t ?? '').replace(',', '.').replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : 0;
};
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const copia = (o) => JSON.parse(JSON.stringify(o));

// ── Estado (se guarda en este equipo) ──────────────────────────────────────
let estado = { productos: [], flete: '', regla: copia(REGLA_INICIAL) };
try {
    const g = JSON.parse(localStorage.getItem(GUARDADO) || 'null');
    if (g && Array.isArray(g.productos)) estado = { ...estado, ...g, regla: { ...copia(REGLA_INICIAL), ...(g.regla || {}) } };
} catch { /* sin guardado: se empieza de cero */ }
const guardar = () => { try { localStorage.setItem(GUARDADO, JSON.stringify(estado)); } catch { /* modo privado */ } };
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

// ── La cuenta de un producto ───────────────────────────────────────────────
const familiaDelProducto = (p) => {
    if (p.familiaId === 'otro') return null;
    if (p.familiaId && p.familiaId !== 'auto') return estado.regla.familias.find((f) => f.id === p.familiaId) || null;
    return familiaDe(p.nombre, estado.regla.familias);
};
const fleteUnidad = () => fletePorUnidad(num(estado.flete), estado.productos);
const resultado = (p) => calcular({
    costo: p.costo, familia: familiaDelProducto(p), propio: p.propio,
    flete: Number(p.cantidad) > 0 ? fleteUnidad() : 0,
}, estado.regla);

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

// ── Lo que se ve mientras escribe arriba ───────────────────────────────────
function vistaPrevia() {
    const costo = num($('nuevo-costo').value);
    const caja = $('vista-previa');
    if (!(costo > 0)) { caja.innerHTML = ''; caja.classList.remove('lleno'); return; }
    const fam = familiaDe($('nuevo-nombre').value, estado.regla.familias);
    const r = calcular({ costo, familia: fam }, estado.regla);
    caja.classList.add('lleno');
    caja.innerHTML = `
        <span class="chip">${fam ? esc(fam.nombre) : 'Por costo'} · +${r.porcentaje} %</span>
        ${r.docena != null ? `<span>Docena <b>${soles(r.docenaUnidad)}</b> c/u</span>` : ''}
        <span>Suelto <b>${soles(r.suelto)}</b></span>
        <span class="gana-mini">ganas ${soles(r.soloSuelto ? r.ganasSuelto : r.ganas)}</span>`;
}
['nuevo-nombre', 'nuevo-costo'].forEach((id) => $(id).addEventListener('input', vistaPrevia));

// Enter en el nombre pasa al costo.
$('nuevo-nombre').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('nuevo-costo').focus(); } });

$('form-nuevo').addEventListener('submit', (e) => {
    e.preventDefault();
    const costo = num($('nuevo-costo').value);
    if (!(costo > 0)) { $('nuevo-costo').focus(); avisar('Escribe cuánto te costó.'); return; }
    agregar([{ nombre: $('nuevo-nombre').value.trim(), costo, cantidad: num($('nuevo-cant').value) || null }]);
    $('nuevo-nombre').value = ''; $('nuevo-costo').value = ''; $('nuevo-cant').value = '';
    vistaPrevia();
    $('nuevo-nombre').focus();
});

function agregar(lista) {
    const nuevos = lista.map((x, i) => ({
        id: siguienteId++, nombre: x.nombre || `Producto ${estado.productos.length + i + 1}`,
        costo: x.costo, cantidad: x.cantidad, familiaId: 'auto', propio: null,
    }));
    estado.productos = [...nuevos.reverse(), ...estado.productos]; // lo último, arriba
    guardar();
    pintarTodo(new Set(nuevos.map((p) => p.id)));
}

// ── La lista ───────────────────────────────────────────────────────────────
function opcionesFamilia(p) {
    // Se muestra la familia que le toca (la del nombre si no la cambió); elegir otra la fija.
    const actual = familiaDelProducto(p);
    const sel = actual ? actual.id : 'otro';
    return [
        ...estado.regla.familias.map((f) => `<option value="${f.id}"${sel === f.id ? ' selected' : ''}>${esc(f.nombre)}</option>`),
        `<option value="otro"${sel === 'otro' ? ' selected' : ''}>Otro (por costo)</option>`,
    ].join('');
}

function htmlResultado(p) {
    const r = resultado(p);
    if (!r) return '<p class="falta">Escribe lo que costó.</p>';
    const tarjeta = estado.regla.tarjeta > 0 && estado.regla.tarjetaOn !== false;
    const venta = r.soloSuelto ? 'suelto' : 'por docena';
    return `
        <div class="precios">
            ${r.docena != null ? `<div class="precio docena"><span>Docena</span><strong>${soles(r.docena)}</strong><small>${soles(r.docenaUnidad)} c/u</small></div>` : ''}
            <div class="precio suelto${r.docena == null ? ' solo' : ''}"><span>${r.docena == null ? 'Precio' : 'Suelto'}</span><strong>${soles(r.suelto)}</strong>${r.docena == null ? '<small>se vende suelto</small>' : ''}</div>
        </div>
        <p class="gana">Ganas <b>${soles(r.soloSuelto ? r.ganasSuelto : r.ganas)}</b> c/u ${venta}
            · te queda <b>${soles(r.teQueda)}</b>${estado.regla.conFactura ? ' <small>(sin IGV)</small>' : ''}
            ${tarjeta ? `<br><small>Si te paga con tarjeta te queda ${soles(r.conTarjeta)}</small>` : ''}</p>
        ${r.costoConFlete !== Number(p.costo) ? `<p class="con-flete">Con flete te costó ${soles(r.costoConFlete)} c/u</p>` : ''}
        <button type="button" class="clave" data-accion="clave" title="Copiar la clave">
            <span>Clave</span><code>${esc(clave(p.costo, r.porcentaje))}</code><i aria-hidden="true">⧉</i>
        </button>`;
}

function htmlProducto(p, nuevo) {
    const r = resultado(p);
    const fam = familiaDelProducto(p);
    const pctBase = r ? r.porcentaje : (fam ? fam.docena : '');
    return `
    <li class="producto${nuevo ? ' nuevo' : ''}" data-id="${p.id}">
        <div class="fila-tope">
            <input class="nombre" data-campo="nombre" value="${esc(p.nombre)}" aria-label="Nombre del producto">
            <button type="button" class="quitar" data-accion="quitar" aria-label="Quitar ${esc(p.nombre)}">✕</button>
        </div>
        <div class="datos">
            <label>Costo c/u<span class="con-sol"><span aria-hidden="true">S/</span><input data-campo="costo" inputmode="decimal" value="${esc(p.costo)}"></span></label>
            <label>Cantidad<input data-campo="cantidad" inputmode="numeric" placeholder="—" value="${p.cantidad ?? ''}"></label>
            <label>Familia<select data-campo="familiaId">${opcionesFamilia(p)}</select></label>
            <label>Le sumas<span class="con-sol"><input data-campo="propio" inputmode="decimal" placeholder="${pctBase}" value="${p.propio ?? ''}" aria-label="Porcentaje para este producto"><span aria-hidden="true">%</span></span></label>
        </div>
        <div class="resultado">${htmlResultado(p)}</div>
    </li>`;
}

function pintarTodo(nuevos = new Set()) {
    const hay = estado.productos.length > 0;
    $('lista').innerHTML = estado.productos.map((p) => htmlProducto(p, nuevos.has(p.id))).join('');
    $('barra').hidden = !hay;
    $('vacio').hidden = hay;
    $('flete').value = estado.flete || '';
    pintarResumen();
}

function pintarResumen() {
    const ps = estado.productos;
    $('cuenta').innerHTML = `<b>${ps.length}</b> ${ps.length === 1 ? 'producto' : 'productos'}`;
    const fu = fleteUnidad();
    const conCant = ps.filter((p) => Number(p.cantidad) > 0);
    const nota = $('nota-flete');
    if (num(estado.flete) > 0) {
        nota.hidden = false;
        nota.textContent = fu > 0
            ? `El flete sale a ${soles(fu)} por unidad (entre ${conCant.reduce((s, p) => s + Number(p.cantidad), 0)} unidades).${conCant.length < ps.length ? ' A los que no tienen cantidad no les toca flete.' : ''}`
            : 'Pon la cantidad de cada producto para repartir el flete.';
    } else nota.hidden = true;

    const t = $('totales');
    if (!conCant.length) {
        t.hidden = !ps.length;
        t.innerHTML = '<p>Pon la <b>cantidad</b> que compraste y te digo cuánto ganas con toda la compra.</p>';
        return;
    }
    let invertido = 0, ganas = 0, queda = 0;
    for (const p of conCant) {
        const r = resultado(p);
        if (!r) continue;
        const n = Number(p.cantidad);
        invertido += r.costoConFlete * n;
        ganas += (r.soloSuelto ? r.ganasSuelto : r.ganas) * n;
        queda += r.teQueda * n;
    }
    t.hidden = false;
    t.innerHTML = `
        <div class="cifra neutro"><span class="icono" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/></svg></span><div><span>Invertiste</span><strong>${soles(invertido)}</strong></div></div>
        <div class="cifra ok"><span class="icono" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/></svg></span><div><span>Si vendes todo, ganas</span><strong>${soles(ganas)}</strong></div></div>
        <div class="cifra ok"><span class="icono" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6.5V8M12 16v1.5"/></svg></span><div><span>Te queda${estado.regla.conFactura ? ' (sin IGV)' : ''}</span><strong>${soles(queda)}</strong></div></div>`;
}

// Escribir en una tarjeta: solo se repinta su resultado (no se pierde el cursor).
$('lista').addEventListener('input', (e) => {
    const li = e.target.closest('.producto');
    const campo = e.target.dataset.campo;
    if (!li || !campo) return;
    const p = estado.productos.find((x) => x.id === Number(li.dataset.id));
    if (!p) return;
    const v = e.target.value;
    if (campo === 'nombre') p.nombre = v;
    else if (campo === 'costo') p.costo = num(v);
    else if (campo === 'cantidad') p.cantidad = num(v) || null;
    else if (campo === 'propio') p.propio = v.trim() === '' ? null : num(v);
    else if (campo === 'familiaId') p.familiaId = v;
    guardar();
    if (campo === 'cantidad' && num(estado.flete) > 0) {
        // Cambia el reparto del flete de todos.
        document.querySelectorAll('.producto').forEach((otro) => {
            const q = estado.productos.find((x) => x.id === Number(otro.dataset.id));
            if (q) otro.querySelector('.resultado').innerHTML = htmlResultado(q);
        });
    } else {
        li.querySelector('.resultado').innerHTML = htmlResultado(p);
    }
    if (campo === 'nombre' || campo === 'familiaId') {
        const sel = li.querySelector('select');
        if (campo === 'nombre') sel.innerHTML = opcionesFamilia(p);
        const r = resultado(p);
        if (r) li.querySelector('[data-campo="propio"]').placeholder = r.porcentaje;
    }
    pintarResumen();
});
// El select dispara «change», no siempre «input».
$('lista').addEventListener('change', (e) => { if (e.target.tagName === 'SELECT') e.target.dispatchEvent(new Event('input', { bubbles: true })); });

$('lista').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-accion]');
    if (!b) return;
    const li = b.closest('.producto');
    const p = estado.productos.find((x) => x.id === Number(li.dataset.id));
    if (!p) return;
    if (b.dataset.accion === 'quitar') {
        const antes = [...estado.productos];
        estado.productos = estado.productos.filter((x) => x.id !== p.id);
        guardar(); pintarTodo();
        avisar(`Quitaste «${p.nombre}».`, () => { estado.productos = antes; guardar(); pintarTodo(); });
    }
    if (b.dataset.accion === 'clave') {
        const r = resultado(p);
        if (r) { await copiarTexto(clave(p.costo, r.porcentaje)); avisar('Clave copiada.'); }
    }
});

$('flete').addEventListener('input', (e) => {
    estado.flete = e.target.value;
    guardar();
    document.querySelectorAll('.producto').forEach((li) => {
        const p = estado.productos.find((x) => x.id === Number(li.dataset.id));
        if (p) li.querySelector('.resultado').innerHTML = htmlResultado(p);
    });
    pintarResumen();
});

// ── Copiar, imprimir, empezar otra ─────────────────────────────────────────
async function copiarTexto(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch {
        const a = document.createElement('textarea');
        a.value = t; document.body.append(a); a.select();
        try { document.execCommand('copy'); } catch { /* nada */ }
        a.remove();
        return true;
    }
}
$('copiar-todo').addEventListener('click', async () => {
    const filas = estado.productos.map((p) => ({ nombre: p.nombre, costo: p.costo, r: resultado(p) })).filter((f) => f.r);
    await copiarTexto(textoParaCopiar(filas));
    avisar(`Copiaste ${filas.length} ${filas.length === 1 ? 'precio' : 'precios'}: pégalos en WhatsApp o donde quieras.`);
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
        ? (l.length ? `Encontré ${l.length} ${l.length === 1 ? 'producto' : 'productos'}: ${l.slice(0, 3).map((x) => `${x.nombre} (${soles(x.costo)})`).join(', ')}${l.length > 3 ? '…' : ''}` : 'No encontré ningún costo. Pon el nombre y el precio en cada línea.')
        : '';
    $('pegar-agregar').disabled = !l.length;
}
$('pegado').addEventListener('input', vistaPegado);
dPegar.addEventListener('close', () => {
    if (dPegar.returnValue !== 'agregar') return;
    const l = leerPegado($('pegado').value);
    if (l.length) { agregar(l); avisar(`Agregaste ${l.length} ${l.length === 1 ? 'producto' : 'productos'}.`); }
});

// ── Tu regla ───────────────────────────────────────────────────────────────
const dRegla = $('dialogo-regla');
function pintarRegla() {
    const R = estado.regla;
    $('regla-familias').innerHTML = R.familias.map((f, i) => `
        <tr><th scope="row">${esc(f.nombre)}${f.soloSuelto ? ' <small>(se vende suelto)</small>' : ''}</th>
            <td><span class="con-sol mini"><input data-f="${i}" data-k="docena" inputmode="decimal" value="${f.docena}" aria-label="${esc(f.nombre)}: le sumas"><span aria-hidden="true">%</span></span></td>
            <td>${f.soloSuelto ? '—' : `<span class="con-sol mini"><input data-f="${i}" data-k="suelto" inputmode="decimal" value="${f.suelto}" aria-label="${esc(f.nombre)}: suelto, más"><span aria-hidden="true">%</span></span>`}</td></tr>`).join('');
    let desde = 0;
    $('regla-escalera').innerHTML = R.escalera.map((e, i) => {
        const fila = `<tr><th scope="row">${e.hasta == null ? `S/ ${desde} o más` : `${desde ? `S/ ${desde} a` : 'Menos de'} S/ ${e.hasta}`}</th>
            <td><span class="con-sol mini"><input data-e="${i}" inputmode="decimal" value="${e.docena}" aria-label="Le sumas"><span aria-hidden="true">%</span></span></td></tr>`;
        desde = e.hasta ?? desde;
        return fila;
    }).join('');
    $('regla-factura').checked = R.conFactura;
    $('regla-tarjeta-on').checked = R.tarjetaOn !== false && R.tarjeta > 0;
    $('regla-tarjeta').value = R.tarjeta;
}
$('abrir-regla').addEventListener('click', () => { pintarRegla(); dRegla.showModal(); });
dRegla.addEventListener('input', (e) => {
    const t = e.target, R = estado.regla;
    if (t.dataset.f != null) R.familias[Number(t.dataset.f)][t.dataset.k] = num(t.value);
    else if (t.dataset.e != null) R.escalera[Number(t.dataset.e)].docena = num(t.value);
    else if (t.id === 'regla-factura') R.conFactura = t.checked;
    else if (t.id === 'regla-tarjeta-on') R.tarjetaOn = t.checked;
    else if (t.id === 'regla-tarjeta') R.tarjeta = num(t.value);
    guardar(); pintarTodo(); vistaPrevia();
});
$('regla-reiniciar').addEventListener('click', () => {
    const antes = copia(estado.regla);
    estado.regla = copia(REGLA_INICIAL);
    guardar(); pintarRegla(); pintarTodo(); vistaPrevia();
    avisar('Volviste a la regla del cuaderno.', () => { estado.regla = antes; guardar(); pintarRegla(); pintarTodo(); });
});

pintarTodo();
$('nuevo-nombre').focus({ preventScroll: true });
