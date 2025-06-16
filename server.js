const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
const PORT = 3000;

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'inventario_muni',
};

const pool = mysql.createPool(dbConfig);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Servir carpeta display como estática
app.use(express.static(path.join(__dirname, 'display')));
app.use('/imgs', express.static(path.join(__dirname, 'imgs')));

// Ruta raíz sirve login.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'display', 'login.html'));
});

// Login
app.post('/login', async (req, res) => {
  const { usuario, contrasena } = req.body; // coincide con los name del form

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM Usuarios WHERE nombre_usuario = ? AND contrasena = ?',
      [usuario, contrasena]
    );

    if (rows.length > 0) {
      // Login correcto
      res.redirect('/main.html');
    } else {
      res.status(401).send('Usuario o contraseña incorrectos');
    }
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).send('Error en el servidor');
  }
});

// Endpoint para obtener artículos
app.get('/api/articulos', async (req, res) => {
  try {
    const [articulos] = await pool.execute('SELECT * FROM articulos');
    res.json(articulos);
  } catch (error) {
    console.error('Error obteniendo articulos:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Endpoint para obtener movimientos recientes
app.get('/api/movimientos', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT m.*, a.nombre_articulo, u.usuario 
      FROM Movimientos m 
      JOIN Articulos a ON m.id_articulo = a.id_articulo
      JOIN Usuarios u ON m.id_usuario = u.id
      ORDER BY m.fecha DESC
      LIMIT 10
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error al obtener movimientos:', error);
    res.status(500).send('Error en el servidor');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
