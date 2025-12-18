class GamePersistence {
    constructor() {
        this.games = new Map();
        this.autoSaveInterval = null;
    }
    
    saveGame(game) {
        if (!game || !game.id) return false;
        
        const snapshot = {
            id: game.id,
            participants: game.participants.map(p => ({
                id: p.id,
                first_name: p.first_name,
                joinedAt: p.joinedAt
            })),
            status: game.status,
            countdown: game.countdown,
            countdownStartTime: game.countdownStartTime,
            winner: game.winner,
            winnerIndex: game.winnerIndex,
            createdAt: game.createdAt,
            lastActivity: game.lastActivity,
            snapshotTime: new Date()
        };
        
        this.games.set(game.id, snapshot);
        console.log(`💾 Сохранен снимок игры ${game.id}: ${snapshot.participants.length} участников`);
        return true;
    }
    
    loadGame(gameId) {
        return this.games.get(gameId);
    }
    
    startAutoSave(gameManager, interval = 30000) { // Каждые 30 секунд
        this.autoSaveInterval = setInterval(() => {
            const game = gameManager.getActiveGame();
            if (game) {
                this.saveGame(game);
            }
        }, interval);
    }
    
    stopAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
    }
}

// Экспорт синглтона
const gamePersistence = new GamePersistence();
module.exports = gamePersistence;