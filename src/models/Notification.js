import mongoose from 'mongoose';

/**
 * Schema para notificaciones del sistema.
 * Soporta:
 *  - Notificaciones a un usuario específico
 *  - Notificaciones broadcast (a todos)
 *  - Notificaciones segmentadas (solo PRO, solo free, etc.)
 */

const notificationSchema = new mongoose.Schema(
    {
        // ============================================
        // DESTINATARIO(S)
        // ============================================

        // Si es para un usuario específico (null = broadcast)
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true,
        },

        // Tipo de audiencia
        audience: {
            type: String,
            enum: ['individual', 'all', 'pro', 'free'],
            default: 'individual',
        },

        // ============================================
        // CONTENIDO
        // ============================================

        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120,
        },

        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: 500,
        },

        // Tipo/categoría de notificación
        type: {
            type: String,
            enum: [
                'info',        // Información general
                'success',     // Algo positivo (pago confirmado, etc.)
                'warning',     // Advertencia
                'promo',       // Promoción / oferta
                'update',      // Actualización de la app
                'response',    // Alguien respondió a tu página
                'system',      // Sistema / mantenimiento
            ],
            default: 'info',
        },

        // Emoji/icono para la notificación
        icon: {
            type: String,
            default: '🔔',
            maxlength: 10,
        },

        // URL a la que redirigir al hacer clic (opcional)
        actionUrl: {
            type: String,
            default: null,
            trim: true,
        },

        // Texto del botón de acción (opcional)
        actionText: {
            type: String,
            default: null,
            trim: true,
            maxlength: 50,
        },

        // ============================================
        // ESTADO
        // ============================================

        // IDs de usuarios que ya leyeron esta notificación (para broadcasts)
        readBy: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
        ],

        // Para notificaciones individuales: si fue leída
        isRead: {
            type: Boolean,
            default: false,
        },

        // Si la notificación está activa
        isActive: {
            type: Boolean,
            default: true,
        },

        // Fecha de expiración (opcional, se oculta después)
        expiresAt: {
            type: Date,
            default: null,
        },

        // ============================================
        // METADATA
        // ============================================

        // Quién la envió (admin)
        sentBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        // Datos extras (flexible)
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true,
    }
);

// ============================================
// ÍNDICES
// ============================================

// Para obtener notificaciones de un usuario específico
notificationSchema.index({ userId: 1, isActive: 1, createdAt: -1 });

// Para obtener broadcasts activos
notificationSchema.index({ audience: 1, isActive: 1, createdAt: -1 });

// Para limpiar notificaciones expiradas
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ============================================
// MÉTODOS ESTÁTICOS
// ============================================

/**
 * Obtener notificaciones para un usuario.
 * Incluye: individuales + broadcasts (all) + segmentadas (pro/free).
 */
notificationSchema.statics.getForUser = async function (userId, userIsPro, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    // Determinar qué audiencias aplican a este usuario
    const audiences = ['all'];
    audiences.push(userIsPro ? 'pro' : 'free');

    const filter = {
        isActive: true,
        $or: [
            // Notificaciones individuales para este usuario
            { userId: userId, audience: 'individual' },
            // Broadcasts y segmentadas
            { userId: null, audience: { $in: audiences } },
        ],
        // Excluir expiradas
        $and: [
            {
                $or: [
                    { expiresAt: null },
                    { expiresAt: { $gt: new Date() } },
                ],
            },
        ],
    };

    const [notifications, total] = await Promise.all([
        this.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        this.countDocuments(filter),
    ]);

    // Marcar cuáles están leídas por este usuario
    const result = notifications.map((n) => {
        let read = false;
        if (n.audience === 'individual') {
            read = n.isRead;
        } else {
            // Para broadcasts: ver si el userId está en readBy
            read = (n.readBy || []).some(
                (id) => id.toString() === userId.toString()
            );
        }

        return {
            _id: n._id,
            title: n.title,
            message: n.message,
            type: n.type,
            icon: n.icon,
            actionUrl: n.actionUrl,
            actionText: n.actionText,
            isRead: read,
            createdAt: n.createdAt,
        };
    });

    return {
        notifications: result,
        total,
        page,
        totalPages: Math.ceil(total / limit),
    };
};

/**
 * Contar notificaciones no leídas para un usuario.
 */
notificationSchema.statics.countUnread = async function (userId, userIsPro) {
    const audiences = ['all'];
    audiences.push(userIsPro ? 'pro' : 'free');

    // Contar individuales no leídas
    const individualCount = await this.countDocuments({
        userId,
        audience: 'individual',
        isActive: true,
        isRead: false,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    });

    // Contar broadcasts no leídas por este usuario
    const broadcastCount = await this.countDocuments({
        userId: null,
        audience: { $in: audiences },
        isActive: true,
        readBy: { $ne: userId },
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    });

    return individualCount + broadcastCount;
};

/**
 * Marcar notificación como leída por un usuario.
 */
notificationSchema.statics.markAsRead = async function (notificationId, userId) {
    const notification = await this.findById(notificationId);
    if (!notification) return null;

    if (notification.audience === 'individual') {
        // Individual: solo marcar isRead
        if (notification.userId.toString() !== userId.toString()) return null;
        notification.isRead = true;
        await notification.save();
    } else {
        // Broadcast: agregar userId a readBy
        if (!notification.readBy.includes(userId)) {
            notification.readBy.push(userId);
            await notification.save();
        }
    }

    return notification;
};

/**
 * Marcar todas las notificaciones como leídas para un usuario.
 */
notificationSchema.statics.markAllAsRead = async function (userId, userIsPro) {
    const audiences = ['all'];
    audiences.push(userIsPro ? 'pro' : 'free');

    // Marcar individuales
    await this.updateMany(
        { userId, audience: 'individual', isRead: false, isActive: true },
        { $set: { isRead: true } }
    );

    // Agregar userId a readBy de broadcasts no leídos
    await this.updateMany(
        {
            userId: null,
            audience: { $in: audiences },
            isActive: true,
            readBy: { $ne: userId },
        },
        { $addToSet: { readBy: userId } }
    );
};

// ============================================
// CONFIGURACIÓN
// ============================================

notificationSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        delete ret.__v;
        delete ret.readBy; // No exponer lista de usuarios
        return ret;
    },
});

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;