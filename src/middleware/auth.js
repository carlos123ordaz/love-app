import admin from '../config/firebase.js';
import User from '../models/User.js';

/**
 * Middleware para verificar el token de Firebase y autenticar al usuario
 */
export const authenticate = async (req, res, next) => {
    try {
        // Obtener el token del header Authorization
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'No se proporcionó token de autenticación',
            });
        }

        const token = authHeader.split('Bearer ')[1];

        // Verificar el token con Firebase Admin
        const decodedToken = await admin.auth().verifyIdToken(token);

        // Buscar o crear el usuario en la base de datos
        let user = await User.findOne({ firebaseUid: decodedToken.uid });

        if (!user) {
            // Crear usuario si no existe
            user = await User.create({
                firebaseUid: decodedToken.uid,
                email: decodedToken.email,
                displayName: decodedToken.name || decodedToken.email.split('@')[0],
                photoURL: decodedToken.picture || null,
            });
            console.log(`✅ New user created: ${user.email}`);
        } else {
            // Actualizar último login
            await user.updateLastLogin();
        }

        // Agregar usuario a la request
        req.user = user;
        req.firebaseUser = decodedToken;

        next();
    } catch (error) {
        console.error('Authentication error:', error);

        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({
                success: false,
                message: 'El token ha expirado',
                code: 'TOKEN_EXPIRED',
            });
        }

        if (error.code === 'auth/argument-error') {
            return res.status(401).json({
                success: false,
                message: 'Token inválido',
                code: 'INVALID_TOKEN',
            });
        }

        return res.status(401).json({
            success: false,
            message: 'Error de autenticación',
        });
    }
};

/**
 * Middleware para verificar si el usuario tiene plan PRO activo
 */
export const requirePro = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado',
            });
        }

        if (!req.user.isProActive()) {
            return res.status(403).json({
                success: false,
                message: 'Se requiere plan PRO para esta acción',
                code: 'PRO_REQUIRED',
            });
        }

        next();
    } catch (error) {
        console.error('Pro verification error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al verificar plan PRO',
        });
    }
};

/**
 * Middleware opcional de autenticación (no falla si no hay token)
 */
export const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token);

        const user = await User.findOne({ firebaseUid: decodedToken.uid });
        if (user) {
            req.user = user;
            req.firebaseUser = decodedToken;
        }

        next();
    } catch (error) {
        // Si hay error, simplemente continuar sin autenticar
        next();
    }
};

export default { authenticate, requirePro, optionalAuth };