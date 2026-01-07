// src/utils/time-sync.js
class TimeSync {
    constructor() {
        this.offset = 0;
        this.latency = 0;
        this.lastSync = 0;
        this.isSyncing = false;
        this.syncHistory = [];
    }
    
    async sync() {
        if (this.isSyncing) return;
        
        this.isSyncing = true;
        try {
            const samples = [];
            
            // Берем 3 образца для точности
            for (let i = 0; i < 3; i++) {
                const start = performance.now();
                const response = await fetch('/api/sync/time');
                const end = performance.now();
                
                if (response.ok) {
                    const data = await response.json();
                    const rtt = end - start;
                    const serverTime = data.serverTime;
                    
                    // Рассчитываем смещение
                    const clientTimeAtRequest = start;
                    const estimatedServerTimeAtReceive = serverTime + (rtt / 2);
                    const offset = estimatedServerTimeAtReceive - clientTimeAtRequest;
                    
                    samples.push({
                        offset,
                        rtt,
                        timestamp: Date.now()
                    });
                }
                
                // Ждем немного между запросами
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            // Усредняем лучшие образцы (игнорируем выбросы)
            if (samples.length > 0) {
                samples.sort((a, b) => a.rtt - b.rtt);
                const bestSamples = samples.slice(0, Math.min(3, samples.length));
                
                const avgOffset = bestSamples.reduce((sum, s) => sum + s.offset, 0) / bestSamples.length;
                const avgRtt = bestSamples.reduce((sum, s) => sum + s.rtt, 0) / bestSamples.length;
                
                this.offset = avgOffset;
                this.latency = avgRtt;
                this.lastSync = Date.now();
                
                console.log(`🕐 Синхронизация: offset=${Math.round(avgOffset)}ms, latency=${Math.round(avgRtt)}ms`);
            }
            
        } catch (error) {
            console.warn('⚠️ Ошибка синхронизации времени:', error);
        } finally {
            this.isSyncing = false;
        }
    }
    
    getServerTime() {
        const now = Date.now();
        const timeSinceSync = now - this.lastSync;
        
        // Учитываем дрейф времени (примерно 1ms в секунду)
        const drift = timeSinceSync * 0.001;
        
        return now + this.offset + drift;
    }
    
    // Проверка синхронизации
    isSynced() {
        return this.lastSync > 0 && (Date.now() - this.lastSync) < 30000; // 30 секунд
    }
}

// Синглтон
const timeSync = new TimeSync();
module.exports = timeSync;