const STORAGE_KEY = 'bodega_inventario_db';
const HISTORY_KEY = 'bodega_historial_db';

let inventario = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [
    { id: '1', nombre: 'Cerveza Poker 330ml', categoria: 'Cervezas', precio: 3500, stock: 120 },
    { id: '2', nombre: 'Coca Cola 1.5L', categoria: 'Gaseosas', precio: 6000, stock: 45 }
];
let historial = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];

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

function registrarLog(usuario, accion, detalle) {
    const ahora = new Date();
    const fechaHora = ahora.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'medium' });
    const dispositivo = obtenerDetallesDispositivo();

    historial.unshift({
        fechaHora,
        usuario: usuario || 'Anónimo',
        dispositivo,
        accion,
        detalle
    });

    saveToStorage();
    renderHistory();
}

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
                <td>$${prod.precio.toLocaleString('es-CO')}</td>
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
}

function renderHistory() {
    historyTbody.innerHTML = '';
    if (historial.length === 0) {
        emptyHistory.style.display = 'block';
    } else {
        emptyHistory.style.display = 'none';
        historial.forEach(item => {
            const tr = document.createElement('tr');
            let badgeClass = 'action-edit';
            if (item.accion.includes('Creación') || item.accion.includes('Suma')) badgeClass = 'action-add';
            if (item.accion.includes('Retiro') || item.accion.includes('Eliminado')) badgeClass = 'action-out';

            tr.innerHTML = `
                <td><i class="fa-regular fa-clock"></i> ${item.fechaHora}</td>
                <td><strong><i class="fa-solid fa-user"></i> ${item.usuario}</strong></td>
                <td><small>${item.dispositivo}</small></td>
                <td><span class="badge-action ${badgeClass}">${item.accion}:</span> ${item.detalle}</td>
            `;
            historyTbody.appendChild(tr);
        });
    }
}

function updateOutSelectOptions() {
    outSelect.innerHTML = '<option value="">-- Seleccionar producto --</option>';
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

function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inventario));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(historial));
}

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const operador = operatorInput.value.trim() || 'Operador';
    const id = editIdInput.value;
    const nombre = nameInput.value.trim();
    const categoria = categoryInput.value;
    const precio = parseFloat(priceInput.value);
    const stock = parseInt(stockInput.value);

    if (id) {
        inventario = inventario.map(p => p.id === id ? { id, nombre, categoria, precio, stock } : p);
        registrarLog(operador, 'Modificación', `Actualizó '${nombre}' (Stock: ${stock}, Precio: $${precio})`);
    } else {
        inventario.push({ id: Date.now().toString(), nombre, categoria, precio, stock });
        registrarLog(operador, 'Creación', `Agregó '${nombre}' con ${stock} u.`);
    }

    saveToStorage();
    renderTable();
    resetForm();
});

outForm.addEventListener('submit', (e) => {
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

    prod.stock -= cantidad;
    registrarLog(operador, 'Retiro/Salida', `Retiró ${cantidad} u. de '${prod.nombre}' (Quedan: ${prod.stock})`);

    saveToStorage();
    renderTable();
    renderHistory();
    outForm.reset();
});

function deleteProduct(id) {
    const operador = operatorInput.value.trim() || 'Operador';
    const prod = inventario.find(p => p.id === id);
    if (confirm(`¿Eliminar ${prod.nombre}?`)) {
        inventario = inventario.filter(p => p.id !== id);
        registrarLog(operador, 'Eliminado', `Eliminó el producto '${prod.nombre}'`);
        saveToStorage();
        renderTable();
    }
}

btnClearHistory.addEventListener('click', () => {
    if (confirm('¿Limpiar registro de historial?')) {
        historial = [];
        saveToStorage();
        renderHistory();
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

renderTable();
renderHistory();