import Page from '../models/Page.js';
import geminiService from '../services/geminiService.js';
import storageService from '../services/googleStorageService.js';

class PageController {
    /**
     * Crear nueva página
     * POST /api/pages
     */
    async createPage(req, res) {
        try {
            const user = req.user;
            const {
                title,
                recipientName,
                message,
                yesButtonText,
                noButtonText,
                noButtonEscapes,
                pageType,
                theme,
                backgroundColor,
                textColor,
            } = req.body;

            // Verificar si es página PRO y el usuario tiene acceso
            if (pageType === 'pro' && !user.isProActive()) {
                return res.status(403).json({
                    success: false,
                    message: 'Se requiere plan PRO para crear páginas personalizadas con IA',
                    code: 'PRO_REQUIRED',
                });
            }

            // Crear página básica
            const pageData = {
                userId: user._id,
                title,
                recipientName,
                message: message || '',
                yesButtonText: yesButtonText || 'Sí',
                noButtonText: noButtonText || 'No',
                noButtonEscapes: noButtonEscapes || false,
                pageType: pageType || 'free',
                theme: theme || 'romantic',
                backgroundColor: backgroundColor || '#ff69b4',
                textColor: textColor || '#ffffff',
            };

            // Si es página PRO y hay imagen de referencia, procesar con IA
            if (pageType === 'pro' && req.file) {
                const imageUrl = await this.processProPage(req.file, user._id, pageData);
                pageData.referenceImageUrl = imageUrl;
            }

            const page = await Page.create(pageData);

            // Incrementar contador de páginas del usuario
            user.pagesCreated += 1;
            await user.save();

            return res.status(201).json({
                success: true,
                message: 'Página creada exitosamente',
                data: {
                    _id: page._id,
                    shortId: page.shortId,
                    url: page.getFullUrl(),
                    pageType: page.pageType,
                    createdAt: page.createdAt,
                },
            });
        } catch (error) {
            console.error('Error creating page:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al crear la página',
                error: error.message,
            });
        }
    }

    /**
     * Procesar página PRO con imagen de referencia
     */
    async processProPage(file, userId, pageData) {
        try {
            // Validar archivo
            if (!storageService.isValidImageType(file.mimetype)) {
                throw new Error('Tipo de archivo no válido. Solo se permiten imágenes JPG, PNG, GIF, WEBP');
            }

            if (!storageService.isValidFileSize(file.size)) {
                throw new Error('El archivo es demasiado grande. Máximo 5MB');
            }

            // Subir imagen a Firebase Storage
            const imageUrl = await storageService.uploadReferenceImage(file.buffer, file.originalname, userId);

            // Generar HTML/CSS con Gemini
            const { html, css } = await geminiService.generatePageFromImage(imageUrl, pageData);

            // Validar código generado
            geminiService.validateGeneratedCode(html, css);

            // Guardar HTML/CSS en pageData
            pageData.customHTML = html;
            pageData.customCSS = css;

            return imageUrl;
        } catch (error) {
            console.error('Error processing pro page:', error);
            throw error;
        }
    }

    /**
     * Obtener página por shortId (para visitantes)
     * GET /api/pages/:shortId
     */
    async getPageByShortId(req, res) {
        try {
            const { shortId } = req.params;

            const page = await Page.findOne({ shortId, isActive: true }).populate('userId', 'displayName');

            if (!page) {
                return res.status(404).json({
                    success: false,
                    message: 'Página no encontrada',
                });
            }

            // Incrementar vistas
            // TODO: Implementar lógica para detectar vistas únicas (por IP o cookie)
            await page.incrementViews(false);

            return res.json({
                success: true,
                data: {
                    _id: page._id,
                    title: page.title,
                    recipientName: page.recipientName,
                    message: page.message,
                    yesButtonText: page.yesButtonText,
                    noButtonText: page.noButtonText,
                    noButtonEscapes: page.noButtonEscapes,
                    pageType: page.pageType,
                    theme: page.theme,
                    backgroundColor: page.backgroundColor,
                    textColor: page.textColor,
                    customHTML: page.customHTML,
                    customCSS: page.customCSS,
                    referenceImageUrl: page.referenceImageUrl,
                    createdAt: page.createdAt,
                    createdBy: page.userId?.displayName || 'Anónimo',
                },
            });
        } catch (error) {
            console.error('Error getting page:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al obtener la página',
            });
        }
    }

    /**
     * Responder a una página
     * POST /api/pages/:shortId/respond
     */
    async respondToPage(req, res) {
        try {
            const { shortId } = req.params;
            const { answer } = req.body;

            const page = await Page.findOne({ shortId, isActive: true });

            if (!page) {
                return res.status(404).json({
                    success: false,
                    message: 'Página no encontrada',
                });
            }

            // Obtener metadata de la respuesta
            const metadata = {
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.headers['user-agent'],
                // Aquí podrías agregar geolocalización usando un servicio externo
            };

            const response = await page.addResponse(answer, metadata);

            return res.json({
                success: true,
                message: 'Respuesta registrada exitosamente',
                data: {
                    responseId: response._id,
                    answer: response.answer,
                    respondedAt: response.respondedAt,
                },
            });
        } catch (error) {
            console.error('Error responding to page:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al registrar la respuesta',
            });
        }
    }

    /**
     * Obtener todas las páginas del usuario autenticado
     * GET /api/pages/my-pages
     */
    async getUserPages(req, res) {
        try {
            const user = req.user;
            const { page = 1, limit = 10, sortBy = 'createdAt', order = 'desc' } = req.query;

            const skip = (page - 1) * limit;
            const sortOrder = order === 'asc' ? 1 : -1;

            const pages = await Page.find({ userId: user._id })
                .sort({ [sortBy]: sortOrder })
                .skip(skip)
                .limit(parseInt(limit))
                .lean();

            const total = await Page.countDocuments({ userId: user._id });

            // Agregar estadísticas a cada página
            const pagesWithStats = pages.map((page) => {
                const yesCount = page.responses.filter((r) => r.answer === 'yes').length;
                const noCount = page.responses.filter((r) => r.answer === 'no').length;

                return {
                    _id: page._id,
                    shortId: page.shortId,
                    url: `${process.env.FRONTEND_URL}/p/${page.shortId}`,
                    title: page.title,
                    recipientName: page.recipientName,
                    pageType: page.pageType,
                    views: page.views,
                    totalResponses: page.responses.length,
                    yesCount,
                    noCount,
                    createdAt: page.createdAt,
                    isActive: page.isActive,
                };
            });

            return res.json({
                success: true,
                data: pagesWithStats,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    totalItems: total,
                    itemsPerPage: parseInt(limit),
                },
            });
        } catch (error) {
            console.error('Error getting user pages:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al obtener las páginas',
            });
        }
    }
}

export default new PageController();