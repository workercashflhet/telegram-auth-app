
// src/utils/game.js - Исправленная версия
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

        // Добавьте точное время начала событий
        this.countdownStartServerTime = null;
        this.spinStartServerTime = null;
        this.nextRoundStartTime = null;
        this.spinEndServerTime = null;
        this.winnerRevealTime = null;
        
        // Добавьте синхронизационные метки
        this.eventTimestamps = {
            gameCreated: Date.now(),
            lastSync: Date.now()
        };
        
        // Индекс текущего состояния (для проверки рассинхронизации)
        this.stateVersion = 0;
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
        this.countdown = 30;
        this.countdownStartTime = new Date();
        this.countdownStartServerTime = Date.now(); // Точное серверное время
        this.lastActivity = new Date();
        this.stateVersion++;
        
        console.log(`⏳ Игра ${this.id}: запущен 30-секундный таймер, serverTime: ${this.countdownStartServerTime}`);
    }
    
    updateGameState(serverTime = Date.now()) {
        const now = serverTime;
        this.lastActivity = new Date(now);
        
        // Обновляем таймер если игра в режиме отсчета
        if (this.status === 'counting' && this.countdownStartServerTime) {
            const secondsPassed = Math.floor((now - this.countdownStartServerTime) / 1000);
            this.countdown = Math.max(0, 30 - secondsPassed);
            
            // Если таймер истек - запускаем вращение
            if (this.countdown <= 0 && this.status === 'counting') {
                console.log(`⏰ Таймер истек, запускаем вращение колеса!`);
                this.startSpinning();
            }
        }
        
        // Если игра в состоянии вращения
        if (this.status === 'spinning' && this.spinStartServerTime) {
            const spinProgress = Math.min((now - this.spinStartServerTime) / 5000, 1);
            
            // Автоматически завершаем вращение через 5 секунд
            if (now >= this.spinEndServerTime && !this.winnerAnnounced) {
                console.log(`🏁 Вращение завершено, показываем победителя`);
                this.winnerAnnounced = true;
            }
            
            // Через 8 секунд после начала вращения завершаем игру
            if (now >= this.spinStartServerTime + 8000 && this.status === 'spinning') {
                this.finishGame();
            }
        }
        
        // Если игра завершена - обновляем таймер следующего раунда
        if (this.status === 'finished' && this.nextRoundStartTime) {
            const timeUntilNextRound = Math.max(0, this.nextRoundStartTime - now);
            this.nextRoundTimer = Math.ceil(timeUntilNextRound / 1000);
            
            // Если время пришло - сбрасываем игру
            if (timeUntilNextRound <= 0) {
                this.resetForNextRound();
            }
        }
    }
    
    startSpinning() {
        if (this.participants.length < 2) {
            console.log(`❌ Недостаточно участников для вращения: ${this.participants.length}`);
            this.status = 'waiting';
            this.countdown = null;
            this.countdownStartTime = null;
            this.countdownStartServerTime = null;
            return;
        }
        
        console.log(`🎰 Начинаем вращение колеса с ${this.participants.length} участниками`);
        
        this.status = 'spinning';
        this.spinStartedAt = new Date();
        this.spinStartServerTime = Date.now(); // Точное серверное время
        this.lastActivity = new Date();
        this.stateVersion++;
        
        // Выбираем победителя ДО рассчета угла
        this.winnerIndex = Math.floor(Math.random() * this.participants.length);
        this.winner = this.participants[this.winnerIndex];
        
        console.log(`🎲 Выбран победитель: ${this.winner.first_name} (индекс: ${this.winnerIndex})`);
        
        // Рассчитываем угол для этого победителя
        this.calculateFinalAngleForWinner();
        
        // Рассчитываем время окончания вращения
        this.spinEndServerTime = this.spinStartServerTime + 5000; // 5 секунд вращения
        this.winnerRevealTime = this.spinStartServerTime + 5000; // Через 5 сек показываем
        this.nextRoundStartTime = this.spinStartServerTime + 13000; // Через 13 сек новый раунд
    }
    
    // ИСПРАВЛЕННЫЙ метод расчета угла
    calculateFinalAngleForWinner() {
        const spins = 5; // 5 полных оборотов для эффекта
        const totalParticipants = this.participants.length;
        const sectorAngle = 360 / totalParticipants;
        
        console.log(`📐 Расчет угла для ${totalParticipants} участников`);
        console.log(`📏 Угол сектора: ${sectorAngle}°`);
        console.log(`🏆 Победитель: ${this.winner.first_name} (индекс: ${this.winnerIndex})`);
        
        // ВАЖНО: Фронтенд размещает участников по часовой стрелке, начиная с 0° вверху
        // Участник 0 находится в секторе 0°-sectorAngle°
        // Участник 1 находится в секторе sectorAngle°-2*sectorAngle°
        // и т.д.
        
        // Стрелка находится вверху (0°)
        // После вращения на угол X, стрелка укажет на участника,
        // чей сектор начинается с угла (360 - X) % 360
        
        // Мы хотим, чтобы стрелка указывала на победителя this.winnerIndex
        // Центр сектора победителя: (this.winnerIndex + 0.5) * sectorAngle
        
        // Но стрелка должна указывать на начало сектора + небольшой отступ
        const targetAngle = this.winnerIndex * sectorAngle + (sectorAngle * 0.1); // 10% от сектора
        
        // Угол, который должен оказаться вверху после вращения
        const angleForPointer = targetAngle;
        
        // Чтобы получить этот угол вверху, нужно повернуть колесо на:
        // (360 - angleForPointer) + полные обороты
        const randomOffset = (Math.random() - 0.3) * sectorAngle * 0.4; // ±20% сектора
        
        this.finalAngle = spins * 360 + (360 - angleForPointer) + randomOffset;
        
        console.log(`🎯 Финальный угол: ${this.finalAngle}°`);
        console.log(`📊 Расчет: ${spins}×360 + (360 - ${angleForPointer}) + ${randomOffset.toFixed(2)}`);
        console.log(`🔄 Нормализованный: ${this.finalAngle % 360}°`);
        
        // ДОПОЛНИТЕЛЬНО: Проверяем расчет
        this.verifyWinnerCalculation();
    }

    // Метод для проверки расчета
    verifyWinnerCalculation() {
        if (!this.finalAngle || !this.winnerIndex || this.participants.length === 0) return;
        
        const normalizedAngle = this.finalAngle % 360;
        const sectorAngle = 360 / this.participants.length;
        
        // Какой участник окажется под стрелкой (0°) после вращения?
        // Если колесо повернуто на угол X, то вверху окажется угол (360 - X) % 360
        const angleAtTop = (360 - normalizedAngle) % 360;
        const sectorAtTop = Math.floor(angleAtTop / sectorAngle);
        
        console.log(`🔍 ПРОВЕРКА: После вращения на ${normalizedAngle}°`);
        console.log(`📍 Вверху (0°) окажется угол: ${angleAtTop}°`);
        console.log(`🎯 Это сектор: ${sectorAtTop}`);
        console.log(`✅ Должен быть: ${this.winnerIndex}`);
        console.log(`📝 Совпадение: ${sectorAtTop === this.winnerIndex ? '✅' : '❌'}`);
        
        // Если не совпадает - корректируем
        if (sectorAtTop !== this.winnerIndex) {
            console.log(`⚠️ Несоответствие! Корректируем угол...`);
            // Корректируем угол чтобы попасть в нужный сектор
            const correctAngleForWinner = this.winnerIndex * sectorAngle + (sectorAngle * 0.1);
            const spins = Math.floor(this.finalAngle / 360);
            this.finalAngle = spins * 360 + (360 - correctAngleForWinner);
            console.log(`🔄 Исправленный угол: ${this.finalAngle}°`);
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
        this.spinStartServerTime = null;
        this.spinEndServerTime = null;
        this.nextRoundStartTime = null;
        this.winnerRevealTime = null;
        
        console.log(`👥 Все участники удалены, начинаем новый раунд с чистого листа`);
        
        this.lastActivity = new Date();
        this.stateVersion++;
    }
    
    getGameState(clientTime = null) {
        const serverTime = Date.now();
        
        // Обновляем состояние игры с учетом текущего серверного времени
        this.updateGameState(serverTime);
        
        // Рассчитываем клиентские таймеры
        let timeUntilCountdownEnd = null;
        let timeUntilSpinEnd = null;
        let spinProgress = null;
        
        if (this.status === 'counting' && this.countdownStartServerTime) {
            timeUntilCountdownEnd = Math.max(0, (this.countdownStartServerTime + 30000) - serverTime);
        }
        
        if (this.status === 'spinning' && this.spinStartServerTime) {
            const elapsed = serverTime - this.spinStartServerTime;
            spinProgress = Math.min(elapsed / 5000, 1);
            timeUntilSpinEnd = Math.max(0, 5000 - elapsed);
        }
        
        // Рассчитываем время до событий для клиента
        const now = clientTime || serverTime;
        let clientCountdown = null;
        if (this.countdownStartServerTime && this.status === 'counting') {
            const serverElapsed = serverTime - this.countdownStartServerTime;
            clientCountdown = Math.max(0, 30 - Math.floor(serverElapsed / 1000));
        }
        
        return {
            id: this.id,
            participants: this.participants,
            status: this.status,
            countdown: clientCountdown,
            winner: this.winner,
            winnerIndex: this.winnerIndex,
            finalAngle: this.finalAngle,
            spinStartedAt: this.spinStartedAt,
            gameEndsAt: this.spinStartServerTime ? this.spinStartServerTime + 13000 : null,
            nextRoundTimer: this.nextRoundTimer,
            
            // Синхронизационные данные
            syncData: {
                serverTime: serverTime,
                clientTime: now,
                countdownStart: this.countdownStartServerTime,
                spinStart: this.spinStartServerTime,
                spinEnd: this.spinEndServerTime,
                nextRoundStart: this.nextRoundStartTime,
                timeUntilCountdownEnd: timeUntilCountdownEnd,
                timeUntilSpinEnd: timeUntilSpinEnd,
                spinProgress: spinProgress,
                stateVersion: this.stateVersion
            },
            
            canJoin: this.status === 'waiting' || this.status === 'counting',
            lastActivity: this.lastActivity
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
