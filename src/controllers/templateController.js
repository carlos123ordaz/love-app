import Template from '../models/Template.js';
import Page from '../models/Page.js';

class TemplateController {
    // ============================================
    // ENDPOINTS PÚBLICOS (usuarios)
    // ============================================

    /**
     * Listar plantillas activas
     * GET /api/templates
     */
    async getTemplates(req, res) {
        try {
            const { category } = req.query;
            const filter = { isActive: true };
            if (category && category !== 'all') {
                filter.category = category;
            }

            const templates = await Template.find(filter)
                .select('name description previewImageUrl category isPro tags sortOrder usageCount editableFields')
                .sort({ sortOrder: 1, createdAt: -1 })
                .lean();

            return res.json({
                success: true,
                data: templates,
            });
        } catch (error) {
            console.error('Error fetching templates:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al obtener plantillas',
            });
        }
    }

    /**
     * Obtener una plantilla por ID (con HTML/CSS para preview)
     * GET /api/templates/:templateId
     */
    async getTemplateById(req, res) {
        try {
            const { templateId } = req.params;
            const template = await Template.findOne({
                _id: templateId,
                isActive: true,
            }).lean();

            if (!template) {
                return res.status(404).json({
                    success: false,
                    message: 'Plantilla no encontrada',
                });
            }

            return res.json({
                success: true,
                data: template,
            });
        } catch (error) {
            console.error('Error fetching template:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al obtener plantilla',
            });
        }
    }

    /**
     * Renderizar plantilla con valores personalizados (preview en vivo)
     * POST /api/templates/:templateId/render
     */
    async renderTemplate(req, res) {
        try {
            const { templateId } = req.params;
            const { values } = req.body; // { TITULO: "Mi título", MENSAJE: "Hola", ... }

            const template = await Template.findOne({
                _id: templateId,
                isActive: true,
            });

            if (!template) {
                return res.status(404).json({
                    success: false,
                    message: 'Plantilla no encontrada',
                });
            }

            const rendered = template.renderHtml(values || {});

            return res.json({
                success: true,
                data: rendered,
            });
        } catch (error) {
            console.error('Error rendering template:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al renderizar plantilla',
            });
        }
    }

    /**
     * Crear página a partir de una plantilla (requiere PRO)
     * POST /api/templates/:templateId/create-page
     */
    async createPageFromTemplate(req, res) {
        try {
            const user = req.user;
            const { templateId } = req.params;
            const {
                values,          // { TITULO: "...", MENSAJE: "...", ... }
                recipientName,
                yesButtonText,
                noButtonText,
                noButtonEscapes,
                customSlug,
            } = req.body;

            // Verificar PRO
            if (!user.isProActive()) {
                return res.status(403).json({
                    success: false,
                    message: 'Las plantillas requieren plan PRO para crear páginas',
                    code: 'PRO_REQUIRED',
                });
            }

            // Verificar límite de páginas
            if (!user.canCreatePage) {
                return res.status(403).json({
                    success: false,
                    message: 'Has alcanzado el límite de páginas',
                    code: 'PAGE_LIMIT',
                });
            }

            // Obtener plantilla
            const template = await Template.findOne({
                _id: templateId,
                isActive: true,
            });

            if (!template) {
                return res.status(404).json({
                    success: false,
                    message: 'Plantilla no encontrada',
                });
            }

            // Validar campos requeridos
            for (const field of template.editableFields) {
                if (field.required && (!values[field.key] || !values[field.key].trim())) {
                    return res.status(400).json({
                        success: false,
                        message: `El campo "${field.label}" es requerido`,
                    });
                }
            }

            // Renderizar HTML/CSS con los valores del usuario
            const rendered = template.renderHtml(values || {});

            // Extraer título del campo TITULO o usar el nombre de la plantilla
            const title = values.TITULO || values.TITLE || template.name;

            // Validar customSlug si se proporciona
            let validatedSlug = null;
            if (customSlug && customSlug.trim()) {
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

            // Crear la página
            const pageData = {
                userId: user._id,
                title,
                recipientName: recipientName || 'Alguien especial',
                message: values.MENSAJE || values.MESSAGE || '',
                yesButtonText: yesButtonText || 'Sí',
                noButtonText: noButtonText || 'No',
                noButtonEscapes: noButtonEscapes || false,
                pageType: 'pro',
                theme: 'custom',
                customHTML: rendered.html,
                customCSS: rendered.css,
                showWatermark: false,
                templateId: template._id,
            };

            if (validatedSlug) {
                pageData.customSlug = validatedSlug;
            }

            const page = await Page.create(pageData);

            // Incrementar contadores
            user.pagesCreated += 1;
            await user.save();

            template.usageCount += 1;
            await template.save();

            return res.status(201).json({
                success: true,
                message: 'Página creada desde plantilla exitosamente',
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
            console.error('Error creating page from template:', error);

            if (error.code === 11000 && error.keyPattern?.customSlug) {
                return res.status(400).json({
                    success: false,
                    message: 'Esta URL personalizada ya está en uso',
                    code: 'SLUG_DUPLICATE',
                });
            }

            return res.status(500).json({
                success: false,
                message: 'Error al crear la página desde plantilla',
            });
        }
    }

    // ============================================
    // ENDPOINTS ADMIN
    // ============================================

    /**
     * Listar TODAS las plantillas (admin)
     * GET /api/admin/templates
     */
    async adminGetTemplates(req, res) {
        try {
            const templates = await Template.find()
                .sort({ sortOrder: 1, createdAt: -1 })
                .lean();

            return res.json({
                success: true,
                data: templates,
            });
        } catch (error) {
            console.error('Error fetching templates (admin):', error);
            return res.status(500).json({
                success: false,
                message: 'Error al obtener plantillas',
            });
        }
    }

    /**
     * Crear nueva plantilla (admin)
     * POST /api/admin/templates
     */
    async adminCreateTemplate(req, res) {
        try {
            const {
                name,
                description,
                previewImageUrl,
                category,
                html,
                css,
                editableFields,
                isPro,
                isActive,
                sortOrder,
                tags,
            } = req.body;

            // Validaciones básicas
            if (!name || !description || !html || !css) {
                return res.status(400).json({
                    success: false,
                    message: 'Nombre, descripción, HTML y CSS son requeridos',
                });
            }

            if (!previewImageUrl) {
                return res.status(400).json({
                    success: false,
                    message: 'La imagen de preview es requerida',
                });
            }

            // Validar que los placeholders en HTML/CSS correspondan a los editableFields
            const fieldKeys = (editableFields || []).map((f) => f.key);
            const htmlPlaceholders = [...html.matchAll(/\{\{([A-Z_]+)\}\}/g)].map((m) => m[1]);
            const cssPlaceholders = [...css.matchAll(/\{\{([A-Z_]+)\}\}/g)].map((m) => m[1]);
            const allPlaceholders = [...new Set([...htmlPlaceholders, ...cssPlaceholders])];

            const missingFields = allPlaceholders.filter((p) => !fieldKeys.includes(p));
            if (missingFields.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Placeholders sin campo editable definido: ${missingFields.join(', ')}`,
                });
            }

            const template = await Template.create({
                name,
                description,
                previewImageUrl,
                category: category || 'otro',
                html,
                css,
                editableFields: editableFields || [],
                isPro: isPro !== undefined ? isPro : false,
                isActive: isActive !== undefined ? isActive : true,
                sortOrder: sortOrder || 0,
                tags: tags || [],
                createdBy: req.user._id,
            });

            return res.status(201).json({
                success: true,
                message: 'Plantilla creada exitosamente',
                data: template,
            });
        } catch (error) {
            console.error('Error creating template:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al crear plantilla',
                error: error.message,
            });
        }
    }

    /**
     * Actualizar plantilla (admin)
     * PATCH /api/admin/templates/:templateId
     */
    async adminUpdateTemplate(req, res) {
        try {
            const { templateId } = req.params;
            const updates = req.body;

            // No permitir actualizar campos internos
            delete updates._id;
            delete updates.createdBy;
            delete updates.usageCount;

            const template = await Template.findByIdAndUpdate(
                templateId,
                { $set: updates },
                { new: true, runValidators: true }
            );

            if (!template) {
                return res.status(404).json({
                    success: false,
                    message: 'Plantilla no encontrada',
                });
            }

            return res.json({
                success: true,
                message: 'Plantilla actualizada',
                data: template,
            });
        } catch (error) {
            console.error('Error updating template:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al actualizar plantilla',
            });
        }
    }

    /**
     * Eliminar plantilla (admin)
     * DELETE /api/admin/templates/:templateId
     */
    async adminDeleteTemplate(req, res) {
        try {
            const { templateId } = req.params;

            const template = await Template.findByIdAndDelete(templateId);
            if (!template) {
                return res.status(404).json({
                    success: false,
                    message: 'Plantilla no encontrada',
                });
            }

            return res.json({
                success: true,
                message: 'Plantilla eliminada',
            });
        } catch (error) {
            console.error('Error deleting template:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al eliminar plantilla',
            });
        }
    }

    /**
     * Toggle estado activo de una plantilla (admin)
     * PATCH /api/admin/templates/:templateId/toggle
     */
    async adminToggleTemplate(req, res) {
        try {
            const { templateId } = req.params;
            const template = await Template.findById(templateId);

            if (!template) {
                return res.status(404).json({
                    success: false,
                    message: 'Plantilla no encontrada',
                });
            }

            template.isActive = !template.isActive;
            await template.save();

            return res.json({
                success: true,
                message: template.isActive ? 'Plantilla activada' : 'Plantilla desactivada',
                data: { isActive: template.isActive },
            });
        } catch (error) {
            console.error('Error toggling template:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al cambiar estado',
            });
        }
    }
}

export default new TemplateController();