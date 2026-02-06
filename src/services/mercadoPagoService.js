import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

class MercadoPagoService {
    constructor() {
        this.client = new MercadoPagoConfig({
            accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
            options: { timeout: 5000 },
        });

        this.preference = new Preference(this.client);
        this.payment = new Payment(this.client);
    }

    async createProPlanPreference(user) {
        try {
            console.log('📝 Creando preferencia para:', user.email);

            const preferenceData = {
                items: [
                    {
                        id: 'pro-plan',
                        title: 'Plan PRO - Páginas Ilimitadas',
                        description: 'Acceso permanente a creación ilimitada de páginas personalizadas con IA',
                        quantity: 1,
                        currency_id: 'USD',
                        unit_price: 3.00,
                    },
                ],
                payer: {
                    email: user.email,
                    name: user.displayName?.split(' ')[0] || 'Usuario',
                    surname: user.displayName?.split(' ').slice(1).join(' ') || 'Apellido',
                },
                back_urls: {
                    success: `${process.env.FRONTEND_URL}/payment/success`,
                    failure: `${process.env.FRONTEND_URL}/payment/failure`,
                    pending: `${process.env.FRONTEND_URL}/payment/pending`,
                },
                external_reference: user._id.toString(),
                notification_url: `${process.env.BACKEND_URL}/api/webhooks/mercadopago`,
                statement_descriptor: 'LOVEPAGES PRO',
                payment_methods: {
                    excluded_payment_methods: [],
                    excluded_payment_types: [],
                    installments: 1,
                },
                metadata: {
                    userId: user._id.toString(),
                    userEmail: user.email,
                    plan: 'pro',
                },
            };

            console.log('📦 Datos de preferencia:', JSON.stringify(preferenceData, null, 2));

            const response = await this.preference.create({ body: preferenceData });

            console.log('✅ Respuesta de MercadoPago:', {
                id: response.id,
                init_point: response.init_point,
            });

            return {
                preferenceId: response.id,
                initPoint: response.init_point,
                sandboxInitPoint: response.sandbox_init_point,
            };
        } catch (error) {
            console.error('❌ Error creating MercadoPago preference:', {
                message: error.message,
                error: error.error,
                status: error.status,
                cause: error.cause,
            });
            throw new Error('Error al crear preferencia de pago');
        }
    }

    /**
     * 👇 MÉTODO ACTUALIZADO CON REINTENTOS
     * Obtener información del pago con reintentos automáticos
     */
    async getPaymentInfo(paymentId, maxRetries = 5, delayMs = 2000) {
        let lastError = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔄 [Intento ${attempt}/${maxRetries}] Obteniendo pago: ${paymentId}`);
                
                const payment = await this.payment.get({ id: paymentId });
                
                console.log('✅ Pago encontrado:', {
                    id: payment.id,
                    status: payment.status,
                    status_detail: payment.status_detail,
                    external_reference: payment.external_reference,
                });
                
                return payment; // ✅ Éxito - retornar el pago
                
            } catch (error) {
                lastError = error;
                
                // Si es 404 y aún quedan intentos, esperar y reintentar
                if (error.status === 404 && attempt < maxRetries) {
                    console.log(`⏳ Pago no disponible aún. Esperando ${delayMs}ms antes del siguiente intento...`);
                    await this.sleep(delayMs);
                    continue; // Reintentar
                }
                
                // Si no es 404 o ya no quedan intentos, lanzar error
                console.error(`❌ Error obteniendo pago (intento ${attempt}/${maxRetries}):`, {
                    message: error.message,
                    error: error.error,
                    status: error.status,
                    cause: error.cause,
                });
                
                // Si no quedan más intentos, lanzar el error
                if (attempt === maxRetries) {
                    break;
                }
            }
        }
        
        // Si llegamos aquí, fallaron todos los intentos
        console.error(`❌ No se pudo obtener el pago después de ${maxRetries} intentos`);
        throw new Error(`No se pudo obtener información del pago ${paymentId} después de ${maxRetries} intentos`);
    }

    /**
     * Helper para esperar
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async processWebhookNotification(data) {
        try {
            const { action, data: paymentData, type } = data;

            console.log('📦 Procesando notificación:', { action, type, paymentId: paymentData?.id });

            // MercadoPago v2 usa "action", v1 usa "type"
            const isPayment =
                type === 'payment' ||
                action === 'payment.created' ||
                action === 'payment.updated';

            if (!isPayment) {
                console.log(`⚠️ No es notificación de pago: ${action || type}`);
                return { processed: false, reason: `Not a payment notification: ${action || type}` };
            }

            const paymentId = paymentData.id;
            console.log('💳 Procesando pago ID:', paymentId);
            
            // 👇 AQUÍ USA EL MÉTODO CON REINTENTOS
            const paymentInfo = await this.getPaymentInfo(paymentId);

            console.log('✅ Información del pago procesada:', {
                id: paymentInfo.id,
                status: paymentInfo.status,
                status_detail: paymentInfo.status_detail,
                external_reference: paymentInfo.external_reference,
            });

            return {
                processed: true,
                paymentInfo,
                status: paymentInfo.status,
                externalReference: paymentInfo.external_reference,
            };
        } catch (error) {
            console.error('❌ Error procesando webhook:', error.message);
            throw error;
        }
    }

    isPaymentApproved(paymentInfo) {
        const isApproved = paymentInfo.status === 'approved' && paymentInfo.status_detail === 'accredited';
        console.log('🔍 Verificando aprobación:', {
            status: paymentInfo.status,
            status_detail: paymentInfo.status_detail,
            isApproved,
        });
        return isApproved;
    }

    formatPaymentData(paymentInfo) {
        return {
            paymentId: paymentInfo.id,
            mercadoPagoId: paymentInfo.id.toString(),
            amount: paymentInfo.transaction_amount,
            currency: paymentInfo.currency_id,
            status: paymentInfo.status,
            statusDetail: paymentInfo.status_detail,
            paymentMethod: paymentInfo.payment_method_id,
            paymentType: paymentInfo.payment_type_id,
            date: new Date(paymentInfo.date_created),
        };
    }
}

export default new MercadoPagoService();