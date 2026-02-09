/**
 * Middleware para verificar si el usuario es administrador.
 * Debe usarse DESPUÉS del middleware `authenticate`.
 */
export const requireAdmin = (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado',
            });
        }

        if (!req.user.isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Acceso denegado. Se requieren permisos de administrador.',
                code: 'ADMIN_REQUIRED',
            });
        }

        next();
    } catch (error) {
        console.error('Admin verification error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al verificar permisos de administrador',
        });
    }
};