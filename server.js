const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
const session = require('express-session');

const app = express();
const PORT = 3000;

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'inventarioMuni',
};

const pool = mysql.createPool(dbConfig);

// Middleware para parsear bodies de las solicitudes
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configuración de la sesión (NUEVO)
app.use(session({
    secret: 'tu_secreto_super_seguro_y_largo_aqui',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
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
        next();
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


//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// app.get('/api/categorias') - Obtener todas las categorías
app.get('/api/categorias', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT id_categoria, nombre_categoria FROM categoriaarticulos');
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener categorías:', error);
        res.status(500).send('Error en el servidor al obtener categorías.');
    }
});
// POST /api/categorias - Agregar nueva categoría
app.post('/api/categorias', async (req, res) => {
    const { nombre_categoria } = req.body;

    if (!nombre_categoria) {
        return res.status(400).json({ error: 'El nombre de la categoría es obligatorio.' });
    }

    try {
        const [result] = await pool.execute(
            'INSERT INTO categoriaarticulos (nombre_categoria) VALUES (?)',
            [nombre_categoria]
        );
        res.status(201).json({ message: 'Categoría agregada correctamente.', id: result.insertId });
    } catch (error) {
        console.error('Error al agregar categoría:', error);
        res.status(500).json({ error: 'Error en el servidor al agregar categoría.' });
    }
});
// PUT /api/categorias/:id - Actualizar nombre de categoría
app.put('/api/categorias/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre_categoria } = req.body;

    if (!nombre_categoria) {
        return res.status(400).json({ error: 'El nombre de la categoría es obligatorio.' });
    }

    try {
        const [result] = await pool.execute(
            'UPDATE categoriaarticulos SET nombre_categoria = ? WHERE id_categoria = ?',
            [nombre_categoria, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada.' });
        }
        res.json({ message: 'Categoría actualizada correctamente.' });
    } catch (error) {
        console.error('Error al actualizar categoría:', error);
        res.status(500).json({ error: 'Error en el servidor al actualizar categoría.' });
    }
});

// DELETE /api/categorias/:id - Eliminar categoría
app.delete('/api/categorias/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await pool.execute(
            'DELETE FROM categoriaarticulos WHERE id_categoria = ?',
            [id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada.' });
        }
        res.json({ message: 'Categoría eliminada correctamente.' });
    } catch (error) {
        console.error('Error al eliminar categoría:', error);
        res.status(500).json({ error: 'Error en el servidor al eliminar categoría.' });
    }
});

//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// app.get('/api/proveedores') - Obtener todos los proveedores
app.get('/api/proveedores', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT id_proveedor, nombre_proveedor, contacto, telefono, direccion FROM proveedores'); // Usamos el nombre real de tu tabla
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener proveedores:', error);
        res.status(500).send('Error en el servidor al obtener proveedores.');
    }
});
// app.get('/api/proveedores/:id') - Obtener un proveedor por ID
app.get('/api/proveedores/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const [rows] = await pool.execute(
            'SELECT id_proveedor, nombre_proveedor, contacto, telefono, direccion FROM proveedores WHERE id_proveedor = ?',
            [id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Error al obtener proveedor por ID:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});
//Agregar Proveedores
app.post('/api/proveedores', async (req, res) => {
  try {
    const { nombre_proveedor, contacto, telefono, direccion } = req.body;

    if (!nombre_proveedor) {
      return res.status(400).json({ error: 'El nombre del proveedor es obligatorio' });
    }

    const [result] = await pool.execute(
      `INSERT INTO Proveedores (nombre_proveedor, contacto, telefono, direccion) VALUES (?, ?, ?, ?)`,
      [nombre_proveedor, contacto || null, telefono || null, direccion || null]
    );

    res.status(201).json({ message: 'Proveedor agregado correctamente', id_proveedor: result.insertId });
  } catch (error) {
    console.error('Error al agregar proveedor:', error);
    res.status(500).json({ error: 'Error en el servidor al agregar proveedor' });
  }
});
// app.put('/api/proveedores/:id') - Actualizar un proveedor
app.put('/api/proveedores/:id', async (req, res) => {
  const id = req.params.id;
  const { nombre_proveedor, contacto, telefono, direccion } = req.body;

  try {
    const [result] = await pool.execute(
      `UPDATE proveedores SET nombre_proveedor = ?, contacto = ?, telefono = ?, direccion = ? WHERE id_proveedor = ?`,
      [nombre_proveedor, contacto, telefono, direccion, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Proveedor no encontrado.' });
    }

    res.json({ message: 'Proveedor actualizado correctamente.' });
  } catch (error) {
    console.error('Error al actualizar proveedor:', error);
    res.status(500).json({ error: 'Error en el servidor al actualizar proveedor.' });
  }
});
// app.delete('/api/proveedores/:id') - Eliminar proveedor
app.delete('/api/proveedores/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const [result] = await pool.execute(
      'DELETE FROM proveedores WHERE id_proveedor = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Proveedor no encontrado.' });
    }

    res.json({ message: 'Proveedor eliminado correctamente.' });
  } catch (error) {
    console.error('Error al eliminar proveedor:', error);
    res.status(500).json({ error: 'Error en el servidor al eliminar proveedor.' });
  }
});
//-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// app.get('/api/marcas') - Obtener todas las marcas
app.get('/api/marcas', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT id_marca, nombre_marca FROM marcaarticulos');
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener marcas:', error);
        res.status(500).send('Error en el servidor al obtener marcas.');
    }
});

// POST /api/marcas - Agregar una nueva marca
app.post('/api/marcas', async (req, res) => {
    const { nombre_marca } = req.body;

    if (!nombre_marca) {
        return res.status(400).json({ error: 'El nombre de la marca es obligatorio.' });
    }

    try {
        const [result] = await pool.execute(
            'INSERT INTO marcaarticulos (nombre_marca) VALUES (?)',
            [nombre_marca]
        );
        res.status(201).json({ message: 'Marca agregada correctamente.', id: result.insertId });
    } catch (error) {
        console.error('Error al agregar marca:', error);
        res.status(500).json({ error: 'Error en el servidor al agregar marca.' });
    }
});

// PUT /api/marcas/:id - Actualizar una marca
app.put('/api/marcas/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre_marca } = req.body;

    if (!nombre_marca) {
        return res.status(400).json({ error: 'El nombre de la marca es obligatorio.' });
    }

    try {
        const [result] = await pool.execute(
            'UPDATE marcaarticulos SET nombre_marca = ? WHERE id_marca = ?',
            [nombre_marca, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Marca no encontrada.' });
        }
        res.json({ message: 'Marca actualizada correctamente.' });
    } catch (error) {
        console.error('Error al actualizar marca:', error);
        res.status(500).json({ error: 'Error en el servidor al actualizar marca.' });
    }
});

// DELETE /api/marcas/:id - Eliminar una marca
app.delete('/api/marcas/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await pool.execute(
            'DELETE FROM marcaarticulos WHERE id_marca = ?',
            [id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Marca no encontrada.' });
        }
        res.json({ message: 'Marca eliminada correctamente.' });
    } catch (error) {
        console.error('Error al eliminar marca:', error);
        res.status(500).json({ error: 'Error en el servidor al eliminar marca.' });
    }
});
//-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// app.get('/api/articulos/:id') - Obtener un artículo por ID
app.get('/api/articulos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM articulos WHERE id_articulo = ?',
            [id]
        );
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


// app.get('/api/articulos') - Obtener todos los artículos
app.get('/api/articulos', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT
                a.id_articulo,
                a.nombre_articulo,
                a.descripcion,
                a.cantidad AS stock,
                a.fecha_ingreso,
                a.id_proveedor,
                p.nombre_proveedor,
                a.id_categoria,
                c.nombre_categoria,
                a.id_marca,
                ma.nombre_marca
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

// app.post('/api/articulos') - Crear un nuevo artículo
app.post('/api/articulos', async (req, res) => {
    const {
        nombre,
        descripcion,
        cantidad,
        categoria,
        proveedor,
        fecha_adquisicion,
        marca
    } = req.body;

    const finalNombreArticulo = (nombre !== undefined && String(nombre).trim() !== '') ? String(nombre).trim() : null;
    const finalDescripcion = (descripcion !== undefined && String(descripcion).trim() !== '') ? String(descripcion).trim() : null;
    const finalCantidad = (cantidad !== undefined && cantidad !== null && !isNaN(Number(cantidad))) ? parseInt(cantidad) : null;
    const finalIdCategoria = (categoria !== undefined && categoria !== null && !isNaN(Number(categoria))) ? parseInt(categoria) : null;
    const finalIdProveedor = (proveedor !== undefined && proveedor !== null && !isNaN(Number(proveedor))) ? parseInt(proveedor) : null;
    const finalFechaIngreso = (fecha_adquisicion !== undefined && String(fecha_adquisicion).trim() !== '') ? String(fecha_adquisicion).trim() : null;
    const finalIdMarca = (marca !== undefined && marca !== null && !isNaN(Number(marca))) ? parseInt(marca) : null;

    // Usuario fijo por ahora (reemplazar con el id del usuario logueado cuando tengas autenticación)
    const idUsuarioAccion = 2;

    if (!finalNombreArticulo) {
        return res.status(400).json({ error: 'El nombre del artículo es obligatorio.' });
    }
    if (finalCantidad === null || isNaN(finalCantidad) || finalCantidad <= 0) {
        return res.status(400).json({ error: 'La cantidad del artículo es obligatoria y debe ser un número válido mayor que 0.' });
    }
    if (finalIdCategoria === null || isNaN(finalIdCategoria)) {
        return res.status(400).json({ error: 'La categoría del artículo es obligatoria.' });
    }
    if (finalIdProveedor === null || isNaN(finalIdProveedor)) {
        return res.status(400).json({ error: 'El proveedor del artículo es obligatorio.' });
    }
    if (finalIdMarca === null || isNaN(finalIdMarca)) {
        return res.status(400).json({ error: 'La marca del artículo es obligatoria.' });
    }
    if (!finalFechaIngreso) {
        return res.status(400).json({ error: 'La fecha de ingreso del artículo es obligatoria.' });
    }

    try {
        // Insertar artículo
        const [result] = await pool.execute(
            `INSERT INTO Articulos 
            (nombre_articulo, descripcion, cantidad, id_categoria, id_proveedor, fecha_ingreso, id_marca) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                finalNombreArticulo,
                finalDescripcion,
                finalCantidad,
                finalIdCategoria,
                finalIdProveedor,
                finalFechaIngreso,
                finalIdMarca
            ]
        );

        const newArticuloId = result.insertId;
        if (!newArticuloId) {
            return res.status(500).json({ error: 'Error al obtener el ID del artículo después de la inserción.' });
        }

    // Insertar movimiento automático
    await pool.execute(
        `INSERT INTO Movimientos 
        (id_articulo, id_usuario, tipo_movimiento, cantidad, fecha, observacion) 
        VALUES (?, ?, ?, ?, NOW(), ?)`,
        [newArticuloId, idUsuarioAccion, 'ingreso', finalCantidad, 'Inserción Artículos']
    );


        res.status(201).json({ message: 'Artículo agregado y movimiento registrado exitosamente', id: newArticuloId });

    } catch (error) {
        console.error('Error al agregar artículo y/o movimiento:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ error: 'Ya existe un artículo con un valor único duplicado.' });
        } else if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_ROW_IS_REFERENCED_2' || error.sqlState === '23000') {
            res.status(409).json({ error: 'Error de integridad de datos. Verifica los IDs de categoría, proveedor, marca y usuario.' });
        } else {
            res.status(500).json({ error: 'Error interno del servidor al agregar artículo.' });
        }
    }
});




// app.put('/api/articulos/:id') - Actualizar un artículo existente
app.put('/api/articulos/:id', async (req, res) => {
    const { id } = req.params;
    const {
        nombre,
        descripcion,
        cantidad,
        categoria,
        proveedor,
        fecha_adquisicion,
        marca
    } = req.body;

    const finalNombreArticulo = nombre?.trim() || null;
    const finalDescripcion = descripcion?.trim() || null;
    const finalCantidad = cantidad !== undefined && cantidad !== null && !isNaN(cantidad) ? parseInt(cantidad) : null;
    const finalIdCategoria = categoria !== undefined && categoria !== null && !isNaN(categoria) ? parseInt(categoria) : null;
    const finalIdProveedor = proveedor !== undefined && proveedor !== null && !isNaN(proveedor) ? parseInt(proveedor) : null;
    const finalFechaIngreso = fecha_adquisicion?.trim() || null;
    const finalIdMarca = marca !== undefined && marca !== null && !isNaN(marca) ? parseInt(marca) : null;

    const idUsuarioAccion = 2;

    if (!finalNombreArticulo) return res.status(400).json({ error: 'El nombre del artículo es obligatorio.' });
    if (finalCantidad === null || isNaN(finalCantidad) || finalCantidad < 0) return res.status(400).json({ error: 'La cantidad es obligatoria y debe ser >= 0.' });

    try {
        const [rows] = await pool.execute('SELECT * FROM Articulos WHERE id_articulo = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Artículo no encontrado' });

        const articuloActual = rows[0];

        // Verifica si hubo algún cambio
        const huboCambio =
            articuloActual.nombre_articulo !== finalNombreArticulo ||
            articuloActual.descripcion !== finalDescripcion ||
            articuloActual.cantidad !== finalCantidad ||
            articuloActual.id_categoria !== finalIdCategoria ||
            articuloActual.id_proveedor !== finalIdProveedor ||
            articuloActual.fecha_ingreso?.toISOString().split('T')[0] !== finalFechaIngreso ||
            articuloActual.id_marca !== finalIdMarca;

        if (!huboCambio) {
            return res.status(200).json({ message: 'No se realizaron cambios' });
        }

        const [updateResult] = await pool.execute(
            `UPDATE Articulos SET 
                nombre_articulo = ?, 
                descripcion = ?, 
                cantidad = ?, 
                id_categoria = ?, 
                id_proveedor = ?, 
                fecha_ingreso = ?, 
                id_marca = ?
            WHERE id_articulo = ?`,
            [finalNombreArticulo, finalDescripcion, finalCantidad, finalIdCategoria, finalIdProveedor, finalFechaIngreso, finalIdMarca, id]
        );

        // Calcular diferencia de cantidad
        const diferenciaCantidad = finalCantidad - articuloActual.cantidad;

        const cantidadMovimiento = Math.abs(diferenciaCantidad) > 0 ? Math.abs(diferenciaCantidad) : 1;

        // Insertar movimiento, aunque la cantidad no haya cambiado
        await pool.execute(
            `INSERT INTO Movimientos (id_articulo, id_usuario, tipo_movimiento, cantidad, fecha, observacion)
             VALUES (?, ?, 'ajuste', ?, NOW(), ?)`,
            [id, idUsuarioAccion, cantidadMovimiento, 'Ajuste por edición de artículo']
        );

        res.json({ message: 'Artículo actualizado correctamente' });

    } catch (error) {
        console.error('Error en update:', error);
        res.status(500).json({ error: 'Error en la actualización' });
    }
});






// app.delete('/api/articulos/:id') - Eliminar un artículo
app.delete('/api/articulos/:id', async (req, res) => {
    const { id } = req.params;
    const id_usuario = 2;

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Obtener datos del artículo para registrar cantidad y nombre antes de borrar
        const [articuloRows] = await connection.query(
            'SELECT cantidad, nombre_articulo FROM articulos WHERE id_articulo = ?',
            [id]
        );

        if (articuloRows.length === 0) {
            await connection.release();
            return res.status(404).json({ message: 'Artículo no encontrado' });
        }

        const articulo = articuloRows[0];

        // 2. Insertar movimiento de baja incluyendo nombre_articulo
        await connection.query(
            `INSERT INTO movimientos 
            (id_articulo, nombre_articulo, id_usuario, tipo_movimiento, cantidad, observacion)
            VALUES (?, ?, ?, 'baja', ?, ?)`,
            [id, articulo.nombre_articulo, id_usuario, articulo.cantidad, 'Artículo eliminado']
        );

        // 3. Eliminar artículo
        await connection.query('DELETE FROM articulos WHERE id_articulo = ?', [id]);

        await connection.commit();
        await connection.release();

        res.json({ message: 'Artículo eliminado y movimiento registrado correctamente' });
    } catch (error) {
        await connection.rollback();
        await connection.release();
        console.error('Error al eliminar artículo:', error);
        res.status(500).json({ message: 'Error al eliminar artículo' });
    }
});


//-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

// --- RUTAS PARA GESTIÓN DE SOLICITUDES ---
function isAuthenticated(req, res, next) {
    if (req.session && req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'No autorizado. Por favor, inicie sesión.' });
    }
}

// Endpoint para crear nueva solicitud
app.post('/api/solicitudes', async (req, res) => {
  try {
    const id_usuario_solicitante = req.session.userId;
    if (!id_usuario_solicitante) {
      return res.status(401).json({ error: 'Usuario no autenticado.' });
    }

    const { id_articulo, cantidad, observaciones } = req.body;

    if (!id_articulo || !cantidad || cantidad <= 0) {
      return res.status(400).json({ error: 'Datos incompletos o inválidos.' });
    }

    // Verificar stock disponible
    const [articulo] = await pool.execute(
      'SELECT cantidad FROM Articulos WHERE id_articulo = ?',
      [id_articulo]
    );

    if (articulo.length === 0) {
      return res.status(404).json({ error: 'Artículo no encontrado.' });
    }

    const stockDisponible = articulo[0].cantidad;
    if (cantidad > stockDisponible) {
      return res.status(400).json({ 
        error: `No hay suficiente stock. Disponible: ${stockDisponible}, Solicitado: ${cantidad}`
      });
    }

    // Si pasa todas las validaciones, crear la solicitud
    const [result] = await pool.execute(
      `INSERT INTO Solicitudes (id_usuario, id_articulo, cantidad_solicitada, observacion, estado, fecha_solicitud)
       VALUES (?, ?, ?, ?, 'pendiente', NOW())`,
      [id_usuario_solicitante, id_articulo, cantidad, observaciones || null]
    );

    res.json({ 
      message: 'Solicitud creada correctamente.', 
      id_solicitud: result.insertId 
    });
  } catch (error) {
    console.error('Error al crear solicitud:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

app.get('/api/solicitudes', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.id_solicitud, s.estado, s.fecha_solicitud, s.fecha_accion_admin, 
             u.nombre_usuario, a.nombre_articulo, s.cantidad_solicitada
      FROM Solicitudes s
      JOIN usuarios u ON s.id_usuario = u.id_usuario
      JOIN articulos a ON s.id_articulo = a.id_articulo
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
});

app.get('/api/solicitudes/pendientes', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        s.id_solicitud, 
        s.id_articulo,
        a.nombre_articulo,
        u.nombre_usuario,
        s.cantidad_solicitada,
        s.fecha_solicitud,
        s.observacion
      FROM Solicitudes s
      JOIN Articulos a ON s.id_articulo = a.id_articulo
      JOIN Usuarios u ON s.id_usuario = u.id_usuario
      WHERE s.estado = 'pendiente'
      ORDER BY s.fecha_solicitud DESC
      LIMIT 5
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener solicitudes pendientes:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes pendientes' });
  }
});
app.get('/api/solicitudes/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const [rows] = await pool.execute(`
      SELECT
        s.id_solicitud,
        s.id_usuario,
        u.nombre_usuario,
        s.fecha_solicitud,
        s.estado,
        s.observacion,
        s.id_articulo,
        a.nombre_articulo,
        s.cantidad_solicitada,
        s.respuesta_admin,
        s.fecha_accion_admin
      FROM
        Solicitudes s
      JOIN Usuarios u ON s.id_usuario = u.id_usuario
      JOIN Articulos a ON s.id_articulo = a.id_articulo
      WHERE s.id_solicitud = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener solicitud por ID:', error);
    res.status(500).json({ error: 'Error al obtener la solicitud' });
  }
});

app.put('/api/solicitudes/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { estado, respuesta_admin } = req.body;

  const id_usuario_admin = req.session.userId;

  if (!['aprobada', 'rechazada', 'completada'].includes(estado)) {
    return res.status(400).json({ error: 'Estado de solicitud inválido.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Obtener datos actuales de la solicitud
    const [solicitudActual] = await connection.execute(
      `SELECT s.estado, s.cantidad_solicitada, a.cantidad, s.id_articulo
       FROM Solicitudes s
       JOIN Articulos a ON s.id_articulo = a.id_articulo
       WHERE s.id_solicitud = ?`,
      [id]
    );

    if (solicitudActual.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Solicitud no encontrada.' });
    }

    const currentStatus = solicitudActual[0].estado;
    const requestedQuantity = solicitudActual[0].cantidad_solicitada;
    const currentStock = solicitudActual[0].cantidad;
    const articleIdFromDB = solicitudActual[0].id_articulo;

    // Solo si se aprueba una solicitud pendiente, se actualiza stock y se registra movimiento
    if (estado === 'aprobada' && currentStatus === 'pendiente') {
      if (currentStock < requestedQuantity) {
        await connection.rollback();
        return res.status(400).json({ error: 'Stock insuficiente para aprobar esta solicitud.' });
      }

      // Restar stock
      await connection.execute(
        'UPDATE Articulos SET cantidad = cantidad - ? WHERE id_articulo = ?',
        [requestedQuantity, articleIdFromDB]
      );
      
    await connection.execute(
    `INSERT INTO Movimientos 
        (id_articulo, id_usuario, tipo_movimiento, cantidad, fecha, fecha_movimiento, observacion) 
    VALUES (?, ?, 'retiro', ?, NOW(), NOW(), ?)`,
    [articleIdFromDB, id_usuario_admin, requestedQuantity, `Aprobación solicitud ${id}`]
    );
    }

    // Actualizar estado, respuesta y fecha de acción admin en Solicitudes
    await connection.execute(
    `UPDATE Solicitudes
    SET estado = ?, respuesta_admin = ?, fecha_accion_admin = NOW(), id_usuario_admin = ?
    WHERE id_solicitud = ?`,
    [estado, respuesta_admin, id_usuario_admin, id]
    );
    await connection.commit();
    res.json({ message: `Solicitud ${estado} exitosamente.` });

  } catch (error) {
    await connection.rollback();
    console.error(`Error al actualizar solicitud ${id}:`, error);
    let errorMessage = `Error en el servidor al actualizar la solicitud a ${estado}.`;
    if (error.sqlMessage) {
      errorMessage += ` Detalle: ${error.sqlMessage}`;
    }
    res.status(500).json({ error: errorMessage, details: error.message });
  } finally {
    connection.release();
  }
});




app.delete('/api/solicitudes/:id', async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

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
app.get('/api/movimientos', async (req, res) => {
  try {
    const [movimientos] = await pool.query(`
      SELECT 
          m.id_movimiento, 
          COALESCE(m.nombre_articulo, a.nombre_articulo) AS nombre_articulo,
          u.nombre_usuario AS nombre_usuario,
          m.tipo_movimiento,
          m.cantidad,
          m.fecha,
          m.observacion,
          COALESCE(ca.nombre_categoria, 'Sin categoría') AS nombre_categoria,
          COALESCE(ma.nombre_marca, 'Sin marca') AS nombre_marca,
          COALESCE(p.nombre_proveedor, 'Sin proveedor') AS nombre_proveedor
      FROM movimientos m
      LEFT JOIN articulos a ON m.id_articulo = a.id_articulo
      LEFT JOIN categoriaarticulos ca ON a.id_categoria = ca.id_categoria
      LEFT JOIN marcaarticulos ma ON a.id_marca = ma.id_marca
      LEFT JOIN proveedores p ON a.id_proveedor = p.id_proveedor
      LEFT JOIN usuarios u ON m.id_usuario = u.id_usuario
      ORDER BY m.fecha DESC
      LIMIT 100
    `);

    res.json(movimientos);
  } catch (error) {
    console.error('Error fetching movimientos:', error);
    res.status(500).json({ error: 'Error al obtener movimientos' });
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

// 1. Obtener catálogo completo de un proveedor específico
app.get("/api/proveedores/:id/catalogo", async (req, res) => {
  const { id } = req.params
  try {
    const [rows] = await pool.execute(
      `
            SELECT 
                pa.id_proveedor_articulo,
                pa.id_proveedor,
                pa.id_articulo,
                pa.precio_unitario,
                pa.stock_proveedor,
                pa.tiempo_entrega_dias,
                pa.activo,
                a.nombre_articulo,
                a.descripcion,
                c.nombre_categoria,
                p.nombre_proveedor
            FROM proveedorarticulos pa
            JOIN articulos a ON pa.id_articulo = a.id_articulo
            LEFT JOIN categoriaarticulos c ON a.id_categoria = c.id_categoria
            JOIN proveedores p ON pa.id_proveedor = p.id_proveedor
            WHERE pa.id_proveedor = ?
            ORDER BY a.nombre_articulo
        `,
      [id],
    )
    res.json(rows)
  } catch (error) {
    console.error("Error al obtener catálogo del proveedor:", error)
    res.status(500).json({ error: "Error al obtener catálogo del proveedor" })
  }
})

// 2. Obtener un artículo específico del catálogo
app.get("/api/proveedor-articulos/:id", async (req, res) => {
  const { id } = req.params
  try {
    const [rows] = await pool.execute(
      `
            SELECT 
                pa.id_proveedor_articulo,
                pa.id_proveedor,
                pa.id_articulo,
                pa.precio_unitario,
                pa.stock_proveedor,
                pa.tiempo_entrega_dias,
                pa.activo,
                a.nombre_articulo,
                p.nombre_proveedor
            FROM proveedorarticulos pa
            JOIN articulos a ON pa.id_articulo = a.id_articulo
            JOIN proveedores p ON pa.id_proveedor = p.id_proveedor
            WHERE pa.id_proveedor_articulo = ?
        `,
      [id],
    )

    if (rows.length === 0) {
      return res.status(404).json({ error: "Artículo del catálogo no encontrado" })
    }

    res.json(rows[0])
  } catch (error) {
    console.error("Error al obtener artículo del catálogo:", error)
    res.status(500).json({ error: "Error al obtener artículo del catálogo" })
  }
})

// 3. Agregar artículo al catálogo de un proveedor
app.post("/api/proveedor-articulos", async (req, res) => {
  const { id_proveedor, id_articulo, precio_unitario, stock_proveedor, tiempo_entrega_dias } = req.body

  if (!id_proveedor || !id_articulo || !precio_unitario) {
    return res.status(400).json({ error: "Proveedor, artículo y precio son obligatorios" })
  }

  try {
    // Verificar si ya existe esta combinación
    const [existing] = await pool.execute(
      "SELECT id_proveedor_articulo FROM proveedorarticulos WHERE id_proveedor = ? AND id_articulo = ?",
      [id_proveedor, id_articulo],
    )

    if (existing.length > 0) {
      return res.status(409).json({ error: "Este artículo ya está en el catálogo del proveedor" })
    }

    const [result] = await pool.execute(
      `
            INSERT INTO proveedorarticulos 
            (id_proveedor, id_articulo, precio_unitario, stock_proveedor, tiempo_entrega_dias, activo) 
            VALUES (?, ?, ?, ?, ?, true)
        `,
      [id_proveedor, id_articulo, precio_unitario, stock_proveedor || 0, tiempo_entrega_dias || 7],
    )

    res.status(201).json({
      message: "Artículo agregado al catálogo exitosamente",
      id: result.insertId,
    })
  } catch (error) {
    console.error("Error al agregar artículo al catálogo:", error)
    res.status(500).json({ error: "Error al agregar artículo al catálogo" })
  }
})

// 4. Actualizar artículo del catálogo
app.put("/api/proveedor-articulos/:id", async (req, res) => {
  const { id } = req.params
  const { precio_unitario, stock_proveedor, tiempo_entrega_dias, activo } = req.body

  if (!precio_unitario) {
    return res.status(400).json({ error: "El precio unitario es obligatorio" })
  }

  try {
    const [result] = await pool.execute(
      `
            UPDATE proveedorarticulos 
            SET precio_unitario = ?, stock_proveedor = ?, tiempo_entrega_dias = ?, activo = ?
            WHERE id_proveedor_articulo = ?
        `,
      [precio_unitario, stock_proveedor || 0, tiempo_entrega_dias || 7, activo !== undefined ? activo : true, id],
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Artículo del catálogo no encontrado" })
    }

    res.json({ message: "Artículo del catálogo actualizado exitosamente" })
  } catch (error) {
    console.error("Error al actualizar artículo del catálogo:", error)
    res.status(500).json({ error: "Error al actualizar artículo del catálogo" })
  }
})

// 5. Eliminar artículo del catálogo
app.delete("/api/proveedor-articulos/:id", async (req, res) => {
  const { id } = req.params

  try {
    const [result] = await pool.execute("DELETE FROM proveedorarticulos WHERE id_proveedor_articulo = ?", [id])

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Artículo del catálogo no encontrado" })
    }

    res.json({ message: "Artículo eliminado del catálogo exitosamente" })
  } catch (error) {
    console.error("Error al eliminar artículo del catálogo:", error)
    res.status(500).json({ error: "Error al eliminar artículo del catálogo" })
  }
})

//GET todas las recepciones
app.get("/api/recepciones", async (req, res) => {
  try {
    const [rows] = await pool.execute(`
            SELECT 
                r.id_recepcion,
                r.id_proveedor,
                p.nombre_proveedor,
                r.id_usuario,
                u.nombre_usuario,
                r.fecha_recepcion,
                r.fecha_entrega_estimada,
                r.estado_pedido,
                r.observacion,
                r.cantidad_solicitada,
                r.total_pedido
            FROM recepciones r
            LEFT JOIN proveedores p ON r.id_proveedor = p.id_proveedor
            LEFT JOIN usuarios u ON r.id_usuario = u.id_usuario
            ORDER BY r.fecha_recepcion DESC
        `)
    res.json(rows)
  } catch (error) {
    console.error("Error al obtener recepciones:", error)
    res.status(500).json({ error: "Error en el servidor al obtener recepciones." })
  }
})

//GET recepción específica con detalles
app.get("/api/recepciones/:id", async (req, res) => {
  const { id } = req.params

  try {
    const [recepcionRows] = await pool.execute(
      `
            SELECT 
                r.id_recepcion,
                r.id_proveedor,
                p.nombre_proveedor,
                r.id_usuario,
                u.nombre_usuario,
                r.fecha_recepcion,
                r.fecha_entrega_estimada,
                r.estado_pedido,
                r.observacion,
                r.cantidad_solicitada,
                r.total_pedido
            FROM recepciones r
            LEFT JOIN proveedores p ON r.id_proveedor = p.id_proveedor
            LEFT JOIN usuarios u ON r.id_usuario = u.id_usuario
            WHERE r.id_recepcion = ?
        `,
      [id],
    )

    if (recepcionRows.length === 0) {
      return res.status(404).json({ error: "Recepción no encontrada." })
    }

    const [detalleRows] = await pool.execute(
      `
            SELECT 
                dr.id_detalle_recepcion,
                dr.id_articulo,
                a.nombre_articulo,
                dr.cantidad,
                dr.precio_unitario,
                dr.subtotal,
                dr.estado_item,
                c.nombre_categoria,
                m.nombre_marca
            FROM detallerecepciones dr
            LEFT JOIN articulos a ON dr.id_articulo = a.id_articulo
            LEFT JOIN categoriaarticulos c ON a.id_categoria = c.id_categoria
            LEFT JOIN marcaarticulos m ON a.id_marca = m.id_marca
            WHERE dr.id_recepcion = ?
        `,
      [id],
    )

    const recepcion = recepcionRows[0]
    recepcion.detalles = detalleRows

    res.json(recepcion)
  } catch (error) {
    console.error("Error al obtener recepción por ID:", error)
    res.status(500).json({ error: "Error en el servidor al obtener la recepción." })
  }
})

//POST crear pedido (DIRECTAMENTE COMO 'ENVIADO')
app.post("/api/recepciones", async (req, res) => {
  const { id_proveedor, observacion, articulos } = req.body

  const id_usuario = req.session.userId
  if (!id_usuario) {
    return res.status(401).json({ error: "Usuario no autenticado." })
  }

  if (!id_proveedor || !articulos || articulos.length === 0) {
    return res.status(400).json({ error: "Proveedor y artículos son obligatorios." })
  }

  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const cantidad_total = articulos.reduce((sum, art) => sum + Number.parseInt(art.cantidad), 0)
    const total_pedido = articulos.reduce((sum, art) => sum + Number.parseFloat(art.subtotal), 0)

    // CREAR DIRECTAMENTE COMO 'ENVIADO'
    const [recepcionResult] = await connection.execute(
      `
            INSERT INTO recepciones 
            (id_proveedor, id_usuario, fecha_recepcion, observacion, cantidad_solicitada, estado_pedido, total_pedido, fecha_entrega_estimada)
            VALUES (?, ?, NOW(), ?, ?, 'enviado', ?, DATE_ADD(NOW(), INTERVAL 7 DAY))
        `,
      [id_proveedor, id_usuario, observacion || null, cantidad_total, total_pedido],
    )

    const idRecepcion = recepcionResult.insertId

    for (const articulo of articulos) {
      await connection.execute(
        `
                INSERT INTO detallerecepciones 
                (id_recepcion, id_articulo, cantidad, precio_unitario, subtotal, estado_item)
                VALUES (?, ?, ?, ?, ?, 'pendiente')
            `,
        [idRecepcion, articulo.id_articulo, articulo.cantidad, articulo.precio_unitario, articulo.subtotal],
      )
    }

    await connection.commit()
    res.status(201).json({
      message: "Pedido creado y enviado al proveedor exitosamente",
      id_recepcion: idRecepcion,
    })
  } catch (error) {
    await connection.rollback()
    console.error("Error al crear recepción:", error)
    res.status(500).json({ error: "Error en el servidor al crear el pedido." })
  } finally {
    connection.release()
  }
})

//PUT actualizar estado (SIMPLIFICADO)
app.put("/api/recepciones/:id/status", async (req, res) => {
  const { id } = req.params
  const { estado_pedido } = req.body

  // Solo permitir cambio a 'recibido' o 'cancelado'
  if (!["recibido", "cancelado"].includes(estado_pedido)) {
    return res.status(400).json({ error: "Solo se puede marcar como recibido o cancelado." })
  }

  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    // Verificar que esté en estado 'enviado'
    const [recepcionActual] = await connection.execute(`SELECT estado_pedido FROM recepciones WHERE id_recepcion = ?`, [
      id,
    ])

    if (recepcionActual.length === 0) {
      await connection.rollback()
      return res.status(404).json({ error: "Recepción no encontrada." })
    }

    if (recepcionActual[0].estado_pedido !== "enviado") {
      await connection.rollback()
      return res.status(400).json({ error: "Solo se pueden recibir pedidos que están enviados." })
    }

    // Actualizar estado
    await connection.execute(
      `UPDATE recepciones SET estado_pedido = ?, fecha_entrega_estimada = NOW() WHERE id_recepcion = ?`,
      [estado_pedido, id],
    )

    // Si se marca como recibido, actualizar stock
    if (estado_pedido === "recibido") {
      const [detalles] = await connection.execute(
        `SELECT id_articulo, cantidad FROM detallerecepciones WHERE id_recepcion = ?`,
        [id],
      )

      const id_usuario = req.session.userId || 1

      for (const detalle of detalles) {
        // Actualizar stock
        await connection.execute(`UPDATE articulos SET cantidad = cantidad + ? WHERE id_articulo = ?`, [
          detalle.cantidad,
          detalle.id_articulo,
        ])

        // Registrar movimiento
        await connection.execute(
          `INSERT INTO movimientos (id_articulo, id_usuario, tipo_movimiento, cantidad, fecha, observacion)
           VALUES (?, ?, 'ingreso', ?, NOW(), ?)`,
          [detalle.id_articulo, id_usuario, detalle.cantidad, `Recepción de pedido #${id}`],
        )
      }

      // Actualizar items a 'recibido'
      await connection.execute(`UPDATE detallerecepciones SET estado_item = 'recibido' WHERE id_recepcion = ?`, [id])
    }

    await connection.commit()
    res.json({ message: `Pedido ${estado_pedido} exitosamente.` })
  } catch (error) {
    await connection.rollback()
    console.error("Error al actualizar estado:", error)
    res.status(500).json({ error: "Error en el servidor al actualizar el estado." })
  } finally {
    connection.release()
  }
})

//GET artículos de proveedor
app.get("/api/proveedores/:id/articulos", async (req, res) => {
  const { id } = req.params

  try {
    const [rows] = await pool.execute(
      `
            SELECT 
                pa.id_proveedor_articulo,
                pa.id_articulo,
                a.nombre_articulo,
                pa.precio_unitario,
                pa.stock_proveedor,
                pa.tiempo_entrega_dias,
                pa.activo,
                c.nombre_categoria,
                m.nombre_marca
            FROM proveedorarticulos pa
            JOIN articulos a ON pa.id_articulo = a.id_articulo
            LEFT JOIN categoriaarticulos c ON a.id_categoria = c.id_categoria
            LEFT JOIN marcaarticulos m ON a.id_marca = m.id_marca
            WHERE pa.id_proveedor = ? AND pa.activo = true
            ORDER BY a.nombre_articulo
        `,
      [id],
    )

    res.json(rows)
  } catch (error) {
    console.error("Error al obtener artículos del proveedor:", error)
    res.status(500).json({ error: "Error en el servidor al obtener artículos del proveedor." })
  }
})

//DELETE recepción (solo pendientes)
app.delete("/api/recepciones/:id", async (req, res) => {
  const { id } = req.params

  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const [recepcionRows] = await connection.execute(`SELECT estado_pedido FROM recepciones WHERE id_recepcion = ?`, [
      id,
    ])

    if (recepcionRows.length === 0) {
      await connection.rollback()
      return res.status(404).json({ error: "Recepción no encontrada." })
    }

    if (recepcionRows[0].estado_pedido !== "pendiente") {
      await connection.rollback()
      return res.status(400).json({
        error: "Solo se pueden eliminar recepciones en estado pendiente.",
      })
    }

    await connection.execute(`DELETE FROM detallerecepciones WHERE id_recepcion = ?`, [id])
    await connection.execute(`DELETE FROM recepciones WHERE id_recepcion = ?`, [id])

    await connection.commit()
    res.json({ message: "Recepción eliminada exitosamente." })
  } catch (error) {
    await connection.rollback()
    console.error("Error al eliminar recepción:", error)
    res.status(500).json({ error: "Error en el servidor al eliminar la recepción." })
  } finally {
    connection.release()
  }
})

//GET estadísticas
app.get("/api/recepciones/stats", async (req, res) => {
  try {
    const [stats] = await pool.execute(`
            SELECT 
                COUNT(*) as total_recepciones,
                SUM(CASE WHEN estado_pedido = 'pendiente' THEN 1 ELSE 0 END) as pendientes,
                SUM(CASE WHEN estado_pedido = 'enviado' THEN 1 ELSE 0 END) as enviados,
                SUM(CASE WHEN estado_pedido = 'recibido' THEN 1 ELSE 0 END) as recibidos,
                SUM(total_pedido) as total_valor
            FROM recepciones
            WHERE MONTH(fecha_recepcion) = MONTH(NOW()) 
            AND YEAR(fecha_recepcion) = YEAR(NOW())
        `)

    res.json(stats[0])
  } catch (error) {
    console.error("Error al obtener estadísticas de recepciones:", error)
    res.status(500).json({ error: "Error en el servidor al obtener estadísticas." })
  }
})

module.exports = app
app.post("/logout", (req, res) => {
  // Destruir la sesión
  req.session.destroy((err) => {
    if (err) {
      console.error("Error al cerrar sesión:", err)
      return res.status(500).json({ error: "Error al cerrar sesión" })
    }

    // Limpiar cookie de sesión
    res.clearCookie("connect.sid")

    res.json({
      success: true,
      message: "Sesión cerrada exitosamente",
    })
  })
})
// ==============================================
// ENDPOINTS PARA USUARIO
// ==============================================
// Obtener todos los usuarios con sus roles y departamentos
app.get('/api/usuarios', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        u.id_usuario,
        u.rut,
        u.nombre_usuario,
        u.id_rol,
        r.nombre_rol,
        u.id_departamento,
        d.nombre AS nombre_departamento
      FROM usuarios u
      JOIN roles r ON u.id_rol = r.id_rol
      LEFT JOIN departamentos d ON u.id_departamento = d.id_departamento
      ORDER BY u.nombre_usuario
    `);
    
    // Formatear respuesta para manejar valores nulos
    const usuariosFormateados = rows.map(usuario => ({
      ...usuario,
      nombre_departamento: usuario.nombre_departamento || 'Sin departamento'
    }));
    
    res.json(usuariosFormateados);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ 
      error: 'Error al obtener usuarios',
      detalle: error.message
    });
  }
});

// Obtener un usuario específico por ID
app.get('/api/usuarios/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute(`
      SELECT 
        u.id_usuario,
        u.rut,
        u.nombre_usuario,
        u.id_rol,
        r.nombre_rol,
        u.id_departamento,
        d.nombre AS nombre_departamento
      FROM usuarios u
      JOIN roles r ON u.id_rol = r.id_rol
      LEFT JOIN departamentos d ON u.id_departamento = d.id_departamento
      WHERE u.id_usuario = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const usuario = rows[0];
    usuario.nombre_departamento = usuario.nombre_departamento || 'Sin departamento';
    
    res.json(usuario);
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ 
      error: 'Error al obtener usuario',
      detalle: error.message
    });
  }
});

// ==============================================
// ENDPOINTS PARA ROLES
// ==============================================

// Obtener todos los roles
app.get('/api/roles', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        id_rol,
        nombre_rol 
      FROM roles 
      ORDER BY nombre_rol
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener roles:', error);
    res.status(500).json({ 
      error: 'Error al obtener roles',
      detalle: error.message
    });
  }
});

// ==============================================
// ENDPOINTS PARA DEPARTAMENTOS
// ==============================================

// Obtener todos los departamentos
app.get('/api/departamentos', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        id_departamento,
        nombre AS nombre_departamento
      FROM departamentos 
      ORDER BY nombre
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener departamentos:', error);
    res.status(500).json({ 
      error: 'Error al obtener departamentos',
      detalle: error.message
    });
  }
});

// Crear nuevo departamento
app.post('/api/departamentos', requireAdmin, async (req, res) => {
  const { nombre } = req.body;

  if (!nombre || nombre.trim() === '') {
    return res.status(400).json({ error: 'El nombre del departamento es obligatorio' });
  }

  try {
    const [result] = await pool.execute(
      'INSERT INTO departamentos (nombre) VALUES (?)',
      [nombre.trim()]
    );
    
    res.status(201).json({ 
      message: 'Departamento creado correctamente',
      id_departamento: result.insertId,
      nombre: nombre.trim()
    });
  } catch (error) {
    console.error('Error al crear departamento:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un departamento con ese nombre' });
    }
    
    res.status(500).json({ 
      error: 'Error al crear departamento',
      detalle: error.message
    });
  }
});

// Actualizar departamento
app.put('/api/departamentos/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;

  if (!nombre || nombre.trim() === '') {
    return res.status(400).json({ error: 'El nombre del departamento es obligatorio' });
  }

  try {
    const [result] = await pool.execute(
      'UPDATE departamentos SET nombre = ? WHERE id_departamento = ?',
      [nombre.trim(), id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Departamento no encontrado' });
    }
    
    res.json({ 
      message: 'Departamento actualizado correctamente',
      id_departamento: id,
      nombre: nombre.trim()
    });
  } catch (error) {
    console.error('Error al actualizar departamento:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un departamento con ese nombre' });
    }
    
    res.status(500).json({ 
      error: 'Error al actualizar departamento',
      detalle: error.message
    });
  }
});

// Eliminar departamento
app.delete('/api/departamentos/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Verificar si hay usuarios en este departamento
    const [usuarios] = await pool.execute(
      'SELECT id_usuario FROM usuarios WHERE id_departamento = ? LIMIT 1',
      [id]
    );

    if (usuarios.length > 0) {
      return res.status(400).json({ 
        error: 'No se puede eliminar el departamento porque tiene usuarios asignados' 
      });
    }

    const [result] = await pool.execute(
      'DELETE FROM departamentos WHERE id_departamento = ?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Departamento no encontrado' });
    }
    
    res.json({ 
      message: 'Departamento eliminado correctamente',
      id_departamento: id
    });
  } catch (error) {
    console.error('Error al eliminar departamento:', error);
    res.status(500).json({ 
      error: 'Error al eliminar departamento',
      detalle: error.message
    });
  }
});
const bcrypt = require('bcryptjs');
// Crear un nuevo usuario
app.post('/api/usuarios', requireAdmin, async (req, res) => {
  const { rut, nombre_usuario, contrasena, id_rol, id_departamento } = req.body;

  // Validaciones básicas
  if (!rut || !nombre_usuario || !contrasena || !id_rol) {
    return res.status(400).json({ message: 'Los campos RUT, nombre, contraseña y rol son obligatorios.' });
  }

  try {
    // Hashear la contraseña antes de guardarla
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(contrasena, salt);

    const [result] = await pool.execute(
      'INSERT INTO usuarios (rut, nombre_usuario, contrasena, id_rol, id_departamento) VALUES (?, ?, ?, ?, ?)',
      [rut, nombre_usuario, hashedPassword, id_rol, id_departamento || null]
    );

    res.status(201).json({ 
      message: 'Usuario creado correctamente', 
      id_usuario: result.insertId 
    });

  } catch (error) {
    console.error('Error al crear usuario:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'El RUT ingresado ya está registrado.' });
    }
    res.status(500).json({ message: 'Error interno del servidor al crear el usuario.' });
  }
});

// Actualizar un usuario existente
app.put('/api/usuarios/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { rut, nombre_usuario, contrasena, id_rol, id_departamento } = req.body;

  if (!rut || !nombre_usuario || !id_rol) {
    return res.status(400).json({ message: 'Los campos RUT, nombre y rol son obligatorios.' });
  }

  try {
    // Construimos la consulta y los parámetros dinámicamente
    let query = 'UPDATE usuarios SET rut = ?, nombre_usuario = ?, id_rol = ?, id_departamento = ?';
    const params = [rut, nombre_usuario, id_rol, id_departamento || null];

    // Solo actualizamos la contraseña si se proporcionó una nueva
    if (contrasena && contrasena.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(contrasena, salt);
      query += ', contrasena = ?';
      params.push(hashedPassword);
    }

    // Añadimos la condición WHERE al final
    query += ' WHERE id_usuario = ?';
    params.push(id);

    // Ejecutamos la consulta de actualización directamente
    const [result] = await pool.execute(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    res.json({ message: 'Usuario actualizado correctamente.' });

  } catch (error) {
    // Este bloque catch ahora manejará los errores de duplicados de MySQL
    console.error('Error al actualizar usuario:', error);
    
    // Si el error es por un RUT duplicado, enviamos un 409.
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'El RUT ingresado ya pertenece a otro usuario.' });
    }
    
    // Para cualquier otro error, enviamos un 500.
    res.status(500).json({ message: 'Error interno del servidor al actualizar el usuario.' });
  }
});

// Eliminar un usuario
app.delete('/api/usuarios/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.execute('DELETE FROM usuarios WHERE id_usuario = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        res.json({ message: 'Usuario eliminado correctamente' });

    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({ message: 'Error interno del servidor al eliminar el usuario.' });
    }
});
app.get('/api/usuarios/check-rut/:rut', async (req, res) => {
  try {
    const { rut } = req.params;
    const [rows] = await pool.execute(
      'SELECT id_usuario FROM usuarios WHERE rut = ?',
      [rut]
    );
    
    if (rows.length > 0) {
      res.json({ exists: true, userId: rows[0].id_usuario });
    } else {
      res.json({ exists: false });
    }
  } catch (error) {
    console.error('Error verificando RUT:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});



// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log('¡Listo para gestionar tu inventario!');
});



