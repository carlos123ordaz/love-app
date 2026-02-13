import express from 'express';
import templateController from '../controllers/templateController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

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