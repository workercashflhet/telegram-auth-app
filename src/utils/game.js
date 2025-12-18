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
        this.maxParticipants = 12; // Больше участников
    }
    
    addParticipant(user) {
        console.log(`👤 Пытаемся добавить пользователя ${user.first_name} в рулетку`);
        
        // Проверяем статус игры
        if (this.status === 'spinning' || this.status === 'finished') {
            return { success: false, error: 'Игра уже началась' };
        }
        
        // Проверяем лимит участников
        if (this.participants.length >= this.maxParticipants) {
            return { success: false, error: 'Достигнут лимит участников' };
        }
        
        // Проверяем, не участвует ли уже
        if (this.participants.some(p => p.id === user.id)) {
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
        
        console.log(`⏳ Рулетка ${this.id}: запущен 30-секундный таймер`);
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
                this.startSpinning();
            }
        }
        
        // Если игра в состоянии вращения
        if (this.status === 'spinning' && this.spinStartedAt) {
            const spinDuration = Math.floor((now - this.spinStartedAt) / 1000);
            
            // Вращение длится 5 секунд
            if (spinDuration >= 5 && !this.winnerAnnounced) {
                this.winnerAnnounced = true;
            }
            
            // Через 8 секунд после начала вращения завершаем игру
            if (spinDuration >= 8) {
                this.finishGame();
            }
        }
        
        // Если игра завершена
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
            console.log(`❌ Недостаточно участников: ${this.participants.length}`);
            this.status = 'waiting';
            this.countdown = null;
            this.countdownStartTime = null;
            return;
        }
        
        console.log(`🎰 Начинаем вращение рулетки с ${this.participants.length} участниками`);
        
        this.status = 'spinning';
        this.spinStartedAt = new Date();
        this.lastActivity = new Date();
        this.winnerAnnounced = false;
        
        // Выбираем случайного победителя
        this.winnerIndex = Math.floor(Math.random() * this.participants.length);
        this.winner = this.participants[this.winnerIndex];
        
        // Рассчитываем угол так, чтобы стрелка указала на победителя
        this.calculateFinalAngleForWinner();
        
        console.log(`🎲 Выбран победитель: ${this.winner.first_name} (индекс: ${this.winnerIndex})`);
        console.log(`🎯 Финальный угол: ${this.finalAngle}°`);
    }
    
    calculateFinalAngleForWinner() {
        const spins = 5; // 5 полных оборотов для эффекта
        const totalParticipants = this.participants.length;
        const sectorAngle = 360 / totalParticipants;
        
        // Центр сектора победителя (в градусах)
        const winnerCenterAngle = this.winnerIndex * sectorAngle + (sectorAngle / 2);
        
        // Чтобы стрелка (0°) остановилась на центре сектора победителя,
        // нужно сделать так, чтобы этот сектор оказался вверху
        const angleToTop = winnerCenterAngle;
        
        // Добавляем случайное смещение (±20% сектора)
        const randomOffset = (Math.random() - 0.5) * sectorAngle * 0.4;
        
        // Рассчитываем финальный угол
        // spins * 360 - полные обороты
        // + (360 - angleToTop) - чтобы сектор победителя оказался вверху
        // + randomOffset - случайное смещение
        this.finalAngle = spins * 360 + (360 - angleToTop) + randomOffset;
        
        // Нормализуем угол
        const normalizedAngle = this.finalAngle % 360;
        
        console.log(`📐 Угол сектора: ${sectorAngle}°`);
        console.log(`📍 Центр сектора победителя: ${winnerCenterAngle}°`);
        console.log(`🔄 Нормализованный угол: ${normalizedAngle}°`);
    }

    // Добавьте метод для проверки
    verifyWinnerCalculation() {
        if (!this.finalAngle || !this.winnerIndex || this.participants.length === 0) return;
        
        const normalizedAngle = this.finalAngle % 360;
        const sectorAngle = 360 / this.participants.length;
        
        // Какой участник окажется вверху (0°) после вращения?
        // Если колесо повернуто на угол X, то вверху окажется участник,
        // чей сектор начинается с угла (360 - X) % 360
        
        const angleAtTop = (360 - normalizedAngle) % 360;
        const winnerAtTop = Math.floor(angleAtTop / sectorAngle);
        
        console.log(`🔍 ПРОВЕРКА: После вращения на ${normalizedAngle}°`);
        console.log(`📍 Вверху (0°) окажется угол: ${angleAtTop}°`);
        console.log(`🎯 Это сектор: ${winnerAtTop}`);
        console.log(`✅ Должен быть: ${this.winnerIndex}`);
        console.log(`📝 Совпадение: ${winnerAtTop === this.winnerIndex ? '✅' : '❌'}`);
    }

    determineWinner() {
        if (!this.finalAngle || this.participants.length === 0) {
            console.warn('Не могу определить победителя: нет угла или участников');
            return;
        }
        
        console.log(`🎯 Определяем победителя по углу ${this.finalAngle}°`);
        console.log(`👥 Участников: ${this.participants.length}`);
        
        // Нормализуем угол
        const normalizedAngle = this.finalAngle % 360;
        const sectorAngle = 360 / this.participants.length;
        
        console.log(`📐 Нормализованный угол: ${normalizedAngle}°`);
        console.log(`📏 Угол сектора: ${sectorAngle}°`);
        
        // КЛЮЧЕВОЙ МОМЕНТ:
        // После вращения колеса на угол X, стрелка (0°) указывает на участника,
        // чей сектор находится в позиции (360 - X) % 360
        
        const pointerAngle = (360 - normalizedAngle) % 360;
        console.log(`📍 Угол под стрелкой: ${pointerAngle}°`);
        
        // Определяем сектор под стрелкой
        let sector = Math.floor(pointerAngle / sectorAngle);
        
        // Проверяем граничные случаи
        if (sector >= this.participants.length) {
            sector = this.participants.length - 1;
        }
        if (sector < 0) {
            sector = 0;
        }
        
        console.log(`🔢 Сектор под стрелкой: ${sector}`);
        
        // Визуализация для отладки
        console.log('=== РАСПРЕДЕЛЕНИЕ СЕКТОРОВ ===');
        for (let i = 0; i < this.participants.length; i++) {
            const startAngle = i * sectorAngle;
            const endAngle = (i + 1) * sectorAngle;
            const isWinner = i === sector;
            console.log(`Сектор ${i} (${this.participants[i].first_name}): ${startAngle}°-${endAngle}° ${isWinner ? '← СТРЕЛКА!' : ''}`);
        }
        
        // Выбираем победителя
        this.winnerIndex = sector;
        this.winner = this.participants[sector];
        
        if (this.winner) {
            console.log(`🏆 ПОБЕДИТЕЛЬ: ${this.winner.first_name}`);
            
            if (gameManager) {
                gameManager.incrementUserWins(this.winner.id);
            }
        }
    }

    finishGame() {
        if (this.status !== 'spinning') return;
        
        console.log(`🏁 Игра завершена! Победитель: ${this.winner?.first_name}`);
        
        this.status = 'finished';
        this.lastActivity = new Date();
        
        // Через 8 секунд сбрасываем и начинаем новый раунд
        setTimeout(() => {
            this.resetForNextRound();
        }, 8000);
    }
    
    resetForNextRound() {
        console.log(`🔄 Начинаем новый раунд рулетки`);
        
        // Сбрасываем состояние
        this.status = 'waiting';
        this.countdown = null;
        this.countdownStartTime = null;
        this.winner = null;
        this.winnerIndex = null;
        this.finalAngle = null;
        this.spinStartedAt = null;
        this.winnerAnnounced = false;
        this.nextRoundTimer = null;
        
        // НЕ ОЧИЩАЕМ участников - они остаются для следующего раунда
        // this.participants = [];
        
        this.lastActivity = new Date();
    }
    
    getGameState() {
        // Обновляем состояние игры
        this.updateGameState();
        
        return {
            id: this.id,
            participants: this.participants,
            status: this.status,
            countdown: this.countdown,
            winner: this.winner,
            winnerIndex: this.winnerIndex,
            finalAngle: this.finalAngle,
            spinStartedAt: this.spinStartedAt,
            nextRoundTimer: this.nextRoundTimer,
            lastActivity: this.lastActivity,
            canJoin: (this.status === 'waiting' || this.status === 'counting') && 
                     this.participants.length < this.maxParticipants
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