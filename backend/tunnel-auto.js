const localtunnel = require('localtunnel');
const { spawn } = require('child_process');

const PORT = 3000;
const SUBDOMAIN = 'cinechronic';
let tunnel = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = Infinity; // Reconectar infinitamente

function createTunnel() {
  console.log(`\n🔗 Intentando conectar tunnel (intento ${reconnectAttempts + 1})...`);
  
  // Intentar primero con subdominio personalizado
  const tunnelOptions = reconnectAttempts < 3 ? { subdomain: SUBDOMAIN } : {};
  
  tunnel = localtunnel(PORT, tunnelOptions, (err, tunnelInstance) => {
    if (err) {
      console.error('❌ Error al crear tunnel:', err.message);
      if (err.message.includes('subdomain') || err.message.includes('taken')) {
        console.log('⚠️  El subdominio está ocupado. Intentando con subdominio aleatorio...');
      }
      reconnectAttempts++;
      console.log(`⏳ Reintentando en 5 segundos...`);
      setTimeout(createTunnel, 5000);
      return;
    }

    reconnectAttempts = 0; // Reset contador al conectar exitosamente
    
    console.log('\n✅ Tunnel conectado exitosamente!');
    console.log(`🌐 URL pública: ${tunnelInstance.url}`);
    console.log(`📡 Redirigiendo a: http://localhost:${PORT}`);
    console.log('\n⚠️  IMPORTANTE: Si la URL es diferente a https://little-insects-camp.loca.lt');
    console.log('   Actualiza la URL en frontend/app.json en la sección "extra.ngrokUrl"');
    console.log('\n⚠️  Este tunnel se reconectará automáticamente si se desconecta.');
    console.log('   Presiona Ctrl+C para detener.\n');
  });

  tunnel.on('close', () => {
    console.log('\n⚠️  Tunnel desconectado. Reconectando automáticamente...');
    reconnectAttempts++;
    setTimeout(createTunnel, 2000); // Reconectar después de 2 segundos
  });

  tunnel.on('error', (err) => {
    console.error('❌ Error en tunnel:', err.message);
    // El evento 'close' se disparará después, así que no reconectamos aquí
  });
}

// Manejar cierre limpio
process.on('SIGINT', () => {
  console.log('\n\n🛑 Cerrando tunnel...');
  if (tunnel) {
    tunnel.close();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (tunnel) {
    tunnel.close();
  }
  process.exit(0);
});

// Verificar que el backend esté corriendo
console.log('🔍 Verificando que el backend esté corriendo en el puerto 3000...');
console.log('   Si no está corriendo, inicia el backend primero con: npm run dev\n');

// Iniciar tunnel
createTunnel();

