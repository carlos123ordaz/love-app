import User from '../models/User.js';
import Page from '../models/Page.js';
import Contact from '../models/Contact.js';

class AdminController {
    // ==================== DASHBOARD ====================

    /**
     * GET /api/admin/dashboard
     * Estadísticas generales del admin
     */
    async getDashboardStats(req, res) {
        try {
            const [totalUsers, totalPages, totalContacts, proUsers] = await Promise.all([
                User.countDocuments(),
                Page.countDocuments(),
                Contact.countDocuments(),
                User.countDocuments({ isPro: true }),
            ]);

            const pendingContacts = await Contact.countDocuments({ status: 'pending' });
            const activePages = await Page.countDocuments({ isActive: true });

            // Usuarios registrados en los últimos 7 días
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const newUsersLast7Days = await User.countDocuments({ createdAt: { $gte: sevenDaysAgo } });

            // Páginas creadas en los últimos 7 días
            const newPagesLast7Days = await Page.countDocuments({ createdAt: { $gte: sevenDaysAgo } });

            return res.json({
                success: true,
                data: {
                    totalUsers,
                    totalPages,
                    totalContacts,
                    proUsers,
                    pendingContacts,
                    activePages,
                    newUsersLast7Days,
                    newPagesLast7Days,
                },
            });
        } catch (error) {
            console.error('Error getting dashboard stats:', error);
            return res.status(500).json({ success: false, message: 'Error al obtener estadísticas' });
        }
    }

    // ==================== USERS (READ-ONLY) ====================

    /**
     * GET /api/admin/users
     * Listar todos los usuarios con paginación y filtros
     */
    async getUsers(req, res) {
        try {
            const {
                page = 1,
                limit = 20,
                search = '',
                isPro,
                sortBy = 'createdAt',
                order = 'desc',
            } = req.query;

            const query = {};

            if (search) {
                query.$or = [
                    { email: { $regex: search, $options: 'i' } },
                    { displayName: { $regex: search, $options: 'i' } },
                ];
            }

            if (isPro !== undefined) {
                query.isPro = isPro === 'true';
            }

            const sortOrder = order === 'asc' ? 1 : -1;
            const skip = (parseInt(page) - 1) * parseInt(limit);

            const [users, total] = await Promise.all([
                User.find(query)
                    .sort({ [sortBy]: sortOrder })
                    .skip(skip)
                    .limit(parseInt(limit))
                    .select('-__v')
                    .lean(),
                User.countDocuments(query),
            ]);

            // Agregar conteo de páginas reales para cada usuario
            const userIds = users.map((u) => u._id);
            const pageCounts = await Page.aggregate([
                { $match: { userId: { $in: userIds } } },
                { $group: { _id: '$userId', count: { $sum: 1 } } },
            ]);
            const pageCountMap = {};
            pageCounts.forEach((pc) => {
                pageCountMap[pc._id.toString()] = pc.count;
            });

            const enrichedUsers = users.map((u) => ({
                ...u,
                actualPageCount: pageCountMap[u._id.toString()] || 0,
            }));

            return res.json({
                success: true,
                data: enrichedUsers,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / parseInt(limit)),
                },
            });
        } catch (error) {
            console.error('Error getting users:', error);
            return res.status(500).json({ success: false, message: 'Error al obtener usuarios' });
        }
    }

    /**
     * GET /api/admin/users/:userId
     * Detalle de un usuario específico
     */
    async getUserDetail(req, res) {
        try {
            const { userId } = req.params;

            const user = await User.findById(userId).select('-__v').lean();
            if (!user) {
                return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
            }

            const pages = await Page.find({ userId: user._id })
                .sort({ createdAt: -1 })
                .select('shortId title pageType views responses isActive createdAt')
                .lean();

            const pagesWithStats = pages.map((p) => ({
                _id: p._id,
                shortId: p.shortId,
                title: p.title,
                pageType: p.pageType,
                views: p.views,
                totalResponses: p.responses?.length || 0,
                yesCount: p.responses?.filter((r) => r.answer === 'yes').length || 0,
                noCount: p.responses?.filter((r) => r.answer === 'no').length || 0,
                isActive: p.isActive,
                createdAt: p.createdAt,
            }));

            return res.json({
                success: true,
                data: {
                    user,
                    pages: pagesWithStats,
                },
            });
        } catch (error) {
            console.error('Error getting user detail:', error);
            return res.status(500).json({ success: false, message: 'Error al obtener detalle del usuario' });
        }
    }

    // ==================== PAGES ====================

    /**
     * GET /api/admin/pages
     * Listar todas las páginas con paginación y filtros
     */
    async getPages(req, res) {
        try {
            const {
                page = 1,
                limit = 20,
                search = '',
                pageType,
                isActive,
                sortBy = 'createdAt',
                order = 'desc',
            } = req.query;

            const query = {};

            if (search) {
                query.$or = [
                    { title: { $regex: search, $options: 'i' } },
                    { recipientName: { $regex: search, $options: 'i' } },
                    { shortId: { $regex: search, $options: 'i' } },
                ];
            }

            if (pageType) query.pageType = pageType;
            if (isActive !== undefined) query.isActive = isActive === 'true';

            const sortOrder = order === 'asc' ? 1 : -1;
            const skip = (parseInt(page) - 1) * parseInt(limit);

            const [pages, total] = await Promise.all([
                Page.find(query)
                    .populate('userId', 'email displayName')
                    .sort({ [sortBy]: sortOrder })
                    .skip(skip)
                    .limit(parseInt(limit))
                    .lean(),
                Page.countDocuments(query),
            ]);

            const pagesFormatted = pages.map((p) => ({
                _id: p._id,
                shortId: p.shortId,
                title: p.title,
                recipientName: p.recipientName,
                pageType: p.pageType,
                theme: p.theme,
                views: p.views,
                totalResponses: p.responses?.length || 0,
                yesCount: p.responses?.filter((r) => r.answer === 'yes').length || 0,
                noCount: p.responses?.filter((r) => r.answer === 'no').length || 0,
                isActive: p.isActive,
                createdAt: p.createdAt,
                backgroundImageUrl: p.backgroundImageUrl,
                owner: p.userId
                    ? { _id: p.userId._id, email: p.userId.email, displayName: p.userId.displayName }
                    : null,
            }));

            return res.json({
                success: true,
                data: pagesFormatted,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / parseInt(limit)),
                },
            });
        } catch (error) {
            console.error('Error getting pages:', error);
            return res.status(500).json({ success: false, message: 'Error al obtener páginas' });
        }
    }

    /**
     * GET /api/admin/pages/:pageId
     * Detalle completo de una página
     */
    async getPageDetail(req, res) {
        try {
            const { pageId } = req.params;

            const page = await Page.findById(pageId)
                .populate('userId', 'email displayName photoURL')
                .lean();

            if (!page) {
                return res.status(404).json({ success: false, message: 'Página no encontrada' });
            }

            const yesCount = page.responses?.filter((r) => r.answer === 'yes').length || 0;
            const noCount = page.responses?.filter((r) => r.answer === 'no').length || 0;
            const totalResponses = page.responses?.length || 0;

            return res.json({
                success: true,
                data: {
                    ...page,
                    stats: {
                        views: page.views,
                        uniqueViews: page.uniqueViews,
                        totalResponses,
                        yesCount,
                        noCount,
                        yesPercentage: totalResponses > 0 ? ((yesCount / totalResponses) * 100).toFixed(1) : 0,
                        noPercentage: totalResponses > 0 ? ((noCount / totalResponses) * 100).toFixed(1) : 0,
                    },
                },
            });
        } catch (error) {
            console.error('Error getting page detail:', error);
            return res.status(500).json({ success: false, message: 'Error al obtener detalle de página' });
        }
    }

    /**
     * PATCH /api/admin/pages/:pageId/toggle
     * Activar/desactivar página
     */
    async togglePage(req, res) {
        try {
            const { pageId } = req.params;
            const page = await Page.findById(pageId);

            if (!page) {
                return res.status(404).json({ success: false, message: 'Página no encontrada' });
            }

            page.isActive = !page.isActive;
            await page.save();

            return res.json({
                success: true,
                message: `Página ${page.isActive ? 'activada' : 'desactivada'}`,
                data: { _id: page._id, isActive: page.isActive },
            });
        } catch (error) {
            console.error('Error toggling page:', error);
            return res.status(500).json({ success: false, message: 'Error al cambiar estado de página' });
        }
    }

    /**
     * DELETE /api/admin/pages/:pageId
     * Eliminar página
     */
    async deletePage(req, res) {
        try {
            const { pageId } = req.params;
            const page = await Page.findById(pageId);

            if (!page) {
                return res.status(404).json({ success: false, message: 'Página no encontrada' });
            }

            await Page.findByIdAndDelete(pageId);

            return res.json({
                success: true,
                message: 'Página eliminada exitosamente',
            });
        } catch (error) {
            console.error('Error deleting page:', error);
            return res.status(500).json({ success: false, message: 'Error al eliminar página' });
        }
    }

    // ==================== CONTACTS ====================

    /**
     * GET /api/admin/contacts
     * Listar todos los mensajes de contacto
     */
    async getContacts(req, res) {
        try {
            const {
                page = 1,
                limit = 20,
                status,
                type,
                search = '',
                sortBy = 'createdAt',
                order = 'desc',
            } = req.query;

            const query = {};
            if (status) query.status = status;
            if (type) query.type = type;

            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { subject: { $regex: search, $options: 'i' } },
                ];
            }

            const sortOrder = order === 'asc' ? 1 : -1;
            const skip = (parseInt(page) - 1) * parseInt(limit);

            const [contacts, total] = await Promise.all([
                Contact.find(query)
                    .populate('userId', 'email displayName')
                    .sort({ [sortBy]: sortOrder })
                    .skip(skip)
                    .limit(parseInt(limit))
                    .lean(),
                Contact.countDocuments(query),
            ]);

            return res.json({
                success: true,
                data: contacts,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / parseInt(limit)),
                },
            });
        } catch (error) {
            console.error('Error getting contacts:', error);
            return res.status(500).json({ success: false, message: 'Error al obtener contactos' });
        }
    }

    /**
     * GET /api/admin/contacts/:contactId
     * Detalle de un mensaje de contacto
     */
    async getContactDetail(req, res) {
        try {
            const { contactId } = req.params;

            const contact = await Contact.findById(contactId)
                .populate('userId', 'email displayName photoURL')
                .lean();

            if (!contact) {
                return res.status(404).json({ success: false, message: 'Contacto no encontrado' });
            }

            return res.json({
                success: true,
                data: contact,
            });
        } catch (error) {
            console.error('Error getting contact detail:', error);
            return res.status(500).json({ success: false, message: 'Error al obtener detalle del contacto' });
        }
    }

    /**
     * PATCH /api/admin/contacts/:contactId
     * Actualizar estado y notas de un contacto
     */
    async updateContact(req, res) {
        try {
            const { contactId } = req.params;
            const { status, adminNotes } = req.body;

            const contact = await Contact.findById(contactId);
            if (!contact) {
                return res.status(404).json({ success: false, message: 'Contacto no encontrado' });
            }

            if (status) {
                contact.status = status;
                if (status === 'resolved' || status === 'closed') {
                    contact.respondedAt = new Date();
                }
            }

            if (adminNotes !== undefined) {
                contact.adminNotes = adminNotes;
            }

            await contact.save();

            return res.json({
                success: true,
                message: 'Contacto actualizado',
                data: contact,
            });
        } catch (error) {
            console.error('Error updating contact:', error);
            return res.status(500).json({ success: false, message: 'Error al actualizar contacto' });
        }
    }

    /**
     * DELETE /api/admin/contacts/:contactId
     * Eliminar mensaje de contacto
     */
    async deleteContact(req, res) {
        try {
            const { contactId } = req.params;
            const contact = await Contact.findById(contactId);

            if (!contact) {
                return res.status(404).json({ success: false, message: 'Contacto no encontrado' });
            }

            await Contact.findByIdAndDelete(contactId);

            return res.json({
                success: true,
                message: 'Contacto eliminado exitosamente',
            });
        } catch (error) {
            console.error('Error deleting contact:', error);
            return res.status(500).json({ success: false, message: 'Error al eliminar contacto' });
        }
    }
}

export default new AdminController();