const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise'); // Using promise-based version
const session = require('express-session'); // NUEVO: Para gestionar sesiones de usuario

const app = express();
const PORT = 3000;

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'inventario_muni',
};

const pool = mysql.createPool(dbConfig);

// Middleware para parsear bodies de las solicitudes
app.use(express.urlencoded({ extended: true })); // Para formularios HTML (application/x-www-form-urlencoded)
app.use(express.json()); // Para bodies JSON (application/json)

// Configuración de la sesión (NUEVO)
app.use(session({
    secret: 'tu_secreto_super_seguro_y_largo_aqui', // ¡CAMBIA ESTO por una cadena secreta y compleja!
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // 'true' si usas HTTPS. Para desarrollo local con HTTP, déjalo en 'false'
}));

// Sirve archivos estáticos desde la carpeta 'display'
app.use(express.static(path.join(__dirname, 'display')));
// Sirve imágenes desde la carpeta 'imgs'
app.use('/imgs', express.static(path.join(__dirname, 'imgs')));

// Middleware para verificar autenticación (opcional, para rutas protegidas generales)
function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).send('No autorizado. Por favor, inicie sesión.');
    }
}

// Middleware para verificar si el usuario es administrador (MODIFICADO)
function requireAdmin(req, res, next) {
    if (req.session && req.session.userRoleName === 'admin') {
        next(); // El usuario es admin, permite que la solicitud continúe
    } else {
        res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
    }
}

// Ruta para la página de login (ruta raíz)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'display', 'login.html'));
});

// Endpoint para el proceso de login (MODIFICADO para obtener nombre_rol)
app.post('/login', async (req, res) => {
    const { usuario, contrasena } = req.body;

    try {
        const [rows] = await pool.execute(
            `SELECT u.id_usuario, u.nombre_usuario, r.nombre_rol
             FROM Usuarios u
             JOIN Roles r ON u.id_rol = r.id_rol
             WHERE u.nombre_usuario = ? AND u.contrasena = ?`,
            [usuario, contrasena]
        );

        if (rows.length > 0) {
            const user = rows[0];
            req.session.userId = user.id_usuario;
            req.session.userRoleName = user.nombre_rol;
            // ¡CAMBIA ESTA LÍNEA!
            res.json({ message: 'Login exitoso', redirectTo: '/main.html', userId: user.id_usuario, userRoleName: user.nombre_rol });
        } else {
            res.status(401).json({ error: 'Credenciales inválidas.' });
        }
    } catch (error) {
        console.error('Error en el login:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Ruta para cerrar sesión
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error al cerrar sesión:', err);
            return res.status(500).json({ error: 'Error al cerrar sesión.' });
        }
        res.json({ message: 'Sesión cerrada exitosamente', redirectTo: '/' });
    });
});

// --- RUTAS DE LA API PARA ARTÍCULOS ---

// app.get('/api/articulos') - Obtener todos los artículos
app.get('/api/articulos', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT
                a.id_articulo,
                a.nombre_articulo,
                a.descripcion,
                a.cantidad AS stock, -- Alias 'cantidad' como 'stock' para el frontend
                a.fecha_ingreso,     -- Asumiendo que esta columna existe
                a.id_proveedor,
                p.nombre_proveedor,  -- Nombre del proveedor
                a.id_categoria,
                c.nombre_categoria,  -- Nombre de la categoría
                a.id_marca,
                ma.nombre_marca      -- Nombre de la marca
            FROM
                articulos a
            LEFT JOIN
                proveedores p ON a.id_proveedor = p.id_proveedor
            LEFT JOIN
                categoriaarticulos c ON a.id_categoria = c.id_categoria
            LEFT JOIN
                marcaarticulos ma ON a.id_marca = ma.id_marca
            ORDER BY a.id_articulo DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener artículos:', error);
        res.status(500).send('Error en el servidor al obtener artículos.');
    }
});
// app.get('/api/categorias') - Obtener todas las categorías
app.get('/api/categorias', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT id_categoria, nombre_categoria FROM categoriaarticulos'); // Usamos el nombre real de tu tabla
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener categorías:', error);
        res.status(500).send('Error en el servidor al obtener categorías.');
    }
});

// app.get('/api/proveedores') - Obtener todos los proveedores
app.get('/api/proveedores', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT id_proveedor, nombre_proveedor FROM proveedores'); // Usamos el nombre real de tu tabla
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener proveedores:', error);
        res.status(500).send('Error en el servidor al obtener proveedores.');
    }
});

// app.get('/api/marcas') - Obtener todas las marcas
app.get('/api/marcas', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT id_marca, nombre_marca FROM marcaarticulos'); // Usamos el nombre real de tu tabla
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener marcas:', error);
        res.status(500).send('Error en el servidor al obtener marcas.');
    }
});

// app.get('/api/articulos/:id') - Obtener un artículo por ID
app.get('/api/articulos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.execute('SELECT * FROM articulos WHERE id_articulo = ?', [id]);
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ error: 'Artículo no encontrado.' });
        }
    } catch (error) {
        console.error('Error al obtener artículo por ID:', error);
        res.status(500).send('Error en el servidor al obtener el artículo.');
    }
});

// app.post('/api/articulos') - Crear un nuevo artículo
app.post('/api/articulos', async (req, res) => {
    const {
        nombre_articulo,
        descripcion,
        cantidad,
        id_proveedor,
        id_categoria,
        id_marca,
        fecha_ingreso
    } = req.body;


    if (nombre_articulo === undefined || cantidad === undefined ||
        id_proveedor === undefined || id_categoria === undefined || id_marca === undefined) {
        return res.status(400).json({ error: 'Faltan campos obligatorios para crear el artículo. Asegúrate de enviar nombre_articulo, cantidad, id_proveedor, id_categoria, id_marca.' });
    }


    const finalDescripcion = descripcion === '' || descripcion === undefined ? null : descripcion;



    try {
        const [result] = await pool.execute(
            `INSERT INTO articulos (
                nombre_articulo,
                descripcion,
                cantidad,
                id_proveedor,
                id_categoria,
                id_marca,
                fecha_ingreso
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`, // Hay 7 columnas, así que 7 placeholders '?'
            [
                nombre_articulo,
                finalDescripcion, // Usamos la descripción procesada
                cantidad,
                id_proveedor,     // Son NOT NULL en DB, se espera un valor
                id_categoria,     // Son NOT NULL en DB, se espera un valor
                id_marca,         // Son NOT NULL en DB, se espera un valor
                fecha_ingreso     // Usamos la fecha que viene del frontend
            ]
        );
        res.status(201).json({ message: 'Artículo creado exitosamente', id: result.insertId });
    } catch (error) {
        console.error('Error al crear artículo:', error);
        let userMessage = 'Error inesperado al crear artículo. Intenta nuevamente.';
        if (error.code === 'ER_DUP_ENTRY') {
            userMessage = 'Error: Ya existe un artículo con un valor duplicado (ej. nombre único si lo tuvieras).';
        } else if (error.code === 'ER_BAD_NULL_ERROR') {
            // Este error ocurriría si un campo NOT NULL se intenta insertar como NULL.
            userMessage = 'Error: Un campo obligatorio no puede ser nulo o está vacío. Asegúrate de que los campos de cantidad, proveedor, categoría y marca tengan valores válidos.';
        } else if (error.message.includes('Bind parameters must not contain undefined')) {
            // Esto debería ser menos probable si la desestructuración es correcta y los campos obligatorios se validan.
            userMessage = 'Error interno: Un valor undefined está siendo pasado a la base de datos. Posible desincronización entre frontend y backend.';
        }
        res.status(500).json({ error: userMessage, details: error.message });
    }
});

// app.put('/api/articulos/:id') - Actualizar un artículo existente
app.put('/api/articulos/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre_articulo, descripcion, cantidad, unidad_medida, precio_unitario, ubicacion } = req.body;
    try {
        const [result] = await pool.execute(
            'UPDATE articulos SET nombre_articulo = ?, descripcion = ?, cantidad = ?, unidad_medida = ?, precio_unitario = ?, ubicacion = ? WHERE id_articulo = ?',
            [nombre_articulo, descripcion, cantidad, unidad_medida, precio_unitario, ubicacion, id]
        );
        if (result.affectedRows === 0) {
            res.status(404).json({ error: 'Artículo no encontrado.' });
        } else {
            res.json({ message: 'Artículo actualizado exitosamente.' });
        }
    } catch (error) {
        console.error('Error al actualizar artículo:', error);
        res.status(500).send('Error en el servidor al actualizar el artículo.');
    }
});

// app.delete('/api/articulos/:id') - Eliminar un artículo
app.delete('/api/articulos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.execute('DELETE FROM articulos WHERE id_articulo = ?', [id]);
        if (result.affectedRows === 0) {
            res.status(404).json({ error: 'Artículo no encontrado.' });
        } else {
            res.json({ message: 'Artículo eliminado exitosamente.' });
        }
    } catch (error) {
        console.error('Error al eliminar artículo:', error);
        res.status(500).send('Error en el servidor al eliminar el artículo.');
    }
});


// --- RUTAS PARA GESTIÓN DE SOLICITUDES ---

// app.post('/api/solicitudes') - Crear una nueva solicitud
app.post('/api/solicitudes', async (req, res) => {
    const { id_usuario_solicitante, id_articulo, cantidad, observaciones } = req.body;

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Insertar en la tabla Solicitudes
        const [solicitudResult] = await connection.execute(
            'INSERT INTO Solicitudes (id_usuario, observacion, estado, fecha_solicitud) VALUES (?, ?, ?, NOW())',
            [id_usuario_solicitante, observaciones, 'pendiente'] // 'pendiente' es el estado inicial
        );
        const id_solicitud = solicitudResult.insertId; // Obtener el ID de la solicitud recién creada

        // 2. Insertar en la tabla DetalleSolicitudes
        await connection.execute(
            'INSERT INTO DetalleSolicitudes (id_solicitud, id_articulo, cantidad) VALUES (?, ?, ?)',
            [id_solicitud, id_articulo, cantidad]
        );

        await connection.commit(); // Confirmar la transacción
        res.status(201).json({ message: 'Solicitud creada exitosamente', id_solicitud: id_solicitud });

    } catch (error) {
        await connection.rollback(); // Deshacer la transacción si algo falla
        console.error('Error al crear solicitud:', error);
        let errorMessage = 'Error en el servidor al crear la solicitud.';
        if (error.code === 'ER_BAD_FIELD_ERROR') {
            errorMessage = `Error de columna: Una de las columnas especificadas no existe. Detalles: ${error.sqlMessage}`;
        } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            errorMessage = 'Error de clave foránea: El usuario o artículo especificado no existe o no se encontró.';
        } else if (error.code === 'ER_SP_DOES_NOT_EXIST' || error.code === 'ER_BAD_FUNCTION_CALL') {
             errorMessage = 'Error de función de fecha: Asegúrate de usar NOW() para MySQL en lugar de GETDATE().';
        }
        res.status(500).json({ error: errorMessage, details: error.message });
    } finally {
        connection.release(); // Liberar la conexión al pool
    }
});

// app.get('/api/solicitudes') - Obtener todas las solicitudes con detalles
app.get('/api/solicitudes', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT
                s.id_solicitud,
                s.id_usuario,
                u.nombre_usuario,
                s.fecha_solicitud,
                s.estado,
                s.observacion,
                ds.id_articulo,
                a.nombre_articulo,
                ds.cantidad AS cantidad_solicitada,
                s.id_usuario_admin,
                ua.nombre_usuario AS nombre_admin,
                s.fecha_accion_admin,
                s.respuesta_admin
            FROM
                Solicitudes s
            JOIN
                DetalleSolicitudes ds ON s.id_solicitud = ds.id_solicitud
            JOIN
                Articulos a ON ds.id_articulo = a.id_articulo
            JOIN
                Usuarios u ON s.id_usuario = u.id_usuario
            LEFT JOIN
                Usuarios ua ON s.id_usuario_admin = ua.id_usuario
            ORDER BY s.fecha_solicitud DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener solicitudes:', error);
        res.status(500).send('Error en el servidor al obtener solicitudes.');
    }
});

// NUEVO: app.get('/api/solicitudes/:id') - Obtener una solicitud específica por ID
app.get('/api/solicitudes/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.execute(`
            SELECT
                s.id_solicitud,
                s.id_usuario,
                u.nombre_usuario,
                s.fecha_solicitud,
                s.estado,
                s.observacion,
                ds.id_articulo,
                a.nombre_articulo,
                ds.cantidad AS cantidad_solicitada,
                s.id_usuario_admin,
                ua.nombre_usuario AS nombre_admin,
                s.fecha_accion_admin,
                s.respuesta_admin
            FROM
                Solicitudes s
            JOIN
                DetalleSolicitudes ds ON s.id_solicitud = ds.id_solicitud
            JOIN
                Articulos a ON ds.id_articulo = a.id_articulo
            JOIN
                Usuarios u ON s.id_usuario = u.id_usuario
            LEFT JOIN
                Usuarios ua ON s.id_usuario_admin = ua.id_usuario
            WHERE s.id_solicitud = ?
        `, [id]);

        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ error: 'Solicitud no encontrada.' });
        }
    } catch (error) {
        console.error('Error al obtener solicitud por ID:', error);
        res.status(500).send('Error en el servidor al obtener la solicitud.');
    }
});

// app.put('/api/solicitudes/:id') - Actualizar estado de solicitud y manejar stock (AHORA PROTEGIDA POR requireAdmin)
app.put('/api/solicitudes/:id', requireAdmin, async (req, res) => { // APLICADO MIDDLEWARE requireAdmin
    const { id } = req.params;
    const { estado, respuesta_admin } = req.body; // id_articulo NO se usa del body aquí

    // Obtener id_usuario_admin desde la sesión del usuario autenticado
    const id_usuario_admin = req.session.userId; // ¡Asumimos que el admin que aprueba es el logueado!

    if (!['aprobada', 'rechazada', 'completada'].includes(estado)) {
        return res.status(400).json({ error: 'Estado de solicitud inválido.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Obtener el estado actual de la solicitud y la cantidad de stock del artículo del DetalleSolicitudes
        const [solicitudActual] = await connection.execute(
            `SELECT s.estado, ds.cantidad AS cantidad_solicitada, a.stock, ds.id_articulo
             FROM Solicitudes s
             JOIN DetalleSolicitudes ds ON s.id_solicitud = ds.id_solicitud
             JOIN Articulos a ON ds.id_articulo = a.id_articulo
             WHERE s.id_solicitud = ?`,
            [id]
        );

        if (solicitudActual.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Solicitud no encontrada.' });
        }

        const currentStatus = solicitudActual[0].estado;
        const requestedQuantity = solicitudActual[0].cantidad_solicitada;
        const currentStock = solicitudActual[0].stock;
        const articleIdFromDB = solicitudActual[0].id_articulo; // Usar el ID del artículo de la BD

        // Lógica de stock solo si el estado cambia de 'pendiente' a 'aprobada'
        if (estado === 'aprobada' && currentStatus === 'pendiente') {
            if (currentStock < requestedQuantity) {
                await connection.rollback();
                return res.status(400).json({ error: 'Stock insuficiente para aprobar esta solicitud.' });
            }
            // Disminuir el stock del artículo
            await connection.execute(
                'UPDATE Articulos SET cantidad = cantidad - ? WHERE id_articulo = ?',
                [requestedQuantity, articleIdFromDB]
            );

            // Registrar el movimiento de salida
            await connection.execute(
                'INSERT INTO Movimientos (id_articulo, tipo_movimiento, cantidad, fecha_movimiento, id_usuario) VALUES (?, ?, ?, NOW(), ?)',
                [articleIdFromDB, 'salida', requestedQuantity, id_usuario_admin] // Usar el ID del admin que aprueba
            );
        }

        // Actualizar el estado de la solicitud en la tabla Solicitudes
        await connection.execute(
            `UPDATE Solicitudes
             SET estado = ?, respuesta_admin = ?, fecha_accion_admin = NOW(), id_usuario_admin = ?
             WHERE id_solicitud = ?`,
            [estado, respuesta_admin, id_usuario_admin, id] // id_usuario_admin YA VENÍA DE LA SESIÓN
        );

        await connection.commit();
        res.json({ message: `Solicitud ${estado} exitosamente.` });

    } catch (error) {
        await connection.rollback();
        console.error(`Error al actualizar solicitud ${id}:`, error);
        let errorMessage = `Error en el servidor al actualizar la solicitud a ${estado}.`;
        if (error.sqlMessage) {
            errorMessage += ` Detalle: ${error.sqlMessage}`;
        } else if (error.code === 'ER_SP_DOES_NOT_EXIST' || error.code === 'ER_BAD_FUNCTION_CALL') {
             errorMessage = 'Error de función de fecha: Asegúrate de usar NOW() para MySQL en lugar de GETDATE().';
        }
        res.status(500).json({ error: errorMessage, details: error.message });
    } finally {
        connection.release();
    }
});

// app.delete('/api/solicitudes/:id') - Eliminar una solicitud
app.delete('/api/solicitudes/:id', async (req, res) => {
    const { id } = req.params;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Eliminar de DetalleSolicitudes (ya que depende de Solicitudes)
        await connection.execute('DELETE FROM DetalleSolicitudes WHERE id_solicitud = ?', [id]);

        // 2. Eliminar de Solicitudes
        const [result] = await connection.execute('DELETE FROM Solicitudes WHERE id_solicitud = ?', [id]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Solicitud no encontrada.' });
        }

        await connection.commit();
        res.json({ message: 'Solicitud eliminada exitosamente.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error al eliminar solicitud:', error);
        res.status(500).json({ error: 'Error en el servidor al eliminar la solicitud.', details: error.message });
    } finally {
        connection.release();
    }
});

// --- RUTAS PARA GESTIÓN DE MOVIMIENTOS ---
// --- RUTAS PARA GESTIÓN DE MOVIMIENTOS ---
app.get('/api/movimientos', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT
                m.id_movimiento,
                m.id_articulo,
                a.nombre_articulo,
                m.tipo_movimiento,
                m.cantidad,
                m.fecha, -- ¡CAMBIADO AQUÍ! Ya no necesita AS fecha
                m.id_usuario,
                u.nombre_usuario AS nombre_usuario,
                c.nombre_categoria,
                p.nombre_proveedor,
                ma.nombre_marca
            FROM
                movimientos m -- Asegúrate que Movimientos también está en minúsculas si así es en la BD
            JOIN
                articulos a ON m.id_articulo = a.id_articulo -- Asegúrate que Articulos también está en minúsculas
            JOIN
                usuarios u ON m.id_usuario = u.id_usuario     -- Asegúrate que Usuarios también está en minúsculas
            LEFT JOIN
                categoriaarticulos c ON a.id_categoria = c.id_categoria
            LEFT JOIN
                proveedores p ON a.id_proveedor = p.id_proveedor
            LEFT JOIN
                marcaarticulos ma ON a.id_marca = ma.id_marca
            ORDER BY m.fecha DESC -- ¡CAMBIADO AQUÍ! Ordenar por m.fecha
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener movimientos:', error);
        res.status(500).send('Error en el servidor al obtener movimientos.');
    }
});

// --- RUTAS DE ESTADÍSTICAS ---
app.get('/api/stats/total-items', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT COUNT(*) AS total FROM articulos');
        res.json(rows[0]);
    } catch (error) {
        console.error('Error al obtener el total de artículos:', error);
        res.status(500).json({ error: 'Error al obtener total de artículos' });
    }
});

app.get('/api/stats/stock-level', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT SUM(cantidad) AS total FROM articulos');
        res.json(rows[0]);
    } catch (error) {
        console.error('Error al obtener el nivel de stock:', error);
        res.status(500).json({ error: 'Error al obtener stock' });
    }
});

app.get('/api/stats/pending-requests', async (req, res) => {
    try {
        const [rows] = await pool.execute("SELECT COUNT(*) AS total FROM solicitudes WHERE estado = 'pendiente'"); // Asegúrate de que el estado sea 'pendiente' y no 'Pendiente' con mayúscula
        res.json(rows[0]);
    } catch (error) {
        console.error('Error al obtener solicitudes pendientes:', error);
        res.status(500).json({ error: 'Error al obtener solicitudes pendientes' });
    }
});


// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log('¡Listo para gestionar tu inventario!');
});