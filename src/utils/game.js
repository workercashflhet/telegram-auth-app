// src/utils/game.js - Логика игры для реальных пользователей
const activeGames = new Map();
const userSessions = new Map(); // Хранилище сессий пользователей

class WheelGame {
    constructor(gameId) {
        this.id = gameId;
        this.participants = [];
        this.status = 'waiting';
        this.countdown = 30;
        this.winner = null; // Победитель выбирается на сервере
        this.winnerIndex = null; // Индекс победителя для анимации
        this.finalAngle = null; // Угол вращения для всех клиентов
        this.createdAt = new Date();
        this.maxParticipants = 8;
        this.lastActivity = new Date();
        this.spinStartedAt = null; // Когда началось вращение
    }
    
   // game.js - исправить метод addParticipant
    addParticipant(user) {
        if (this.status !== 'waiting') {
            return { success: false, error: 'Игра уже началась' };
        }
        
        if (this.participants.length >= this.maxParticipants) {
            return { success: false, error: 'Достигнут лимит участников' };
        }
        
        // Проверяем, не участвует ли уже
        if (this.participants.some(p => p.id === user.id)) {
            return { success: false, error: 'Вы уже участвуете в игре' };
        }
        
        // Убеждаемся, что пользователь зарегистрирован
        if (!gameManager.getUser(user.id)) {
            gameManager.registerUser(user);
        }
        
        // Сохраняем полные данные пользователя
        this.participants.push({
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name || '',
            username: user.username || '',
            photo_url: user.photo_url || null,
            language_code: user.language_code || 'ru',
            is_premium: user.is_premium || false,
            joinedAt: new Date()
        });
        
        this.lastActivity = new Date();
        
        // Автоматически запускаем отсчет если участников > 1
        if (this.participants.length > 1 && this.status === 'waiting') {
            this.status = 'counting';
            this.startCountdown();
        }
        
        return { success: true, participant: user };
    }
    
    // Запустить отсчет
    startCountdown() {
        if (this.status !== 'counting') return;
        
        // Сбрасываем таймер
        this.countdown = 30;
        
        // В реальном приложении здесь был бы интервал
        // Для демо просто сохраняем время старта
    }
    
    // game.js - исправить метод updateCountdown
    updateCountdown() {
        if (this.status !== 'counting') return;
        
        const now = new Date();
        const secondsPassed = Math.floor((now - this.lastActivity) / 1000);
        this.countdown = Math.max(0, 30 - secondsPassed);
        
        if (this.countdown <= 0 && this.status === 'counting') {
            this.startSpinning();
        }
    }

    // Запустить вращение (сервер определяет победителя)
    startSpinning() {
        if (this.participants.length < 2) {
            this.status = 'waiting';
            this.countdown = null;
            return;
        }
        
        this.status = 'spinning';
        this.spinStartedAt = new Date();
        this.lastActivity = new Date();
        
        // ВАЖНО: Сервер выбирает победителя
        this.winnerIndex = Math.floor(Math.random() * this.participants.length);
        this.winner = this.participants[this.winnerIndex];
        
        // Рассчитываем конечный угол для всех клиентов
        const spins = 5;
        const sectorAngle = 360 / this.participants.length;
        const extraAngle = Math.random() * sectorAngle; // Немного случайности
        
        // Формула для расчета финального угла
        this.finalAngle = spins * 360 + (this.winnerIndex * sectorAngle) + extraAngle;
        
        console.log(`🎰 Игра ${this.id}: запущено вращение!`);
        console.log(`🏆 Победитель: ${this.winner.first_name} (индекс: ${this.winnerIndex})`);
        console.log(`📐 Финальный угол: ${this.finalAngle}°`);
        
        // Через 5 секунд завершаем игру
        setTimeout(() => {
            this.finishGame();
        }, 5000);
    }

    // Убираем метод startGame или переименовываем его
    getGameState() {
        // Обновляем таймер если игра в режиме отсчета
        if (this.status === 'counting') {
            this.updateCountdown();
        }
        
        return {
            id: this.id,
            participants: this.participants,
            status: this.status,
            countdown: this.countdown,
            winner: this.winner,
            winnerIndex: this.winnerIndex,
            finalAngle: this.finalAngle,
            spinStartedAt: this.spinStartedAt,
            maxParticipants: this.maxParticipants,
            lastActivity: this.lastActivity
        };
    }
    
    // Запустить игру (автоматически при завершении таймера)
    startGame() {
        if (this.status !== 'counting' || this.participants.length < 2) {
            // Если недостаточно игроков, сбрасываем состояние
            this.status = 'waiting';
            this.countdown = null;
            return { success: false, error: 'Недостаточно участников' };
        }
        
        this.status = 'spinning';
        this.lastActivity = new Date();
        
        // Выбираем случайного победителя
        const winnerIndex = Math.floor(Math.random() * this.participants.length);
        this.winner = this.participants[winnerIndex];
        
        // Через 5 секунд завершаем игру
        setTimeout(() => {
            this.finishGame();
        }, 5000);
        
        return { success: true, winner: this.winner };
    }
    
    // Обработчик API для запуска игры (теперь не используется, но оставим для совместимости)
    spinWheel() {
        return this.startGame();
    }
    
    // ... остальные методы без изменений ...

    
    // Завершить игру
    finishGame() {
        this.status = 'finished';
        this.lastActivity = new Date();
        
        // Очищаем игру через 10 секунд
        setTimeout(() => {
            if (activeGames.has(this.id)) {
                activeGames.delete(this.id);
            }
        }, 10000);
    }
    
    // Получить состояние игры
    getGameState() {
        // Обновляем таймер если игра в режиме отсчета
        if (this.status === 'counting') {
            this.updateCountdown();
        }
        
        return {
            id: this.id,
            participants: this.participants,
            status: this.status,
            countdown: this.countdown,
            winner: this.winner,
            maxParticipants: this.maxParticipants,
            lastActivity: this.lastActivity
        };
    }
}

// Менеджер игр
const gameManager = {
    // Создать новую игру
    createGame() {
        const gameId = 'game_' + Date.now();
        const game = new WheelGame(gameId);
        activeGames.set(gameId, game);
        return game;
    },

    // Получить все игры (новый метод)
    getAllGames() {
        return Array.from(activeGames.values());
    },
    
    // Получить игру
    getGame(gameId) {
        return activeGames.get(gameId);
    },
    
    // Получить активную игру (или создать новую)
    getActiveGame() {
        // Ищем активную игру
        for (const [id, game] of activeGames) {
            if (game.status === 'waiting' || game.status === 'counting') {
                return game;
            }
        }
        
        // Если нет активных игр, создаем новую
        return this.createGame();
    },
    
    // Очистить старые игры
    cleanupOldGames() {
        const now = new Date();
        const oneHourAgo = new Date(now - 60 * 60 * 1000);
        
        for (const [id, game] of activeGames) {
            if (game.lastActivity < oneHourAgo) {
                activeGames.delete(id);
            }
        }
    },
    
    // Регистрация пользователя
    registerUser(userData) {
        if (!userData || !userData.id) return null;
        
        userSessions.set(userData.id, {
            ...userData,
            lastSeen: new Date(),
            gamesPlayed: 0,
            gamesWon: 0
        });
        
        return userData;
    },
    
    // Получить пользователя
    getUser(userId) {
        return userSessions.get(userId);
    }
};

// Очистка старых игр каждые 5 минут
setInterval(() => {
    gameManager.cleanupOldGames();
}, 5 * 60 * 1000);

module.exports = {
    WheelGame,
    gameManager
};