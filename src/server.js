import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import { generalLimiter } from './middleware/validation.js';
import authRoutes from './routes/authRoutes.js';
import pageRoutes from './routes/pageRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';

dotenv.config();

const app = express();


connectDB();

app.use(helmet());
app.set('trust proxy', 1);
// CORS
const corsOptions = {
    origin:[process.env.FRONTEND_URL,'http://localhost:3000'],
    credentials: true,
    optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logger
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// Rate limiting
app.use('/api/', generalLimiter);

// Health check
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/pages', pageRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/webhooks', webhookRoutes);

// Ruta 404
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Ruta no encontrada',
    });
});

// Manejador de errores global
app.use((err, req, res, next) => {
    console.error('Error:', err);

    // Error de Multer (subida de archivos)
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            success: false,
            message: 'El archivo es demasiado grande. Máximo 5MB',
        });
    }

    if (err.message && err.message.includes('Tipo de archivo no válido')) {
        return res.status(400).json({
            success: false,
            message: err.message,
        });
    }

    // Error de validación de Mongoose
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map((e) => e.message);
        return res.status(400).json({
            success: false,
            message: 'Error de validación',
            errors,
        });
    }

    // Error de duplicado en MongoDB
    if (err.code === 11000) {
        return res.status(400).json({
            success: false,
            message: 'Ya existe un registro con esos datos',
        });
    }

    // Error genérico
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Error interno del servidor',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
});

// Puerto
const PORT = process.env.PORT || 5000;

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║   🚀 Love Pages Backend Server Running    ║
╠════════════════════════════════════════════╣
║   Environment: ${process.env.NODE_ENV?.toUpperCase().padEnd(26)} ║
║   Port: ${PORT.toString().padEnd(33)} ║
║   URL: http://localhost:${PORT.toString().padEnd(18)} ║
╚════════════════════════════════════════════╝
  `);
});

// Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Rejection:', err);
    // Cerrar servidor y salir del proceso
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
});

export default app;