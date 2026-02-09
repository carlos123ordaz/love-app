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
        // Historial de pagos
        payments: [
            {
                paymentId: String,
                amount: Number,
                currency: String,
                status: String,
                date: Date,
                mercadoPagoId: String,
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

userSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        delete ret.__v;
        return ret;
    },
});

const User = mongoose.model('User', userSchema);

export default User;