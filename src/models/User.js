import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
    {
        firebaseUid: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        displayName: {
            type: String,
            required: true,
        },
        photoURL: {
            type: String,
            default: null,
        },
        isPro: {
            type: Boolean,
            default: false,
        },
        proExpiresAt: {
            type: Date,
            default: null,
        },
        isAdmin: {
            type: Boolean,
            default: false,
        },
        pagesCreated: {
            type: Number,
            default: 0,
        },
        lastLogin: {
            type: Date,
            default: Date.now,
        },
        // Historial de pagos - ACTUALIZADO
        payments: [
            {
                // ID único del pago (puede ser de MercadoPago o PayPal)
                paymentId: {
                    type: String,
                    required: true,
                },
                // Monto del pago
                amount: {
                    type: Number,
                    required: true,
                },
                // Moneda (USD, PEN, etc.)
                currency: {
                    type: String,
                    required: true,
                    default: 'USD',
                },
                // Estado del pago (approved, completed, pending, etc.)
                status: {
                    type: String,
                    required: true,
                },
                // Fecha del pago
                date: {
                    type: Date,
                    required: true,
                    default: Date.now,
                },
                // Proveedor del pago
                provider: {
                    type: String,
                    enum: ['mercadopago', 'paypal', 'simulation'],
                    required: true,
                    default: 'mercadopago',
                },
                // IDs específicos de cada proveedor
                mercadoPagoId: {
                    type: String,
                    default: null,
                },
                paypalOrderId: {
                    type: String,
                    default: null,
                },
                // Detalles adicionales del pago
                statusDetail: {
                    type: String,
                    default: null,
                },
                paymentMethod: {
                    type: String,
                    default: null,
                },
                paymentType: {
                    type: String,
                    default: null,
                },
                // Información del pagador
                payer: {
                    email: {
                        type: String,
                        default: null,
                    },
                    name: {
                        type: String,
                        default: null,
                    },
                    payerId: {
                        type: String,
                        default: null,
                    },
                },
            },
        ],
    },
    {
        timestamps: true,
    }
);

// Índices compuestos
userSchema.index({ email: 1, firebaseUid: 1 });

// Método virtual para verificar si el usuario puede crear más páginas
userSchema.virtual('canCreatePage').get(function () {
    if (this.isPro) return true;
    return this.pagesCreated < 1;
});

// Método para verificar si el PRO está activo
userSchema.methods.isProActive = function () {
    if (!this.isPro) return false;
    if (!this.proExpiresAt) return true; // PRO permanente
    return this.proExpiresAt > new Date();
};

// Método para actualizar último login
userSchema.methods.updateLastLogin = async function () {
    this.lastLogin = new Date();
    await this.save();
};

// 🆕 NUEVO: Método para obtener último pago
userSchema.methods.getLastPayment = function () {
    if (!this.payments || this.payments.length === 0) return null;
    return this.payments[this.payments.length - 1];
};

// 🆕 NUEVO: Método para obtener pagos por proveedor
userSchema.methods.getPaymentsByProvider = function (provider) {
    if (!this.payments) return [];
    return this.payments.filter(p => p.provider === provider);
};

// 🆕 NUEVO: Método para verificar si ya tiene un pago con un ID específico
userSchema.methods.hasPayment = function (paymentId) {
    if (!this.payments) return false;
    return this.payments.some(
        p => p.paymentId === paymentId ||
            p.mercadoPagoId === paymentId ||
            p.paypalOrderId === paymentId
    );
};

userSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        delete ret.__v;
        return ret;
    },
});

const User = mongoose.model('User', userSchema);

export default User;