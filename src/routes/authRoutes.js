import express from 'express';
import authController from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   GET /api/auth/me
 * @desc    Obtener información del usuario actual
 * @access  Private
 */
router.get('/me', authenticate, authController.getMe);

/**
 * @route   POST /api/auth/sync
 * @desc    Sincronizar usuario de Firebase con BD
 * @access  Public (se autentica en el controlador)
 */
router.post('/sync', authController.syncUser);

/**
 * @route   PATCH /api/auth/profile
 * @desc    Actualizar perfil del usuario
 * @access  Private
 */
router.patch('/profile', authenticate, authController.updateProfile);

/**
 * @route   DELETE /api/auth/account
 * @desc    Eliminar cuenta de usuario
 * @access  Private
 */
router.delete('/account', authenticate, authController.deleteAccount);

export default router;