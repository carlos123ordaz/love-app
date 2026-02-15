import express from 'express';
import multer from 'multer';
import templateController from '../controllers/templateController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Configuración de multer para subida de imágenes de plantilla
const templateImageUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 15 * 1024 * 1024, // 5MB máximo
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no válido. Solo se permiten JPG, PNG, GIF y WebP'), false);
        }
    },
});

// ============================================
// RUTAS PÚBLICAS (usuarios autenticados o no)
// ============================================

/**
 * GET /api/templates
 * Listar plantillas activas (filtro opcional por categoría)
 * Query: ?category=san-valentin
 */
router.get('/', (req, res) => templateController.getTemplates(req, res));

/**
 * GET /api/templates/:templateId
 * Obtener plantilla completa por ID (con HTML/CSS para preview)
 */
router.get('/:templateId', (req, res) => templateController.getTemplateById(req, res));

/**
 * POST /api/templates/:templateId/render
 * Renderizar plantilla con valores custom (para preview en vivo)
 * Body: { values: { TITULO: "...", MENSAJE: "..." } }
 */
router.post('/:templateId/render', (req, res) => templateController.renderTemplate(req, res));

// ============================================
// RUTAS AUTENTICADAS (requieren login + PRO)
// ============================================

/**
 * POST /api/templates/:templateId/upload-image
 * Subir imagen para un campo de tipo image_url de la plantilla
 * Body (multipart/form-data): image (file), fieldKey (string)
 */
router.post(
    '/:templateId/upload-image',
    authenticate,
    templateImageUpload.single('image'),
    (req, res) => templateController.uploadTemplateImage(req, res)
);

/**
 * POST /api/templates/:templateId/create-page
 * Crear página a partir de plantilla (requiere PRO + auth)
 * Body: { values: {...}, recipientName, yesButtonText, noButtonText, noButtonEscapes, customSlug }
 */
router.post(
    '/:templateId/create-page',
    authenticate,
    (req, res) => templateController.createPageFromTemplate(req, res)
);

export default router;