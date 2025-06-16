<?php
$usuario = $_POST['usuario'];
$contrasena = $_POST['contrasena'];

$conexion = new mysqli("localhost", "root", "", "inventario_muni");

if ($conexion->connect_error) {
  die("Error de conexión: " . $conexion->connect_error);
}

$sql = "SELECT * FROM usuarios WHERE usuario=? AND contrasena=?";
$stmt = $conexion->prepare($sql);
$stmt->bind_param("ss", $usuario, $contrasena);
$stmt->execute();
$resultado = $stmt->get_result();

if ($resultado->num_rows > 0) {
  header("Location: main.html");
  exit();
} else {
  echo "<script>alert('Usuario o contraseña incorrectos'); window.history.back();</script>";
}

$stmt->close();
$conexion->close();
?>
