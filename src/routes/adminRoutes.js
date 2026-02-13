import express from 'express';
import adminController from '../controllers/adminController.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminMiddleware.js';
import templateController from '../controllers/templateController.js';

const router = express.Router();

// Todos los endpoints requieren autenticación + admin
router.use(authenticate, requireAdmin);

// Dashboard
router.get('/dashboard', (req, res) => adminController.getDashboardStats(req, res));

// Users (read-only)
router.get('/users', (req, res) => adminController.getUsers(req, res));
router.get('/users/:userId', (req, res) => adminController.getUserDetail(req, res));

// Pages
router.get('/pages', (req, res) => adminController.getPages(req, res));
router.get('/pages/:pageId', (req, res) => adminController.getPageDetail(req, res));
router.patch('/pages/:pageId/toggle', (req, res) => adminController.togglePage(req, res));
router.delete('/pages/:pageId', (req, res) => adminController.deletePage(req, res));

// Contacts
router.get('/contacts', (req, res) => adminController.getContacts(req, res));
router.get('/contacts/:contactId', (req, res) => adminController.getContactDetail(req, res));
router.patch('/contacts/:contactId', (req, res) => adminController.updateContact(req, res));
router.delete('/contacts/:contactId', (req, res) => adminController.deleteContact(req, res));





// Dentro de tu router de admin (después de authenticate + isAdmin middleware):

// GET /api/admin/templates - Listar todas las plantillas
router.get('/templates', (req, res) => templateController.adminGetTemplates(req, res));

// POST /api/admin/templates - Crear plantilla
router.post('/templates', (req, res) => templateController.adminCreateTemplate(req, res));

// PATCH /api/admin/templates/:templateId - Actualizar plantilla
router.patch('/templates/:templateId', (req, res) => templateController.adminUpdateTemplate(req, res));

// DELETE /api/admin/templates/:templateId - Eliminar plantilla
router.delete('/templates/:templateId', (req, res) => templateController.adminDeleteTemplate(req, res));

// PATCH /api/admin/templates/:templateId/toggle - Toggle activo/inactivo
router.patch('/templates/:templateId/toggle', (req, res) => templateController.adminToggleTemplate(req, res));

export default router;