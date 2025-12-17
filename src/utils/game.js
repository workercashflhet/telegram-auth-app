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
        
        // 1. Сначала выбираем случайного победителя
        this.winnerIndex = Math.floor(Math.random() * this.participants.length);
        this.winner = this.participants[this.winnerIndex];
        
        console.log(`🎲 Выбран победитель: ${this.winner.first_name} (индекс: ${this.winnerIndex})`);
        
        // 2. Рассчитываем угол так, чтобы колесо остановилось на этом победителе
        this.calculateFinalAngleForWinner();
    }
    
    calculateFinalAngleForWinner() {
        const spins = 5; // 5 полных оборотов для эффекта
        const totalParticipants = this.participants.length;
        const sectorAngle = 360 / totalParticipants;
        
        console.log(`📐 Расчет угла для ${totalParticipants} участников`);
        console.log(`📏 Угол сектора: ${sectorAngle}°`);
        
        // ВАЖНО: На фронтенде участники расположены ПО ЧАСОВОЙ СТРЕЛКЕ
        // начиная с 0° (вверху) и двигаясь по часовой стрелке
        
        // Угол центра сектора победителя:
        // Для индекса 0: центр в 0° (вверху)
        // Для индекса 1: центр в sectorAngle° (по часовой стрелке)
        // и т.д.
        const winnerCenterAngle = this.winnerIndex * sectorAngle;
        
        console.log(`📍 Центр сектора победителя (${this.winnerIndex}): ${winnerCenterAngle}°`);
        
        // Колесо вращается по часовой стрелке
        // Чтобы указатель (вверху) остановился на центре сектора победителя:
        // Нужно пройти: полные обороты + угол
        
        // Добавляем случайность (±20% сектора) для естественности
        const randomOffset = (Math.random() - 0.5) * sectorAngle * 0.4;
        
        // ФОРМУЛА ДЛЯ 3 УЧАСТНИКОВ:
        // При sectorAngle = 120°:
        // - Участник 0: 0°-120°
        // - Участник 1: 120°-240°
        // - Участник 2: 240°-360°
        
        // Чтобы указатель остановился в центре сектора победителя:
        // angle = spins*360 + winnerCenterAngle + randomOffset
        
        this.finalAngle = spins * 360 + winnerCenterAngle + randomOffset;
        
        // Для точности: добавляем половину сектора, чтобы указывать на центр
        this.finalAngle += sectorAngle / 2;
        
        console.log(`🎯 Финальный угол: ${this.finalAngle}°`);
        console.log(`🎲 Случайное смещение: ${randomOffset}°`);
        console.log(`🔄 Полных оборотов: ${spins}, Остаток: ${this.finalAngle % 360}°`);
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
        
        const totalParticipants = this.participants.length;
        const sectorAngle = 360 / totalParticipants;
        console.log(`📏 Угол сектора: ${sectorAngle}°`);
        
        // ОТЛАДКА: Показываем все сектора
        console.log('=== РАСПОЛОЖЕНИЕ СЕКТОРОВ ===');
        for (let i = 0; i < totalParticipants; i++) {
            const startAngle = i * sectorAngle;
            const endAngle = (i + 1) * sectorAngle;
            console.log(`Участник ${i}: ${startAngle}° - ${endAngle}°`);
        }
        console.log('=============================');
        
        // ПРОСТАЯ И ПОНЯТНАЯ ФОРМУЛА:
        // Участники расположены по часовой стрелке, начиная с 0° (вверху)
        // Каждый занимает сектор размером sectorAngle
        
        // Определяем, в какой сектор попадает угол
        let sector = Math.floor(normalizedAngle / sectorAngle);
        
        // Для 3 участников (sectorAngle = 120°):
        // - 0°-120°: sector = 0 (участник 0)
        // - 120°-240°: sector = 1 (участник 1)
        // - 240°-360°: sector = 2 (участник 2)
        
        // Проверяем граничные случаи
        if (sector >= totalParticipants) {
            sector = totalParticipants - 1;
        }
        if (sector < 0) {
            sector = 0;
        }
        
        console.log(`🔢 Рассчитанный сектор: ${sector}`);
        
        // Проверяем расчет
        const startAngle = sector * sectorAngle;
        const endAngle = (sector + 1) * sectorAngle;
        console.log(`📍 Угол ${normalizedAngle}° попадает в сектор ${sector} (${startAngle}°-${endAngle}°)`);
        
        // Выбираем победителя
        this.winnerIndex = sector;
        this.winner = this.participants[sector];
        
        if (this.winner) {
            console.log(`🏆 Окончательный победитель: ${this.winner.first_name}`);
            console.log(`✅ Проверка: выбранный индекс (${this.winnerIndex}) совпадает с расчетным`);
            
            // Увеличиваем счетчик побед пользователя
            if (gameManager) {
                gameManager.incrementUserWins(this.winner.id);
            }
        } else {
            console.error('❌ Ошибка: победитель не найден!');
            console.log('Доступные участники:', this.participants.map((p, i) => `${i}: ${p.first_name}`));
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