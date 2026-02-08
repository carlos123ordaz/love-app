import Contact from '../models/Contact.js';

class ContactController {
    /**
     * Crear un nuevo mensaje de contacto
     * POST /api/contact
     */
    async createMessage(req, res) {
        try {
            const { name, email, type, subject, message } = req.body;

            // Validaciones
            if (!name || !email || !type || !subject || !message) {
                return res.status(400).json({
                    success: false,
                    message: 'Todos los campos son requeridos',
                });
            }

            // Validar tipo
            const validTypes = ['comment', 'custom_page', 'support', 'other'];
            if (!validTypes.includes(type)) {
                return res.status(400).json({
                    success: false,
                    message: 'Tipo de consulta inválido',
                });
            }

            // Validar longitud del mensaje
            if (message.length > 2000) {
                return res.status(400).json({
                    success: false,
                    message: 'El mensaje no puede exceder 2000 caracteres',
                });
            }

            // Crear mensaje de contacto
            const contactMessage = await Contact.create({
                userId: req.user?._id || null, // Si está autenticado
                name,
                email,
                type,
                subject,
                message,
            });

            console.log(`📧 New contact message from: ${email} - Type: ${type}`);

            // Aquí podrías agregar lógica para enviar un email de notificación
            // await sendEmailNotification(contactMessage);

            return res.status(201).json({
                success: true,
                message: '¡Mensaje enviado exitosamente! Te responderemos pronto.',
                data: {
                    id: contactMessage._id,
                    createdAt: contactMessage.createdAt,
                },
            });
        } catch (error) {
            console.error('Error creating contact message:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al enviar el mensaje',
            });
        }
    }

    /**
     * Obtener mis mensajes de contacto (usuario autenticado)
     * GET /api/contact/my-messages
     */
    async getMyMessages(req, res) {
        try {
            const user = req.user;

            const messages = await Contact.find({
                $or: [{ userId: user._id }, { email: user.email }],
            })
                .sort({ createdAt: -1 })
                .select('-adminNotes');

            return res.json({
                success: true,
                data: messages,
            });
        } catch (error) {
            console.error('Error getting messages:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al obtener mensajes',
            });
        }
    }

    /**
     * Obtener un mensaje específico
     * GET /api/contact/:id
     */
    async getMessage(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;

            const message = await Contact.findById(id);

            if (!message) {
                return res.status(404).json({
                    success: false,
                    message: 'Mensaje no encontrado',
                });
            }

            // Verificar que el mensaje pertenezca al usuario
            if (
                message.userId?.toString() !== user._id.toString() &&
                message.email !== user.email
            ) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permiso para ver este mensaje',
                });
            }

            return res.json({
                success: true,
                data: message,
            });
        } catch (error) {
            console.error('Error getting message:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al obtener mensaje',
            });
        }
    }

    // ==================== ADMIN ROUTES ====================
    /**
     * Obtener todos los mensajes (Admin)
     * GET /api/contact/admin/all
     */
    async getAllMessages(req, res) {
        try {
            const { status, type, page = 1, limit = 20 } = req.query;

            const query = {};
            if (status) query.status = status;
            if (type) query.type = type;

            const messages = await Contact.find(query)
                .populate('userId', 'email displayName')
                .sort({ createdAt: -1 })
                .limit(parseInt(limit))
                .skip((parseInt(page) - 1) * parseInt(limit));

            const total = await Contact.countDocuments(query);

            return res.json({
                success: true,
                data: {
                    messages,
                    pagination: {
                        total,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        pages: Math.ceil(total / parseInt(limit)),
                    },
                },
            });
        } catch (error) {
            console.error('Error getting all messages:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al obtener mensajes',
            });
        }
    }

    /**
     * Actualizar estado de un mensaje (Admin)
     * PATCH /api/contact/admin/:id
     */
    async updateMessageStatus(req, res) {
        try {
            const { id } = req.params;
            const { status, adminNotes } = req.body;

            const message = await Contact.findById(id);

            if (!message) {
                return res.status(404).json({
                    success: false,
                    message: 'Mensaje no encontrado',
                });
            }

            if (status) {
                message.status = status;
                if (status === 'resolved' || status === 'closed') {
                    message.respondedAt = new Date();
                }
            }

            if (adminNotes !== undefined) {
                message.adminNotes = adminNotes;
            }

            await message.save();

            return res.json({
                success: true,
                message: 'Mensaje actualizado exitosamente',
                data: message,
            });
        } catch (error) {
            console.error('Error updating message:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al actualizar mensaje',
            });
        }
    }
}

export default new ContactController();