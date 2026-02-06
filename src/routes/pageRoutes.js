import express from 'express';
import multer from 'multer';
import pageController from '../controllers/pageController.js';
import pageControllerExtended from '../controllers/pageControllerExtended.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import {
    createPageLimiter,
    responsePageLimiter,
    validatePageCreation,
    validatePageResponse,
    sanitizeInputs,
    checkPageLimit,
} from '../middleware/validation.js';

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no válido. Solo se permiten JPG, PNG, GIF, WEBP'));
        }
    },
});

// === RUTAS ESTÁTICAS (van primero para evitar conflicto con :params) ===

// POST /api/pages - Crear página
router.post(
    '/',
    authenticate,
    checkPageLimit,
    createPageLimiter,
    upload.single('referenceImage'),
    sanitizeInputs,
    validatePageCreation,
    (req, res) => pageController.createPage(req, res)
);

// GET /api/pages/my-pages - Mis páginas
router.get('/my-pages', authenticate, (req, res) => pageController.getUserPages(req, res));

// GET /api/pages/stats - Estadísticas
router.get('/stats', authenticate, (req, res) => pageControllerExtended.getUserStats(req, res));

// === RUTAS CON /public/ (van antes de las rutas con :pageId) ===

// GET /api/pages/public/:shortId - Ver página pública
router.get('/public/:shortId', optionalAuth, (req, res) => pageController.getPageByShortId(req, res));

// POST /api/pages/public/:shortId/respond - Responder a página
router.post(
    '/public/:shortId/respond',
    responsePageLimiter,
    sanitizeInputs,
    validatePageResponse,
    (req, res) => pageController.respondToPage(req, res)
);

// === RUTAS CON :pageId (van al final) ===

// GET /api/pages/:pageId/details - Detalles de página (dueño)
router.get('/:pageId/details', authenticate, (req, res) => pageControllerExtended.getPageDetails(req, res));

// PATCH /api/pages/:pageId - Actualizar página
router.patch('/:pageId', authenticate, sanitizeInputs, (req, res) => pageControllerExtended.updatePage(req, res));

// DELETE /api/pages/:pageId - Eliminar página
router.delete('/:pageId', authenticate, (req, res) => pageControllerExtended.deletePage(req, res));

// PATCH /api/pages/:pageId/toggle - Toggle estado
router.patch('/:pageId/toggle', authenticate, (req, res) => pageControllerExtended.togglePageStatus(req, res));

export default router;