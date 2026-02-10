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

// Slugs reservados que no se pueden usar
const RESERVED_SLUGS = [
    'admin', 'api', 'dashboard', 'login', 'signup', 'create', 'edit',
    'delete', 'update', 'settings', 'profile', 'pages', 'public',
    'upgrade', 'pro', 'pricing', 'contact', 'about', 'terms', 'privacy',
    'help', 'support', 'docs', 'blog', 'home', 'index', 'my-pages',
    'stats', 'details', 'respond', 'toggle'
];

const pageSchema = new mongoose.Schema(
    {
        // ID único para la URL (autogenerado)
        shortId: {
            type: String,
            required: true,
            unique: true,
            default: () => nanoid(10),
            index: true,
        },

        // 🆕 NUEVO: Slug personalizado (solo PRO)
        customSlug: {
            type: String,
            default: null,
            unique: true,
            sparse: true, // permite nulls múltiples
            lowercase: true,
            trim: true,
            validate: {
                validator: function (v) {
                    if (!v) return true; // null es válido
                    // Solo letras, números y guiones, entre 3-30 caracteres
                    return /^[a-z0-9-]{3,30}$/.test(v);
                },
                message: 'El slug debe contener solo letras minúsculas, números y guiones (3-30 caracteres)'
            }
        },

        isDeleted: {
            type: Boolean,
            default: false,
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
        // TIPOGRAFÍA
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
        // IMÁGENES
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
                    return v.length <= 5;
                },
                message: 'Máximo 5 imágenes decorativas',
            },
        },

        // ============================================
        // STICKERS
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
        // ANIMACIONES
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
        // MÚSICA (solo PRO)
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
            default: true,
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
pageSchema.index({ customSlug: 1 });
pageSchema.index({ userId: 1, createdAt: -1 });
pageSchema.index({ isActive: 1, expiresAt: 1 });

// 🆕 Método para generar URL completa (actualizado para soportar custom slug)
pageSchema.methods.getFullUrl = function () {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const identifier = this.customSlug || this.shortId;
    return `${baseUrl}/p/${identifier}`;
};

// 🆕 Método estático para validar disponibilidad de slug
pageSchema.statics.isSlugAvailable = async function (slug) {
    if (!slug) return { available: false, reason: 'Slug vacío' };

    // Validar formato
    if (!/^[a-z0-9-]{3,30}$/.test(slug)) {
        return { available: false, reason: 'Formato inválido (3-30 caracteres, solo minúsculas, números y guiones)' };
    }

    // Verificar slugs reservados
    if (RESERVED_SLUGS.includes(slug.toLowerCase())) {
        return { available: false, reason: 'Slug reservado por el sistema' };
    }

    // Verificar si ya existe
    const existing = await this.findOne({ customSlug: slug, isDeleted: { $ne: true } });
    if (existing) {
        return { available: false, reason: 'Ya está en uso' };
    }

    return { available: true };
};

// 🆕 Método estático para buscar por shortId O customSlug
pageSchema.statics.findByIdentifier = async function (identifier) {
    return await this.findOne({
        $or: [
            { shortId: identifier },
            { customSlug: identifier }
        ],
        isActive: true,
        isDeleted: { $ne: true }
    }).populate('userId', 'displayName');
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