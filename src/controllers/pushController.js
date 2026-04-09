import User from '../models/User.js';

class PushController {
    /**
     * Guardar suscripción web push del usuario.
     * POST /api/notifications/push/subscribe
     * Body: { subscription: PushSubscription }
     */
    async subscribe(req, res) {
        try {
            const { subscription } = req.body;

            if (!subscription?.endpoint) {
                return res.status(400).json({ success: false, message: 'Suscripción inválida' });
            }

            const user = await User.findById(req.user._id).select('+pushSubscriptions');
            if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

            // Evitar duplicados por endpoint
            const alreadyExists = user.pushSubscriptions.some(
                (s) => s.endpoint === subscription.endpoint
            );

            if (!alreadyExists) {
                user.pushSubscriptions.push(subscription);
                await user.save();
            }

            return res.json({ success: true });
        } catch (error) {
            console.error('Push subscribe error:', error);
            return res.status(500).json({ success: false, message: 'Error al guardar suscripción' });
        }
    }

    /**
     * Eliminar suscripción web push.
     * DELETE /api/notifications/push/unsubscribe
     * Body: { endpoint: string }
     */
    async unsubscribe(req, res) {
        try {
            const { endpoint } = req.body;

            await User.findByIdAndUpdate(req.user._id, {
                $pull: { pushSubscriptions: { endpoint } },
            });

            return res.json({ success: true });
        } catch (error) {
            console.error('Push unsubscribe error:', error);
            return res.status(500).json({ success: false, message: 'Error al eliminar suscripción' });
        }
    }
}

export default new PushController();
