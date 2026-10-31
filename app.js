// Clave para guardar en LocalStorage
const STORAGE_KEY = 'bodega_inventario_db';

// Estado global de productos
let inventario = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [
    { id: '1', nombre: 'Cerveza Poker 330ml', categoria: 'Cervezas', precio: 3500, stock: 120 },
    { id: '2', nombre: 'Coca Cola 1.5L', categoria: 'Gaseosas', precio: 6000, stock: 45 }
];

// Elementos del DOM
const form = document.getElementById('inventory-form');
const editIdInput = document.getElementById('edit-id');
const nameInput = document.getElementById('prod-name');
const categoryInput = document.getElementById('prod-category');
const priceInput = document.getElementById('prod-price');
const stockInput = document.getElementById('prod-stock');
const btnSave = document.getElementById('btn-save');
const btnCancel = document.getElementById('btn-cancel');
const tbody = document.getElementById('inventory-tbody');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search-input');

// Renderizar la tabla de productos
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
            const totalProducto = prod.precio * prod.stock;

            tr.innerHTML = `
                <td><strong>${prod.nombre}</strong></td>
                <td><span class="badge">${prod.categoria}</span></td>
                <td>$${prod.precio.toLocaleString('es-CO')}</td>
                <td><strong>${prod.stock}</strong> u.</td>
                <td>$${totalProducto.toLocaleString('es-CO')}</td>
                <td class="actions-cell">
                    <button class="btn-icon edit" onclick="startEdit('${prod.id}')" title="Editar">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-icon delete" onclick="deleteProduct('${prod.id}')" title="Eliminar">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    updateStats();
}

// Actualizar contadores del header
function updateStats() {
    const totalProductos = inventario.length;
    const totalStock = inventario.reduce((sum, p) => sum + Number(p.stock), 0);
    const totalValor = inventario.reduce((sum, p) => sum + (p.precio * p.stock), 0);

    document.getElementById('stat-total-prod').textContent = totalProductos;
    document.getElementById('stat-total-stock').textContent = totalStock;
    document.getElementById('stat-total-val').textContent = `$${totalValor.toLocaleString('es-CO')}`;
}

// Guardar en LocalStorage
function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inventario));
}

// Agregar o Actualizar producto
form.addEventListener('submit', (e) => {
    e.preventDefault();

    const id = editIdInput.value;
    const nombre = nameInput.value.trim();
    const categoria = categoryInput.value;
    const precio = parseFloat(priceInput.value);
    const stock = parseInt(stockInput.value);

    if (id) {
        // Actualizar existente
        inventario = inventario.map(p => p.id === id ? { id, nombre, categoria, precio, stock } : p);
    } else {
        // Crear nuevo
        const nuevoProducto = {
            id: Date.now().toString(),
            nombre,
            categoria,
            precio,
            stock
        };
        inventario.push(nuevoProducto);
    }

    saveToStorage();
    renderTable();
    resetForm();
});

// Preparar formulario para edición
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

// Cancelar edición
btnCancel.addEventListener('click', resetForm);

function resetForm() {
    form.reset();
    editIdInput.value = '';
    btnSave.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Producto`;
    btnCancel.style.display = 'none';
}

// Eliminar producto
function deleteProduct(id) {
    if (confirm('¿Estás seguro de que deseas eliminar este producto del inventario?')) {
        inventario = inventario.filter(p => p.id !== id);
        saveToStorage();
        renderTable();
    }
}

// Búsqueda en tiempo real
searchInput.addEventListener('input', (e) => {
    renderTable(e.target.value);
});

// Inicialización
renderTable();