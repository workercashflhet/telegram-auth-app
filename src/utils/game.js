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
        
        // Сначала выбираем случайного победителя
        const winnerIndex = Math.floor(Math.random() * this.participants.length);
        const winner = this.participants[winnerIndex];
        
        console.log(`🎲 Выбран случайный победитель: ${winner.first_name} (индекс: ${winnerIndex})`);
        
        // Теперь рассчитываем угол так, чтобы колесо остановилось на этом победителе
        const spins = 5; // 5 полных оборотов для эффекта
        const sectorAngle = 360 / this.participants.length;
        
        // КОРРЕКТНЫЙ РАСЧЕТ УГЛА:
        // Участники расположены против часовой стрелки на колесе
        // Колесо вращается по часовой стрелке
        // Указатель находится вверху (0°)
        
        // Центр сектора победителя:
        // 0° = первый участник, далее против часовой стрелки
        const winnerCenterAngle = winnerIndex * sectorAngle;
        
        // Чтобы указатель остановился на этом секторе при вращении по часовой стрелке:
        // Нужно пройти полные обороты + (360 - угол сектора победителя)
        const angleToWinner = 360 - winnerCenterAngle;
        
        // Добавляем случайность (±25% сектора) для реалистичности
        const randomOffset = (Math.random() - 0.5) * sectorAngle * 0.5;
        
        // Итоговый угол: полные обороты + угол до победителя + случайность
        this.finalAngle = spins * 360 + angleToWinner + randomOffset - (sectorAngle / 2);
        
        // Сохраняем победителя
        this.winner = winner;
        this.winnerIndex = winnerIndex;
        
        console.log(`📐 Рассчитан финальный угол: ${this.finalAngle}°`);
        console.log(`📏 Параметры: обороты=${spins}, угол до победителя=${angleToWinner}°, смещение=${randomOffset}°`);
        console.log(`📍 Центр сектора победителя: ${winnerCenterAngle}°, размер сектора: ${sectorAngle}°`);
    }
    
    determineWinner() {
        if (!this.finalAngle || this.participants.length === 0) {
            console.warn('Не могу определить победителя: нет угла или участников');
            return;
        }
        
        console.log(`🎯 Определяем победителя по углу ${this.finalAngle}°`);
        console.log(`👥 Участников: ${this.participants.length}`);
        
        // Нормализуем угол (убираем полные обороты)
        const normalizedAngle = this.finalAngle % 360;
        console.log(`📐 Нормализованный угол: ${normalizedAngle}°`);
        
        // Участники расположены равномерно по кругу
        const sectorAngle = 360 / this.participants.length;
        console.log(`📏 Угол сектора: ${sectorAngle}°`);
        
        // Определяем сектор (от 0 до participants.length-1)
        // Учитываем что указатель вверху (0°), а вращение по часовой стрелке
        // И участники расположены против часовой стрелки на колесе
        
        let sector = Math.floor(normalizedAngle / sectorAngle);
        console.log(`🔢 Рассчитанный сектор (до инверсии): ${sector}`);
        
        // КОРРЕКТНАЯ ФОРМУЛА ДЛЯ КОЛЕСА:
        // 1. Инвертируем направление (колесо вращается по часовой стрелке, но участники расположены против часовой)
        // 2. Смещаем на половину сектора для указания на центр сектора
        
        // Правильный расчет:
        // Угол 0° указывает вверх, это начало первого сектора
        // При вращении по часовой стрелке угол увеличивается
        sector = Math.floor((360 - normalizedAngle) / sectorAngle) % this.participants.length;
        
        // Корректировка для точного определения
        if (sector < 0) sector += this.participants.length;
        if (sector >= this.participants.length) sector = 0;
        
        console.log(`🎯 Окончательный сектор: ${sector}`);
        
        // Выбираем победителя
        this.winnerIndex = sector;
        this.winner = this.participants[sector];
        
        if (this.winner) {
            console.log(`🏆 Определен победитель: ${this.winner.first_name} (ID: ${this.winner.id})`);
            console.log(`📍 Индекс: ${sector}, Угол: ${normalizedAngle}°, Сектор: ${sectorAngle}°`);
            
            // Увеличиваем счетчик побед пользователя
            if (gameManager) {
                gameManager.incrementUserWins(this.winner.id);
            }
        } else {
            console.error('❌ Ошибка: победитель не найден!');
            console.log('Доступные участники:', this.participants.map(p => p.first_name));
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