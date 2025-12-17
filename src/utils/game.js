// src/utils/game.js - Полностью переписанная версия
const activeGames = new Map();
const userSessions = new Map();

class WheelGame {
    constructor(gameId) {
        this.id = gameId;
        this.participants = [];
        this.status = 'waiting'; // waiting, counting, spinning, finished
        this.countdown = null;
        this.countdownStartTime = null;
        this.winner = null;
        this.winnerIndex = null;
        this.finalAngle = null;
        this.createdAt = new Date();
        this.lastActivity = new Date();
        this.spinStartedAt = null;
        this.winnerAnnounced = false;
        this.nextRoundTimer = null;
        this.maxParticipants = 20; // Больше участников
    }
    
    addParticipant(user) {
        console.log(`👤 Пытаемся добавить пользователя ${user.first_name} (ID: ${user.id}) в игру ${this.id}`);
        
        // Проверяем статус игры
        if (this.status === 'spinning' || this.status === 'finished') {
            console.log(`❌ Игра уже в статусе: ${this.status}`);
            return { success: false, error: 'Игра уже началась' };
        }
        
        // Проверяем, не участвует ли уже
        if (this.participants.some(p => p.id === user.id)) {
            console.log(`❌ Пользователь уже участвует в игре`);
            return { success: false, error: 'Вы уже участвуете в игре' };
        }
        
        // Добавляем пользователя
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
        
        console.log(`✅ Пользователь добавлен. Теперь участников: ${this.participants.length}`);
        
        // Если стало 2+ участников и игра в режиме ожидания - запускаем таймер
        if (this.participants.length >= 2 && this.status === 'waiting') {
            console.log(`⏳ Запускаем 30-секундный таймер (участников: ${this.participants.length})`);
            this.startCountdown();
        }
        
        return { success: true, participant: user };
    }
    
    startCountdown() {
        if (this.status !== 'waiting') return;
        
        this.status = 'counting';
        this.countdown = 30; // 30 секунд
        this.countdownStartTime = new Date();
        this.lastActivity = new Date();
        
        console.log(`⏳ Игра ${this.id}: запущен 30-секундный таймер`);
    }
    
    updateGameState() {
        const now = new Date();
        this.lastActivity = now;
        
        // Обновляем таймер если игра в режиме отсчета
        if (this.status === 'counting' && this.countdownStartTime) {
            const secondsPassed = Math.floor((now - this.countdownStartTime) / 1000);
            this.countdown = Math.max(0, 30 - secondsPassed);
            
            // Если таймер истек - запускаем вращение
            if (this.countdown <= 0 && this.status === 'counting') {
                console.log(`⏰ Таймер истек, запускаем вращение колеса!`);
                this.startSpinning();
            }
        }
        
        // Если игра в состоянии вращения - проверяем не пора ли завершить
        if (this.status === 'spinning' && this.spinStartedAt) {
            const spinDuration = Math.floor((now - this.spinStartedAt) / 1000);
            
            // Вращение длится 5 секунд, затем показываем победителя
            if (spinDuration >= 5 && !this.winnerAnnounced) {
                console.log(`🎰 Вращение завершено, определяем победителя...`);
                this.determineWinner();
                this.winnerAnnounced = true;
            }
            
            // Через 8 секунд после начала вращения завершаем игру
            if (spinDuration >= 8 && this.status === 'spinning') {
                this.finishGame();
            }
        }
        
        // Если игра завершена - обновляем таймер следующего раунда
        if (this.status === 'finished') {
            if (!this.nextRoundTimer) {
                this.nextRoundTimer = 8; // 8 секунд показа победителя
            } else {
                const finishedAt = this.spinStartedAt ? new Date(this.spinStartedAt.getTime() + 8000) : new Date();
                const secondsSinceFinish = Math.floor((now - finishedAt) / 1000);
                this.nextRoundTimer = Math.max(0, 8 - secondsSinceFinish);
            }
        }
    }
    
    startSpinning() {
        if (this.participants.length < 2) {
            console.log(`❌ Недостаточно участников для вращения: ${this.participants.length}`);
            this.status = 'waiting';
            this.countdown = null;
            this.countdownStartTime = null;
            return;
        }
        
        console.log(`🎰 Начинаем вращение колеса с ${this.participants.length} участниками`);
        
        this.status = 'spinning';
        this.spinStartedAt = new Date();
        this.lastActivity = new Date();
        
        // Генерируем случайный финальный угол
        // Колесо сделает 5 полных оборотов + случайный угол
        const spins = 5;
        const baseAngle = spins * 360;
        
        // Случайный угол от 0 до 360 градусов
        const randomAngle = Math.random() * 360;
        
        this.finalAngle = baseAngle + randomAngle;
        
        console.log(`📐 Финальный угол вращения: ${this.finalAngle}°`);
        
        // Победитель пока не определен - определится после остановки
        this.winner = null;
        this.winnerIndex = null;
        this.winnerAnnounced = false;
    }
    
    determineWinner() {
        if (!this.finalAngle || this.participants.length === 0) {
            console.warn('Не могу определить победителя: нет угла или участников');
            return;
        }
        
        // Нормализуем угол (убираем полные обороты)
        const normalizedAngle = this.finalAngle % 360;
        
        // Участники расположены равномерно по кругу
        const sectorAngle = 360 / this.participants.length;
        
        // Определяем сектор (от 0 до participants.length-1)
        // Учитываем что указатель вверху (0°), а вращение по часовой стрелке
        let sector = Math.floor(normalizedAngle / sectorAngle);
        
        // Инвертируем индекс для правильного соответствия
        sector = (this.participants.length - sector) % this.participants.length;
        if (sector < 0) sector += this.participants.length;
        
        // Выбираем победителя
        this.winnerIndex = sector;
        this.winner = this.participants[sector];
        
        console.log(`🎯 Определен победитель: ${this.winner.first_name}`);
        console.log(`📏 Угол: ${normalizedAngle}°, Сектор: ${sectorAngle}°, Выбран сектор: ${sector}`);
        
        // Увеличиваем счетчик побед пользователя
        if (gameManager) {
            gameManager.incrementUserWins(this.winner.id);
        }
    }

    finishGame() {
        if (this.status !== 'spinning') return;
        
        console.log(`🏁 Игра ${this.id}: завершена! Победитель: ${this.winner?.first_name || 'не определен'}`);
        
        this.status = 'finished';
        this.lastActivity = new Date();
        
        // Через 8 секунд сбрасываем и начинаем новый раунд
        setTimeout(() => {
            this.resetForNextRound();
        }, 8000);
    }
    
    resetForNextRound() {
        console.log(`🔄 Сброс игры для нового раунда`);
        
        // ВАЖНО: Очищаем участников!
        this.participants = [];
        
        // Полностью сбрасываем состояние игры
        this.status = 'waiting';
        this.countdown = null;
        this.countdownStartTime = null;
        this.winner = null;
        this.winnerIndex = null;
        this.finalAngle = null;
        this.spinStartedAt = null;
        this.winnerAnnounced = false;
        this.nextRoundTimer = null;
        
        console.log(`👥 Все участники удалены, начинаем новый раунд с чистого листа`);
        
        this.lastActivity = new Date();
    }
    
    getGameState() {
        // Обновляем состояние игры
        this.updateGameState();
        
        // Рассчитываем прогресс вращения
        let spinProgress = null;
        if (this.status === 'spinning' && this.spinStartedAt) {
            const now = new Date();
            const spinDuration = Math.floor((now - this.spinStartedAt) / 1000);
            spinProgress = Math.min(spinDuration / 5, 1);
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
            spinProgress: spinProgress,
            nextRoundTimer: this.nextRoundTimer,
            lastActivity: this.lastActivity,
            canJoin: this.status === 'waiting' || this.status === 'counting'
        };
    }
}



const gameManager = {
    createGame() {
        const gameId = 'game_' + Date.now();
        const game = new WheelGame(gameId);
        activeGames.set(gameId, game);
        console.log(`🆕 Создана новая игра: ${gameId}`);
        return game;
    },
    
    getGame(gameId) {
        return activeGames.get(gameId);
    },
    
    getActiveGame() {
        // Ищем активную игру
        for (const [id, game] of activeGames) {
            const now = new Date();
            const timeSinceLastActivity = (now - game.lastActivity) / 1000;
            
            // Удаляем старые неактивные игры
            if (timeSinceLastActivity > 300) { // 5 минут
                console.log(`🗑️ Удаляем старую игру ${id}`);
                activeGames.delete(id);
                continue;
            }
            
            return game;
        }
        
        // Если нет активных игр, создаем новую
        return this.createGame();
    },
    
    cleanupOldGames() {
        const now = new Date();
        const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);
        
        let cleaned = 0;
        for (const [id, game] of activeGames) {
            if (game.lastActivity < fiveMinutesAgo) {
                activeGames.delete(id);
                cleaned++;
                console.log(`🧹 Удалена старая игра ${id}`);
            }
        }
        
        if (cleaned > 0) {
            console.log(`🧹 Очищено ${cleaned} старых игр`);
        }
    },
    
    registerUser(userData) {
        if (!userData || !userData.id) return null;
        
        const existingUser = userSessions.get(userData.id);
        const now = new Date();
        
        const userRecord = {
            ...userData,
            lastSeen: now,
            firstSeen: existingUser?.firstSeen || now,
            gamesPlayed: existingUser?.gamesPlayed || 0,
            gamesWon: existingUser?.gamesWon || 0,
            totalGames: existingUser?.totalGames || 0
        };
        
        userSessions.set(userData.id, userRecord);
        
        console.log(`👤 Зарегистрирован/обновлен пользователь: ${userData.first_name} (ID: ${userData.id})`);
        
        return userRecord;
    },
    
    getUser(userId) {
        return userSessions.get(userId);
    },
    
    incrementUserGames(userId) {
        const user = userSessions.get(userId);
        if (user) {
            user.gamesPlayed = (user.gamesPlayed || 0) + 1;
            user.totalGames = (user.totalGames || 0) + 1;
            user.lastSeen = new Date();
        }
    },
    
    incrementUserWins(userId) {
        const user = userSessions.get(userId);
        if (user) {
            user.gamesWon = (user.gamesWon || 0) + 1;
            user.lastSeen = new Date();
            console.log(`🏆 Пользователь ${userId} одержал победу! Всего побед: ${user.gamesWon}`);
        }
    }
};

// Очистка старых игр каждую минуту
setInterval(() => {
    gameManager.cleanupOldGames();
}, 60 * 1000);

// Логирование каждые 30 секунд
setInterval(() => {
    console.log(`📊 Статистика: ${activeGames.size} активных игр, ${userSessions.size} пользователей`);
}, 30000);

module.exports = {
    WheelGame,
    gameManager
};