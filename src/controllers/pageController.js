import Page from '../models/Page.js';
import geminiService from '../services/geminiService.js';
import storageService from '../services/googleStorageService.js';

// Features que requieren PRO
const PRO_THEMES = ['neon', 'vintage', 'aurora', 'cherry'];
const PRO_ANIMATIONS = ['confetti', 'particles', 'fireworks', 'snow', 'petals', 'bubbles'];
const PRO_FONTS = [
    'Cormorant Garamond', 'Cinzel', 'Abril Fatface', 'Righteous',
    'Sacramento', 'Amatic SC', 'Caveat', 'Indie Flower',
];
const PRO_STICKERS = ['star', 'fire', 'butterfly', 'teddy', 'chocolate', 'champagne', 'moon', 'rainbow'];
const PRO_MUSIC = ['romantic-piano', 'acoustic-guitar', 'love-song', 'music-box', 'orchestra'];

// Límites FREE vs PRO (solo para cantidad de items, NO para páginas)
const LIMITS = {
    free: {
        maxDecorativeImages: 1,
        maxStickers: 3,
    },
    pro: {
        maxDecorativeImages: 5,
        maxStickers: 10,
    },
};

/**
 * Parsear JSON de forma segura
 */
function safeJsonParse(value, fallback = []) {
    if (!value) return fallback;
    if (Array.isArray(value)) return value;

    try {
        const cleaned = value
            .replace(/&quot;/g, '"')
            .replace(/&#x27;/g, "'")
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');

        const parsed = JSON.parse(cleaned);
        return Array.isArray(parsed) ? parsed : fallback;
    } catch (e) {
        return fallback;
    }
}

class PageController {
    /**
     * Validar que el usuario no use features PRO sin serlo
     */
    validateProFeatures(user, body) {
        const isPro = user.isProActive();
        const errors = [];

        if (!isPro) {
            if (PRO_THEMES.includes(body.theme)) {
                errors.push('El tema seleccionado requiere plan PRO');
            }
            if (PRO_ANIMATIONS.includes(body.animation)) {
                errors.push('La animación seleccionada requiere plan PRO');
            }
            if (PRO_FONTS.includes(body.titleFont) || PRO_FONTS.includes(body.bodyFont)) {
                errors.push('La tipografía seleccionada requiere plan PRO');
            }
            if (PRO_MUSIC.includes(body.backgroundMusic)) {
                errors.push('La música de fondo requiere plan PRO');
            }

            // Validar stickers PRO
            const selectedStickers = safeJsonParse(body.selectedStickers);
            const hasProSticker = selectedStickers.some((s) => PRO_STICKERS.includes(s));
            if (hasProSticker) {
                errors.push('Algunos stickers seleccionados requieren plan PRO');
            }

            // Validar límites de cantidad
            if (selectedStickers.length > LIMITS.free.maxStickers) {
                errors.push(`Máximo ${LIMITS.free.maxStickers} stickers en plan gratuito`);
            }

            // Custom slug solo para PRO
            if (body.customSlug) {
                errors.push('Las URLs personalizadas requieren plan PRO');
            }
        }

        return errors;
    }

    /**
     * Verificar disponibilidad de slug personalizado
     * GET /api/pages/check-slug/:slug
     */
    async checkSlugAvailability(req, res) {
        try {
            const { slug } = req.params;
            const user = req.user;

            // Solo usuarios PRO pueden verificar slugs
            if (!user.isProActive()) {
                return res.status(403).json({
                    success: false,
                    message: 'Las URLs personalizadas requieren plan PRO',
                    code: 'PRO_REQUIRED',
                });
            }

            const result = await Page.isSlugAvailable(slug);

            return res.json({
                success: true,
                data: result,
            });
        } catch (error) {
            console.error('Error checking slug:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al verificar disponibilidad',
            });
        }
    }

    /**
     * Crear nueva página (sin límite de páginas, solo validación de features PRO)
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
                accentColor,
                titleFont,
                bodyFont,
                animation,
                backgroundMusic,
                selectedStickers,
                showWatermark,
                customSlug,
            } = req.body;

            // Verificar PRO para página tipo 'pro' (IA)
            if (pageType === 'pro' && !user.isProActive()) {
                return res.status(403).json({
                    success: false,
                    message: 'Se requiere plan PRO para crear páginas con IA',
                    code: 'PRO_REQUIRED',
                });
            }

            // Validar que no usen features PRO sin tener PRO
            const proErrors = this.validateProFeatures(user, req.body);
            if (proErrors.length > 0) {
                return res.status(403).json({
                    success: false,
                    message: proErrors[0],
                    errors: proErrors,
                    code: 'PRO_REQUIRED',
                });
            }

            const isPro = user.isProActive();

            // Validar customSlug si se proporciona
            let validatedSlug = null;
            if (customSlug && customSlug.trim()) {
                if (!isPro) {
                    return res.status(403).json({
                        success: false,
                        message: 'Las URLs personalizadas requieren plan PRO',
                        code: 'PRO_REQUIRED',
                    });
                }

                const slugCheck = await Page.isSlugAvailable(customSlug.trim().toLowerCase());
                if (!slugCheck.available) {
                    return res.status(400).json({
                        success: false,
                        message: `URL no disponible: ${slugCheck.reason}`,
                        code: 'SLUG_NOT_AVAILABLE',
                    });
                }

                validatedSlug = customSlug.trim().toLowerCase();
            }

            // Parsear stickers
            const parsedStickers = safeJsonParse(selectedStickers);

            // Crear datos de la página
            const pageData = {
                userId: user._id,
                title,
                recipientName,
                message: message || '',
                yesButtonText: yesButtonText || 'Sí',
                noButtonText: noButtonText || 'No',
                noButtonEscapes: noButtonEscapes === 'true' || noButtonEscapes === true,
                pageType: pageType || 'free',
                theme: theme || 'romantic',
                backgroundColor: backgroundColor || '#ff69b4',
                textColor: textColor || '#ffffff',
                accentColor: accentColor || '#ff1493',
                titleFont: titleFont || 'Dancing Script',
                bodyFont: bodyFont || 'Quicksand',
                animation: animation || 'none',
                backgroundMusic: isPro ? (backgroundMusic || 'none') : 'none',
                selectedStickers: parsedStickers,
                showWatermark: isPro ? (showWatermark === 'false' ? false : true) : true,
            };
            if (validatedSlug) {
                pageData.customSlug = validatedSlug;
            }

            // ---- Procesar imágenes ----
            const files = req.files || {};

            // Imagen de fondo
            if (req.file?.fieldname === 'backgroundImage' || files.backgroundImage?.[0]) {
                const bgFile = files.backgroundImage?.[0] || req.file;
                if (bgFile) {
                    const bgUrl = await storageService.uploadReferenceImage(
                        bgFile.buffer,
                        `bg_${bgFile.originalname}`,
                        user._id.toString()
                    );
                    pageData.backgroundImageUrl = bgUrl;
                }
            }

            // Imágenes decorativas
            const maxDecorative = isPro ? LIMITS.pro.maxDecorativeImages : LIMITS.free.maxDecorativeImages;
            const decorativeUrls = [];

            for (let i = 0; i < maxDecorative; i++) {
                const fieldName = `decorativeImage_${i}`;
                const file = files[fieldName]?.[0];
                if (file) {
                    const url = await storageService.uploadReferenceImage(
                        file.buffer,
                        `dec_${i}_${file.originalname}`,
                        user._id.toString()
                    );
                    decorativeUrls.push(url);
                }
            }
            pageData.decorativeImageUrls = decorativeUrls;

            // Imagen de referencia para IA (solo PRO)
            if (pageType === 'pro') {
                const refFile = files.referenceImage?.[0];
                if (refFile) {
                    const imageUrl = await this.processProPage(refFile, user._id.toString(), pageData);
                    pageData.referenceImageUrl = imageUrl;
                }
            }

            const page = await Page.create(pageData);

            // Incrementar contador (estadística solamente)
            user.pagesCreated += 1;
            await user.save();

            return res.status(201).json({
                success: true,
                message: 'Página creada exitosamente',
                data: {
                    _id: page._id,
                    shortId: page.shortId,
                    customSlug: page.customSlug,
                    url: page.getFullUrl(),
                    pageType: page.pageType,
                    createdAt: page.createdAt,
                },
            });
        } catch (error) {
            console.error('Error creating page:', error);

            // Manejar error de slug duplicado
            if (error.code === 11000 && error.keyPattern?.customSlug) {
                return res.status(400).json({
                    success: false,
                    message: 'Esta URL personalizada ya está en uso',
                    code: 'SLUG_DUPLICATE',
                });
            }

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
            if (!storageService.isValidImageType(file.mimetype)) {
                throw new Error('Tipo de archivo no válido');
            }
            if (!storageService.isValidFileSize(file.size)) {
                throw new Error('El archivo es demasiado grande. Máximo 5MB');
            }

            const imageUrl = await storageService.uploadReferenceImage(file.buffer, file.originalname, userId);
            const { html, css } = await geminiService.generatePageFromImage(imageUrl, pageData);
            geminiService.validateGeneratedCode(html, css);

            pageData.customHTML = html;
            pageData.customCSS = css;

            return imageUrl;
        } catch (error) {
            console.error('Error processing pro page:', error);
            throw error;
        }
    }

    /**
     * Obtener página pública por shortId O customSlug
     * GET /api/pages/public/:identifier
     */
    async getPageByShortId(req, res) {
        try {
            const { shortId } = req.params;

            const page = await Page.findByIdentifier(shortId);

            if (!page) {
                return res.status(404).json({
                    success: false,
                    message: 'Página no encontrada',
                });
            }

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
                    accentColor: page.accentColor,
                    titleFont: page.titleFont,
                    bodyFont: page.bodyFont,
                    backgroundImageUrl: page.backgroundImageUrl,
                    decorativeImageUrls: page.decorativeImageUrls,
                    selectedStickers: page.selectedStickers,
                    animation: page.animation,
                    backgroundMusic: page.backgroundMusic,
                    showWatermark: page.showWatermark,
                    customSlug: page.customSlug,
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
     */
    async respondToPage(req, res) {
        try {
            const { shortId } = req.params;
            const { answer } = req.body;

            const page = await Page.findByIdentifier(shortId);

            if (!page) {
                return res.status(404).json({ success: false, message: 'Página no encontrada' });
            }

            const metadata = {
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.headers['user-agent'],
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
            return res.status(500).json({ success: false, message: 'Error al registrar la respuesta' });
        }
    }

    /**
     * Obtener páginas del usuario
     */
    async getUserPages(req, res) {
        try {
            const user = req.user;
            const { page = 1, limit = 10, sortBy = 'createdAt', order = 'desc' } = req.query;

            const skip = (page - 1) * limit;
            const sortOrder = order === 'asc' ? 1 : -1;

            const pages = await Page.find({ userId: user._id, isDeleted: { $ne: true } })
                .sort({ [sortBy]: sortOrder })
                .skip(skip)
                .limit(parseInt(limit))
                .lean();

            const total = await Page.countDocuments({ userId: user._id });

            const pagesWithStats = pages.map((p) => {
                const yesCount = p.responses.filter((r) => r.answer === 'yes').length;
                const noCount = p.responses.filter((r) => r.answer === 'no').length;
                const identifier = p.customSlug || p.shortId;
                return {
                    _id: p._id,
                    shortId: p.shortId,
                    customSlug: p.customSlug,
                    url: `${process.env.FRONTEND_URL}/p/${identifier}`,
                    title: p.title,
                    recipientName: p.recipientName,
                    pageType: p.pageType,
                    views: p.views,
                    totalResponses: p.responses.length,
                    yesCount,
                    noCount,
                    createdAt: p.createdAt,
                    isActive: p.isActive,
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
            return res.status(500).json({ success: false, message: 'Error al obtener las páginas' });
        }
    }
}

export default new PageController();