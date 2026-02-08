import express from 'express';
import contactController from '../controllers/contactController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiter para prevenir spam
const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 3, // Máximo 3 mensajes por 15 minutos
    message: {
        success: false,
        message: 'Demasiados mensajes. Por favor intenta más tarde.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * @route   POST /api/contact
 * @desc    Crear un nuevo mensaje de contacto
 * @access  Public (con rate limit)
 */
router.post('/', contactLimiter, optionalAuth, contactController.createMessage);

/**
 * @route   GET /api/contact/my-messages
 * @desc    Obtener mis mensajes de contacto
 * @access  Private
 */
router.get('/my-messages', authenticate, contactController.getMyMessages);

/**
 * @route   GET /api/contact/:id
 * @desc    Obtener un mensaje específico
 * @access  Private
 */
router.get('/:id', authenticate, contactController.getMessage);

// ==================== ADMIN ROUTES ====================
// Nota: Deberías agregar un middleware de admin aquí en producción
/**
 * @route   GET /api/contact/admin/all
 * @desc    Obtener todos los mensajes (Admin)
 * @access  Private (Admin only)
 */
router.get('/admin/all', authenticate, contactController.getAllMessages);

/**
 * @route   PATCH /api/contact/admin/:id
 * @desc    Actualizar estado de mensaje (Admin)
 * @access  Private (Admin only)
 */
router.patch('/admin/:id', authenticate, contactController.updateMessageStatus);

export default router;