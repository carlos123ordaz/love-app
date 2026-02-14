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
 * ✅ FIX: PayPal webhook necesita el raw body para verificar la firma
 * Usamos express.raw() para obtener el body sin parsear
 * y luego lo parseamos manualmente
 */
router.post(
    '/paypal',
    express.raw({ type: 'application/json' }),
    (req, res, next) => {
        // Guardar el raw body para verificación de firma
        if (Buffer.isBuffer(req.body)) {
            req.rawBody = req.body.toString('utf8');
            req.body = JSON.parse(req.rawBody);
        } else if (typeof req.body === 'string') {
            req.rawBody = req.body;
            req.body = JSON.parse(req.body);
        } else {
            // Si ya fue parseado por el middleware global de JSON
            req.rawBody = JSON.stringify(req.body);
        }
        next();
    },
    (req, res) => paymentController.handlePayPalWebhook(req, res)
);

export default router;