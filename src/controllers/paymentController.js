import User from '../models/User.js';
import mercadoPagoService from '../services/mercadoPagoService.js';
import paypalService from '../services/paypalService.js';
import 'dotenv/config';

class PaymentController {
    // ============================================================
    // MERCADO PAGO
    // ============================================================

    /**
     * Crear preferencia de pago MercadoPago para plan PRO
     * POST /api/payments/mercadopago/create-preference
     */
    async createMercadoPagoPreference(req, res) {
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
                provider: 'mercadopago',
                data: {
                    preferenceId: preference.preferenceId,
                    initPoint: preference.initPoint,
                    sandboxInitPoint: preference.sandboxInitPoint,
                },
            });
        } catch (error) {
            console.error('Error creating MercadoPago preference:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al crear preferencia de pago',
                error: error.message,
            });
        }
    }

    /**
     * Webhook de Mercado Pago
     * POST /api/webhooks/mercadopago
     */
    async handleMercadoPagoWebhook(req, res) {
        try {
            // Responder rápido a MercadoPago para evitar reintentos
            res.status(200).send('OK');

            let webhookData;

            if (req.body?.action || req.body?.type === 'payment') {
                webhookData = req.body;
            } else if (req.query.topic || req.query.type) {
                webhookData = {
                    type: req.query.topic || req.query.type,
                    data: { id: req.query.id || req.query['data.id'] },
                };
            } else {
                console.log('⚠️ Webhook format not recognized');
                return;
            }

            console.log('📩 MercadoPago Webhook received:', webhookData);

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
                await this.activateProPlan(user, paymentInfo, 'mercadopago');
            }
        } catch (error) {
            console.error('Error handling MercadoPago webhook:', error);
        }
    }

    // ============================================================
    // PAYPAL
    // ============================================================

    /**
     * Crear orden de PayPal para plan PRO
     * POST /api/payments/paypal/create-order
     */
    async createPayPalOrder(req, res) {
        try {
            const user = req.user;

            if (user.isProActive()) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya tienes un plan PRO activo',
                    code: 'ALREADY_PRO',
                });
            }

            const order = await paypalService.createProPlanOrder(user);

            return res.json({
                success: true,
                message: 'Orden de PayPal creada exitosamente',
                provider: 'paypal',
                data: {
                    orderId: order.orderId,
                    approvalUrl: order.approvalUrl,
                },
            });
        } catch (error) {
            console.error('Error creating PayPal order:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al crear orden de PayPal',
                error: error.message,
            });
        }
    }

    /**
     * Capturar pago de PayPal después de la aprobación
     * POST /api/payments/paypal/capture/:orderId
     */
    async capturePayPalPayment(req, res) {
        try {
            const { orderId } = req.params;
            const user = req.user;

            // Capturar el pago
            const orderDetails = await paypalService.capturePayment(orderId);

            // Verificar que la orden pertenezca al usuario
            const customId = orderDetails.purchase_units?.[0]?.custom_id;
            if (customId !== user._id.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permiso para capturar este pago',
                });
            }

            // Verificar que el pago fue completado
            if (paypalService.isPaymentCompleted(orderDetails)) {
                await this.activateProPlan(user, orderDetails, 'paypal');

                return res.json({
                    success: true,
                    message: '¡Pago completado! Plan PRO activado',
                    data: {
                        orderId: orderDetails.id,
                        status: orderDetails.status,
                        isPro: true,
                    },
                });
            }

            return res.status(400).json({
                success: false,
                message: 'El pago no se completó correctamente',
            });
        } catch (error) {
            console.error('Error capturing PayPal payment:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al capturar pago de PayPal',
            });
        }
    }

    /**
     * Webhook de PayPal
     * POST /api/webhooks/paypal
     */
    async handlePayPalWebhook(req, res) {
        try {
            // Responder rápido a PayPal
            res.status(200).send('OK');

            // Verificar signature del webhook
            const isValid = await paypalService.verifyWebhookSignature(req.headers, req.body);

            if (!isValid) {
                console.error('❌ Invalid PayPal webhook signature');
                return;
            }

            console.log('📩 PayPal Webhook received:', req.body.event_type);

            const result = await paypalService.processWebhookNotification(req.body);

            if (!result.processed) {
                console.log('⚠️ Webhook not processed:', result.reason);
                return;
            }

            const { orderDetails, customId } = result;
            const user = await User.findById(customId);

            if (!user) {
                console.error('❌ User not found for order:', customId);
                return;
            }

            if (paypalService.isPaymentCompleted(orderDetails)) {
                await this.activateProPlan(user, orderDetails, 'paypal');
            }
        } catch (error) {
            console.error('Error handling PayPal webhook:', error);
        }
    }

    // ============================================================
    // MÉTODOS COMUNES
    // ============================================================

    /**
     * Activar plan PRO para un usuario
     */
    async activateProPlan(user, paymentInfo, provider = 'mercadopago') {
        try {
            const paymentId =
                provider === 'paypal'
                    ? paymentInfo.id
                    : paymentInfo.id.toString();

            // Verificar si el pago ya fue procesado
            const paymentExists = user.payments.some(
                (p) => p.paymentId === paymentId || p.mercadoPagoId === paymentId || p.paypalOrderId === paymentId
            );

            if (paymentExists) {
                console.log('⚠️ Payment already processed:', paymentId);
                return;
            }

            // Activar plan PRO
            user.isPro = true;
            user.proExpiresAt = null; // PRO permanente

            // Agregar pago al historial
            let formattedPayment;
            if (provider === 'paypal') {
                formattedPayment = paypalService.formatPaymentData(paymentInfo);
            } else {
                formattedPayment = mercadoPagoService.formatPaymentData(paymentInfo);
            }

            formattedPayment.provider = provider;
            user.payments.push(formattedPayment);

            await user.save();

            console.log(`✅ PRO plan activated for user: ${user.email} (${provider})`);
        } catch (error) {
            console.error('Error activating PRO plan:', error);
            throw error;
        }
    }

    /**
     * Verificar estado de un pago
     * GET /api/payments/:provider/:paymentId/status
     */
    async checkPaymentStatus(req, res) {
        try {
            const { provider, paymentId } = req.params;
            const user = req.user;

            let paymentInfo;

            if (provider === 'paypal') {
                paymentInfo = await paypalService.getOrderDetails(paymentId);

                // Verificar que pertenezca al usuario
                if (paymentInfo.purchase_units?.[0]?.custom_id !== user._id.toString()) {
                    return res.status(403).json({
                        success: false,
                        message: 'No tienes permiso para acceder a este pago',
                    });
                }

                return res.json({
                    success: true,
                    provider: 'paypal',
                    data: {
                        orderId: paymentInfo.id,
                        status: paymentInfo.status,
                        isCompleted: paypalService.isPaymentCompleted(paymentInfo),
                    },
                });
            } else if (provider === 'mercadopago') {
                paymentInfo = await mercadoPagoService.getPaymentInfo(paymentId);

                // Verificar que pertenezca al usuario
                if (paymentInfo.external_reference !== user._id.toString()) {
                    return res.status(403).json({
                        success: false,
                        message: 'No tienes permiso para acceder a este pago',
                    });
                }

                return res.json({
                    success: true,
                    provider: 'mercadopago',
                    data: {
                        paymentId: paymentInfo.id,
                        status: paymentInfo.status,
                        statusDetail: paymentInfo.status_detail,
                        isApproved: mercadoPagoService.isPaymentApproved(paymentInfo),
                    },
                });
            }

            return res.status(400).json({
                success: false,
                message: 'Proveedor de pago no válido',
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
     * Simular pago exitoso (solo para desarrollo)
     * POST /api/payments/simulate-success
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
                amount: 1.39,
                currency: 'USD',
                status: 'approved',
                statusDetail: 'accredited',
                paymentMethod: 'mock',
                paymentType: 'credit_card',
                provider: 'simulation',
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