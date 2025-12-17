// src/utils/game.js - Логика игры
const activeGames = new Map();

class WheelGame {
    constructor(gameId) {
        this.id = gameId;
        this.participants = [];
        this.status = 'waiting'; // waiting, counting, spinning, finished
        this.countdown = 30;
        this.timer = null;
        this.winner = null;
        this.createdAt = new Date();
        this.maxParticipants = 8;
    }
    
    addParticipant(user) {
        if (this.status !== 'waiting' && this.status !== 'counting') {
            return false;
        }
        
        if (this.participants.length >= this.maxParticipants) {
            return false;
        }
        
        // Проверяем, не участвует ли уже
        if (this.participants.some(p => p.id === user.id)) {
            return false;
        }
        
        this.participants.push(user);
        
        // Автоматически запускаем отсчет если участников > 1
        if (this.participants.length > 1 && this.status === 'waiting') {
            this.startCountdown();
        }
        
        return true;
    }
    
    removeParticipant(userId) {
        this.participants = this.participants.filter(p => p.id !== userId);
        
        // Останавливаем отсчет если участников < 2
        if (this.participants.length < 2 && this.status === 'counting') {
            this.stopCountdown();
        }
    }
    
    startCountdown() {
        if (this.status !== 'waiting' || this.participants.length < 2) {
            return;
        }
        
        this.status = 'counting';
        this.countdown = 30;
        
        // Здесь можно добавить WebSocket или интервал для обновления клиентов
    }
    
    stopCountdown() {
        if (this.status === 'counting') {
            this.status = 'waiting';
        }
    }
    
    spinWheel() {
        if (this.status !== 'counting' || this.countdown > 0) {
            return null;
        }
        
        this.status = 'spinning';
        
        // Выбираем случайного победителя
        const winnerIndex = Math.floor(Math.random() * this.participants.length);
        this.winner = this.participants[winnerIndex];
        
        setTimeout(() => {
            this.finishGame();
        }, 5000);
        
        return this.winner;
    }
    
    finishGame() {
        this.status = 'finished';
        
        // Очищаем через 10 секунд
        setTimeout(() => {
            if (activeGames.has(this.id)) {
                activeGames.delete(this.id);
            }
        }, 10000);
    }
    
    getGameState() {
        return {
            id: this.id,
            participants: this.participants,
            status: this.status,
            countdown: this.countdown,
            winner: this.winner,
            maxParticipants: this.maxParticipants
        };
    }
}

// Управление играми
const gameManager = {
    createGame() {
        const gameId = 'game_' + Date.now();
        const game = new WheelGame(gameId);
        activeGames.set(gameId, game);
        return game;
    },
    
    getGame(gameId) {
        return activeGames.get(gameId);
    },
    
    getAllGames() {
        return Array.from(activeGames.values());
    },
    
    getActiveGame() {
        // Для демо возвращаем первую активную игру
        const games = this.getAllGames();
        return games.length > 0 ? games[0] : this.createGame();
    }
};

module.exports = {
    WheelGame,
    gameManager
};