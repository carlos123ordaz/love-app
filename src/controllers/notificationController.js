import Notification from '../models/Notification.js';
import User from '../models/User.js';

class NotificationController {
    // ============================================
    // ENDPOINTS PARA USUARIOS AUTENTICADOS
    // ============================================

    /**
     * Obtener notificaciones del usuario actual
     * GET /api/notifications
     * Query: ?page=1&limit=20
     */
    async getMyNotifications(req, res) {
        try {
            const user = req.user;
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 20, 50);

            const result = await Notification.getForUser(
                user._id,
                user.isProActive(),
                { page, limit }
            );

            return res.json({
                success: true,
                data: result,
            });
        } catch (error) {
            console.error('Error fetching notifications:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al obtener notificaciones',
            });
        }
    }

    /**
     * Obtener contador de no leídas
     * GET /api/notifications/unread-count
     */
    async getUnreadCount(req, res) {
        try {
            const user = req.user;
            const count = await Notification.countUnread(
                user._id,
                user.isProActive()
            );

            return res.json({
                success: true,
                data: { count },
            });
        } catch (error) {
            console.error('Error counting unread:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al contar notificaciones',
            });
        }
    }

    /**
     * Marcar una notificación como leída
     * PATCH /api/notifications/:notificationId/read
     */
    async markAsRead(req, res) {
        try {
            const user = req.user;
            const { notificationId } = req.params;

            const notification = await Notification.markAsRead(
                notificationId,
                user._id
            );

            if (!notification) {
                return res.status(404).json({
                    success: false,
                    message: 'Notificación no encontrada',
                });
            }

            return res.json({
                success: true,
                message: 'Notificación marcada como leída',
            });
        } catch (error) {
            console.error('Error marking as read:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al marcar notificación',
            });
        }
    }

    /**
     * Marcar todas las notificaciones como leídas
     * PATCH /api/notifications/read-all
     */
    async markAllAsRead(req, res) {
        try {
            const user = req.user;
            await Notification.markAllAsRead(
                user._id,
                user.isProActive()
            );

            return res.json({
                success: true,
                message: 'Todas las notificaciones marcadas como leídas',
            });
        } catch (error) {
            console.error('Error marking all as read:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al marcar notificaciones',
            });
        }
    }

    // ============================================
    // ENDPOINTS ADMIN (para Postman / panel admin)
    // ============================================

    /**
     * Enviar notificación a un usuario específico
     * POST /api/notifications/admin/send
     * Body: { userId, title, message, type, icon, actionUrl, actionText, expiresAt }
     */
    async adminSendToUser(req, res) {
        try {
            const {
                userId,
                title,
                message,
                type = 'info',
                icon = '🔔',
                actionUrl,
                actionText,
                expiresAt,
            } = req.body;

            if (!userId || !title || !message) {
                return res.status(400).json({
                    success: false,
                    message: 'userId, title y message son requeridos',
                });
            }

            // Verificar que el usuario existe
            const targetUser = await User.findById(userId);
            if (!targetUser) {
                return res.status(404).json({
                    success: false,
                    message: 'Usuario no encontrado',
                });
            }

            const notification = await Notification.create({
                userId,
                audience: 'individual',
                title,
                message,
                type,
                icon,
                actionUrl: actionUrl || null,
                actionText: actionText || null,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
                sentBy: req.user._id,
            });

            return res.status(201).json({
                success: true,
                message: `Notificación enviada a ${targetUser.displayName || targetUser.email}`,
                data: notification,
            });
        } catch (error) {
            console.error('Error sending notification:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al enviar notificación',
            });
        }
    }

    /**
     * Enviar notificación broadcast (a todos, solo PRO, solo free)
     * POST /api/notifications/admin/broadcast
     * Body: { audience, title, message, type, icon, actionUrl, actionText, expiresAt }
     */
    async adminBroadcast(req, res) {
        try {
            const {
                audience = 'all',
                title,
                message,
                type = 'info',
                icon = '📢',
                actionUrl,
                actionText,
                expiresAt,
            } = req.body;

            if (!title || !message) {
                return res.status(400).json({
                    success: false,
                    message: 'title y message son requeridos',
                });
            }

            if (!['all', 'pro', 'free'].includes(audience)) {
                return res.status(400).json({
                    success: false,
                    message: 'audience debe ser: all, pro, o free',
                });
            }

            const notification = await Notification.create({
                userId: null,
                audience,
                title,
                message,
                type,
                icon,
                actionUrl: actionUrl || null,
                actionText: actionText || null,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
                sentBy: req.user._id,
            });

            // Contar cuántos usuarios recibirán la notificación
            let recipientFilter = {};
            if (audience === 'pro') {
                recipientFilter = { isPro: true };
            } else if (audience === 'free') {
                recipientFilter = { isPro: false };
            }

            const recipientCount = await User.countDocuments(recipientFilter);

            return res.status(201).json({
                success: true,
                message: `Broadcast enviado a ~${recipientCount} usuarios (${audience})`,
                data: notification,
            });
        } catch (error) {
            console.error('Error broadcasting:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al enviar broadcast',
            });
        }
    }

    /**
     * Enviar notificación a múltiples usuarios específicos
     * POST /api/notifications/admin/send-bulk
     * Body: { userIds: [...], title, message, type, icon, actionUrl, actionText }
     */
    async adminSendBulk(req, res) {
        try {
            const {
                userIds,
                title,
                message,
                type = 'info',
                icon = '🔔',
                actionUrl,
                actionText,
                expiresAt,
            } = req.body;

            if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'userIds debe ser un array con al menos un ID',
                });
            }

            if (!title || !message) {
                return res.status(400).json({
                    success: false,
                    message: 'title y message son requeridos',
                });
            }

            if (userIds.length > 100) {
                return res.status(400).json({
                    success: false,
                    message: 'Máximo 100 usuarios por envío bulk',
                });
            }

            // Verificar que los usuarios existen
            const existingUsers = await User.find({ _id: { $in: userIds } }).select('_id');
            const existingIds = existingUsers.map((u) => u._id.toString());

            // Crear notificaciones en lote
            const notifications = existingIds.map((uid) => ({
                userId: uid,
                audience: 'individual',
                title,
                message,
                type,
                icon,
                actionUrl: actionUrl || null,
                actionText: actionText || null,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
                sentBy: req.user._id,
            }));

            const created = await Notification.insertMany(notifications);

            const notFoundCount = userIds.length - existingIds.length;

            return res.status(201).json({
                success: true,
                message: `Notificación enviada a ${created.length} usuarios${notFoundCount > 0 ? ` (${notFoundCount} no encontrados)` : ''}`,
                data: {
                    sent: created.length,
                    notFound: notFoundCount,
                },
            });
        } catch (error) {
            console.error('Error bulk sending:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al enviar notificaciones',
            });
        }
    }

    /**
     * Listar todas las notificaciones (admin panel)
     * GET /api/notifications/admin/all
     * Query: ?page=1&limit=30&audience=all&type=info
     */
    async adminGetAll(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 30, 100);
            const skip = (page - 1) * limit;

            const filter = {};
            if (req.query.audience) filter.audience = req.query.audience;
            if (req.query.type) filter.type = req.query.type;

            const [notifications, total] = await Promise.all([
                Notification.find(filter)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .populate('userId', 'displayName email')
                    .populate('sentBy', 'displayName email')
                    .lean(),
                Notification.countDocuments(filter),
            ]);

            // Agregar readCount para broadcasts
            const result = notifications.map((n) => ({
                ...n,
                readCount: n.audience === 'individual' ? (n.isRead ? 1 : 0) : (n.readBy || []).length,
            }));

            return res.json({
                success: true,
                data: {
                    notifications: result,
                    total,
                    page,
                    totalPages: Math.ceil(total / limit),
                },
            });
        } catch (error) {
            console.error('Error fetching all notifications:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al obtener notificaciones',
            });
        }
    }

    /**
     * Eliminar / desactivar notificación
     * DELETE /api/notifications/admin/:notificationId
     */
    async adminDelete(req, res) {
        try {
            const { notificationId } = req.params;

            const notification = await Notification.findByIdAndUpdate(
                notificationId,
                { isActive: false },
                { new: true }
            );

            if (!notification) {
                return res.status(404).json({
                    success: false,
                    message: 'Notificación no encontrada',
                });
            }

            return res.json({
                success: true,
                message: 'Notificación desactivada',
            });
        } catch (error) {
            console.error('Error deleting notification:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al eliminar notificación',
            });
        }
    }

    /**
     * Estadísticas de notificaciones
     * GET /api/notifications/admin/stats
     */
    async adminStats(req, res) {
        try {
            const [total, active, byType, byAudience, recentBroadcasts] = await Promise.all([
                Notification.countDocuments({}),
                Notification.countDocuments({ isActive: true }),
                Notification.aggregate([
                    { $match: { isActive: true } },
                    { $group: { _id: '$type', count: { $sum: 1 } } },
                ]),
                Notification.aggregate([
                    { $match: { isActive: true } },
                    { $group: { _id: '$audience', count: { $sum: 1 } } },
                ]),
                Notification.find({ audience: { $ne: 'individual' }, isActive: true })
                    .sort({ createdAt: -1 })
                    .limit(5)
                    .select('title audience type createdAt readBy')
                    .lean()
                    .then((notifs) =>
                        notifs.map((n) => ({
                            ...n,
                            readCount: (n.readBy || []).length,
                        }))
                    ),
            ]);

            return res.json({
                success: true,
                data: {
                    total,
                    active,
                    byType: Object.fromEntries(byType.map((t) => [t._id, t.count])),
                    byAudience: Object.fromEntries(byAudience.map((a) => [a._id, a.count])),
                    recentBroadcasts,
                },
            });
        } catch (error) {
            console.error('Error getting stats:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al obtener estadísticas',
            });
        }
    }
}

export default new NotificationController();