import express from 'express';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

// Configuración
const MAX_DAILY_REWARDS = 3;
const REWARD_PAGES = 1;
const REWARD_TOKEN_EXPIRY = 5 * 60;

const rewardTokens = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [token, data] of rewardTokens.entries()) {
        if (now - data.createdAt > REWARD_TOKEN_EXPIRY * 1000) {
            rewardTokens.delete(token);
        }
    }
}, 10 * 60 * 1000);

router.post('/request', authenticate, async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        }

        if (user.isPro) {
            return res.status(400).json({
                success: false,
                message: 'Los usuarios PRO no necesitan ver anuncios',
            });
        }

        const today = new Date().toISOString().split('T')[0];
        const dailyViews = user.rewardHistory?.filter(
            (r) => r.date.toISOString().split('T')[0] === today && r.completed
        ).length || 0;

        if (dailyViews >= MAX_DAILY_REWARDS) {
            return res.status(429).json({
                success: false,
                message: `Has alcanzado el límite de ${MAX_DAILY_REWARDS} recompensas por día`,
            });
        }

        const token = crypto.randomBytes(32).toString('hex');
        rewardTokens.set(token, {
            userId: userId.toString(),
            createdAt: Date.now(),
            used: false,
        });

        res.json({
            success: true,
            data: {
                token,
                expiresIn: REWARD_TOKEN_EXPIRY,
                dailyRemaining: MAX_DAILY_REWARDS - dailyViews,
            },
        });
    } catch (error) {
        console.error('Error requesting reward:', error);
        res.status(500).json({ success: false, message: 'Error al solicitar recompensa' });
    }
});

router.post('/confirm', authenticate, async (req, res) => {
    try {
        const userId = req.user._id;
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ success: false, message: 'Token requerido' });
        }

        const tokenData = rewardTokens.get(token);

        if (!tokenData) {
            return res.status(400).json({ success: false, message: 'Token inválido o expirado' });
        }

        if (tokenData.userId !== userId.toString()) {
            return res.status(403).json({ success: false, message: 'Token no pertenece a este usuario' });
        }

        if (tokenData.used) {
            return res.status(400).json({ success: false, message: 'Token ya utilizado' });
        }

        if (Date.now() - tokenData.createdAt > REWARD_TOKEN_EXPIRY * 1000) {
            rewardTokens.delete(token);
            return res.status(400).json({ success: false, message: 'Token expirado' });
        }

        tokenData.used = true;
        rewardTokens.delete(token);

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        }

        user.bonusPages = (user.bonusPages || 0) + REWARD_PAGES;

        if (!user.rewardHistory) {
            user.rewardHistory = [];
        }
        user.rewardHistory.push({
            date: new Date(),
            type: 'ad_reward',
            pagesEarned: REWARD_PAGES,
            completed: true,
        });

        await user.save();

        const totalAllowed = 1 + (user.bonusPages || 0);
        const canCreatePage = user.isPro || user.pagesCreated < totalAllowed;

        const today = new Date().toISOString().split('T')[0];
        const dailyAdViews = user.rewardHistory.filter(
            (r) => r.date.toISOString().split('T')[0] === today && r.completed
        ).length;

        res.json({
            success: true,
            data: {
                user: {
                    ...user.toObject(),
                    canCreatePage,
                    dailyAdViews,
                },
                reward: {
                    pagesEarned: REWARD_PAGES,
                    totalBonusPages: user.bonusPages,
                    dailyRemaining: MAX_DAILY_REWARDS - dailyAdViews,
                },
            },
        });
    } catch (error) {
        console.error('Error confirming reward:', error);
        res.status(500).json({ success: false, message: 'Error al confirmar recompensa' });
    }
});

router.get('/status', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        }

        const today = new Date().toISOString().split('T')[0];
        const dailyAdViews = user.rewardHistory?.filter(
            (r) => r.date.toISOString().split('T')[0] === today && r.completed
        ).length || 0;

        res.json({
            success: true,
            data: {
                bonusPages: user.bonusPages || 0,
                dailyAdViews,
                dailyRemaining: MAX_DAILY_REWARDS - dailyAdViews,
                maxDailyRewards: MAX_DAILY_REWARDS,
                totalRewardsEarned: user.rewardHistory?.filter((r) => r.completed).length || 0,
            },
        });
    } catch (error) {
        console.error('Error getting reward status:', error);
        res.status(500).json({ success: false, message: 'Error al obtener estado' });
    }
});

export default router;