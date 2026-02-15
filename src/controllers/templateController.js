import Template from '../models/Template.js';
import Page from '../models/Page.js';
import storageService from '../services/googleStorageService.js';

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
            const { values } = req.body;

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
     * Subir imagen para un campo de plantilla (requiere PRO + auth)
     * POST /api/templates/:templateId/upload-image
     * Body (multipart): image (file), fieldKey (string)
     */
    async uploadTemplateImage(req, res) {
        try {
            const user = req.user;
            const { templateId } = req.params;
            const { fieldKey } = req.body;

            // Verificar PRO
            if (!user.isProActive()) {
                return res.status(403).json({
                    success: false,
                    message: 'Requiere plan PRO para subir imágenes en plantillas',
                    code: 'PRO_REQUIRED',
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No se proporcionó imagen',
                });
            }

            // Validar tipo de archivo
            if (!storageService.isValidImageType(req.file.mimetype)) {
                return res.status(400).json({
                    success: false,
                    message: 'Tipo de archivo no válido. Solo se permiten JPG, PNG, GIF y WebP',
                });
            }

            // Validar tamaño
            if (!storageService.isValidFileSize(req.file.size)) {
                return res.status(400).json({
                    success: false,
                    message: 'El archivo es demasiado grande. Máximo 5MB',
                });
            }

            // Verificar que la plantilla existe
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

            // Verificar que el fieldKey corresponde a un campo de tipo image_url
            const field = template.editableFields.find(
                (f) => f.key === fieldKey && f.type === 'image_url'
            );

            if (!field) {
                return res.status(400).json({
                    success: false,
                    message: `El campo "${fieldKey}" no es un campo de imagen válido en esta plantilla`,
                });
            }

            // Validar tamaño máximo específico del campo si tiene imageConfig
            if (field.imageConfig?.maxSizeMB) {
                const maxBytes = 15 * 1024 * 1024;
                if (req.file.size > maxBytes) {
                    return res.status(400).json({
                        success: false,
                        message: `La imagen para "${field.label}" no puede superar 15MB`,
                    });
                }
            }

            // Subir a Google Cloud Storage
            const imageUrl = await storageService.uploadReferenceImage(
                req.file.buffer,
                `tpl_${templateId}_${fieldKey}_${req.file.originalname}`,
                user._id.toString()
            );

            return res.json({
                success: true,
                message: 'Imagen subida exitosamente',
                data: {
                    imageUrl,
                    fieldKey,
                },
            });
        } catch (error) {
            console.error('Error uploading template image:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al subir la imagen',
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
                values,
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
                if (field.required) {
                    const value = values[field.key];

                    if (field.type === 'image_url') {
                        // Para imágenes requeridas: verificar que sea una URL válida
                        if (!value || !value.trim()) {
                            return res.status(400).json({
                                success: false,
                                message: `La imagen "${field.label}" es requerida`,
                            });
                        }
                        // Validar que sea URL https
                        try {
                            const parsed = new URL(value.trim());
                            if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
                                return res.status(400).json({
                                    success: false,
                                    message: `La URL de "${field.label}" no es válida`,
                                });
                            }
                        } catch {
                            return res.status(400).json({
                                success: false,
                                message: `La URL de "${field.label}" no es válida`,
                            });
                        }
                    } else {
                        // Para campos de texto requeridos
                        if (!value || !value.trim()) {
                            return res.status(400).json({
                                success: false,
                                message: `El campo "${field.label}" es requerido`,
                            });
                        }
                    }
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