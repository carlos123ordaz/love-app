import Page from '../models/Page.js';
import User from '../models/User.js';
import { sendPushToUser } from './pushService.js';

/**
 * Recordatorios de ocasión.
 *
 * Una carta se escribe para una fecha (un aniversario, un cumpleaños). Guardar
 * esa fecha permite avisar al autor unos días antes del siguiente, que es lo
 * que da un motivo para volver fuera de San Valentín.
 *
 * El aviso se manda una vez por año y por página. `lastReminderYear` se usa
 * como cerrojo: se reclama con una escritura atómica antes de enviar nada, así
 * que aunque haya varias instancias del servidor sólo una envía.
 */

/** Días de antelación del aviso. */
export const REMINDER_DAYS_AHEAD = 3;

/**
 * Todo el cálculo va en UTC.
 *
 * Una fecha que llega como '2020-06-13' se interpreta como medianoche UTC. Si
 * luego se lee el mes y el día con getters locales, en cualquier zona horaria
 * negativa (México es UTC-6) sale el día anterior y el aviso se manda con un
 * día de desfase. Mezclar ambos relojes era justo ese error.
 */
function midnightUTC(date) {
    const d = new Date(date);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Próxima vez que se cumple el mismo día y mes que `occasionDate`, contando
 * desde `from`. Si ya pasó este año, devuelve el del año que viene.
 *
 * Un 29 de febrero en año no bisiesto lo normaliza JS al 1 de marzo, que es un
 * comportamiento aceptable para un recordatorio.
 */
export function nextOccurrence(occasionDate, from = new Date()) {
    const occ = new Date(occasionDate);
    const base = new Date(midnightUTC(from));

    let candidate = new Date(Date.UTC(base.getUTCFullYear(), occ.getUTCMonth(), occ.getUTCDate()));
    if (candidate.getTime() < base.getTime()) {
        candidate = new Date(Date.UTC(base.getUTCFullYear() + 1, occ.getUTCMonth(), occ.getUTCDate()));
    }
    return candidate;
}

/** Días enteros entre dos fechas, en UTC. */
export function daysBetween(a, b) {
    return Math.round((midnightUTC(b) - midnightUTC(a)) / 86400000);
}

/**
 * ¿Toca avisar hoy de esta página?
 * Exportada aparte para poder probar la decisión sin base de datos.
 */
export function shouldRemind(page, now = new Date()) {
    if (!page.occasionDate || page.isDeleted) return false;
    const next = nextOccurrence(page.occasionDate, now);
    if (daysBetween(now, next) !== REMINDER_DAYS_AHEAD) return false;
    // Un aviso por año: si ya se mandó el de esta ocasión, no se repite.
    return page.lastReminderYear !== next.getUTCFullYear();
}

/**
 * Recorre las páginas con fecha de ocasión y manda los avisos que tocan hoy.
 * @returns {{ revisadas: number, enviados: number }}
 */
export async function runOccasionReminders(now = new Date()) {
    const candidates = await Page.find({
        occasionDate: { $ne: null },
        isDeleted: false,
    }).select('_id userId title recipientName occasionDate lastReminderYear isDeleted');

    let enviados = 0;

    for (const page of candidates) {
        if (!shouldRemind(page, now)) continue;

        const year = nextOccurrence(page.occasionDate, now).getUTCFullYear();

        // Reclamar el envío antes de mandarlo: si otra instancia se adelantó,
        // este update no encuentra el documento y no se duplica el aviso.
        const claimed = await Page.findOneAndUpdate(
            { _id: page._id, lastReminderYear: page.lastReminderYear ?? null },
            { $set: { lastReminderYear: year } },
            { new: true }
        );
        if (!claimed) continue;

        try {
            const owner = await User.findById(page.userId).select('pushSubscriptions email');
            if (!owner?.pushSubscriptions?.length) continue;

            const quien = page.recipientName || '';
            const expired = await sendPushToUser(owner.pushSubscriptions, {
                title: quien ? `Se acerca la fecha de ${quien}` : 'Se acerca una fecha especial',
                body: `Faltan ${REMINDER_DAYS_AHEAD} días. ¿Le escribes algo?`,
                url: '/create',
                tag: `occasion-${page._id}`,
            });

            if (expired.length > 0) {
                await User.updateOne(
                    { _id: owner._id },
                    { $pull: { pushSubscriptions: { endpoint: { $in: expired } } } }
                );
            }

            enviados += 1;
        } catch (err) {
            // Si falla el envío se devuelve el cerrojo, para reintentar mañana.
            await Page.updateOne(
                { _id: page._id },
                { $set: { lastReminderYear: page.lastReminderYear ?? null } }
            );
            console.error('Error enviando recordatorio de ocasión:', err.message);
        }
    }

    return { revisadas: candidates.length, enviados };
}

/**
 * Arranca la comprobación periódica. Se mira cada hora porque el aviso sólo
 * depende del día, no de la hora exacta.
 */
export function startReminderScheduler() {
    const UNA_HORA = 60 * 60 * 1000;

    const tick = async () => {
        try {
            const { revisadas, enviados } = await runOccasionReminders();
            if (enviados > 0) {
                console.log(`📅 Recordatorios de ocasión: ${enviados} enviados de ${revisadas} páginas`);
            }
        } catch (err) {
            console.error('Error en el job de recordatorios:', err.message);
        }
    };

    // Un poco después del arranque, para no competir con la conexión a la BD.
    setTimeout(tick, 30 * 1000);
    const handle = setInterval(tick, UNA_HORA);
    handle.unref?.();
    return handle;
}
