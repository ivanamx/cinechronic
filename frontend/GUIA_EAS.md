# 🚀 Guía para Subir la App a EAS (Expo Application Services)

## ✅ Configuración Actual

- ✅ EAS CLI instalado y autenticado como `ivanamx`
- ✅ Proyecto configurado con ID: `849f2e17-178a-425a-9b19-b10bae9ef206`
- ✅ Configuración de URLs del API actualizada

## 📋 Pasos para Subir la App

### 1. Configurar la URL de Producción del Backend

**IMPORTANTE:** Antes de hacer el build de producción, actualiza la URL del API:

#### Opción A: En `app.json`
Edita `frontend/app.json` y cambia:
```json
"apiUrl": "https://your-production-api.com/api"
```
Por tu URL real:
```json
"apiUrl": "https://api.tudominio.com/api"
```

#### Opción B: En `api.ts` (si prefieres hardcodear)
Edita `frontend/src/services/api.ts` y cambia:
```typescript
const PROD_URL = 'https://your-production-api.com/api';
```

### 2. Verificar que el Backend Esté Desplegado

Asegúrate de que tu backend esté:
- ✅ Desplegado en el VPS
- ✅ Accesible públicamente (con dominio o IP)
- ✅ Con SSL/HTTPS configurado (recomendado)
- ✅ Con CORS configurado para permitir requests desde la app

### 3. Crear el Build

#### Para Android (Preview - Testing):
```bash
cd frontend
npx eas-cli build --platform android --profile preview
```

#### Para Android (Producción):
```bash
cd frontend
npx eas-cli build --platform android --profile production
```

#### Para iOS (Producción):
```bash
cd frontend
npx eas-cli build --platform ios --profile production
```

#### Para ambas plataformas:
```bash
cd frontend
npx eas-cli build --platform all --profile production
```

### 4. Seguir el Progreso del Build

El comando te dará un enlace para seguir el progreso. También puedes verlo en:
- Dashboard de EAS: https://expo.dev/accounts/ivanamx/projects/cinechronic/builds

### 5. Descargar el APK/IPA

Una vez completado el build:
- El enlace de descarga aparecerá en la terminal
- O puedes descargarlo desde el dashboard de EAS

### 6. (Opcional) Subir a Google Play / App Store

```bash
# Para Android (Google Play)
npx eas-cli submit --platform android --profile production

# Para iOS (App Store)
npx eas-cli submit --platform ios --profile production
```

## 🔧 Configuración de Perfiles de Build

Los perfiles están en `eas.json`:

- **development**: Para desarrollo con Expo Go
- **preview**: Para testing interno (APK/IPA descargable)
- **production**: Para producción (listo para stores)

## 📝 Notas Importantes

1. **Primera vez**: El primer build puede tardar 15-30 minutos
2. **Credenciales**: EAS manejará automáticamente las credenciales de Android/iOS
3. **Versiones**: El build de producción incrementa automáticamente la versión
4. **API URL**: Asegúrate de que la URL de producción esté correcta antes del build

## 🐛 Troubleshooting

### Error: "No credentials found"
```bash
npx eas-cli credentials
```

### Error: "Build failed"
- Revisa los logs en el dashboard de EAS
- Verifica que todas las dependencias estén en `package.json`
- Asegúrate de que no haya errores de TypeScript

### Cambiar la URL después del build
Si necesitas cambiar la URL del API después del build, puedes:
1. Hacer un nuevo build (recomendado)
2. O usar EAS Updates para actualizar la configuración sin rebuild

## 🔗 Enlaces Útiles

- Dashboard EAS: https://expo.dev
- Documentación EAS: https://docs.expo.dev/build/introduction/
- Estado de EAS: https://status.expo.dev

