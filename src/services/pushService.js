import webpush from 'web-push';

// setVapidDetails lanza si las claves faltan o no son válidas, y al ejecutarse
// al importar el módulo tumbaba el arranque del servidor entero por una
// variable de entorno mal puesta. Sin claves, el push queda desactivado y el
// resto de la app sigue funcionando.
let pushEnabled = false;

try {
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        webpush.setVapidDetails(
            `mailto:${process.env.VAPID_EMAIL || 'admin@lovepages.ink'}`,
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );
        pushEnabled = true;
    } else {
        console.warn('⚠️  VAPID no configurado: las notificaciones push quedan desactivadas.');
    }
} catch (err) {
    console.error('⚠️  VAPID inválido, push desactivado:', err.message);
}

export function isPushEnabled() {
    return pushEnabled;
}

/**
 * Envía una web push notification a una suscripción específica.
 * Si la suscripción expiró (410) se considera inválida.
 * @returns {boolean} true si se envió, false si expiró
 */
export async function sendPushNotification(subscription, payload) {
    if (!pushEnabled) return true; // sin claves no hay nada que enviar ni que purgar
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
