// ==========================================
// 1. IMPORTACIONES DE FIREBASE (Única vez)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    doc, 
    deleteDoc, 
    updateDoc, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// 2. CONFIGURACIÓN DE FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyDYUrDD56_n0bncgXReyNFMJ9OMcVjapIM",
    authDomain: "inventario-32ebc.firebaseapp.com",
    projectId: "inventario-32ebc",
    storageBucket: "inventario-32ebc.firebasestorage.app",
    messagingSenderId: "781622125997",
    appId: "1:781622125997:web:ed272b07df30554fbc2d24",
    measurementId: "G-BFTQF2QKNL"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

// ==========================================
// 3. ELEMENTOS DEL DOM Y ESTADO LOCAL
// ==========================================
let inventarioFirestore = []; // Almacenará los datos que vienen de Firestore

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

// ==========================================
// 4. SINCRONIZACIÓN EN TIEMPO REAL (FIRESTORE)
// ==========================================
onSnapshot(collection(db, "inventario"), (snapshot) => {
    inventarioFirestore = [];
    
    snapshot.forEach((docSnap) => {
        inventarioFirestore.push({
            id: docSnap.id,
            ...docSnap.data()
        });
    });

    // Renderizar la tabla cada vez que Firestore detecte un cambio
    renderTable(searchInput ? searchInput.value : '');
});

// ==========================================
// 5. RENDERIZAR TABLA Y ESTADÍSTICAS
// ==========================================
function renderTable(filter = '') {
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const productosFiltrados = inventarioFirestore.filter(p => 
        (p.nombre && p.nombre.toLowerCase().includes(filter.toLowerCase())) ||
        (p.categoria && p.categoria.toLowerCase().includes(filter.toLowerCase()))
    );

    if (productosFiltrados.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
    } else {
        if (emptyState) emptyState.style.display = 'none';
        
        productosFiltrados.forEach(prod => {
            const tr = document.createElement('tr');
            const precio = Number(prod.precio) || 0;
            const stock = Number(prod.stock) || 0;
            const totalProducto = precio * stock;

            tr.innerHTML = `
                <td><strong>${prod.nombre || 'Sin nombre'}</strong></td>
                <td><span class="badge">${prod.categoria || 'General'}</span></td>
                <td>$${precio.toLocaleString('es-CO')}</td>
                <td><strong>${stock}</strong> u.</td>
                <td>$${totalProducto.toLocaleString('es-CO')}</td>
                <td class="actions-cell">
                    <button class="btn-icon edit" onclick="window.startEdit('${prod.id}')" title="Editar">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-icon delete" onclick="window.deleteProduct('${prod.id}')" title="Eliminar">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    updateStats();
}

function updateStats() {
    const totalProductos = inventarioFirestore.length;
    const totalStock = inventarioFirestore.reduce((sum, p) => sum + Number(p.stock || 0), 0);
    const totalValor = inventarioFirestore.reduce((sum, p) => sum + ((Number(p.precio) || 0) * (Number(p.stock) || 0)), 0);

    const elTotalProd = document.getElementById('stat-total-prod');
    const elTotalStock = document.getElementById('stat-total-stock');
    const elTotalVal = document.getElementById('stat-total-val');

    if (elTotalProd) elTotalProd.textContent = totalProductos;
    if (elTotalStock) elTotalStock.textContent = totalStock;
    if (elTotalVal) elTotalVal.textContent = `$${totalValor.toLocaleString('es-CO')}`;
}

// ==========================================
// 6. GESTIÓN DE FORMULARIO (GUARDAR / EDITAR)
// ==========================================
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = editIdInput ? editIdInput.value : '';
        const nombre = nameInput.value.trim();
        const categoria = categoryInput.value;
        const precio = parseFloat(priceInput.value) || 0;
        const stock = parseInt(stockInput.value) || 0;

        try {
            if (id) {
                // Actualizar documento existente en Firestore
                const docRef = doc(db, "inventario", id);
                await updateDoc(docRef, {
                    nombre,
                    categoria,
                    precio,
                    stock
                });
                console.log("¡Producto actualizado!");
            } else {
                // Crear nuevo documento en Firestore
                await addDoc(collection(db, "inventario"), {
                    nombre,
                    categoria,
                    precio,
                    stock,
                    fecha: new Date()
                });
                console.log("¡Producto guardado en Firestore!");
            }

            resetForm();
        } catch (error) {
            console.error("Error al guardar el producto: ", error);
            alert("Hubo un error al guardar en la base de datos.");
        }
    });
}

// Preparar formulario para edición
window.startEdit = function(id) {
    const prod = inventarioFirestore.find(p => p.id === id);
    if (!prod) return;

    if (editIdInput) editIdInput.value = prod.id;
    if (nameInput) nameInput.value = prod.nombre || '';
    if (categoryInput) categoryInput.value = prod.categoria || '';
    if (priceInput) priceInput.value = prod.precio || 0;
    if (stockInput) stockInput.value = prod.stock || 0;

    if (btnSave) btnSave.innerHTML = `<i class="fa-solid fa-rotate"></i> Actualizar`;
    if (btnCancel) btnCancel.style.display = 'inline-block';
};

// Cancelar edición
if (btnCancel) {
    btnCancel.addEventListener('click', resetForm);
}

function resetForm() {
    if (form) form.reset();
    if (editIdInput) editIdInput.value = '';
    if (btnSave) btnSave.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Producto`;
    if (btnCancel) btnCancel.style.display = 'none';
}

// ==========================================
// 7. ELIMINAR PRODUCTO
// ==========================================
window.deleteProduct = async function(id) {
    if (confirm('¿Estás seguro de que deseas eliminar este producto del inventario?')) {
        try {
            await deleteDoc(doc(db, "inventario", id));
            console.log("Producto eliminado de Firestore");
        } catch (error) {
            console.error("Error al eliminar: ", error);
            alert("No se pudo eliminar el producto.");
        }
    }
};

// ==========================================
// 8. BÚSQUEDA EN TIEMPO REAL
// ==========================================
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        renderTable(e.target.value);
    });
}