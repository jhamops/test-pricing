/**
 * La pantalla. La cuenta vive en `precios.js` (con sus pruebas); aquí solo se escribe,
 * se muestra y se guarda en este equipo (localStorage).
 */
import { PORCENTAJES, REGLA_INICIAL, calcular, clave, escalonDe, fleteDelProducto, fletePorUnidad, leerPegado, redondearPrecio, textoParaCopiar } from './precios.js';

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
let estado = { productos: [], flete: '', regla: copia(REGLA_INICIAL) };
try {
    const g = JSON.parse(localStorage.getItem(GUARDADO) || 'null');
    if (g && Array.isArray(g.productos)) {
        estado = { ...estado, ...g, regla: { ...copia(REGLA_INICIAL), ...(g.regla || {}), ajustes: { ...REGLA_INICIAL.ajustes, ...(g.regla?.ajustes || {}) } } };
    } else {
        // Versiones anteriores (otra regla): se rescata solo la lista; la regla nueva ya
        // trae la comisión de tarjeta adentro.
        const viejo = JSON.parse(localStorage.getItem('illak-calculadora-v2') || localStorage.getItem('illak-calculadora-v1') || 'null');
        if (viejo && Array.isArray(viejo.productos)) {
            estado.productos = viejo.productos.map((p) => ({ id: p.id, nombre: p.nombre, costo: p.costo, cantidad: p.cantidad, pct: null, flete: '' }));
            estado.flete = viejo.flete || '';
        }
    }
} catch { /* sin guardado: se empieza de cero */ }
const guardar = () => { try { localStorage.setItem(GUARDADO, JSON.stringify(estado)); } catch { /* modo privado */ } };
// Escaleras de antes (que nadie tocó): pasan a la de 5 en 5.
if (['57,42,47,37,27', '58,38,52,38,31'].includes(estado.regla.escalera.map((e) => e.pct).join())) {
    estado.regla.escalera = copia(REGLA_INICIAL.escalera);
    guardar();
}
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
const fleteUnidad = () => fletePorUnidad(num(estado.flete), estado.productos);
/** El flete de cada unidad: el suyo propio (entre sus unidades) más su parte del flete de toda la compra. */
const fleteDe = (p) => fleteDelProducto(p.flete, p.cantidad) + (Number(p.cantidad) > 0 ? fleteUnidad() : 0);
const resultado = (p) => calcular({ costo: p.costo, pct: p.pct, flete: fleteDe(p) }, estado.regla);
/** El sugerido para ese costo (el botón que aparece marcado). */
const sugerido = (costo) => estado.regla.escalera[escalonDe(Number(costo) || 0, estado.regla)].pct;

/** Los botones de porcentaje (de 5 en 5) y «Otro»: el elegido en verde, el sugerido con borde. */
function htmlPorcentajes(elegido, costo) {
    const sug = sugerido(costo);
    const actual = elegido ?? sug;
    const esOtro = !PORCENTAJES.includes(Number(actual));
    return PORCENTAJES.map((n) => `<button type="button" class="pct${n === sug ? ' sugerido' : ''}" data-pct="${n}" aria-pressed="${!esOtro && Number(actual) === n}"${n === sug ? ' title="Sugerido para este costo"' : ''}>${n}</button>`).join('')
        + `<label class="pct-otro${esOtro ? ' activo' : ''}"><span>Otro</span><input data-pct-otro inputmode="decimal" value="${esOtro ? esc(actual) : ''}" placeholder="—" aria-label="Otro porcentaje"><span aria-hidden="true">%</span></label>`;
}
/** Marca el botón elegido sin repintar (no se pierde el cursor del «Otro»). */
function marcarPorcentajes(caja, elegido, costo) {
    // Sin precio de compra no hay sugerido: nada marcado hasta que lo escriba (o toque uno).
    const sug = Number(costo) > 0 ? sugerido(costo) : null;
    const actual = elegido ?? sug;
    const esOtro = actual != null && !PORCENTAJES.includes(Number(actual));
    caja.querySelectorAll('[data-pct]').forEach((b) => {
        b.setAttribute('aria-pressed', String(!esOtro && Number(b.dataset.pct) === Number(actual)));
        b.classList.toggle('sugerido', Number(b.dataset.pct) === sug);
    });
    caja.querySelector('.pct-otro').classList.toggle('activo', actual != null && esOtro);
}
const conTarjetaSiempre = () => estado.regla.tarjetaSiempre !== false && Number(estado.regla.tarjeta) > 0;

/** «de S/ 5 a S/ 20», «menos de S/ 5», «S/ 150 o más». */
function rango(i) {
    const e = estado.regla.escalera;
    const desde = i > 0 ? e[i - 1].hasta : 0;
    const hasta = e[i].hasta;
    if (hasta == null) return `S/ ${desde} o más`;
    return desde ? `de S/ ${desde} a S/ ${hasta}` : `menos de S/ ${hasta}`;
}
/** Un costo de ejemplo para cada escalón. */
function costoDeEjemplo(i) {
    const e = estado.regla.escalera;
    const desde = i > 0 ? e[i - 1].hasta : 0;
    const hasta = e[i].hasta;
    if (hasta == null) return Math.round(desde * 1.3);
    return desde ? Math.round((desde + hasta) / 2) : Math.max(1, Math.round(hasta * 0.6 * 10) / 10);
}
/** «docena S/ 4.80 c/u y suelto S/ 5.50» o «S/ 208». */
function precioCorto(r) {
    return r.porDocena ? `docena <b>${soles(r.docenaUnidad)}</b> c/u y suelto <b>${soles(r.suelto)}</b>` : `<b>${soles(r.suelto)}</b>`;
}

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
let pctNuevo = null; // el que tocó arriba (null = el sugerido)
function vistaPrevia() {
    const costo = num($('nuevo-costo').value);
    const caja = $('vista-previa');
    marcarPorcentajes($('nuevo-pct'), pctNuevo, costo);
    $('nuevo-sugerido').textContent = costo > 0 ? `sugerido ${sugerido(costo)} % (costó ${rango(escalonDe(costo, estado.regla))})` : '';
    if (!(costo > 0)) { caja.innerHTML = ''; caja.classList.remove('lleno'); return; }
    const r = calcular({ costo, pct: pctNuevo, flete: fleteDelProducto($('nuevo-flete').value.replace(',', '.'), num($('nuevo-cant').value)) }, estado.regla);
    caja.classList.add('lleno');
    caja.innerHTML = `
        <span class="chip">+${r.porcentaje} %${conTarjetaSiempre() ? ` + ${estado.regla.tarjeta} % tarjeta` : ''}</span>
        <span class="grande">${precioCorto(r)}</span>
        ${!r.porDocena && Math.abs(r.sinRedondear - r.suelto) >= 0.5 ? `<span class="antes-red">${soles(r.sinRedondear)} redondeado${estado.regla.terminaEn8On !== false && r.sinRedondear >= estado.regla.terminaEn8Desde ? ' a terminado en 8' : ''}</span>` : ''}
        <span class="gana-mini">ganas ${soles(r.porDocena ? r.ganas : r.ganasSuelto)}</span>
        ${r.costoConFlete !== costo ? `<span class="flete-mini">flete ${soles(r.costoConFlete - costo)} c/u → te costó ${soles(r.costoConFlete)}</span>` : ''}`;
}
['nuevo-costo', 'nuevo-cant', 'nuevo-flete'].forEach((id) => $(id).addEventListener('input', vistaPrevia));
$('nuevo-pct').innerHTML = htmlPorcentajes(null, 0);
$('nuevo-pct').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pct]');
    if (!b) return;
    pctNuevo = Number(b.dataset.pct);
    $('nuevo-pct').querySelector('[data-pct-otro]').value = '';
    vistaPrevia();
});
$('nuevo-pct').addEventListener('input', (e) => {
    if (!e.target.matches('[data-pct-otro]')) return;
    pctNuevo = e.target.value.trim() === '' ? null : num(e.target.value);
    vistaPrevia();
});
// La tarjeta: un solo número para todo (0 = no va en el precio).
const pintarTarjeta = () => { $('nuevo-tarjeta').value = conTarjetaSiempre() ? estado.regla.tarjeta : 0; };
pintarTarjeta();
$('nuevo-tarjeta').addEventListener('input', (e) => {
    const t = num(e.target.value);
    estado.regla.tarjeta = t > 0 ? t : estado.regla.tarjeta;
    estado.regla.tarjetaSiempre = t > 0;
    guardar(); vistaPrevia(); repintarResultados(); pintarResumen();
});
$('nuevo-nombre').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('nuevo-costo').focus(); } });

$('form-nuevo').addEventListener('submit', (e) => {
    e.preventDefault();
    const costo = num($('nuevo-costo').value);
    if (!(costo > 0)) { $('nuevo-costo').focus(); avisar('Escribe cuánto te costó.'); return; }
    agregar([{ nombre: $('nuevo-nombre').value.trim(), costo, cantidad: num($('nuevo-cant').value) || null, flete: $('nuevo-flete').value.trim(), pct: pctNuevo }]);
    $('nuevo-nombre').value = ''; $('nuevo-costo').value = ''; $('nuevo-cant').value = ''; $('nuevo-flete').value = '';
    pctNuevo = null; $('nuevo-pct').querySelector('[data-pct-otro]').value = '';
    vistaPrevia();
    $('nuevo-nombre').focus();
});

function agregar(lista) {
    const nuevos = lista.map((x, i) => ({
        id: siguienteId++, nombre: x.nombre || `Producto ${estado.productos.length + i + 1}`,
        costo: x.costo, cantidad: x.cantidad, pct: x.pct ?? null, flete: x.flete || '',
    }));
    estado.productos = [...nuevos.reverse(), ...estado.productos]; // lo último, arriba
    guardar();
    pintarTodo(new Set(nuevos.map((p) => p.id)));
}

// ── La lista ───────────────────────────────────────────────────────────────
function htmlResultado(p) {
    const r = resultado(p);
    if (!r) return '<p class="falta">Escribe lo que costó.</p>';
    const siempre = conTarjetaSiempre();
    const avisarTarjeta = !siempre && Number(estado.regla.tarjeta) > 0;
    const termina8 = !r.porDocena && estado.regla.terminaEn8On !== false && r.sinRedondear >= estado.regla.terminaEn8Desde && Math.abs(r.sinRedondear - r.suelto) >= 0.5;
    return `
        <p class="por-que">Le sumas <b>${r.porcentaje} %</b>${p.pct == null ? ' (el sugerido)' : ''}${siempre ? ` + <b>${estado.regla.tarjeta} %</b> de tarjeta` : ''}</p>
        <div class="precios">
            ${r.porDocena ? `<div class="precio docena"><span>Docena</span><strong>${soles(r.docena)}</strong><small>${soles(r.docenaUnidad)} c/u</small></div>` : ''}
            <div class="precio suelto${r.porDocena ? '' : ' solo'}"><span>${r.porDocena ? 'Suelto' : 'Precio'}</span><strong>${soles(r.suelto)}</strong>${termina8 ? `<small>en vez de ${soles(r.sinRedondear)}: termina en 8, ya trae su rebaja</small>` : ''}</div>
        </div>
        <p class="gana">Ganas <b>${soles(r.porDocena ? r.ganas : r.ganasSuelto)}</b> c/u${r.porDocena ? ' por docena' : ''}
            · te queda <b>${soles(r.teQueda)}</b>${estado.regla.conFactura ? ' <small>(sin IGV)</small>' : ''}
            ${siempre ? `<br><small>Ya descontada la tarjeta (${soles(r.comision)}). Si te paga en efectivo o Yape, te queda ${soles(r.enEfectivo)}.</small>` : ''}
            ${avisarTarjeta ? `<br><small>Si te paga con tarjeta te queda ${soles(r.conTarjeta)}</small>` : ''}</p>
        ${r.costoConFlete !== Number(p.costo) ? `<p class="con-flete">Con flete te costó ${soles(r.costoConFlete)} c/u</p>` : ''}
        <button type="button" class="clave" data-accion="clave" title="Copiar la clave">
            <span>Clave</span><code>${esc(clave(p.costo, r.porcentaje))}</code><i aria-hidden="true">⧉</i>
        </button>`;
}

function htmlProducto(p, nuevo) {
    return `
    <li class="producto${nuevo ? ' nuevo' : ''}" data-id="${p.id}">
        <div class="fila-tope">
            <input class="nombre" data-campo="nombre" value="${esc(p.nombre)}" aria-label="Nombre del producto">
            <button type="button" class="quitar" data-accion="quitar" aria-label="Quitar ${esc(p.nombre)}">✕</button>
        </div>
        <div class="datos">
            <label>Precio de compra<span class="con-sol"><span aria-hidden="true">S/</span><input data-campo="costo" inputmode="decimal" value="${esc(p.costo)}"></span></label>
            <label>Flete<span class="con-sol"><span aria-hidden="true">S/</span><input data-campo="flete" inputmode="decimal" placeholder="—" value="${esc(p.flete ?? '')}" aria-label="Flete que pagaste por este producto"></span></label>
        </div>
        <div class="chips chico" role="group" aria-label="Cuánto le sumas">${htmlPorcentajes(p.pct, p.costo)}</div>
        <div class="resultado">${htmlResultado(p)}</div>
        <label class="cant-chica">Cantidad <small>(opcional)</small><input data-campo="cantidad" inputmode="numeric" placeholder="—" value="${p.cantidad ?? ''}"></label>
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
const repintarResultados = () => document.querySelectorAll('.producto').forEach((li) => {
    const p = estado.productos.find((x) => x.id === Number(li.dataset.id));
    if (p) li.querySelector('.resultado').innerHTML = htmlResultado(p);
});

const ICONOS = {
    caja: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/></svg>',
    sube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/></svg>',
    moneda: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6.5V8M12 16v1.5"/></svg>',
};

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
        ganas += (r.porDocena ? r.ganas : r.ganasSuelto) * n;
        queda += r.teQueda * n;
    }
    t.hidden = false;
    t.innerHTML = `
        <div class="cifra neutro"><span class="icono" aria-hidden="true">${ICONOS.caja}</span><div><span>Invertiste</span><strong>${soles(invertido)}</strong></div></div>
        <div class="cifra ok"><span class="icono" aria-hidden="true">${ICONOS.sube}</span><div><span>Si vendes todo, ganas</span><strong>${soles(ganas)}</strong></div></div>
        <div class="cifra ok"><span class="icono" aria-hidden="true">${ICONOS.moneda}</span><div><span>Te queda${estado.regla.conFactura ? ' (sin IGV)' : ''}</span><strong>${soles(queda)}</strong></div></div>`;
}

// Escribir en una tarjeta: solo se repinta su resultado (no se pierde el cursor).
$('lista').addEventListener('input', (e) => {
    const li = e.target.closest('.producto');
    if (li && e.target.matches('[data-pct-otro]')) {
        const q = estado.productos.find((x) => x.id === Number(li.dataset.id));
        if (!q) return;
        q.pct = e.target.value.trim() === '' ? null : num(e.target.value);
        guardar();
        marcarPorcentajes(li.querySelector('.chips'), q.pct, q.costo);
        li.querySelector('.resultado').innerHTML = htmlResultado(q);
        pintarResumen();
        return;
    }
    const campo = e.target.dataset.campo;
    if (!li || !campo) return;
    const p = estado.productos.find((x) => x.id === Number(li.dataset.id));
    if (!p) return;
    const v = e.target.value;
    if (campo === 'nombre') p.nombre = v;
    else if (campo === 'costo') p.costo = num(v);
    else if (campo === 'cantidad') p.cantidad = num(v) || null;
    else if (campo === 'flete') p.flete = v.trim();
    guardar();
    if (campo === 'cantidad' && num(estado.flete) > 0) repintarResultados();
    else if (campo !== 'nombre') li.querySelector('.resultado').innerHTML = htmlResultado(p);
    if (campo === 'costo') marcarPorcentajes(li.querySelector('.chips'), p.pct, p.costo);
    pintarResumen();
});

$('lista').addEventListener('click', async (e) => {
    const chip = e.target.closest('[data-pct]');
    if (chip) {
        const lic = chip.closest('.producto');
        const q = estado.productos.find((x) => x.id === Number(lic.dataset.id));
        if (!q) return;
        q.pct = Number(chip.dataset.pct);
        lic.querySelector('[data-pct-otro]').value = '';
        guardar();
        marcarPorcentajes(lic.querySelector('.chips'), q.pct, q.costo);
        lic.querySelector('.resultado').innerHTML = htmlResultado(q);
        pintarResumen();
        return;
    }
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
    guardar(); repintarResultados(); pintarResumen();
});

// ── Copiar, imprimir, empezar otra ─────────────────────────────────────────
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

// ── Tu regla (con ejemplos que se actualizan solos) ────────────────────────
const dRegla = $('dialogo-regla');
function pintarEscalera() {
    const R = estado.regla;
    $('regla-escalera').innerHTML = R.escalera.map((e, i) => {
        const c = costoDeEjemplo(i);
        const r = calcular({ costo: c }, R);
        return `
        <div class="escalon">
            <div class="escalon-tope">
                <span>Si costó <b>${rango(i)}</b></span>
                <span class="con-sol mini"><span aria-hidden="true">+</span><input data-e="${i}" inputmode="decimal" value="${e.pct}" aria-label="Le sumas, si costó ${rango(i)}"><span aria-hidden="true">%</span></span>
            </div>
            <p class="ejemplo">Ej.: si te costó ${soles(c)} → ${precioCorto(r)}</p>
        </div>`;
    }).join('');
}
function pintarEjemplos() {
    const R = estado.regla;
    const barato = calcular({ costo: 3 }, R);
    $('ej-docena').innerHTML = barato.porDocena
        ? `Ej.: costó ${soles(3)} → la docena a ${soles(barato.docena)} (${soles(barato.docenaUnidad)} c/u) y suelto ${soles(barato.suelto)}.`
        : 'No sacas precio por docena: cada producto tiene un solo precio.';
    const con8 = R.terminaEn8On !== false;
    $('ej-redondeo').innerHTML = `Ej.: ${soles(4.36)} → <b>${soles(redondearPrecio(4.36, R))}</b> · ${soles(64.7)} → <b>${soles(redondearPrecio(64.7, R))}</b> · ${soles(203.85)} → <b>${soles(redondearPrecio(203.85, R))}</b>${con8 ? ' <small>(termina en 8)</small>' : ' <small>(al sol: sin el 8)</small>'}`;
}
function pintarRegla() {
    const R = estado.regla;
    pintarEscalera(); pintarEjemplos();
    $('regla-docena').value = R.docenaHasta;
    $('regla-docena-on').checked = R.porDocenaOn !== false;
    $('regla-8-on').checked = R.terminaEn8On !== false;
    $('linea-docena').hidden = R.porDocenaOn === false;
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
    if (t.dataset.e != null) R.escalera[Number(t.dataset.e)].pct = num(t.value);
    else if (t.id === 'regla-docena') R.docenaHasta = num(t.value);
    else if (t.id === 'regla-docena-on') { R.porDocenaOn = t.checked; $('linea-docena').hidden = !t.checked; }
    else if (t.id === 'regla-8-on') R.terminaEn8On = t.checked;
    else if (t.id === 'regla-suelto') R.recargoSuelto = num(t.value);
    else if (t.id === 'regla-al-sol') R.redondeoAlSolDesde = num(t.value);
    else if (t.id === 'regla-en-8') R.terminaEn8Desde = num(t.value) || 1e9;
    else if (t.id === 'regla-factura') R.conFactura = t.checked;
    else if (t.id === 'regla-tarjeta-siempre') R.tarjetaSiempre = t.checked;
    else if (t.id === 'regla-tarjeta') R.tarjeta = num(t.value);
    guardar();
    // Los ejemplos se actualizan sin repintar los campos (no se pierde el cursor).
    document.querySelectorAll('#regla-escalera .escalon .ejemplo').forEach((p, i) => {
        const c = costoDeEjemplo(i);
        p.innerHTML = `Ej.: si te costó ${soles(c)} → ${precioCorto(calcular({ costo: c }, R))}`;
    });
    pintarEjemplos(); repintarResultados(); pintarResumen(); vistaPrevia(); pintarTarjeta();
    // El sugerido pudo cambiar: se vuelve a marcar en cada tarjeta.
    document.querySelectorAll('.producto').forEach((li) => {
        const p = estado.productos.find((x) => x.id === Number(li.dataset.id));
        if (p) marcarPorcentajes(li.querySelector('.chips'), p.pct, p.costo);
    });
});
$('regla-reiniciar').addEventListener('click', () => {
    const antes = copia(estado.regla);
    estado.regla = copia(REGLA_INICIAL);
    guardar(); pintarRegla(); repintarResultados(); pintarResumen(); vistaPrevia();
    avisar('Volviste a la regla de siempre.', () => { estado.regla = antes; guardar(); pintarRegla(); repintarResultados(); pintarResumen(); });
});

pintarTodo();
$('nuevo-nombre').focus({ preventScroll: true });
