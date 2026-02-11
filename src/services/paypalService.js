import paypal from '@paypal/checkout-server-sdk';

class PayPalService {
    constructor() {
        this.environment = this.getEnvironment();
        this.client = new paypal.core.PayPalHttpClient(this.environment);
    }

    /**
     * Configurar entorno de PayPal (Sandbox o Production)
     */
    getEnvironment() {
        const clientId = process.env.PAYPAL_CLIENT_ID;
        const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            throw new Error('PayPal credentials are missing');
        }

        // Usar sandbox en desarrollo, live en producción
        if (process.env.NODE_ENV === 'production') {
            return new paypal.core.LiveEnvironment(clientId, clientSecret);
        }
        return new paypal.core.SandboxEnvironment(clientId, clientSecret);
    }

    /**
     * Crear orden de pago para plan PRO
     * @param {Object} user - Usuario que realiza el pago
     * @returns {Object} - Detalles de la orden creada
     */
    async createProPlanOrder(user) {
        try {
            console.log('📝 Creando orden PayPal para:', user.email);

            const request = new paypal.orders.OrdersCreateRequest();
            request.prefer('return=representation');
            request.requestBody({
                intent: 'CAPTURE',
                purchase_units: [
                    {
                        reference_id: user._id.toString(),
                        description: 'Love Pages PRO - Páginas Ilimitadas',
                        custom_id: user._id.toString(),
                        soft_descriptor: 'LOVEPAGES PRO',
                        amount: {
                            currency_code: 'USD',
                            value: '1.39',
                            breakdown: {
                                item_total: {
                                    currency_code: 'USD',
                                    value: '1.39',
                                },
                            },
                        },
                        items: [
                            {
                                name: 'Love Pages PRO',
                                description: 'Acceso permanente a páginas ilimitadas con IA',
                                unit_amount: {
                                    currency_code: 'USD',
                                    value: '1.39',
                                },
                                quantity: '1',
                                category: 'DIGITAL_GOODS',
                            },
                        ],
                    },
                ],
                application_context: {
                    brand_name: 'Love Pages',
                    landing_page: 'NO_PREFERENCE',
                    user_action: 'PAY_NOW',
                    return_url: `${process.env.FRONTEND_URL}/payment/success?provider=paypal`,
                    cancel_url: `${process.env.FRONTEND_URL}/payment/failure?provider=paypal`,
                },
            });

            const response = await this.client.execute(request);

            console.log('✅ Orden PayPal creada:', {
                id: response.result.id,
                status: response.result.status,
            });

            return {
                orderId: response.result.id,
                status: response.result.status,
                approvalUrl: response.result.links.find((link) => link.rel === 'approve')?.href,
            };
        } catch (error) {
            console.error('❌ Error creating PayPal order:', {
                message: error.message,
                details: error.details,
            });
            throw new Error('Error al crear orden de PayPal');
        }
    }

    /**
     * Capturar pago después de la aprobación
     * @param {string} orderId - ID de la orden de PayPal
     * @returns {Object} - Detalles del pago capturado
     */
    async capturePayment(orderId) {
        try {
            console.log('💰 Capturando pago PayPal:', orderId);

            const request = new paypal.orders.OrdersCaptureRequest(orderId);
            request.requestBody({});

            const response = await this.client.execute(request);

            console.log('✅ Pago PayPal capturado:', {
                id: response.result.id,
                status: response.result.status,
            });

            return response.result;
        } catch (error) {
            console.error('❌ Error capturing PayPal payment:', error);
            throw new Error('Error al capturar pago de PayPal');
        }
    }

    /**
     * Obtener detalles de una orden
     * @param {string} orderId - ID de la orden
     * @returns {Object} - Detalles de la orden
     */
    async getOrderDetails(orderId) {
        try {
            const request = new paypal.orders.OrdersGetRequest(orderId);
            const response = await this.client.execute(request);
            return response.result;
        } catch (error) {
            console.error('Error getting PayPal order details:', error);
            throw new Error('Error al obtener detalles de la orden');
        }
    }

    /**
     * Verificar si el pago fue completado exitosamente
     * @param {Object} orderDetails - Detalles de la orden
     * @returns {boolean}
     */
    isPaymentCompleted(orderDetails) {
        return (
            orderDetails.status === 'COMPLETED' &&
            orderDetails.purchase_units?.[0]?.payments?.captures?.[0]?.status === 'COMPLETED'
        );
    }

    /**
     * Formatear datos del pago para guardar en BD
     * @param {Object} orderDetails - Detalles de la orden
     * @returns {Object}
     */
    formatPaymentData(orderDetails) {
        const capture = orderDetails.purchase_units?.[0]?.payments?.captures?.[0];

        return {
            paymentId: capture?.id || orderDetails.id,
            paypalOrderId: orderDetails.id,
            amount: parseFloat(capture?.amount?.value || '0'),
            currency: capture?.amount?.currency_code || 'USD',
            status: orderDetails.status.toLowerCase(),
            statusDetail: capture?.status || 'completed',
            paymentMethod: 'paypal',
            paymentType: 'digital_goods',
            date: new Date(capture?.create_time || orderDetails.create_time),
            payer: {
                email: orderDetails.payer?.email_address,
                name: orderDetails.payer?.name?.given_name,
                payerId: orderDetails.payer?.payer_id,
            },
        };
    }

    /**
     * Verificar webhook signature de PayPal
     * @param {Object} headers - Headers de la petición
     * @param {Object} body - Body de la petición
     * @returns {boolean}
     */
    async verifyWebhookSignature(headers, body) {
        try {
            const request = new paypal.notifications.WebhookVerifySignature();
            request.requestBody({
                auth_algo: headers['paypal-auth-algo'],
                cert_url: headers['paypal-cert-url'],
                transmission_id: headers['paypal-transmission-id'],
                transmission_sig: headers['paypal-transmission-sig'],
                transmission_time: headers['paypal-transmission-time'],
                webhook_id: process.env.PAYPAL_WEBHOOK_ID,
                webhook_event: body,
            });

            const response = await this.client.execute(request);
            return response.result.verification_status === 'SUCCESS';
        } catch (error) {
            console.error('Error verifying PayPal webhook:', error);
            return false;
        }
    }

    /**
     * Procesar notificación de webhook
     * @param {Object} webhookData - Datos del webhook
     * @returns {Object}
     */
    async processWebhookNotification(webhookData) {
        try {
            const { event_type, resource } = webhookData;

            console.log('📩 Webhook PayPal recibido:', event_type);

            // Solo procesar eventos de pago completado
            if (event_type !== 'CHECKOUT.ORDER.APPROVED' && event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
                return { processed: false, reason: `Event type not handled: ${event_type}` };
            }

            // Obtener detalles completos de la orden
            const orderId = resource.id;
            const orderDetails = await this.getOrderDetails(orderId);

            console.log(`💰 Estado de la orden ${orderId}: ${orderDetails.status}`);

            if (!this.isPaymentCompleted(orderDetails)) {
                return { processed: false, reason: `Order ${orderId} not completed yet` };
            }

            return {
                processed: true,
                orderDetails,
                customId: orderDetails.purchase_units?.[0]?.custom_id,
            };
        } catch (error) {
            console.error('Error processing PayPal webhook:', error);
            throw error;
        }
    }
}

export default new PayPalService();