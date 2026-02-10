import Page from '../models/Page.js';
import storageService from '../services/googleStorageService.js';

class PageControllerExtended {
    /**
     * Obtener detalles completos de una página (solo para el dueño)
     * GET /api/pages/:pageId/details
     */
    async getPageDetails(req, res) {
        try {
            const user = req.user;
            const { pageId } = req.params;

            const page = await Page.findOne({ _id: pageId, userId: user._id });

            if (!page) {
                return res.status(404).json({
                    success: false,
                    message: 'Página no encontrada',
                });
            }

            const stats = page.getStats();

            return res.json({
                success: true,
                data: {
                    page: {
                        _id: page._id,
                        shortId: page.shortId,
                        url: page.getFullUrl(),
                        title: page.title,
                        recipientName: page.recipientName,
                        message: page.message,
                        yesButtonText: page.yesButtonText,
                        customSlug: page.customSlug, // 🆕
                        noButtonText: page.noButtonText,
                        noButtonEscapes: page.noButtonEscapes,
                        pageType: page.pageType,
                        theme: page.theme,
                        backgroundColor: page.backgroundColor,
                        textColor: page.textColor,
                        referenceImageUrl: page.referenceImageUrl,
                        isActive: page.isActive,
                        createdAt: page.createdAt,
                        updatedAt: page.updatedAt,
                    },
                    stats,
                    responses: page.responses.map((r) => ({
                        _id: r._id,
                        answer: r.answer,
                        respondedAt: r.respondedAt,
                        location: r.location,
                    })),
                },
            });
        } catch (error) {
            console.error('Error getting page details:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al obtener detalles de la página',
            });
        }
    }

    /**
     * Actualizar página
     * PATCH /api/pages/:pageId
     */
    async updatePage(req, res) {
        try {
            const user = req.user;
            const { pageId } = req.params;
            const updates = req.body;

            const page = await Page.findOne({ _id: pageId, userId: user._id });

            if (!page) {
                return res.status(404).json({
                    success: false,
                    message: 'Página no encontrada',
                });
            }

            // Campos permitidos para actualizar
            const allowedUpdates = [
                'title',
                'recipientName',
                'message',
                'yesButtonText',
                'noButtonText',
                'noButtonEscapes',
                'theme',
                'backgroundColor',
                'textColor',
                'isActive',
            ];

            allowedUpdates.forEach((field) => {
                if (updates[field] !== undefined) {
                    page[field] = updates[field];
                }
            });

            await page.save();

            return res.json({
                success: true,
                message: 'Página actualizada exitosamente',
                data: {
                    _id: page._id,
                    shortId: page.shortId,
                    updatedAt: page.updatedAt,
                },
            });
        } catch (error) {
            console.error('Error updating page:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al actualizar la página',
            });
        }
    }

    /**
     * Eliminar página
     * DELETE /api/pages/:pageId
     */
    async deletePage(req, res) {
        try {
            const user = req.user;
            const { pageId } = req.params;

            const page = await Page.findOne({ _id: pageId, userId: user._id, isDeleted: { $ne: true } });

            if (!page) {
                return res.status(404).json({
                    success: false,
                    message: 'Página no encontrada',
                });
            }

            page.isDeleted = true;
            page.isActive = false;
            await page.save();

            return res.json({
                success: true,
                message: 'Página eliminada exitosamente',
            });
        } catch (error) {
            console.error('Error deleting page:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al eliminar la página',
            });
        }
    }

    /**
     * Obtener estadísticas generales del usuario
     * GET /api/pages/stats
     */
    async getUserStats(req, res) {
        try {
            const user = req.user;

            const pages = await Page.find({ userId: user._id, isDeleted: { $ne: true } });

            const stats = {
                totalPages: pages.length,
                totalViews: pages.reduce((sum, page) => sum + page.views, 0),
                totalResponses: pages.reduce((sum, page) => sum + page.responses.length, 0),
                totalYes: pages.reduce(
                    (sum, page) => sum + page.responses.filter((r) => r.answer === 'yes').length,
                    0
                ),
                totalNo: pages.reduce(
                    (sum, page) => sum + page.responses.filter((r) => r.answer === 'no').length,
                    0
                ),
                pagesByType: {
                    free: pages.filter((p) => p.pageType === 'free').length,
                    pro: pages.filter((p) => p.pageType === 'pro').length,
                },
                mostViewedPage: pages.length > 0 ? pages.reduce((max, page) => (page.views > max.views ? page : max)) : null,
            };

            return res.json({
                success: true,
                data: stats,
            });
        } catch (error) {
            console.error('Error getting user stats:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al obtener estadísticas',
            });
        }
    }

    /**
     * Toggle estado activo/inactivo de página
     * PATCH /api/pages/:pageId/toggle
     */
    async togglePageStatus(req, res) {
        try {
            const user = req.user;
            const { pageId } = req.params;

            const page = await Page.findOne({ _id: pageId, userId: user._id });

            if (!page) {
                return res.status(404).json({
                    success: false,
                    message: 'Página no encontrada',
                });
            }

            page.isActive = !page.isActive;
            await page.save();

            return res.json({
                success: true,
                message: `Página ${page.isActive ? 'activada' : 'desactivada'} exitosamente`,
                data: {
                    _id: page._id,
                    isActive: page.isActive,
                },
            });
        } catch (error) {
            console.error('Error toggling page status:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al cambiar estado de la página',
            });
        }
    }
}

export default new PageControllerExtended();