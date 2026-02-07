import mongoose from 'mongoose';
import { nanoid } from 'nanoid';

const responseSchema = new mongoose.Schema(
    {
        answer: {
            type: String,
            enum: ['yes', 'no'],
            required: true,
        },
        ipAddress: {
            type: String,
            default: null,
        },
        location: {
            country: String,
            city: String,
            coordinates: {
                lat: Number,
                lng: Number,
            },
        },
        userAgent: {
            type: String,
            default: null,
        },
        respondedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: true }
);

const pageSchema = new mongoose.Schema(
    {
        // ID único para la URL
        shortId: {
            type: String,
            required: true,
            unique: true,
            default: () => nanoid(10),
            index: true,
        },
        // Usuario propietario
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },

        // ============================================
        // CONTENIDO
        // ============================================
        title: {
            type: String,
            required: true,
            maxlength: 200,
        },
        recipientName: {
            type: String,
            required: true,
            maxlength: 100,
        },
        message: {
            type: String,
            default: '',
            maxlength: 1000,
        },
        yesButtonText: {
            type: String,
            default: 'Sí',
            maxlength: 50,
        },
        noButtonText: {
            type: String,
            default: 'No',
            maxlength: 50,
        },
        noButtonEscapes: {
            type: Boolean,
            default: false,
        },

        // ============================================
        // TIPO DE PÁGINA
        // ============================================
        pageType: {
            type: String,
            enum: ['free', 'pro'],
            default: 'free',
        },

        // Para páginas PRO: HTML/CSS generado por IA
        customHTML: {
            type: String,
            default: null,
        },
        customCSS: {
            type: String,
            default: null,
        },
        referenceImageUrl: {
            type: String,
            default: null,
        },

        // ============================================
        // DISEÑO - TEMA Y COLORES
        // ============================================
        theme: {
            type: String,
            enum: [
                'romantic', 'sunset', 'ocean', 'garden', 'playful',
                'elegant', 'minimal', 'dark',
                // PRO themes
                'neon', 'vintage', 'aurora', 'cherry', 'custom',
            ],
            default: 'romantic',
        },
        backgroundColor: {
            type: String,
            default: '#ff69b4',
        },
        textColor: {
            type: String,
            default: '#ffffff',
        },
        accentColor: {
            type: String,
            default: '#ff1493',
        },

        // ============================================
        // TIPOGRAFÍA (NUEVO)
        // ============================================
        titleFont: {
            type: String,
            default: 'Dancing Script',
            maxlength: 100,
        },
        bodyFont: {
            type: String,
            default: 'Quicksand',
            maxlength: 100,
        },

        // ============================================
        // IMÁGENES (NUEVO)
        // ============================================
        backgroundImageUrl: {
            type: String,
            default: null,
        },
        decorativeImageUrls: {
            type: [String],
            default: [],
            validate: {
                validator: function (v) {
                    return v.length <= 5; // máximo 5 imágenes decorativas
                },
                message: 'Máximo 5 imágenes decorativas',
            },
        },

        // ============================================
        // STICKERS (NUEVO)
        // ============================================
        selectedStickers: {
            type: [String],
            default: [],
            validate: {
                validator: function (v) {
                    return v.length <= 10;
                },
                message: 'Máximo 10 stickers',
            },
        },

        // ============================================
        // ANIMACIONES (NUEVO)
        // ============================================
        animation: {
            type: String,
            enum: [
                'none', 'hearts-falling', 'fade-in', 'float-up',
                // PRO animations
                'confetti', 'particles', 'fireworks', 'snow', 'petals', 'bubbles',
            ],
            default: 'none',
        },

        // ============================================
        // MÚSICA (NUEVO - solo PRO)
        // ============================================
        backgroundMusic: {
            type: String,
            enum: [
                'none', 'romantic-piano', 'acoustic-guitar',
                'love-song', 'music-box', 'orchestra',
            ],
            default: 'none',
        },

        // ============================================
        // EXTRAS
        // ============================================
        showWatermark: {
            type: Boolean,
            default: true, // free siempre true, PRO puede quitar
        },

        // ============================================
        // ESTADÍSTICAS
        // ============================================
        responses: [responseSchema],
        views: {
            type: Number,
            default: 0,
        },
        uniqueViews: {
            type: Number,
            default: 0,
        },

        // Estado
        isActive: {
            type: Boolean,
            default: true,
        },
        expiresAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Índices
pageSchema.index({ shortId: 1 });
pageSchema.index({ userId: 1, createdAt: -1 });
pageSchema.index({ isActive: 1, expiresAt: 1 });

// Método para generar URL completa
pageSchema.methods.getFullUrl = function () {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return `${baseUrl}/p/${this.shortId}`;
};

// Método para incrementar vistas
pageSchema.methods.incrementViews = async function (isUnique = false) {
    this.views += 1;
    if (isUnique) {
        this.uniqueViews += 1;
    }
    await this.save();
};

// Método para agregar respuesta
pageSchema.methods.addResponse = async function (answer, metadata = {}) {
    this.responses.push({
        answer,
        ipAddress: metadata.ipAddress,
        location: metadata.location,
        userAgent: metadata.userAgent,
    });
    await this.save();
    return this.responses[this.responses.length - 1];
};

// Método para obtener estadísticas
pageSchema.methods.getStats = function () {
    const yesCount = this.responses.filter((r) => r.answer === 'yes').length;
    const noCount = this.responses.filter((r) => r.answer === 'no').length;
    const totalResponses = this.responses.length;

    return {
        views: this.views,
        uniqueViews: this.uniqueViews,
        totalResponses,
        yesCount,
        noCount,
        yesPercentage: totalResponses > 0 ? ((yesCount / totalResponses) * 100).toFixed(1) : 0,
        noPercentage: totalResponses > 0 ? ((noCount / totalResponses) * 100).toFixed(1) : 0,
    };
};

// Middleware pre-save
pageSchema.pre('save', async function (next) {
    if (!this.shortId) {
        this.shortId = nanoid(10);
    }
    next();
});

pageSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        delete ret.__v;
        return ret;
    },
});

const Page = mongoose.model('Page', pageSchema);

export default Page;