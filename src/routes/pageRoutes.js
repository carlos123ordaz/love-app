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

const uploadFields = upload.fields([
    { name: 'backgroundImage', maxCount: 1 },
    { name: 'referenceImage', maxCount: 1 },
    { name: 'decorativeImage_0', maxCount: 1 },
    { name: 'decorativeImage_1', maxCount: 1 },
    { name: 'decorativeImage_2', maxCount: 1 },
    { name: 'decorativeImage_3', maxCount: 1 },
    { name: 'decorativeImage_4', maxCount: 1 },
]);

// === RUTAS ESTÁTICAS (ORDEN IMPORTA) ===

// 🆕 NUEVO: Verificar disponibilidad de slug personalizado (debe ir ANTES de otras rutas)
router.get('/check-slug/:slug', authenticate, (req, res) =>
    pageController.checkSlugAvailability(req, res)
);

// POST /api/pages - Crear página
router.post(
    '/',
    authenticate,
    checkPageLimit,
    createPageLimiter,
    uploadFields,
    sanitizeInputs,
    validatePageCreation,
    (req, res) => pageController.createPage(req, res)
);

// GET /api/pages/my-pages
router.get('/my-pages', authenticate, (req, res) => pageController.getUserPages(req, res));

// GET /api/pages/stats
router.get('/stats', authenticate, (req, res) => pageControllerExtended.getUserStats(req, res));

// === RUTAS CON /public/ ===

// GET /api/pages/public/:shortId (ahora soporta shortId O customSlug)
router.get('/public/:shortId', optionalAuth, (req, res) => pageController.getPageByShortId(req, res));

// POST /api/pages/public/:shortId/respond
router.post(
    '/public/:shortId/respond',
    responsePageLimiter,
    sanitizeInputs,
    validatePageResponse,
    (req, res) => pageController.respondToPage(req, res)
);

// === RUTAS CON :pageId ===

router.get('/:pageId/details', authenticate, (req, res) => pageControllerExtended.getPageDetails(req, res));
router.patch('/:pageId', authenticate, sanitizeInputs, (req, res) => pageControllerExtended.updatePage(req, res));
router.delete('/:pageId', authenticate, (req, res) => pageControllerExtended.deletePage(req, res));
router.patch('/:pageId/toggle', authenticate, (req, res) => pageControllerExtended.togglePageStatus(req, res));

export default router;