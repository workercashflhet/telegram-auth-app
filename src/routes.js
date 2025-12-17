const express = require('express');
const router = express.Router();
const { validateTelegramData, generateDemoData } = require('./utils/auth');
const { gameManager } = require('./utils/game');

// Главная страница
router.get('/', (req, res) => {
    res.sendFile('index.html', { root: './public' });
});

// Проверка сервера
router.get('/api/test', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Wheel of Fortune Server',
        timestamp: new Date().toISOString(),
        botToken: process.env.BOT_TOKEN ? '✅ Настроен' : '❌ Не настроен'
    });
});

// Авторизация
router.post('/api/auth', (req, res) => {
    try {
        const { initData } = req.body;
        
        if (!initData) {
            return res.status(400).json({
                success: false,
                error: 'Нет данных авторизации',
                user: generateDemoData()
            });
        }

        const userData = validateTelegramData(initData);
        
        if (userData) {
            return res.json({
                success: true,
                user: userData,
                source: 'telegram'
            });
        } else {
            const demoUser = generateDemoData();
            return res.json({
                success: true,
                user: demoUser,
                source: 'demo'
            });
        }

    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка сервера',
            user: generateDemoData()
        });
    }
});

// Игровые API
router.get('/api/game/state', (req, res) => {
    try {
        const game = gameManager.getActiveGame();
        res.json({
            success: true,
            game: game.getGameState()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/api/game/join', (req, res) => {
    try {
        const { userId } = req.body;
        const game = gameManager.getActiveGame();
        
        // Здесь должна быть проверка пользователя из БД
        const user = generateDemoData();
        user.id = userId;
        
        if (game.addParticipant(user)) {
            res.json({
                success: true,
                message: 'Вы присоединились к игре',
                game: game.getGameState()
            });
        } else {
            res.json({
                success: false,
                error: 'Не удалось присоединиться к игре'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/api/game/spin', (req, res) => {
    try {
        const game = gameManager.getActiveGame();
        const winner = game.spinWheel();
        
        if (winner) {
            res.json({
                success: true,
                winner: winner,
                game: game.getGameState()
            });
        } else {
            res.json({
                success: false,
                error: 'Нельзя запустить колесо сейчас'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;