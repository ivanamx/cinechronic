// Configuración de PM2 para producción en VPS
// Instalar PM2: npm install -g pm2
// Iniciar: pm2 start ecosystem.config.js
// Ver logs: pm2 logs cinechronic-backend
// Reiniciar: pm2 restart cinechronic-backend

module.exports = {
  apps: [{
    name: 'cinechronic-backend',
    script: './src/server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 4000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    // Reiniciar si el proceso usa más de 1GB de RAM
  }]
};

