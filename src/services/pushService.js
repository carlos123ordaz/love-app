import webpush from 'web-push';

webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'admin@lovepages.ink'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

/**
 * Envía una web push notification a una suscripción específica.
 * Si la suscripción expiró (410) se considera inválida.
 * @returns {boolean} true si se envió, false si expiró
 */
export async function sendPushNotification(subscription, payload) {
    try {
        await webpush.sendNotification(subscription, JSON.stringify(payload));
        return true;
    } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
            // Suscripción expirada o inválida
            return false;
        }
        console.error('Push send error:', err.message);
        return false;
    }
}

/**
 * Envía push a todas las suscripciones de un usuario.
 * Devuelve los endpoints que deben eliminarse (expirados).
 */
export async function sendPushToUser(subscriptions, payload) {
    const expired = [];
    await Promise.all(
        subscriptions.map(async (sub) => {
            const ok = await sendPushNotification(sub, payload);
            if (!ok) expired.push(sub.endpoint);
        })
    );
    return expired;
}

export default webpush;
