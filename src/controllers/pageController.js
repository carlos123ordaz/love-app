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

// Límites FREE vs PRO
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
 * Parsear JSON de forma segura, deshaciendo HTML entities
 * que el middleware sanitizeInputs pueda haber introducido.
 */
function safeJsonParse(value, fallback = []) {
    if (!value) return fallback;
    if (Array.isArray(value)) return value; // ya es array

    try {
        // Deshacer HTML entities comunes que sanitizeInputs introduce
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
        }

        return errors;
    }

    /**
     * Crear nueva página (ACTUALIZADO)
     * POST /api/pages
     */
    async createPage(req, res) {
        try {
            const user = req.user;
            console.log('user: ', user)
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
                // Nuevos campos
                titleFont,
                bodyFont,
                animation,
                backgroundMusic,
                selectedStickers,
                showWatermark,
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
            if (!isPro && user.pagesCreated > 0) {
               return res.status(403).json({
                    success: false,
                    message: 'Ya superó el límite de páginas gratuitas',
                    errors: proErrors,
                    code: 'PRO_REQUIRED',
                });
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
                // Nuevos campos
                titleFont: titleFont || 'Dancing Script',
                bodyFont: bodyFont || 'Quicksand',
                animation: animation || 'none',
                backgroundMusic: isPro ? (backgroundMusic || 'none') : 'none',
                selectedStickers: parsedStickers,
                showWatermark: isPro ? (showWatermark === 'false' ? false : true) : true,
            };

            // ---- Procesar imágenes ----
            const files = req.files || {};

            // Imagen de fondo (free y pro)
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

            // Imágenes decorativas (free: 1, pro: 5)
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

            // Incrementar contador
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
     * Obtener página pública por shortId (ACTUALIZADO con nuevos campos)
     * GET /api/pages/public/:shortId
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
                    // Nuevos campos
                    titleFont: page.titleFont,
                    bodyFont: page.bodyFont,
                    backgroundImageUrl: page.backgroundImageUrl,
                    decorativeImageUrls: page.decorativeImageUrls,
                    selectedStickers: page.selectedStickers,
                    animation: page.animation,
                    backgroundMusic: page.backgroundMusic,
                    showWatermark: page.showWatermark,
                    // PRO
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
     * Responder a una página (sin cambios)
     */
    async respondToPage(req, res) {
        try {
            const { shortId } = req.params;
            const { answer } = req.body;
            const page = await Page.findOne({ shortId, isActive: true });

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
     * Obtener páginas del usuario (sin cambios relevantes)
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

            const pagesWithStats = pages.map((p) => {
                const yesCount = p.responses.filter((r) => r.answer === 'yes').length;
                const noCount = p.responses.filter((r) => r.answer === 'no').length;

                return {
                    _id: p._id,
                    shortId: p.shortId,
                    url: `${process.env.FRONTEND_URL}/p/${p.shortId}`,
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