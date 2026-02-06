import express from 'express';
import paymentController from '../controllers/paymentController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   POST /api/payments/create-preference
 * @desc    Crear preferencia de pago para plan PRO
 * @access  Private
 */
router.post('/create-preference', authenticate, paymentController.createPreference);

/**
 * @route   GET /api/payments/:paymentId/status
 * @desc    Verificar estado de un pago
 * @access  Private
 */
router.get('/:paymentId/status', authenticate, paymentController.checkPaymentStatus);

/**
 * @route   GET /api/payments/history
 * @desc    Obtener historial de pagos
 * @access  Private
 */
router.get('/history', authenticate, paymentController.getPaymentHistory);

/**
 * @route   POST /api/payments/simulate-success
 * @desc    Simular pago exitoso (SOLO DESARROLLO)
 * @access  Private
 */
if (process.env.NODE_ENV !== 'production') {
    router.post('/simulate-success', authenticate, paymentController.simulatePaymentSuccess);
}

export default router;