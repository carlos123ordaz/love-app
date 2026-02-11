import express from 'express';
import paymentController from '../controllers/paymentController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// ============================================================
// MERCADO PAGO
// ============================================================

/**
 * @route   POST /api/payments/mercadopago/create-preference
 * @desc    Crear preferencia de pago MercadoPago para plan PRO
 * @access  Private
 */
router.post('/mercadopago/create-preference', authenticate, paymentController.createMercadoPagoPreference);

// ============================================================
// PAYPAL
// ============================================================

/**
 * @route   POST /api/payments/paypal/create-order
 * @desc    Crear orden de PayPal para plan PRO
 * @access  Private
 */
router.post('/paypal/create-order', authenticate, paymentController.createPayPalOrder);

/**
 * @route   POST /api/payments/paypal/capture/:orderId
 * @desc    Capturar pago de PayPal después de la aprobación
 * @access  Private
 */
router.post('/paypal/capture/:orderId', authenticate, paymentController.capturePayPalPayment);

// ============================================================
// RUTAS COMUNES
// ============================================================

/**
 * @route   GET /api/payments/:provider/:paymentId/status
 * @desc    Verificar estado de un pago
 * @access  Private
 */
router.get('/:provider/:paymentId/status', authenticate, paymentController.checkPaymentStatus);

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

// ============================================================
// COMPATIBILIDAD CON VERSIÓN ANTERIOR (Opcional)
// ============================================================

/**
 * @route   POST /api/payments/create-preference
 * @desc    Alias para MercadoPago (retrocompatibilidad)
 * @access  Private
 */
router.post('/create-preference', authenticate, paymentController.createMercadoPagoPreference);

export default router;