import paypal from '@paypal/checkout-server-sdk';
import crypto from 'crypto';

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
                            value: '1.75',
                            breakdown: {
                                item_total: {
                                    currency_code: 'USD',
                                    value: '1.75',
                                },
                            },
                        },
                        items: [
                            {
                                name: 'Love Pages PRO',
                                description: 'Acceso permanente a páginas ilimitadas con IA',
                                unit_amount: {
                                    currency_code: 'USD',
                                    value: '1.75',
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
                    // ✅ FIX: Apuntar a la página intermedia de captura, NO a success
                    return_url: `${process.env.FRONTEND_URL}/payment/paypal-return`,
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

            // ✅ FIX: Verificar estado de la orden antes de capturar
            const orderDetails = await this.getOrderDetails(orderId);

            // Si ya fue capturada, retornar los detalles existentes
            if (orderDetails.status === 'COMPLETED') {
                console.log('ℹ️ Orden ya fue capturada previamente:', orderId);
                return orderDetails;
            }

            // Solo capturar si está aprobada
            if (orderDetails.status !== 'APPROVED') {
                throw new Error(`Orden no está en estado APPROVED. Estado actual: ${orderDetails.status}`);
            }

            const request = new paypal.orders.OrdersCaptureRequest(orderId);
            request.requestBody({});

            const response = await this.client.execute(request);

            console.log('✅ Pago PayPal capturado:', {
                id: response.result.id,
                status: response.result.status,
            });

            return response.result;
        } catch (error) {
            console.error('❌ Error capturing PayPal payment:', {
                message: error.message,
                statusCode: error.statusCode,
                details: error.details || error.result,
            });
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
     * ✅ FIX: Verificar webhook signature usando la API REST de PayPal directamente
     * El SDK @paypal/checkout-server-sdk NO tiene paypal.notifications
     * @param {Object} headers - Headers de la petición
     * @param {Object|string} body - Body de la petición (raw)
     * @returns {boolean}
     */
    async verifyWebhookSignature(headers, body) {
        try {
            const webhookId = process.env.PAYPAL_WEBHOOK_ID;

            if (!webhookId) {
                console.error('❌ PAYPAL_WEBHOOK_ID no configurado');
                return false;
            }

            // Obtener access token
            const accessToken = await this.getAccessToken();

            // Preparar body como string si no lo es
            const bodyString = typeof body === 'string' ? body : JSON.stringify(body);

            const baseUrl = process.env.NODE_ENV === 'production'
                ? 'https://api-m.paypal.com'
                : 'https://api-m.sandbox.paypal.com';

            const verifyResponse = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    auth_algo: headers['paypal-auth-algo'],
                    cert_url: headers['paypal-cert-url'],
                    transmission_id: headers['paypal-transmission-id'],
                    transmission_sig: headers['paypal-transmission-sig'],
                    transmission_time: headers['paypal-transmission-time'],
                    webhook_id: webhookId,
                    webhook_event: typeof body === 'string' ? JSON.parse(body) : body,
                }),
            });

            const result = await verifyResponse.json();

            console.log('🔐 Webhook verification result:', result.verification_status);
            return result.verification_status === 'SUCCESS';
        } catch (error) {
            console.error('Error verifying PayPal webhook:', error);
            return false;
        }
    }

    /**
     * Obtener access token para llamadas directas a la API REST
     * @returns {string} access token
     */
    async getAccessToken() {
        const clientId = process.env.PAYPAL_CLIENT_ID;
        const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

        const baseUrl = process.env.NODE_ENV === 'production'
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';

        const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            },
            body: 'grant_type=client_credentials',
        });

        const data = await response.json();
        return data.access_token;
    }

    /**
     * ✅ FIX: Procesar notificación de webhook correctamente
     * @param {Object} webhookData - Datos del webhook
     * @returns {Object}
     */
    async processWebhookNotification(webhookData) {
        try {
            const { event_type, resource } = webhookData;

            console.log('📩 Webhook PayPal recibido:', event_type);

            // ✅ FIX: Solo procesar PAYMENT.CAPTURE.COMPLETED
            // CHECKOUT.ORDER.APPROVED no sirve porque la orden aún no está capturada
            if (event_type === 'PAYMENT.CAPTURE.COMPLETED') {
                // Para captures, el order ID está en un nivel diferente
                const captureId = resource.id;
                const orderId = resource.supplementary_data?.related_ids?.order_id;

                console.log(`💰 Capture completada: ${captureId}, Order: ${orderId}`);

                if (!orderId) {
                    // Si no viene el order ID en supplementary_data,
                    // buscarlo en los links
                    const upLink = resource.links?.find(l => l.rel === 'up');
                    if (upLink) {
                        // El link "up" apunta a la orden, extraer el ID
                        const orderIdFromLink = upLink.href.split('/').pop();
                        const orderDetails = await this.getOrderDetails(orderIdFromLink);

                        return {
                            processed: true,
                            orderDetails,
                            customId: orderDetails.purchase_units?.[0]?.custom_id,
                        };
                    }

                    console.error('❌ No se pudo obtener el order ID del webhook');
                    return { processed: false, reason: 'Could not extract order ID from capture webhook' };
                }

                const orderDetails = await this.getOrderDetails(orderId);

                return {
                    processed: true,
                    orderDetails,
                    customId: orderDetails.purchase_units?.[0]?.custom_id,
                };
            }

            // CHECKOUT.ORDER.APPROVED: la orden fue aprobada pero NO capturada aún
            // Intentar capturar desde el webhook como respaldo
            if (event_type === 'CHECKOUT.ORDER.APPROVED') {
                const orderId = resource.id;
                console.log(`📋 Orden aprobada via webhook, intentando capturar: ${orderId}`);

                try {
                    const capturedOrder = await this.capturePayment(orderId);

                    if (this.isPaymentCompleted(capturedOrder)) {
                        return {
                            processed: true,
                            orderDetails: capturedOrder,
                            customId: capturedOrder.purchase_units?.[0]?.custom_id,
                        };
                    }
                } catch (captureError) {
                    // Si falla, probablemente el frontend ya lo capturó
                    console.log('ℹ️ Captura desde webhook falló (probablemente ya capturado):', captureError.message);
                }

                return { processed: false, reason: `Order ${orderId} capture attempted from webhook` };
            }

            return { processed: false, reason: `Event type not handled: ${event_type}` };
        } catch (error) {
            console.error('Error processing PayPal webhook:', error);
            throw error;
        }
    }
}

export default new PayPalService();