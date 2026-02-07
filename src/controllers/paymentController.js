import User from '../models/User.js';
import mercadoPagoService from '../services/mercadoPagoService.js';
import 'dotenv/config';

class PaymentController {
    /**
     * Crear preferencia de pago para plan PRO
     * POST /api/payments/create-preference
     */
    async createPreference(req, res) {
        console.log('MERCADOPAGO_ACCESS_TOKEN:', process.env.MERCADOPAGO_ACCESS_TOKEN);
        try {
            const user = req.user;
            if (user.isProActive()) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya tienes un plan PRO activo',
                    code: 'ALREADY_PRO',
                });
            }
            const preference = await mercadoPagoService.createProPlanPreference(user);

            return res.json({
                success: true,
                message: 'Preferencia de pago creada exitosamente',
                data: {
                    preferenceId: preference.preferenceId,
                    initPoint: preference.initPoint,
                    sandboxInitPoint: preference.sandboxInitPoint,
                },
            });
        } catch (error) {
            console.error('Error creating payment preference:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al crear preferencia de pago',
                error: error.message,
            });
        }
    }

    /**
     * Verificar estado de un pago
     * GET /api/payments/:paymentId/status
     */
    async checkPaymentStatus(req, res) {
        try {
            const { paymentId } = req.params;
            const user = req.user;

            const paymentInfo = await mercadoPagoService.getPaymentInfo(paymentId);

            // Verificar que el pago pertenezca al usuario
            if (paymentInfo.external_reference !== user._id.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permiso para acceder a este pago',
                });
            }

            return res.json({
                success: true,
                data: {
                    paymentId: paymentInfo.id,
                    status: paymentInfo.status,
                    statusDetail: paymentInfo.status_detail,
                    amount: paymentInfo.transaction_amount,
                    currency: paymentInfo.currency_id,
                    dateCreated: paymentInfo.date_created,
                    isApproved: mercadoPagoService.isPaymentApproved(paymentInfo),
                },
            });
        } catch (error) {
            console.error('Error checking payment status:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al verificar estado del pago',
            });
        }
    }

    /**
     * Obtener historial de pagos del usuario
     * GET /api/payments/history
     */
    async getPaymentHistory(req, res) {
        try {
            const user = req.user;

            return res.json({
                success: true,
                data: {
                    payments: user.payments || [],
                    isPro: user.isProActive(),
                    totalPayments: user.payments?.length || 0,
                },
            });
        } catch (error) {
            console.error('Error getting payment history:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al obtener historial de pagos',
            });
        }
    }

    /**
     * Webhook de Mercado Pago
     * POST /api/webhooks/mercadopago
     */
    async handleWebhook(req, res) {
        try {
            // Responder rápido a MercadoPago para evitar reintentos
            res.status(200).send('OK');

            let webhookData;

            if (req.body?.action || req.body?.type === 'payment') {
                // Formato nuevo (body con action)
                webhookData = req.body;
            } else if (req.query.topic || req.query.type) {
                // Formato IPN legacy (query params)
                webhookData = {
                    type: req.query.topic || req.query.type,
                    data: { id: req.query.id || req.query['data.id'] },
                };
            } else {
                console.log('⚠️ Webhook format not recognized');
                return;
            }

            console.log('📩 Webhook received:', webhookData);

            const result = await mercadoPagoService.processWebhookNotification(webhookData);

            if (!result.processed) {
                console.log('⚠️ Webhook not processed:', result.reason);
                return;
            }

            const { paymentInfo, externalReference } = result;
            const user = await User.findById(externalReference);

            if (!user) {
                console.error('❌ User not found for payment:', externalReference);
                return;
            }

            if (mercadoPagoService.isPaymentApproved(paymentInfo)) {
                await this.activateProPlan(user, paymentInfo);
            }
        } catch (error) {
            console.error('Error handling webhook:', error);
        }
    }

    /**
     * Activar plan PRO para un usuario
     */
    async activateProPlan(user, paymentInfo) {
        try {
            // Verificar si el pago ya fue procesado
            const paymentExists = user.payments.some((p) => p.mercadoPagoId === paymentInfo.id.toString());

            if (paymentExists) {
                console.log('⚠️ Payment already processed:', paymentInfo.id);
                return;
            }

            // Activar plan PRO
            user.isPro = true;
            user.proExpiresAt = null; // PRO permanente

            // Agregar pago al historial
            const formattedPayment = mercadoPagoService.formatPaymentData(paymentInfo);
            user.payments.push(formattedPayment);

            await user.save();

            console.log(`✅ PRO plan activated for user: ${user.email}`);
        } catch (error) {
            console.error('Error activating PRO plan:', error);
            throw error;
        }
    }

    /**
     * Simular pago exitoso (solo para desarrollo)
     * POST /api/payments/simulate-success
     * ELIMINAR EN PRODUCCIÓN
     */
    async simulatePaymentSuccess(req, res) {
        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({
                success: false,
                message: 'Endpoint no disponible en producción',
            });
        }

        try {
            const user = req.user;

            user.isPro = true;
            user.proExpiresAt = null;

            const mockPayment = {
                paymentId: 'mock-' + Date.now(),
                mercadoPagoId: 'mock-' + Date.now(),
                amount: 3.0,
                currency: 'USD',
                status: 'approved',
                statusDetail: 'accredited',
                paymentMethod: 'mock',
                paymentType: 'credit_card',
                date: new Date(),
            };

            user.payments.push(mockPayment);
            await user.save();

            return res.json({
                success: true,
                message: 'Plan PRO activado (simulación)',
                data: {
                    isPro: user.isPro,
                },
            });
        } catch (error) {
            console.error('Error simulating payment:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al simular pago',
            });
        }
    }
}

export default new PaymentController();