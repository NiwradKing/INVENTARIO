// ==========================================
// CONFIGURACIÓN DE FIREBASE (Pega aquí tus credenciales reales)
// ==========================================
const firebaseConfig = {
    apiKey: "AQUÍ_VA_TU_API_KEY_REAL",
    authDomain: "tu-proyecto.firebaseapp.com",
    projectId: "tu-proyecto-id",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "tu-sender-id",
    appId: "tu-app-id"
};

// Inicializar Firebase de forma segura
try {
    firebase.initializeApp(firebaseConfig);
} catch (e) {
    console.error("Error al inicializar Firebase:", e);
}

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
    }).catch(err => console.error("Error al registrar log:", err));
}

// ==========================================
// SINCRONIZACIÓN EN TIEMPO REAL CON FIRESTORE
// ==========================================

// Escuchar cambios en la colección 'inventario' en tiempo real
db.collection('inventario').onSnapshot((snapshot) => {
    inventario = [];
    snapshot.forEach(doc => {
        inventario.push({
            id: doc.id,
            ...doc.data()
        });
    });
    renderTable(searchInput ? searchInput.value : '');
}, (error) => {
    console.error("Error al escuchar inventario de Firestore:", error);
});

// Escuchar cambios en la colección 'historial'
db.collection('historial').orderBy('timestamp', 'desc').limit(50).onSnapshot((snapshot) => {
    historial = [];
    snapshot.forEach(doc => {
        historial.push({
            id: doc.id,
            ...doc.data()
        });
    });
    renderHistory();
}, (error) => {
    console.error("Error al escuchar historial:", error);
});

// Renderizar Inventario principal
function renderTable(filter = '') {
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const productosFiltrados = inventario.filter(p => 
        (p.nombre && p.nombre.toLowerCase().includes(filter.toLowerCase())) ||
        (p.categoria && p.categoria.toLowerCase().includes(filter.toLowerCase()))
    );

    if (productosFiltrados.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
    } else {
        if (emptyState) emptyState.style.display = 'none';
        productosFiltrados.forEach(prod => {
            const tr = document.createElement('tr');
            const precioVal = Number(prod.precio) || 0;
            const stockVal = Number(prod.stock) || 0;

            tr.innerHTML = `
                <td><strong>${prod.nombre || 'Sin nombre'}</strong></td>
                <td><span class="badge">${prod.categoria || 'General'}</span></td>
                <td>$${precioVal.toLocaleString('es-CO')}</td>
                <td><strong>${stockVal}</strong> u.</td>
                <td>$${(precioVal * stockVal).toLocaleString('es-CO')}</td>
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
        const precioAnt = Number(prod.precio) || 0;
        tr.innerHTML = `
            <td>
                <strong>${prod.nombre}</strong><br>
                <small style="color:var(--text-muted);">Stock actual: ${prod.stock} | Ant: $${precioAnt.toLocaleString('es-CO')}</small>
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
        try {
            await db.collection('inventario').doc(id).update({
                stock: nuevoStock,
                precio: nuevoPrecio
            });

            registrarLog(operador, 'Surtido / Actualización', `En '${prod.nombre}': ${detalleCambios.join(' | ')}`);
            alert(`¡Surtido aplicado correctamente a ${prod.nombre}!`);
        } catch (e) {
            console.error("Error al aplicar surtido:", e);
            alert("Error al actualizar en Firebase. Revisa las reglas de seguridad.");
        }
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
            if (item.accion && (item.accion.includes('Creación') || item.accion.includes('Suma') || item.accion.includes('Surtido'))) badgeClass = 'action-add';
            if (item.accion && (item.accion.includes('Retiro') || item.accion.includes('Eliminado'))) badgeClass = 'action-out';

            tr.innerHTML = `
                <td><i class="fa-regular fa-clock"></i> ${item.fechaHora || ''}</td>
                <td><strong><i class="fa-solid fa-user"></i> ${item.usuario || 'Anónimo'}</strong></td>
                <td><small>${item.dispositivo || ''}</small></td>
                <td><span class="badge-action ${badgeClass}">${item.accion || 'Acción'}:</span> ${item.detalle || ''}</td>
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
    const totalProd = inventario.length;
    const totalStock = inventario.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
    const totalVal = inventario.reduce((sum, p) => sum + ((Number(p.precio) || 0) * (Number(p.stock) || 0)), 0);

    const elProd = document.getElementById('stat-total-prod');
    const elStock = document.getElementById('stat-total-stock');
    const elVal = document.getElementById('stat-total-val');

    if (elProd) elProd.textContent = totalProd;
    if (elStock) elStock.textContent = totalStock;
    if (elVal) elVal.textContent = `$${totalVal.toLocaleString('es-CO')}`;
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

    try {
        if (id) {
            await db.collection('inventario').doc(id).update({ nombre, categoria, precio, stock });
            registrarLog(operador, 'Modificación', `Actualizó '${nombre}' (Stock: ${stock}, Precio: $${precio})`);
        } else {
            await db.collection('inventario').add({ nombre, categoria, precio, stock });
            registrarLog(operador, 'Creación', `Agregó '${nombre}' con ${stock} u.`);
        }
        resetForm();
    } catch (err) {
        console.error("Error al guardar en Firestore:", err);
        alert("No se pudo guardar el producto. Verifica los permisos de Firebase.");
    }
});

// Registrar Retiro en Firebase
outForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const operador = operatorInput.value.trim() || 'Operador';
    const id = outSelect.value;
    const cantidad = parseInt(outQtyInput.value);

    if (!id) return;
    const prod = inventario.find(p => p.id === id);
    if (!prod) return;

    if (cantidad > prod.stock) {
        alert(`Stock insuficiente.`);
        return;
    }

    try {
        const nuevoStock = prod.stock - cantidad;
        await db.collection('inventario').doc(id).update({ stock: nuevoStock });
        registrarLog(operador, 'Retiro/Salida', `Retiró ${cantidad} u. de '${prod.nombre}' (Quedan: ${nuevoStock})`);
        outForm.reset();
    } catch (err) {
        console.error("Error al registrar salida:", err);
    }
});

// Eliminar Producto en Firebase
async function deleteProduct(id) {
    const operador = operatorInput.value.trim() || 'Operador';
    const prod = inventario.find(p => p.id === id);
    if (!prod) return;

    if (confirm(`¿Eliminar ${prod.nombre}?`)) {
        try {
            await db.collection('inventario').doc(id).delete();
            registrarLog(operador, 'Eliminado', `Eliminó el producto '${prod.nombre}'`);
        } catch (err) {
            console.error("Error al eliminar:", err);
        }
    }
}

// Limpiar Historial en Firebase
btnClearHistory.addEventListener('click', async () => {
    if (confirm('¿Limpiar registro de historial?')) {
        try {
            const snapshot = await db.collection('historial').get();
            const batch = db.batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        } catch (err) {
            console.error("Error al limpiar historial:", err);
        }
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

if (searchInput) {
    searchInput.addEventListener('input', (e) => renderTable(e.target.value));
}

// Menú desplegable (Acordeón)
const accordionToggle = document.getElementById('accordion-toggle');
const accordionCard = document.querySelector('.accordion-card');
if (accordionToggle && accordionCard) {
    accordionToggle.addEventListener('click', () => {
        accordionCard.classList.toggle('open');
    });
}