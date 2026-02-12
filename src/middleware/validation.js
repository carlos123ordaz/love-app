import rateLimit from 'express-rate-limit';
import validator from 'validator';

/**
 * Rate limiter general para todas las rutas
 */
export const generalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
        success: false,
        message: 'Demasiadas solicitudes, por favor intenta más tarde',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Rate limiter estricto para creación de páginas
 */
export const createPageLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 20, // 20 páginas por hora
    message: {
        success: false,
        message: 'Has excedido el límite de creación de páginas. Intenta más tarde.',
    },
    skipSuccessfulRequests: false,
});

/**
 * Rate limiter para respuestas a páginas
 */
export const responsePageLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 10, // 10 respuestas por 5 minutos
    message: {
        success: false,
        message: 'Demasiadas respuestas. Espera un momento antes de intentar nuevamente.',
    },
    keyGenerator: (req) => {
        // Usar IP + shortId para rate limiting por página
        return `${req.ip}-${req.params.shortId}`;
    },
});

/**
 * Middleware para validar datos de creación de página
 */
export const validatePageCreation = (req, res, next) => {
    const { title, recipientName, yesButtonText, noButtonText, pageType } = req.body;

    const errors = [];

    // Validar título
    if (!title || typeof title !== 'string') {
        errors.push('El título es requerido');
    } else if (title.length > 200) {
        errors.push('El título no puede exceder 200 caracteres');
    } else if (!validator.isLength(title, { min: 1, max: 200 })) {
        errors.push('El título debe tener entre 1 y 200 caracteres');
    }

    // Validar nombre del destinatario
    if (!recipientName || typeof recipientName !== 'string') {
        errors.push('El nombre del destinatario es requerido');
    } else if (recipientName.length > 100) {
        errors.push('El nombre del destinatario no puede exceder 100 caracteres');
    }

    // Validar textos de botones si se proporcionan
    if (yesButtonText && yesButtonText.length > 50) {
        errors.push('El texto del botón "Sí" no puede exceder 50 caracteres');
    }

    if (noButtonText && noButtonText.length > 50) {
        errors.push('El texto del botón "No" no puede exceder 50 caracteres');
    }

    // Validar mensaje si existe
    if (req.body.message && req.body.message.length > 1000) {
        errors.push('El mensaje no puede exceder 1000 caracteres');
    }

    // Validar tipo de página
    if (pageType && !['free', 'pro'].includes(pageType)) {
        errors.push('Tipo de página inválido');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Errores de validación',
            errors,
        });
    }

    next();
};

/**
 * Middleware para validar respuesta a página
 */
export const validatePageResponse = (req, res, next) => {
    const { answer } = req.body;

    if (!answer || !['yes', 'no'].includes(answer)) {
        return res.status(400).json({
            success: false,
            message: 'Respuesta inválida. Debe ser "yes" o "no"',
        });
    }

    next();
};

/**
 * Middleware para sanitizar inputs
 */
export const sanitizeInputs = (req, res, next) => {
    // Sanitizar strings en el body
    if (req.body) {
        Object.keys(req.body).forEach((key) => {
            if (typeof req.body[key] === 'string') {
                // Escapar HTML para prevenir XSS
                req.body[key] = validator.escape(req.body[key]);
                // Normalizar espacios en blanco
                req.body[key] = req.body[key].trim();
            }
        });
    }

    next();
};

/**
 * Middleware para verificar límite de páginas gratuitas
 */
export const checkPageLimit = async (req, res, next) => {
    try {
        const user = req.user;

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado',
            });
        }

        // Si es PRO, puede crear páginas ilimitadas
        if (user.isProActive()) {
            return next();
        }

        // Verificar límite de páginas gratuitas
        const totalAllowed = 1 + (user.bonusPages || 0);
        if (user.pagesCreated >= totalAllowed) {
            return res.status(403).json({
                success: false,
                message: `Has alcanzado el límite de ${totalAllowed} página${totalAllowed !== 1 ? 's' : ''} gratuita${totalAllowed !== 1 ? 's' : ''}`,
                code: 'PAGE_LIMIT_REACHED',
                pagesCreated: user.pagesCreated,
                limit: totalAllowed,
            });
        }

        next();
    } catch (error) {
        console.error('Error checking page limit:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al verificar límite de páginas',
        });
    }
};

export default {
    generalLimiter,
    createPageLimiter,
    responsePageLimiter,
    validatePageCreation,
    validatePageResponse,
    sanitizeInputs,
    checkPageLimit,
};