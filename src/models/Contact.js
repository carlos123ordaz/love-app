import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null, // Puede ser null si no está autenticado
        },
        name: {
            type: String,
            required: [true, 'El nombre es requerido'],
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'El email es requerido'],
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Email inválido'],
        },
        type: {
            type: String,
            enum: ['comment', 'custom_page', 'support', 'other'],
            required: true,
        },
        subject: {
            type: String,
            required: [true, 'El asunto es requerido'],
            trim: true,
            maxlength: [200, 'El asunto no puede exceder 200 caracteres'],
        },
        message: {
            type: String,
            required: [true, 'El mensaje es requerido'],
            trim: true,
            maxlength: [2000, 'El mensaje no puede exceder 2000 caracteres'],
        },
        status: {
            type: String,
            enum: ['pending', 'in_progress', 'resolved', 'closed'],
            default: 'pending',
        },
        adminNotes: {
            type: String,
            default: '',
        },
        respondedAt: {
            type: Date,
            default: null,
        },
        adminReply: {
            type: String,
            default: null,
            trim: true,
            maxlength: 500,
        },

        // Fecha en que se respondió
        adminRepliedAt: {
            type: Date,
            default: null,
        },

        // Quién respondió (referencia al admin)
        adminRepliedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Índices
contactSchema.index({ email: 1 });
contactSchema.index({ userId: 1 });
contactSchema.index({ status: 1 });
contactSchema.index({ type: 1 });
contactSchema.index({ createdAt: -1 });

const Contact = mongoose.model('Contact', contactSchema);

export default Contact;