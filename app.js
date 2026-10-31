// Configuración de tu proyecto de Firebase
const firebaseConfig = {
    apiKey: "AIzaSy...", // Tus datos reales
    authDomain: "tu-proyecto.firebaseapp.com",
    projectId: "tu-proyecto",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123:web:abc"
};

// Inicializar Firebase y Firestore
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let inventario = [];
let historial = [];

// Elementos del DOM
const operatorInput = document.getElementById('operator-name');
const form = document.getElementById('inventory-form');
const editIdInput = document.getElementById('edit-id');
const nameInput = document.getElementById('prod-name');
const categoryInput = document.getElementById('prod-category');
const priceInput = document.getElementById('prod-price');
const stockInput = document.getElementById('prod-stock');
const btnSave = document.getElementById('btn-save');
const btnCancel = document.getElementById('btn-cancel');

const outForm = document.getElementById('out-form');
const outSelect = document.getElementById('out-select');
const outQtyInput = document.getElementById('out-qty');

const tbody = document.getElementById('inventory-tbody');
const surtidoTbody = document.getElementById('surtido-tbody');
const emptyState = document.getElementById('empty-state');
const historyTbody = document.getElementById('history-tbody');
const emptyHistory = document.getElementById('empty-history');
const btnClearHistory = document.getElementById('btn-clear-history');
const searchInput = document.getElementById('search-input');

operatorInput.value = localStorage.getItem('last_operator') || 'Operador 1';
operatorInput.addEventListener('change', () => {
    localStorage.setItem('last_operator', operatorInput.value.trim());
});

function obtenerDetallesDispositivo() {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return "📱 Android";
    if (/iPhone|iPad|iPod/i.test(ua)) return "📱 iPhone/iOS";
    if (/windows/i.test(ua)) return "💻 Windows PC";
    if (/mac/i.test(ua)) return "💻 Mac";
    return "📱 Dispositivo Móvil";
}

// Registrar logs en Firebase
function registrarLog(usuario, accion, detalle) {
    const ahora = new Date();
    const fechaHora = ahora.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'medium' });
    const dispositivo = obtenerDetallesDispositivo();

    db.collection('historial').add({
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        fechaHora,
        usuario: usuario || 'Anónimo',
        dispositivo,
        accion,
        detalle
    });
}

// Sincronización en tiempo real con Firestore (Colección 'inventario')
db.collection('inventario').onSnapshot((snapshot) => {
    inventario = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
    renderTable(searchInput ? searchInput.value : '');
});

// Sincronización en tiempo real con Firestore (Historial)
db.collection('historial').orderBy('timestamp', 'desc').limit(50).onSnapshot((snapshot) => {
    historial = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
    renderHistory();
});

// Renderizar Inventario principal
function renderTable(filter = '') {
    tbody.innerHTML = '';
    const productosFiltrados = inventario.filter(p => 
        p.nombre.toLowerCase().includes(filter.toLowerCase()) ||
        p.categoria.toLowerCase().includes(filter.toLowerCase())
    );

    if (productosFiltrados.length === 0) {
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
        productosFiltrados.forEach(prod => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${prod.nombre}</strong></td>
                <td><span class="badge">${prod.categoria}</span></td>
                <td>$${Number(prod.precio).toLocaleString('es-CO')}</td>
                <td><strong>${prod.stock}</strong> u.</td>
                <td>$${(prod.precio * prod.stock).toLocaleString('es-CO')}</td>
                <td class="actions-cell">
                    <button class="btn-icon edit" onclick="startEdit('${prod.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-icon delete" onclick="deleteProduct('${prod.id}')" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    updateStats();
    updateOutSelectOptions();
    renderSurtidoTable();
}

// Renderizar Tabla de Surtido Masivo
function renderSurtidoTable() {
    if (!surtidoTbody) return;
    surtidoTbody.innerHTML = '';

    if (inventario.length === 0) {
        surtidoTbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">No hay productos para surtir.</td></tr>`;
        return;
    }

    inventario.forEach(prod => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong>${prod.nombre}</strong><br>
                <small style="color:var(--text-muted);">Stock actual: ${prod.stock} | Ant: $${Number(prod.precio).toLocaleString('es-CO')}</small>
            </td>
            <td>
                <input type="number" id="add-qty-${prod.id}" min="0" placeholder="+ Cantidad">
            </td>
            <td>
                <input type="number" id="new-price-${prod.id}" min="0" step="50" placeholder="${prod.precio}">
            </td>
            <td>
                <button type="button" class="btn btn-success btn-sm" onclick="aplicarSurtido('${prod.id}')">
                    <i class="fa-solid fa-check"></i> Aplicar
                </button>
            </td>
        `;
        surtidoTbody.appendChild(tr);
    });
}

// Procesar el surtido rápido en Firebase
async function aplicarSurtido(id) {
    const operador = operatorInput.value.trim() || 'Operador';
    const prod = inventario.find(p => p.id === id);
    if (!prod) return;

    const inputQty = document.getElementById(`add-qty-${id}`);
    const inputPrice = document.getElementById(`new-price-${id}`);

    const cantidadASumar = parseInt(inputQty.value) || 0;
    const precioNuevo = parseFloat(inputPrice.value);

    if (cantidadASumar <= 0 && isNaN(precioNuevo)) {
        alert('Ingresa una cantidad a sumar o un precio nuevo.');
        return;
    }

    let nuevoStock = prod.stock;
    let nuevoPrecio = prod.precio;
    let detalleCambios = [];

    if (cantidadASumar > 0) {
        nuevoStock += cantidadASumar;
        detalleCambios.push(`Sumó +${cantidadASumar} u. (Stock total: ${nuevoStock})`);
    }

    if (!isNaN(precioNuevo) && precioNuevo !== prod.precio) {
        const precioAnterior = prod.precio;
        nuevoPrecio = precioNuevo;
        const diferencia = precioNuevo > precioAnterior ? 'subió' : 'bajó';
        detalleCambios.push(`Precio ${diferencia} de $${precioAnterior.toLocaleString('es-CO')} a $${precioNuevo.toLocaleString('es-CO')}`);
    }

    if (detalleCambios.length > 0) {
        await db.collection('inventario').doc(id).update({
            stock: nuevoStock,
            precio: nuevoPrecio
        });

        registrarLog(operador, 'Surtido / Actualización', `En '${prod.nombre}': ${detalleCambios.join(' | ')}`);
        alert(`¡Surtido aplicado correctamente a ${prod.nombre}!`);
    }
}

// Renderizar Historial
function renderHistory() {
    if (!historyTbody) return;
    historyTbody.innerHTML = '';
    if (historial.length === 0) {
        if (emptyHistory) emptyHistory.style.display = 'block';
    } else {
        if (emptyHistory) emptyHistory.style.display = 'none';
        historial.forEach(item => {
            const tr = document.createElement('tr');
            let badgeClass = 'action-edit';
            if (item.accion.includes('Creación') || item.accion.includes('Suma') || item.accion.includes('Surtido')) badgeClass = 'action-add';
            if (item.accion.includes('Retiro') || item.accion.includes('Eliminado')) badgeClass = 'action-out';

            tr.innerHTML = `
                <td><i class="fa-regular fa-clock"></i> ${item.fechaHora || ''}</td>
                <td><strong><i class="fa-solid fa-user"></i> ${item.usuario}</strong></td>
                <td><small>${item.dispositivo}</small></td>
                <td><span class="badge-action ${badgeClass}">${item.accion}:</span> ${item.detalle}</td>
            `;
            historyTbody.appendChild(tr);
        });
    }
}

function updateOutSelectOptions() {
    if (!outSelect) return;
    outSelect.innerHTML = '<option value="">-- Seleccionar --</option>';
    inventario.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = `${p.nombre} (Stock: ${p.stock})`;
        outSelect.appendChild(option);
    });
}

function updateStats() {
    document.getElementById('stat-total-prod').textContent = inventario.length;
    document.getElementById('stat-total-stock').textContent = inventario.reduce((sum, p) => sum + Number(p.stock), 0);
    document.getElementById('stat-total-val').textContent = `$${inventario.reduce((sum, p) => sum + (p.precio * p.stock), 0).toLocaleString('es-CO')}`;
}

// Guardar o Editar Producto en Firebase
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const operador = operatorInput.value.trim() || 'Operador';
    const id = editIdInput.value;
    const nombre = nameInput.value.trim();
    const categoria = categoryInput.value;
    const precio = parseFloat(priceInput.value);
    const stock = parseInt(stockInput.value);

    if (id) {
        await db.collection('inventario').doc(id).update({ nombre, categoria, precio, stock });
        registrarLog(operador, 'Modificación', `Actualizó '${nombre}' (Stock: ${stock}, Precio: $${precio})`);
    } else {
        await db.collection('inventario').add({ nombre, categoria, precio, stock });
        registrarLog(operador, 'Creación', `Agregó '${nombre}' con ${stock} u.`);
    }

    resetForm();
});

// Registrar Retiro en Firebase
outForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const operador = operatorInput.value.trim() || 'Operador';
    const id = outSelect.value;
    const cantidad = parseInt(outQtyInput.value);

    if (!id) return;
    const prod = inventario.find(p => p.id === id);

    if (cantidad > prod.stock) {
        alert(`Stock insuficiente.`);
        return;
    }

    const nuevoStock = prod.stock - cantidad;
    await db.collection('inventario').doc(id).update({ stock: nuevoStock });
    registrarLog(operador, 'Retiro/Salida', `Retiró ${cantidad} u. de '${prod.nombre}' (Quedan: ${nuevoStock})`);

    outForm.reset();
});

// Eliminar Producto en Firebase
async function deleteProduct(id) {
    const operador = operatorInput.value.trim() || 'Operador';
    const prod = inventario.find(p => p.id === id);
    if (confirm(`¿Eliminar ${prod.nombre}?`)) {
        await db.collection('inventario').doc(id).delete();
        registrarLog(operador, 'Eliminado', `Eliminó el producto '${prod.nombre}'`);
    }
}

// Limpiar Historial en Firebase
btnClearHistory.addEventListener('click', async () => {
    if (confirm('¿Limpiar registro de historial?')) {
        const snapshot = await db.collection('historial').get();
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
});

function startEdit(id) {
    const prod = inventario.find(p => p.id === id);
    if (!prod) return;
    editIdInput.value = prod.id;
    nameInput.value = prod.nombre;
    categoryInput.value = prod.categoria;
    priceInput.value = prod.precio;
    stockInput.value = prod.stock;
    btnSave.innerHTML = `<i class="fa-solid fa-rotate"></i> Actualizar`;
    btnCancel.style.display = 'inline-block';
}

btnCancel.addEventListener('click', resetForm);
function resetForm() {
    form.reset();
    editIdInput.value = '';
    btnSave.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Producto`;
    btnCancel.style.display = 'none';
}

searchInput.addEventListener('input', (e) => renderTable(e.target.value));

// Menú desplegable (Acordeón)
const accordionToggle = document.getElementById('accordion-toggle');
const accordionCard = document.querySelector('.accordion-card');
if (accordionToggle && accordionCard) {
    accordionToggle.addEventListener('click', () => {
        accordionCard.classList.toggle('open');
    });
}