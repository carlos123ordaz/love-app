import mongoose from 'mongoose';

/**
 * Schema para campos editables dentro de una plantilla.
 * Cada campo tiene un placeholder (ej: {{TITULO}}) que se reemplaza
 * en el HTML/CSS con el valor que el usuario ingresa.
 */
const editableFieldSchema = new mongoose.Schema(
    {
        // Clave interna usada como placeholder: {{KEY}}
        key: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
        },
        // Etiqueta visible para el usuario en el formulario
        label: {
            type: String,
            required: true,
            trim: true,
        },
        // Tipo de campo
        type: {
            type: String,
            enum: ['text', 'textarea', 'color', 'image_url'],
            default: 'text',
        },
        // Valor por defecto (lo que se ve en la preview)
        defaultValue: {
            type: String,
            default: '',
        },
        // Placeholder del input
        placeholder: {
            type: String,
            default: '',
        },
        // Longitud máxima permitida
        maxLength: {
            type: Number,
            default: 500,
        },
        // Si es requerido
        required: {
            type: Boolean,
            default: false,
        },
        // Orden de aparición en el formulario
        order: {
            type: Number,
            default: 0,
        },
    },
    { _id: false }
);

const templateSchema = new mongoose.Schema(
    {
        // Nombre interno de la plantilla
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },
        // Descripción que ven los usuarios
        description: {
            type: String,
            required: true,
            trim: true,
            maxlength: 300,
        },
        // URL de la imagen de preview (captura de pantalla del diseño)
        previewImageUrl: {
            type: String,
            required: true,
        },
        // Categoría para filtrar
        category: {
            type: String,
            enum: [
                'san-valentin',
                'cumpleanos',
                'aniversario',
                'declaracion',
                'amistad',
                'navidad',
                'otro',
            ],
            default: 'otro',
        },
        // HTML de la plantilla (con placeholders tipo {{TITULO}}, {{MENSAJE}}, etc.)
        html: {
            type: String,
            required: true,
        },
        // CSS de la plantilla (también puede tener placeholders como {{COLOR_FONDO}})
        css: {
            type: String,
            required: true,
        },
        // Campos editables que el usuario puede personalizar
        editableFields: {
            type: [editableFieldSchema],
            default: [],
            validate: {
                validator: function (v) {
                    return v.length <= 20;
                },
                message: 'Máximo 20 campos editables',
            },
        },
        // Si es gratis o requiere PRO
        isPro: {
            type: Boolean,
            default: false,
        },
        // Si está activa y visible para los usuarios
        isActive: {
            type: Boolean,
            default: true,
        },
        // Orden de aparición en el catálogo
        sortOrder: {
            type: Number,
            default: 0,
        },
        // Tags para búsqueda
        tags: {
            type: [String],
            default: [],
        },
        // Quién la creó (admin)
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        // Contador de usos
        usageCount: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

// Índices
templateSchema.index({ isActive: 1, sortOrder: 1 });
templateSchema.index({ category: 1, isActive: 1 });
templateSchema.index({ isPro: 1, isActive: 1 });

/**
 * Método para renderizar el HTML con los valores del usuario.
 * Reemplaza todos los {{KEY}} con los valores proporcionados.
 */
templateSchema.methods.renderHtml = function (values = {}) {
    let renderedHtml = this.html;
    let renderedCss = this.css;

    for (const field of this.editableFields) {
        const value = values[field.key] || field.defaultValue || '';
        const placeholder = `{{${field.key}}}`;
        const escapedValue = escapeHtml(value);

        renderedHtml = renderedHtml.replaceAll(placeholder, escapedValue);
        renderedCss = renderedCss.replaceAll(placeholder, escapedValue);
    }

    return { html: renderedHtml, css: renderedCss };
};

/**
 * Método estático para obtener plantillas activas (para usuarios)
 */
templateSchema.statics.getActiveTemplates = async function (category = null) {
    const filter = { isActive: true };
    if (category) filter.category = category;

    return await this.find(filter)
        .select('name description previewImageUrl category isPro tags sortOrder usageCount editableFields')
        .sort({ sortOrder: 1, createdAt: -1 })
        .lean();
};

// Sanitizar HTML para evitar XSS
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

templateSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        delete ret.__v;
        return ret;
    },
});

const Template = mongoose.model('Template', templateSchema);

export default Template;