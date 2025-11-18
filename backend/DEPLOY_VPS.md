# 🚀 Guía de Despliegue en VPS - CineChronic Backend

## 📋 Requisitos Previos

- VPS con Ubuntu 20.04+ o similar
- Acceso SSH al servidor
- PostgreSQL instalado
- Node.js 18+ y npm instalados
- PM2 instalado (gestor de procesos)

## 🔧 Instalación Paso a Paso

### 1. Conectar al VPS
```bash
ssh usuario@tu-vps-ip
```

### 2. Instalar Dependencias del Sistema
```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Instalar PM2 globalmente
sudo npm install -g pm2

# Instalar Nginx (opcional, para reverse proxy)
sudo apt install nginx -y
```

### 3. Configurar PostgreSQL
```bash
# Cambiar a usuario postgres
sudo -u postgres psql

# Crear base de datos y usuario
CREATE DATABASE cinechronic;
CREATE USER cinechronic_user WITH PASSWORD 'tu_password_seguro';
GRANT ALL PRIVILEGES ON DATABASE cinechronic TO cinechronic_user;
\q
```

### 4. Clonar el Repositorio
```bash
cd /var/www  # o donde prefieras
git clone https://github.com/ivanamx/cinechronic.git
cd cinechronic/backend
```

### 5. Instalar Dependencias
```bash
npm install --production
```

### 6. Configurar Variables de Entorno
```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar con tus valores
nano .env
```

**Configuración mínima del .env:**
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cinechronic
DB_USER=cinechronic_user
DB_PASSWORD=tu_password_seguro
PORT=3000
NODE_ENV=production
JWT_SECRET=genera_un_secret_muy_seguro
GEMINI_API_KEY=tu_api_key
TMDB_API_KEY=tu_api_key
```

### 7. Ejecutar Migraciones
```bash
npm run migrate
```

### 8. Iniciar con PM2
```bash
# Iniciar aplicación
pm2 start ecosystem.config.js --env production

# Guardar configuración para que se inicie al reiniciar el servidor
pm2 save
pm2 startup
```

### 9. Verificar que Funciona
```bash
# Ver logs
pm2 logs cinechronic-backend

# Ver estado
pm2 status

# Probar endpoint
curl http://localhost:3000/health
```

## 🌐 Configurar Nginx como Reverse Proxy (Recomendado)

### 1. Crear Configuración de Nginx
```bash
sudo nano /etc/nginx/sites-available/cinechronic
```

**Contenido:**
```nginx
server {
    listen 80;
    server_name tu-dominio.com www.tu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. Habilitar Sitio
```bash
sudo ln -s /etc/nginx/sites-available/cinechronic /etc/nginx/sites-enabled/
sudo nginx -t  # Verificar configuración
sudo systemctl restart nginx
```

### 3. Configurar SSL con Let's Encrypt (Opcional pero Recomendado)
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com
```

## 🔄 Actualizar la Aplicación

```bash
cd /var/www/cinechronic/backend
git pull origin main
npm install --production
npm run migrate  # Si hay nuevas migraciones
pm2 restart cinechronic-backend
```

## 📊 Comandos Útiles de PM2

```bash
# Ver logs en tiempo real
pm2 logs cinechronic-backend

# Ver estado
pm2 status

# Reiniciar
pm2 restart cinechronic-backend

# Detener
pm2 stop cinechronic-backend

# Eliminar de PM2
pm2 delete cinechronic-backend

# Ver uso de recursos
pm2 monit
```

## 🔒 Seguridad

1. **Firewall (UFW)**
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

2. **Actualizar CORS en server.js**
   - Cambiar `origin: '*'` por tu dominio específico en producción

3. **Variables de Entorno**
   - Nunca subas el archivo `.env` a Git
   - Usa secretos seguros para JWT_SECRET

## 🐛 Troubleshooting

### La aplicación no inicia
```bash
# Ver logs detallados
pm2 logs cinechronic-backend --lines 100

# Verificar que el puerto esté libre
sudo netstat -tulpn | grep 3000
```

### Error de conexión a base de datos
```bash
# Verificar que PostgreSQL esté corriendo
sudo systemctl status postgresql

# Probar conexión
psql -U cinechronic_user -d cinechronic -h localhost
```

### Error de permisos
```bash
# Dar permisos al usuario
sudo chown -R $USER:$USER /var/www/cinechronic
```

## 📝 Notas

- El backend correrá en el puerto 3000 por defecto
- PM2 reiniciará automáticamente la app si se cae
- Los logs se guardan en `backend/logs/`
- Para producción, considera usar un proceso manager como systemd si prefieres

---

**¿Problemas?** Revisa los logs con `pm2 logs cinechronic-backend`

