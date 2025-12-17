// src/utils/game.js - Исправленная версия
const activeGames = new Map();
const userSessions = new Map();

class WheelGame {
    constructor(gameId) {
        this.id = gameId;
        this.participants = [];
        this.status = 'waiting';
        this.countdown = 30;
        this.countdownStartTime = null;
        this.winner = null;
        this.winnerIndex = null;
        this.finalAngle = null;
        this.createdAt = new Date();
        this.maxParticipants = 8;
        this.lastActivity = new Date();
        this.spinStartedAt = null;
    }
    
    // В game.js убедитесь, что метод addParticipant выглядит так:
    addParticipant(user) {
        console.log(`👤 Пытаемся добавить пользователя ${user.first_name} (ID: ${user.id}) в игру ${this.id}`);
        
        if (this.status !== 'waiting' && this.status !== 'counting') {
            console.log(`❌ Игра уже в статусе: ${this.status}`);
            return { success: false, error: 'Игра уже началась' };
        }
        
        if (this.participants.length >= this.maxParticipants) {
            console.log(`❌ Достигнут лимит участников: ${this.participants.length}/${this.maxParticipants}`);
            return { success: false, error: 'Достигнут лимит участников' };
        }
        
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
        
        // Автоматически запускаем отсчет если участников > 1
        if (this.participants.length > 1 && this.status === 'waiting') {
            console.log(`⏳ Запускаем таймер (участников: ${this.participants.length})`);
            this.startCountdown();
        }
        
        return { success: true, participant: user };
    }
    
    startCountdown() {
        if (this.status !== 'waiting') return;
        
        this.status = 'counting';
        this.countdown = 30;
        this.countdownStartTime = new Date();
        this.lastActivity = new Date();
        
        console.log(`⏳ Игра ${this.id}: запущен 30-секундный таймер`);
    }
    
    updateCountdown() {
        if (this.status !== 'counting') return;
        
        if (!this.countdownStartTime) {
            this.countdownStartTime = new Date();
            this.countdown = 30;
            return;
        }
        
        const now = new Date();
        const secondsPassed = Math.floor((now - this.countdownStartTime) / 1000);
        this.countdown = Math.max(0, 30 - secondsPassed);
        
        if (this.countdown <= 0 && this.status === 'counting') {
            this.startSpinning();
        }
    }
    
    startSpinning() {
        if (this.participants.length < 2) {
            this.status = 'waiting';
            this.countdown = null;
            this.countdownStartTime = null;
            return;
        }
        
        this.status = 'spinning';
        this.spinStartedAt = new Date();
        this.lastActivity = new Date();
        
        // Выбираем случайного победителя
        this.winnerIndex = Math.floor(Math.random() * this.participants.length);
        this.winner = this.participants[this.winnerIndex];
        
        // Рассчитываем конечный угол (совместим с frontend логикой)
        const spins = 5; // 5 полных оборотов
        const sectorAngle = 360 / this.participants.length;
        
        // Формула для frontend: участники расположены по часовой стрелке
        // Указатель сверху (0°), нужно чтобы он указывал на центр сектора победителя
        
        // Центр сектора победителя (относительно 0° сверху)
        const winnerCenterAngle = (360 - (this.winnerIndex * sectorAngle)) - (sectorAngle / 2);
        
        // Добавляем немного случайности (±30% сектора)
        const randomOffset = (Math.random() - 0.5) * sectorAngle * 0.6;
        
        // Итоговый угол: полные обороты + угол до сектора победителя + случайность
        this.finalAngle = spins * 360 + winnerCenterAngle + randomOffset;
        
        // Нормализуем угол
        this.finalAngle = this.finalAngle % 3600; // Не более 10 оборотов
        
        console.log(`🎰 Игра ${this.id}: запущено вращение!`);
        console.log(`👥 Участников: ${this.participants.length}`);
        console.log(`🏆 Победитель: ${this.winner.first_name} (индекс: ${this.winnerIndex})`);
        console.log(`📐 Финальный угол: ${this.finalAngle}°`);
        console.log(`📏 Сектор: ${sectorAngle}°, Центр сектора: ${winnerCenterAngle}°`);
        
        // Завершаем игру через 8 секунд
        setTimeout(() => {
            this.finishGame();
        }, 8000);
    }
    
    finishGame() {
        this.status = 'finished';
        this.lastActivity = new Date();
        
        console.log(`🏁 Игра ${this.id}: завершена! Победитель: ${this.winner.first_name}`);
        
        // Очищаем игру через 15 секунд
        setTimeout(() => {
            if (activeGames.has(this.id)) {
                activeGames.delete(this.id);
                console.log(`🗑️ Игра ${this.id}: удалена из памяти`);
            }
        }, 15000);
    }
    
    getGameState() {
        // Обновляем таймер если игра в режиме отсчета
        if (this.status === 'counting') {
            this.updateCountdown();
        }
        
        // Рассчитываем прогресс вращения
        let spinProgress = null;
        let spinDuration = null;
        if (this.status === 'spinning' && this.spinStartedAt) {
            const now = new Date();
            spinDuration = Math.floor((now - this.spinStartedAt) / 1000);
            spinProgress = Math.min(spinDuration / 5, 1); // 5 секунд на вращение
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
            spinDuration: spinDuration,
            maxParticipants: this.maxParticipants,
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
    
    getAllGames() {
        return Array.from(activeGames.values());
    },
    
    getGame(gameId) {
        return activeGames.get(gameId);
    },
    
    getActiveGame() {
        // Ищем активную игру
        for (const [id, game] of activeGames) {
            if (game.status === 'waiting' || game.status === 'counting') {
                // Проверяем не устарела ли игра
                const now = new Date();
                const timeSinceLastActivity = (now - game.lastActivity) / 1000;
                
                if (timeSinceLastActivity < 300) { // 5 минут
                    return game;
                }
            }
        }
        
        // Если нет активных игр, создаем новую
        return this.createGame();
    },
    
    cleanupOldGames() {
        const now = new Date();
        const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);
        const tenMinutesAgo = new Date(now - 10 * 60 * 1000);
        
        let cleaned = 0;
        for (const [id, game] of activeGames) {
            // Удаляем завершенные игры старше 10 минут
            if (game.status === 'finished' && game.lastActivity < tenMinutesAgo) {
                activeGames.delete(id);
                cleaned++;
            }
            // Удаляем неактивные игры старше 5 минут
            else if (game.lastActivity < fiveMinutesAgo) {
                activeGames.delete(id);
                cleaned++;
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
        }
    }
};

// Очистка старых игр каждые 2 минуты
setInterval(() => {
    gameManager.cleanupOldGames();
}, 2 * 60 * 1000);

// Логирование каждые 30 секунд для отладки
setInterval(() => {
    console.log(`📊 Статистика: ${activeGames.size} активных игр, ${userSessions.size} пользователей в сессии`);
}, 30000);

module.exports = {
    WheelGame,
    gameManager
};