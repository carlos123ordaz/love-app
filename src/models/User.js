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
        // Se mantiene como estadística (no como límite)
        pagesCreated: {
            type: Number,
            default: 0,
        },
        lastLogin: {
            type: Date,
            default: Date.now,
        },
        // Historial de pagos
        payments: [
            {
                paymentId: { type: String, required: true },
                amount: { type: Number, required: true },
                currency: { type: String, required: true, default: 'USD' },
                status: { type: String, required: true },
                date: { type: Date, required: true, default: Date.now },
                provider: {
                    type: String,
                    enum: ['mercadopago', 'paypal', 'simulation'],
                    required: true,
                    default: 'mercadopago',
                },
                mercadoPagoId: { type: String, default: null },
                paypalOrderId: { type: String, default: null },
                statusDetail: { type: String, default: null },
                paymentMethod: { type: String, default: null },
                paymentType: { type: String, default: null },
                payer: {
                    email: { type: String, default: null },
                    name: { type: String, default: null },
                    payerId: { type: String, default: null },
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

// ============================================
// METHODS
// ============================================

userSchema.methods.isProActive = function () {
    if (!this.isPro) return false;
    if (!this.proExpiresAt) return true;
    return this.proExpiresAt > new Date();
};

userSchema.methods.updateLastLogin = async function () {
    this.lastLogin = new Date();
    await this.save();
};

userSchema.methods.getLastPayment = function () {
    if (!this.payments || this.payments.length === 0) return null;
    return this.payments[this.payments.length - 1];
};

userSchema.methods.getPaymentsByProvider = function (provider) {
    if (!this.payments) return [];
    return this.payments.filter((p) => p.provider === provider);
};

userSchema.methods.hasPayment = function (paymentId) {
    if (!this.payments) return false;
    return this.payments.some(
        (p) =>
            p.paymentId === paymentId ||
            p.mercadoPagoId === paymentId ||
            p.paypalOrderId === paymentId
    );
};

// ============================================
// toJSON — incluir virtuals
// ============================================
userSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        delete ret.__v;
        return ret;
    },
});

const User = mongoose.model('User', userSchema);

export default User;