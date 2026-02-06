/**
 * Utilidades generales para el backend
 */

/**
 * Formatear fecha a formato legible
 */
export const formatDate = (date) => {
    return new Date(date).toLocaleDateString('es-PE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

/**
 * Generar un slug único
 */
export const generateSlug = (text) => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
};

/**
 * Validar email
 */
export const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Obtener IP del cliente
 */
export const getClientIP = (req) => {
    return (
        req.headers['x-forwarded-for']?.split(',')[0] ||
        req.headers['x-real-ip'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.ip
    );
};

/**
 * Sanitizar objeto eliminando campos undefined/null
 */
export const sanitizeObject = (obj) => {
    return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v != null));
};

/**
 * Calcular porcentaje
 */
export const calculatePercentage = (part, total) => {
    if (total === 0) return 0;
    return ((part / total) * 100).toFixed(1);
};

/**
 * Delay promise (para testing)
 */
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Truncar texto
 */
export const truncateText = (text, maxLength) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
};

/**
 * Generar código aleatorio
 */
export const generateRandomCode = (length = 6) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

/**
 * Validar ObjectId de MongoDB
 */
export const isValidObjectId = (id) => {
    return /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * Parsear query params para paginación
 */
export const parsePaginationParams = (query) => {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
    const skip = (page - 1) * limit;

    return { page, limit, skip };
};

/**
 * Formatear respuesta de paginación
 */
export const formatPaginationResponse = (data, total, page, limit) => {
    return {
        data,
        pagination: {
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            itemsPerPage: limit,
            hasNextPage: page * limit < total,
            hasPrevPage: page > 1,
        },
    };
};

export default {
    formatDate,
    generateSlug,
    isValidEmail,
    getClientIP,
    sanitizeObject,
    calculatePercentage,
    delay,
    truncateText,
    generateRandomCode,
    isValidObjectId,
    parsePaginationParams,
    formatPaginationResponse,
};