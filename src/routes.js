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
        if (!game) {
            return res.json({
                success: false,
                error: 'Игра не найдена'
            });
        }
        
        const gameState = game.getGameState();
        
        // Добавляем серверную метку времени для синхронизации
        const serverTime = Date.now();
        
        // Рассчитываем время до старта вращения
        let timeToSpin = null;
        if (gameState.status === 'counting' && gameState.countdown !== null) {
            timeToSpin = gameState.countdown * 1000; // в миллисекундах
        }
        
        res.json({
            success: true,
            game: gameState,
            serverTime: serverTime,
            timeToSpin: timeToSpin,
            timestamp: new Date().toISOString(),
            syncInfo: {
                participants: gameState.participants.length,
                status: gameState.status,
                countdown: gameState.countdown
            }
        });
    } catch (error) {
        console.error('Game state error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Также добавьте новый эндпоинт для синхронизации:
router.get('/api/sync', (req, res) => {
    res.json({
        success: true,
        serverTime: Date.now(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timestamp: new Date().toISOString()
    });
});

// Присоединиться к игре
// routes.js - исправить маршрут /api/game/join
// Присоединиться к игре
router.post('/api/game/join', (req, res) => {
    try {
        let { userId, userData } = req.body; // ← Измените const на let
        
        console.log('🔄 Запрос на присоединение к игре:', { userId, userData: userData ? 'предоставлен' : 'не предоставлен' });
        
        let user = null;
        let effectiveUserId = userId; // ← Создаем новую переменную
        
        // Если предоставлен userData, регистрируем пользователя
        if (userData) {
            console.log('📝 Регистрируем пользователя из данных запроса:', userData.id, userData.first_name);
            user = gameManager.registerUser(userData);
            effectiveUserId = userData.id; // ← Используем новую переменную
        } else if (userId) {
            // Ищем существующего пользователя
            user = gameManager.getUser(userId);
            effectiveUserId = userId; // ← Используем новую переменную
            console.log('👤 Найден пользователь по ID:', userId, user ? 'да' : 'нет');
        }
        
        if (!user) {
            console.log('❌ Пользователь не найден и не предоставлен в запросе');
            return res.status(401).json({
                success: false,
                error: 'Пользователь не найден. Сначала войдите в аккаунт.'
            });
        }
        
        console.log(`👤 Пользователь для игры: ${user.first_name} (ID: ${effectiveUserId})`);
        
        // Получаем активную игру
        const game = gameManager.getActiveGame();
        console.log(`🎮 Найдена игра: ${game.id}, статус: ${game.status}, участников: ${game.participants.length}`);
        
        // Пытаемся добавить пользователя в игру
        const result = game.addParticipant(user);
        
        console.log(`📊 Результат добавления: ${result.success ? 'успех' : 'ошибка'}, ошибка: ${result.error || 'нет'}`);
        
        if (result.success) {
            // Увеличиваем счетчик игр пользователя
            gameManager.incrementUserGames(effectiveUserId); // ← Используем effectiveUserId
            
            res.json({
                success: true,
                message: 'Вы присоединились к игре!',
                game: game.getGameState(),
                user: user
            });
        } else {
            res.json({
                success: false,
                error: result.error
            });
        }
        
    } catch (error) {
        console.error('❌ Ошибка присоединения к игре:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка сервера: ' + error.message
        });
    }
});

// Установить победителя игры
router.post('/api/game/set-winner', (req, res) => {
    try {
        const { gameId, winnerId, winnerIndex } = req.body;
        
        console.log(`🏆 Установка победителя для игры ${gameId}: ID=${winnerId}, индекс=${winnerIndex}`);
        
        const game = gameManager.getGame(gameId);
        
        if (!game) {
            return res.status(404).json({
                success: false,
                error: 'Игра не найдена'
            });
        }
        
        if (game.status !== 'spinning') {
            return res.status(400).json({
                success: false,
                error: 'Игра не в состоянии вращения'
            });
        }
        
        // Находим победителя
        const winner = game.participants.find(p => p.id === winnerId);
        
        if (!winner) {
            return res.status(404).json({
                success: false,
                error: 'Победитель не найден среди участников'
            });
        }
        
        // Устанавливаем победителя
        game.winner = winner;
        game.winnerIndex = winnerIndex !== undefined ? winnerIndex : game.participants.findIndex(p => p.id === winnerId);
        
        // Завершаем игру
        game.status = 'finished';
        
        // Увеличиваем счетчик побед пользователя
        gameManager.incrementUserWins(winnerId);
        
        res.json({
            success: true,
            message: `Победитель установлен: ${winner.first_name}`,
            winner: winner,
            game: game.getGameState()
        });
        
    } catch (error) {
        console.error('Set winner error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка сервера'
        });
    }
});

// Также добавьте новый эндпоинт для отладки:
router.post('/api/debug/join-test', (req, res) => {
    try {
        const { userId, firstName } = req.body;
        
        if (!userId || !firstName) {
            return res.status(400).json({
                success: false,
                error: 'Требуется userId и firstName'
            });
        }
        
        const userData = {
            id: parseInt(userId),
            first_name: firstName,
            last_name: 'Test',
            username: 'test_user',
            language_code: 'ru',
            is_premium: false,
            allows_write_to_pm: true,
            photo_url: null
        };
        
        const user = gameManager.registerUser(userData);
        const game = gameManager.getActiveGame();
        const result = game.addParticipant(user);
        
        res.json({
            success: result.success,
            message: result.success ? 'Тестовый пользователь добавлен' : result.error,
            game: game.getGameState(),
            user: user
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// // Запустить колесо
// router.post('/api/game/spin', (req, res) => {
//     try {
//         const { gameId } = req.body;
        
//         if (!gameId) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'Не указан ID игры'
//             });
//         }
        
//         const game = gameManager.getGame(gameId);
        
//         if (!game) {
//             return res.status(404).json({
//                 success: false,
//                 error: 'Игра не найдена'
//             });
//         }
        
//         const result = game.spinWheel();
        
//         if (result.success) {
//             res.json({
//                 success: true,
//                 winner: result.winner,
//                 message: 'Колесо запущено!',
//                 game: game.getGameState()
//             });
//         } else {
//             res.json({
//                 success: false,
//                 error: result.error
//             });
//         }
        
//     } catch (error) {
//         console.error('Spin wheel error:', error);
//         res.status(500).json({
//             success: false,
//             error: 'Ошибка сервера'
//         });
//     }
// });

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

// В routes.js добавить простой эндпоинт для отладки
router.get('/api/debug/game', (req, res) => {
    try {
        const game = gameManager.getActiveGame();
        if (!game) {
            return res.json({ success: false, error: 'Нет активной игры' });
        }
        
        res.json({
            success: true,
            game: {
                id: game.id,
                participants: game.participants,
                status: game.status,
                countdown: game.countdown,
                lastActivity: game.lastActivity,
                timeSinceLastActivity: Math.floor((new Date() - game.lastActivity) / 1000) + ' сек'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
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