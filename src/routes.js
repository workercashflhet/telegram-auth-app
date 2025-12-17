const express = require('express');
const router = express.Router();
const { validateTelegramData } = require('./utils/auth');
const { gameManager } = require('./utils/game');

// Главная страница
router.get('/', (req, res) => {
    res.sendFile('index.html', { root: './public' });
});

// Проверка сервера
router.get('/api/test', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Wheel of Fortune - Real Players Only',
        timestamp: new Date().toISOString(),
        activeGames: gameManager.getAllGames ? gameManager.getAllGames().length : 0,
        botToken: process.env.BOT_TOKEN ? '✅ Настроен' : '❌ Не настроен'
    });
});

// Авторизация и регистрация пользователя
router.post('/api/auth', (req, res) => {
    try {
        const { initData } = req.body;
        
        if (!initData) {
            return res.status(400).json({
                success: false,
                error: 'Нет данных авторизации'
            });
        }

        // Валидируем данные Telegram
        const userData = validateTelegramData(initData);
        
        if (userData) {
            // Регистрируем/обновляем пользователя
            const registeredUser = gameManager.registerUser(userData);
            
            return res.json({
                success: true,
                user: registeredUser,
                source: 'telegram',
                message: 'Добро пожаловать!'
            });
        } else {
            return res.status(401).json({
                success: false,
                error: 'Недействительные данные Telegram. Откройте приложение через Telegram бота.'
            });
        }

    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка сервера'
        });
    }
});

// Получить состояние текущей игры
router.get('/api/game/state', (req, res) => {
    try {
        const game = gameManager.getActiveGame();
        const gameState = game.getGameState();
        
        res.json({
            success: true,
            game: gameState
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Присоединиться к игре
router.post('/api/game/join', (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'Не указан ID пользователя'
            });
        }
        
        // Получаем пользователя
        const user = gameManager.getUser(userId);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Пользователь не найден. Сначала войдите в аккаунт.'
            });
        }
        
        // Получаем активную игру
        const game = gameManager.getActiveGame();
        
        // Пытаемся добавить пользователя в игру
        const result = game.addParticipant(user);
        
        if (result.success) {
            res.json({
                success: true,
                message: 'Вы присоединились к игре!',
                game: game.getGameState()
            });
        } else {
            res.json({
                success: false,
                error: result.error
            });
        }
        
    } catch (error) {
        console.error('Join game error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка сервера'
        });
    }
});

// Запустить колесо
router.post('/api/game/spin', (req, res) => {
    try {
        const { gameId } = req.body;
        
        if (!gameId) {
            return res.status(400).json({
                success: false,
                error: 'Не указан ID игры'
            });
        }
        
        const game = gameManager.getGame(gameId);
        
        if (!game) {
            return res.status(404).json({
                success: false,
                error: 'Игра не найдена'
            });
        }
        
        const result = game.spinWheel();
        
        if (result.success) {
            res.json({
                success: true,
                winner: result.winner,
                message: 'Колесо запущено!',
                game: game.getGameState()
            });
        } else {
            res.json({
                success: false,
                error: result.error
            });
        }
        
    } catch (error) {
        console.error('Spin wheel error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка сервера'
        });
    }
});

// Получить информацию о пользователе
router.get('/api/user/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const user = gameManager.getUser(userId);
        
        if (user) {
            res.json({
                success: true,
                user: user
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Получить список активных игр
router.get('/api/games/active', (req, res) => {
    try {
        // В реальном приложении здесь был бы список игр
        const game = gameManager.getActiveGame();
        
        res.json({
            success: true,
            games: [game.getGameState()]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;