class SyncManager {
    constructor() {
        this.offsets = [];
        this.maxSamples = 10;
        this.correctionFactor = 0.1;
        this.isCalibrated = false;
    }
    
    async calibrate() {
        const samples = [];
        
        for (let i = 0; i < 5; i++) {
            try {
                const start = performance.now();
                const response = await fetch('/api/sync/time');
                const end = performance.now();
                
                if (response.ok) {
                    const data = await response.json();
                    const rtt = end - start;
                    const offset = data.serverTime - (start + rtt / 2);
                    
                    samples.push({
                        offset,
                        rtt,
                        timestamp: Date.now()
                    });
                }
            } catch (error) {
                console.warn('Calibration error:', error);
            }
            
            // Пауза между измерениями
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Фильтруем выбросы
        const validSamples = this.filterOutliers(samples);
        const avgOffset = validSamples.reduce((sum, s) => sum + s.offset, 0) / validSamples.length;
        const avgRtt = validSamples.reduce((sum, s) => sum + s.rtt, 0) / validSamples.length;
        
        this.baseOffset = avgOffset;
        this.baseRtt = avgRtt;
        this.isCalibrated = true;
        
        console.log(`🎯 Калибровка завершена: offset=${Math.round(avgOffset)}ms, RTT=${Math.round(avgRtt)}ms`);
        
        return { offset: avgOffset, rtt: avgRtt };
    }
    
    filterOutliers(samples) {
        if (samples.length < 3) return samples;
        
        const offsets = samples.map(s => s.offset);
        const mean = offsets.reduce((a, b) => a + b) / offsets.length;
        const stdDev = Math.sqrt(
            offsets.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / offsets.length
        );
        
        return samples.filter(s => {
            return Math.abs(s.offset - mean) <= stdDev * 2;
        });
    }
    
    getSyncedTime() {
        if (!this.isCalibrated) return Date.now();
        
        const now = Date.now();
        const drift = (now - this.lastCalibration) * 0.001; // Предполагаемый дрейф
        return now + this.baseOffset + drift;
    }
    
    // Интерполяция для плавной коррекции
    interpolateTime(clientTime, serverTime, alpha = 0.1) {
        const target = serverTime;
        const current = clientTime;
        return current * (1 - alpha) + target * alpha;
    }
}

// Экспорт синглтона
let syncManagerInstance = null;
export function getSyncManager() {
    if (!syncManagerInstance) {
        syncManagerInstance = new SyncManager();
    }
    return syncManagerInstance;
}