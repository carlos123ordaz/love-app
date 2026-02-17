import express from 'express';
import notificationController from '../controllers/notificationController.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminMiddleware.js';

const router = express.Router();

// ============================================
// RUTAS DE USUARIO (requieren autenticación)
// ============================================ 

/**
 * GET /api/notifications
 * Obtener mis notificaciones (individuales + broadcasts)
 * Query: ?page=1&limit=20
 */
router.get(
    '/',
    authenticate,
    (req, res) => notificationController.getMyNotifications(req, res)
);

/**
 * GET /api/notifications/unread-count
 * Obtener cantidad de notificaciones no leídas
 */
router.get(
    '/unread-count',
    authenticate,
    (req, res) => notificationController.getUnreadCount(req, res)
);

/**
 * PATCH /api/notifications/read-all
 * Marcar TODAS mis notificaciones como leídas
 */
router.patch(
    '/read-all',
    authenticate,
    (req, res) => notificationController.markAllAsRead(req, res)
);

/**
 * PATCH /api/notifications/:notificationId/read
 * Marcar UNA notificación como leída
 */
router.patch(
    '/:notificationId/read',
    authenticate,
    (req, res) => notificationController.markAsRead(req, res)
);

// ============================================
// RUTAS ADMIN (requieren autenticación + admin)
// ============================================

/**
 * GET /api/notifications/admin/all
 * Listar todas las notificaciones del sistema
 * Query: ?page=1&limit=30&audience=all&type=info
 */
router.get(
    '/admin/all',
    authenticate,
    requireAdmin,
    (req, res) => notificationController.adminGetAll(req, res)
);

/**
 * GET /api/notifications/admin/stats
 * Estadísticas de notificaciones
 */
router.get(
    '/admin/stats',
    authenticate,
    requireAdmin,
    (req, res) => notificationController.adminStats(req, res)
);

/**
 * POST /api/notifications/admin/send
 * Enviar notificación a UN usuario específico
 * Body: {
 *   userId: "ObjectId del usuario",
 *   title: "Título",
 *   message: "Mensaje",
 *   type: "info|success|warning|promo|update|response|system",
 *   icon: "🔔",
 *   actionUrl: "/upgrade" (opcional),
 *   actionText: "Ver más" (opcional),
 *   expiresAt: "2025-12-31" (opcional)
 * }
 */
router.post(
    '/admin/send',
    authenticate,
    requireAdmin,
    (req, res) => notificationController.adminSendToUser(req, res)
);

/**
 * POST /api/notifications/admin/broadcast
 * Enviar notificación a TODOS, solo PRO, o solo FREE
 * Body: {
 *   audience: "all|pro|free",
 *   title: "Título",
 *   message: "Mensaje",
 *   type: "info|success|warning|promo|update|response|system",
 *   icon: "📢",
 *   actionUrl: "/upgrade" (opcional),
 *   actionText: "Ver oferta" (opcional),
 *   expiresAt: "2025-12-31" (opcional)
 * }
 */
router.post(
    '/admin/broadcast',
    authenticate,
    requireAdmin,
    (req, res) => notificationController.adminBroadcast(req, res)
);

/**
 * POST /api/notifications/admin/send-bulk
 * Enviar notificación a VARIOS usuarios específicos
 * Body: {
 *   userIds: ["id1", "id2", "id3"],
 *   title: "Título",
 *   message: "Mensaje",
 *   type: "info",
 *   icon: "🔔"
 * }
 */
router.post(
    '/admin/send-bulk',
    authenticate,
    requireAdmin,
    (req, res) => notificationController.adminSendBulk(req, res)
);

/**
 * DELETE /api/notifications/admin/:notificationId
 * Desactivar/eliminar una notificación
 */
router.delete(
    '/admin/:notificationId',
    authenticate,
    requireAdmin,
    (req, res) => notificationController.adminDelete(req, res)
);

export default router;