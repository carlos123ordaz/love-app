# Love Pages - Backend API

Backend para la aplicación de creación de páginas personalizadas para ocasiones especiales.

## 🚀 Características

- ✅ Autenticación con Firebase (Google OAuth)
- ✅ Gestión de usuarios y páginas
- ✅ Integración con Gemini AI para generación de páginas personalizadas
- ✅ Sistema de pagos con Mercado Pago (Perú)
- ✅ Almacenamiento de imágenes en Firebase Storage
- ✅ Base de datos MongoDB
- ✅ Rate limiting y seguridad
- ✅ Webhooks de Mercado Pago

## 📋 Requisitos Previos

- Node.js v18 o superior
- MongoDB (local o Atlas)
- Cuenta de Firebase
- API Key de Gemini
- Cuenta de Mercado Pago

## 🛠️ Instalación

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd backend
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**

Copiar `.env.example` a `.env` y completar:

```bash
cp .env.example .env
```

### Configuración de Firebase

1. Crear proyecto en [Firebase Console](https://console.firebase.google.com)
2. Habilitar Google Authentication
3. Ir a Project Settings > Service Accounts
4. Generar nueva clave privada (JSON)
5. Copiar los valores al `.env`:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_PRIVATE_KEY`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_STORAGE_BUCKET`

### Configuración de MongoDB

**Opción 1: MongoDB Local**
```bash
MONGODB_URI=mongodb://localhost:27017/lovepages
```

**Opción 2: MongoDB Atlas**
1. Crear cluster en [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Obtener connection string
3. Agregar al `.env`:
```bash
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/lovepages
```

### Configuración de Gemini AI

1. Obtener API Key en [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Agregar al `.env`:
```bash
GEMINI_API_KEY=your-api-key
```

### Configuración de Mercado Pago

1. Crear cuenta en [Mercado Pago Developers](https://www.mercadopago.com.pe/developers)
2. Obtener credenciales (Access Token)
3. Agregar al `.env`:
```bash
MERCADOPAGO_ACCESS_TOKEN=your-access-token
MERCADOPAGO_PUBLIC_KEY=your-public-key
```

## 🚀 Ejecutar el Servidor

### Desarrollo
```bash
npm run dev
```

### Producción
```bash
npm start
```

El servidor estará disponible en `http://localhost:5000`

## 📡 API Endpoints

### Autenticación
- `GET /api/auth/me` - Obtener usuario actual
- `POST /api/auth/sync` - Sincronizar usuario
- `PATCH /api/auth/profile` - Actualizar perfil
- `DELETE /api/auth/account` - Eliminar cuenta

### Páginas
- `POST /api/pages` - Crear página
- `GET /api/pages/my-pages` - Listar páginas del usuario
- `GET /api/pages/:shortId` - Obtener página pública
- `POST /api/pages/:shortId/respond` - Responder a página
- `GET /api/pages/:pageId/details` - Detalles completos (owner)
- `PATCH /api/pages/:pageId` - Actualizar página
- `DELETE /api/pages/:pageId` - Eliminar página
- `PATCH /api/pages/:pageId/toggle` - Toggle estado activo
- `GET /api/pages/stats` - Estadísticas del usuario

### Pagos
- `POST /api/payments/create-preference` - Crear preferencia de pago
- `GET /api/payments/:paymentId/status` - Estado de pago
- `GET /api/payments/history` - Historial de pagos
- `POST /api/payments/simulate-success` - Simular pago (solo dev)

### Webhooks
- `POST /api/webhooks/mercadopago` - Webhook de Mercado Pago

## 🔐 Autenticación

Todas las rutas protegidas requieren un token de Firebase en el header:

```
Authorization: Bearer <firebase-id-token>
```

## 📦 Estructura del Proyecto

```
backend/
├── src/
│   ├── config/          # Configuración (DB, Firebase)
│   ├── controllers/     # Controladores de rutas
│   ├── middleware/      # Middlewares (auth, validación)
│   ├── models/          # Modelos de Mongoose
│   ├── routes/          # Definición de rutas
│   ├── services/        # Servicios (Storage, Gemini, MP)
│   └── server.js        # Servidor principal
├── .env                 # Variables de entorno
├── .env.example         # Ejemplo de variables
├── package.json
└── README.md
```

## 🧪 Testing

### Probar autenticación
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

### Simular pago PRO (solo desarrollo)
```bash
curl -X POST http://localhost:5000/api/payments/simulate-success \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

## 🚨 Manejo de Errores

El servidor incluye manejo centralizado de errores:
- Validación de datos
- Límites de tasa (rate limiting)
- Errores de MongoDB
- Errores de Firebase
- Errores de Mercado Pago

## 📝 Notas Importantes

### Límites
- **Usuarios gratuitos**: 5 páginas máximo
- **Usuarios PRO**: Páginas ilimitadas
- **Tamaño de imagen**: Máximo 5MB
- **Rate limiting**: 100 requests/15min (general)

### Seguridad
- Helmet para headers HTTP seguros
- CORS configurado
- Validación de inputs
- Sanitización de datos
- Rate limiting por IP

### Webhooks de Mercado Pago

Para configurar webhooks en producción:
1. Ir a [Mercado Pago Dashboard](https://www.mercadopago.com.pe/developers/panel)
2. Configurar Webhooks
3. URL: `https://your-domain.com/api/webhooks/mercadopago`
4. Eventos: `payment`

## 🐛 Troubleshooting

### Error: "Firebase Admin initialization failed"
- Verificar que el `FIREBASE_PRIVATE_KEY` tenga los saltos de línea correctos
- Asegurarse de usar comillas dobles en el `.env`

### Error: "MongoDB connection failed"
- Verificar que MongoDB esté corriendo
- Revisar el connection string en `.env`
- Verificar IP whitelist en MongoDB Atlas

### Error: "Gemini API error"
- Verificar que el API key sea válido
- Revisar cuota de uso en Google AI Studio

### Error: "Mercado Pago authentication failed"
- Verificar credenciales en `.env`
- Asegurarse de usar el access token correcto para Perú

## 📞 Soporte

Para problemas o preguntas, crear un issue en el repositorio.

## 📄 Licencia

MIT