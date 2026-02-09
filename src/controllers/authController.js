import User from '../models/User.js';

class AuthController {
    /**
     * Obtener información del usuario actual
     * GET /api/auth/me
     */
    async getMe(req, res) {
        try {
            const user = req.user;

            return res.json({
                success: true,
                data: {
                    _id: user._id,
                    firebaseUid: user.firebaseUid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    isPro: user.isProActive(),
                    pagesCreated: user.pagesCreated,
                    canCreatePage: user.isPro ? true : user.pagesCreated < 1,
                    remainingPages: user.isPro ? 'unlimited' : Math.max(0, 1 - user.pagesCreated),
                    lastLogin: user.lastLogin,
                    createdAt: user.createdAt,
                    isAdmin: user.isAdmin,
                },
            });
        } catch (error) {
            console.error('Error in getMe:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al obtener información del usuario',
            });
        }
    }

    /**
     * Sincronizar usuario de Firebase con la base de datos
     * POST /api/auth/sync
     */
    async syncUser(req, res) {
        try {
            const { email, displayName, photoURL, firebaseUid } = req.body;

            if (!firebaseUid || !email) {
                return res.status(400).json({
                    success: false,
                    message: 'Datos de usuario incompletos',
                });
            }

            // Buscar o crear usuario
            let user = await User.findOne({ firebaseUid });

            if (!user) {
                user = await User.create({
                    firebaseUid,
                    email,
                    displayName: displayName || email.split('@')[0],
                    photoURL: photoURL || null,
                });

                console.log(`✅ New user synced: ${user.email}`);
            } else {
                // Actualizar información si cambió
                user.displayName = displayName || user.displayName;
                user.photoURL = photoURL || user.photoURL;
                await user.updateLastLogin();
            }

            return res.json({
                success: true,
                data: {
                    _id: user._id,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    isPro: user.isProActive(),
                    pagesCreated: user.pagesCreated,
                },
            });
        } catch (error) {
            console.error('Error syncing user:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al sincronizar usuario',
            });
        }
    }

    /**
     * Actualizar perfil del usuario
     * PATCH /api/auth/profile
     */
    async updateProfile(req, res) {
        try {
            const user = req.user;
            const { displayName, photoURL } = req.body;

            if (displayName) {
                user.displayName = displayName;
            }

            if (photoURL !== undefined) {
                user.photoURL = photoURL;
            }

            await user.save();

            return res.json({
                success: true,
                message: 'Perfil actualizado exitosamente',
                data: {
                    _id: user._id,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                },
            });
        } catch (error) {
            console.error('Error updating profile:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al actualizar perfil',
            });
        }
    }

    /**
     * Eliminar cuenta de usuario
     * DELETE /api/auth/account
     */
    async deleteAccount(req, res) {
        try {
            const user = req.user;

            // Aquí podrías agregar lógica adicional:
            // - Eliminar todas las páginas del usuario
            // - Eliminar imágenes de Firebase Storage
            // - Etc.

            await User.findByIdAndDelete(user._id);

            return res.json({
                success: true,
                message: 'Cuenta eliminada exitosamente',
            });
        } catch (error) {
            console.error('Error deleting account:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al eliminar cuenta',
            });
        }
    }
}

export default new AuthController();