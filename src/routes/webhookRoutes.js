import express from 'express';
import paymentController from '../controllers/paymentController.js';

const router = express.Router();

/**
 * @route   POST /api/webhooks/mercadopago
 * @desc    Webhook para notificaciones de Mercado Pago
 * @access  Public (validado por Mercado Pago)
 */
router.post('/mercadopago', (req, res) => paymentController.handleMercadoPagoWebhook(req, res));

/**
 * @route   POST /api/webhooks/paypal
 * @desc    Webhook para notificaciones de PayPal
 * @access  Public (validado por PayPal)
 */
router.post('/paypal', (req, res) => paymentController.handlePayPalWebhook(req, res));

export default router;