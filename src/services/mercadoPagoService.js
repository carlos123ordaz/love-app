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
                        currency_id: 'PEN',
                        unit_price: 10,
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
                // auto_return: 'approved',
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

    async getPaymentInfo(paymentId) {
        try {
            const payment = await this.payment.get({ id: paymentId });
            return payment;
        } catch (error) {
            console.error('Error getting payment info:', error);
            throw new Error('Error al obtener información del pago');
        }
    }

    async processWebhookNotification(data) {
        try {
            const { action, data: paymentData, type } = data;

            const isPayment =
                type === 'payment' ||
                action === 'payment.created' ||
                action === 'payment.updated';

            if (!isPayment) {
                return { processed: false, reason: `Not a payment notification: ${action || type}` };
            }

            // Si tiene action "payment.created", ignorar (esperar payment.updated)
            if (action === 'payment.created') {
                return { processed: false, reason: 'Ignoring payment.created, waiting for payment.updated' };
            }

            // Si action es undefined pero type es 'payment' (formato IPN legacy),
            // consultar el estado directamente a MercadoPago
            const paymentId = paymentData.id;
            const paymentInfo = await this.getPaymentInfoWithRetry(paymentId);

            return {
                processed: true,
                paymentInfo,
                status: paymentInfo.status,
                externalReference: paymentInfo.external_reference,
            };
        } catch (error) {
            console.error('Error processing webhook:', error);
            throw error;
        }
    }

    async getPaymentInfoWithRetry(paymentId, retries = 3, delay = 2000) {
        for (let i = 0; i < retries; i++) {
            try {
                return await this.getPaymentInfo(paymentId);
            } catch (error) {
                if (i < retries - 1) {
                    console.log(`⏳ Retry ${i + 1}/${retries} for payment ${paymentId}...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw error;
                }
            }
        }
    }

    isPaymentApproved(paymentInfo) {
        return paymentInfo.status === 'approved' && paymentInfo.status_detail === 'accredited';
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