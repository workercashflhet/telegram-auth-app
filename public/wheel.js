// public/wheel.js - Исправленная версия
class FortuneWheel {
    constructor() {
        this.participants = [];
        this.isSpinning = false;
        this.countdown = null;
        this.winner = null;
        this.finalAngle = null;
        this.wheelElement = null;
        this.spinStartTime = null;
        this.winnerAnnounced = false;
        this.nextRoundTimer = null;
        this.lastGameState = null;
        
        this.init();
    }
    
    async init() {
        this.wheelElement = document.getElementById('fortuneWheel');
        this.setupEventListeners();
        
        // Загружаем начальное состояние
        await this.loadGameState();
        
        // Автообновление каждую секунду
        setInterval(() => {
            this.loadGameState();
        }, 1000);
        
        // Анимация колеса каждые 50ms
        setInterval(() => {
            this.updateWheelAnimation();
        }, 50);
        
        console.log('✅ Колесо фортуны инициализировано');
    }

    // Синхронизация времени с сервером
    async syncTimeWithServer() {
        try {
            const startTime = Date.now();
            const response = await fetch('/api/sync');
            const endTime = Date.now();
            const roundTrip = endTime - startTime;
            
            if (response.ok) {
                const data = await response.json();
                const serverTime = data.serverTime;
                const estimatedOneWay = roundTrip / 2;
                
                // Рассчитываем разницу между клиентом и сервером
                this.clientTimeOffset = serverTime - (startTime + estimatedOneWay);
                this.lastServerTime = serverTime;
                
                console.log(`🕐 Синхронизация времени: offset=${this.clientTimeOffset}ms, RTT=${roundTrip}ms`);
            }
        } catch (error) {
            console.warn('⚠️ Не удалось синхронизировать время с сервером');
        }
    }

    getCurrentServerTime() {
        return Date.now() + (this.clientTimeOffset || 0);
    }
    
    setupSpinSync() {
        // Синхронизация каждые 100ms во время вращения
        this.syncInterval = setInterval(() => {
            if (this.isSpinning && this.spinStartTime && this.finalAngle) {
                this.updateWheelPosition();
            }
        }, 100);
    }

    updateWheelPosition() {
        if (!this.spinStartTime || !this.finalAngle) return;
        
        const now = this.getCurrentServerTime();
        const elapsed = now - this.spinStartTime;
        const totalTime = 5000; // 5 секунд вращения
        
        if (elapsed < 0 || elapsed > totalTime + 1000) {
            return; // Вращение еще не началось или уже давно закончилось
        }
        
        // Плавная кривая замедления
        let progress = elapsed / totalTime;
        progress = Math.min(progress, 1);
        
        // Кривая замедления (ease-out)
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        // Текущий угол
        const currentAngle = easeProgress * this.finalAngle;
        
        // Плавное обновление позиции
        this.wheelElement.style.transition = 'transform 0.1s linear';
        this.wheelElement.style.transform = `rotate(${currentAngle}deg)`;
        
        // Если вращение завершено
        if (progress >= 1 && !this.winnerAnnounced && this.winner) {
            this.showWinner(this.winner);
            this.winnerAnnounced = true;
        }
    }
    
    setupAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
        
        // Обновляем состояние каждую секунду
        this.autoRefreshInterval = setInterval(async () => {
            await this.loadGameState();
        }, 1000);
    }
    
    async loadGameState() {
        try {
            const response = await fetch('/api/game/state');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            
            if (data.success && data.game) {
                // Сохраняем предыдущее состояние для сравнения
                const prevState = this.lastGameState;
                this.lastGameState = data.game;
                
                // Проверяем сброс участников (новый раунд)
                const participantsReset = prevState && 
                    prevState.participants.length > 0 && 
                    data.game.participants.length === 0;
                
                if (participantsReset) {
                    console.log('🔄 Обнаружен сброс участников - новый раунд');
                    this.resetForNextRound();
                }
                
                // Обновляем данные
                this.participants = data.game.participants || [];
                this.countdown = data.game.countdown;
                this.winner = data.game.winner;
                this.finalAngle = data.game.finalAngle;
                this.nextRoundTimer = data.game.nextRoundTimer;
                
                const wasSpinning = this.isSpinning;
                this.isSpinning = data.game.status === 'spinning';
                
                // Обработка начала вращения
                if (this.isSpinning && !wasSpinning && data.game.spinStartedAt) {
                    console.log('🎰 Начинаем вращение колеса!');
                    this.startSpinAnimation(data.game.spinStartedAt);
                }
                
                // Обработка завершения игры
                if (data.game.status === 'finished' && this.winner && !this.winnerAnnounced) {
                    console.log(`🏆 Победитель: ${this.winner.first_name}`);
                    this.showWinner(this.winner);
                    this.winnerAnnounced = true;
                }
                
                // Обновляем UI
                this.updateUI();
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки состояния игры:', error);
        }
    }

    startSpinAnimation(spinStartedAt) {
        if (!this.finalAngle) return;
        
        this.spinStartTime = new Date(spinStartedAt).getTime();
        this.winnerAnnounced = false;
        this.hideWinner();
        
        console.log(`🌀 Запуск анимации: угол=${this.finalAngle}°, время начала=${this.spinStartTime}`);
    }
    
    updateWheelAnimation() {
        if (!this.isSpinning || !this.spinStartTime || !this.finalAngle) {
            return;
        }
        
        const now = Date.now();
        const elapsed = now - this.spinStartTime;
        const spinDuration = 5000; // 5 секунд вращения
        
        if (elapsed < 0) return; // Еще не началось
        
        if (elapsed > spinDuration + 3000) {
            // Вращение давно закончилось
            this.isSpinning = false;
            return;
        }
        
        // Плавная кривая замедления
        let progress = Math.min(elapsed / spinDuration, 1);
        
        // Кривая ease-out (замедление в конце)
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        // Текущий угол
        const currentAngle = easeProgress * this.finalAngle;
        
        // Плавное обновление позиции
        this.wheelElement.style.transition = 'transform 0.05s linear';
        this.wheelElement.style.transform = `rotate(${currentAngle}deg)`;
        
        // Если вращение завершено и есть победитель - показываем его
        if (progress >= 1 && this.winner && !this.winnerAnnounced) {
            setTimeout(() => {
                this.showWinner(this.winner);
                this.winnerAnnounced = true;
            }, 500);
        }
    }
    
    updateUI() {
        this.updateTimer();
        this.updateWheel();
        this.updateButtons();
        this.renderParticipants();
    }
    
    updateTimer() {
        const timerElement = document.getElementById('gameTimer');
        const timerLabel = document.getElementById('timerLabel');
        
        if (!timerElement || !timerLabel) return;
        
        if (this.countdown !== null && this.countdown > 0) {
            timerElement.textContent = this.countdown;
            timerLabel.textContent = 'СЕКУНД ДО СТАРТА';
            timerElement.style.color = '#ff6b6b';
            timerElement.classList.add('pulse');
        } else {
            timerElement.textContent = this.participants.length;
            timerLabel.textContent = 'УЧАСТНИКОВ';
            timerElement.style.color = this.participants.length > 0 ? '#4ecdc4' : '#666';
            timerElement.classList.remove('pulse');
        }
        
        // Обновляем таймер следующего раунда
        const nextRoundTimer = document.getElementById('nextRoundTimer');
        if (nextRoundTimer && this.nextRoundTimer !== null) {
            nextRoundTimer.textContent = Math.max(0, this.nextRoundTimer);
        }
    }

    // Уведомить сервер о победителе
    async notifyServerAboutWinner(winner) {
        try {
            // Отправляем информацию о победителе на сервер
            const response = await fetch('/api/game/set-winner', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    gameId: this.currentGameId,
                    winnerId: winner.id,
                    winnerIndex: this.participants.findIndex(p => p.id === winner.id)
                })
            });
            
            const result = await response.json();
            if (result.success) {
                console.log('✅ Сервер уведомлен о победителе');
            }
        } catch (error) {
            console.error('❌ Ошибка отправки победителя на сервер:', error);
        }
    }
    
    startSynchronizedSpin(spinStartedAt) {
        if (!this.finalAngle || this.participants.length < 2) return;
        
        this.isSpinning = true;
        this.updateButtons();
        this.hideWinner();
        
        // Устанавливаем время начала вращения
        if (spinStartedAt) {
            this.spinStartTime = new Date(spinStartedAt).getTime() + (this.clientTimeOffset || 0);
        } else {
            this.spinStartTime = this.getCurrentServerTime();
        }
        
        console.log(`🎰 Запуск вращения: угол=${this.finalAngle}°, startTime=${this.spinStartTime}`);
        
        // Сбрасываем позицию колеса
        this.wheelElement.style.transition = 'none';
        this.wheelElement.style.transform = 'rotate(0deg)';
        void this.wheelElement.offsetWidth; // Принудительный reflow
        
        // Начинаем плавное вращение
        setTimeout(() => {
            this.updateWheelPosition();
        }, 10);
    }
    
    syncExistingSpin(syncData) {
        if (!syncData || !syncData.startTime || !syncData.finalAngle) return;
        
        // Синхронизируем с данными сервера
        this.finalAngle = syncData.finalAngle;
        this.spinStartTime = syncData.startTime + (this.clientTimeOffset || 0);
        
        // Если вращение должно быть активно
        if (syncData.shouldBeSpinning) {
            this.isSpinning = true;
            this.updateWheelPosition();
        }
    }

    determineWinnerFromAngle(finalAngle) {
        if (!finalAngle || this.participants.length === 0) {
            console.warn('Недостаточно данных для определения победителя');
            return null;
        }
        
        const normalizedAngle = finalAngle % 360;
        const sectorAngle = 360 / this.participants.length;
        
        console.log(`🎯 Фронтенд: определяем победителя по углу ${finalAngle}°`);
        console.log(`📐 Нормализованный: ${normalizedAngle}°`);
        console.log(`📏 Сектор: ${sectorAngle}°`);
        
        // КЛЮЧЕВОЕ: Стрелка вверху (0°)
        // После вращения на угол X, вверху окажется участник,
        // чей сектор начинается с угла (360 - X) % 360
        
        const pointerAngle = (360 - normalizedAngle) % 360;
        console.log(`📍 Угол под стрелкой: ${pointerAngle}°`);
        
        let sector = Math.floor(pointerAngle / sectorAngle);
        
        // Корректировка
        if (sector >= this.participants.length) sector = this.participants.length - 1;
        if (sector < 0) sector = 0;
        
        const winner = this.participants[sector];
        
        if (winner) {
            console.log(`🏆 Фронтенд: стрелка указывает на ${winner.first_name} (сектор: ${sector})`);
            this.winner = winner;
            this.showWinner(winner);
            return winner;
        }
        
        return null;
    }
    
    startCountdownTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        this.timerInterval = setInterval(() => {
            if (this.countdown > 0) {
                this.countdown--;
                this.updateTimer();
                
                // Обновляем колесо каждые 5 секунд
                if (this.countdown % 5 === 0) {
                    this.updateWheel();
                }
                
                // Автоматический запуск вращения при достижении 0
                if (this.countdown === 0) {
                    console.log('⏰ Таймер истек, ожидаем запуска вращения с сервера...');
                }
            } else {
                this.stopCountdownTimer();
            }
        }, 1000);
    }
    
    stopCountdownTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
    
    resetWheelPosition() {
        this.wheelElement.style.transition = 'transform 0.5s ease-out';
        this.wheelElement.style.transform = 'rotate(0deg)';
        
        setTimeout(() => {
            this.wheelElement.style.transition = '';
        }, 500);
    }

    // В wheel.js добавьте звук победы (опционально)
    playWinnerSound() {
        try {
            // Создаем звук победы с помощью Web Audio API
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // До
            oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // Ми
            oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // Соль
            oscillator.frequency.setValueAtTime(1046.50, audioContext.currentTime + 0.3); // До октавой выше
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
            
        } catch (error) {
            console.log('🔇 Звук недоступен:', error);
        }
    }
    
    // В методе resetForNextRound() добавьте скрытие push:
    resetForNextRound() {
        console.log('🔄 Сброс для нового раунда');
        
        this.hideWinnerPush();
        this.winnerAnnounced = false;
        this.spinStartTime = null;
        this.isSpinning = false;
        
        // Сбрасываем позицию колеса
        this.wheelElement.style.transition = 'transform 0.5s ease-out';
        this.wheelElement.style.transform = 'rotate(0deg)';
        
        setTimeout(() => {
            this.wheelElement.style.transition = '';
        }, 500);
        
        // Обновляем кнопки
        this.updateButtons();
    }
        
    // В wheel.js полностью перепишите метод joinGame:
    // В wheel.js упростите метод joinGame:
    async joinGame() {
        console.log('🎮 joinGame вызван');
        
        if (!window.currentUser) {
            console.error('❌ Нет текущего пользователя');
            window.showStatus('❌ Сначала войдите в аккаунт', 'error');
            return;
        }
        
        console.log('👤 Текущий пользователь:', window.currentUser.first_name);
        
        try {
            const response = await fetch('/api/game/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: window.currentUser.id,
                    userData: window.currentUser
                })
            });
            
            const result = await response.json();
            console.log('📊 Результат API:', result);
            
            if (result.success) {
                await this.loadGameState();
                window.showStatus('✅ Вы присоединились к игре!', 'success');
            } else {
                window.showStatus(`❌ ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Ошибка joinGame:', error);
            window.showStatus('❌ Ошибка соединения', 'error');
        }
    }

    // В класс FortuneWheel добавьте методы:

    showWinnerPush(winner) {
        if (!winner) {
            console.error('❌ showWinnerPush вызван без победителя');
            return;
        }
        
        console.log(`🎉 Показываем push-уведомление: ${winner.first_name}`);
        
        const winnerPush = document.getElementById('winnerPush');
        const winnerPushPhoto = document.getElementById('winnerPushPhoto');
        const winnerPushInitials = document.getElementById('winnerPushInitials');
        const winnerPushName = document.getElementById('winnerPushName');
        const winnerPushTimer = document.getElementById('winnerPushTimer');
        
        if (!winnerPush) {
            console.error('❌ Не найден элемент winnerPush');
            this.showWinner(winner); // Fallback к старому методу
            return;
        }
        
        // Обновляем аватар
        winnerPushPhoto.style.display = 'none';
        winnerPushInitials.style.display = 'none';
        
        if (winner.photo_url) {
            winnerPushPhoto.src = winner.photo_url;
            winnerPushPhoto.style.display = 'block';
            winnerPushPhoto.onerror = () => {
                winnerPushPhoto.style.display = 'none';
                const initials = this.getInitials(winner.first_name, winner.last_name);
                winnerPushInitials.textContent = initials;
                winnerPushInitials.style.display = 'flex';
            };
        } else {
            const initials = this.getInitials(winner.first_name, winner.last_name);
            winnerPushInitials.textContent = initials;
            winnerPushInitials.style.display = 'flex';
        }
        
        // Обновляем имя
        winnerPushName.textContent = `${winner.first_name} ${winner.last_name || ''}`.trim();
        
        // Обновляем таймер
        if (winnerPushTimer && this.nextRoundTimer !== null) {
            winnerPushTimer.textContent = Math.max(0, this.nextRoundTimer);
        }

        this.playWinnerSound();
        
        // Показываем уведомление
        winnerPush.classList.remove('hide');
        winnerPush.classList.add('show');
        
        // Автоматическое скрытие через 8 секунд
        setTimeout(() => {
            this.hideWinnerPush();
        }, 8000);
        
        // Обновляем статус
        if (window.showStatus) {
            window.showStatus(`🎉 ${winner.first_name} - победитель раунда!`, 'success');
        }
        
        this.winnerAnnounced = true;
    }

    hideWinnerPush() {
        const winnerPush = document.getElementById('winnerPush');
        if (winnerPush) {
            winnerPush.classList.remove('show');
            winnerPush.classList.add('hide');
            
            setTimeout(() => {
                winnerPush.classList.remove('hide');
                winnerPush.style.display = 'none';
            }, 500);
        }
    }

    // Обновите метод showWinner():
    showWinner(winner) {
        // Используем push-уведомление вместо старой таблички
        this.showWinnerPush(winner);
        
        // Также обновляем старую табличку (на всякий случай)
        const winnerSection = document.getElementById('winnerSection');
        if (winnerSection) {
            winnerSection.style.display = 'none';
        }
    }

    
    updateWheel() {
        const participantsContainer = document.getElementById('wheelParticipants');
        
        if (!participantsContainer) return;
        
        // Очищаем контейнер
        participantsContainer.innerHTML = '';
        participantsContainer.className = 'wheel-participants-container';
        
        if (this.participants.length === 0) {
            this.wheelElement.style.background = '#222';
            return;
        }
        
        const totalParticipants = this.participants.length;
        const sectorAngle = 360 / totalParticipants;
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#fab1a0', '#a29bfe', '#fd79a8'];
        
        console.log(`🎨 Рисуем колесо: ${totalParticipants} участников, сектор: ${sectorAngle}°`);
        
        // 1. Создаем конический градиент для фона колеса
        let gradientParts = [];
        for (let i = 0; i < totalParticipants; i++) {
            const startAngle = i * sectorAngle;
            const endAngle = (i + 1) * sectorAngle;
            const color = colors[i % colors.length];
            gradientParts.push(`${color} ${startAngle}deg ${endAngle}deg`);
        }
        
        this.wheelElement.style.background = `conic-gradient(${gradientParts.join(', ')})`;
        
        // 2. Добавляем участников с правильным позиционированием
        this.participants.forEach((participant, index) => {
            // Угол центра сектора (в градусах)
            const centerAngle = (index * sectorAngle) + (sectorAngle / 2);
            
            // Преобразуем в радианы для расчетов
            const centerAngleRad = (centerAngle - 90) * (Math.PI / 180);
            
            // Радиус от центра для позиционирования фото
            const radius = 45; // Процент от радиуса колеса
            
            // Рассчитываем координаты для фото
            const x = 50 + Math.cos(centerAngleRad) * radius;
            const y = 50 + Math.sin(centerAngleRad) * radius;
            
            // Создаем контейнер для участника
            const participantContainer = document.createElement('div');
            participantContainer.className = 'wheel-participant-container';
            participantContainer.setAttribute('data-index', index);
            
            // Устанавливаем CSS переменные для позиционирования
            participantContainer.style.setProperty('--sector-angle', `${sectorAngle}deg`);
            participantContainer.style.setProperty('--rotate-angle', centerAngle);
            participantContainer.style.setProperty('--index', index);
            
            // Создаем элемент для фото
            const photoElement = document.createElement('div');
            photoElement.className = 'wheel-participant-photo';
            photoElement.title = `${participant.first_name}`;
            photoElement.style.left = `${x}%`;
            photoElement.style.top = `${y}%`;
            
            // Определяем размер фото в зависимости от позиции
            if (radius < 40) {
                photoElement.classList.add('inner');
            } else if (radius > 50) {
                photoElement.classList.add('outer');
            }
            
            // Добавляем фото или инициалы
            if (participant.photo_url && participant.photo_url.trim() !== '') {
                const img = document.createElement('img');
                img.src = participant.photo_url;
                img.alt = participant.first_name;
                img.onerror = () => {
                    // Если фото не загрузилось, показываем инициалы
                    const initials = this.getInitials(participant.first_name, participant.last_name);
                    photoElement.innerHTML = `<div class="wheel-participant-initials">${initials}</div>`;
                };
                photoElement.appendChild(img);
            } else {
                const initials = this.getInitials(participant.first_name, participant.last_name);
                photoElement.innerHTML = `<div class="wheel-participant-initials">${initials}</div>`;
            }
            
            // Добавляем номер участника (для отладки, можно убрать)
            const numberElement = document.createElement('div');
            numberElement.className = 'participant-number';
            numberElement.textContent = index + 1;
            photoElement.appendChild(numberElement);
            
            // Добавляем фото в контейнер
            participantContainer.appendChild(photoElement);
            
            // Создаем сектор для клиппинга (опционально)
            const sectorElement = document.createElement('div');
            sectorElement.className = 'wheel-sector';
            
            // Рассчитываем координаты для клип-патча
            const startAngle = index * sectorAngle;
            const endAngle = (index + 1) * sectorAngle;
            
            // Преобразуем углы в координаты
            const startRad = (startAngle - 90) * (Math.PI / 180);
            const endRad = (endAngle - 90) * (Math.PI / 180);
            
            const startX = 50 + Math.cos(startRad) * 50;
            const startY = 50 + Math.sin(startRad) * 50;
            const endX = 50 + Math.cos(endRad) * 50;
            const endY = 50 + Math.sin(endRad) * 50;
            
            sectorElement.style.setProperty('--start-x', `${startX}%`);
            sectorElement.style.setProperty('--start-y', `${startY}%`);
            sectorElement.style.setProperty('--end-x', `${endX}%`);
            sectorElement.style.setProperty('--end-y', `${endY}%`);
            sectorElement.style.transform = `rotate(${startAngle}deg)`;
            
            // Добавляем элементы в контейнер
            participantsContainer.appendChild(sectorElement);
            participantsContainer.appendChild(participantContainer);
            
            // Добавляем обработчик клика (опционально)
            photoElement.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log(`👤 Выбран участник: ${participant.first_name} (индекс: ${index})`);
                // Можно добавить дополнительную логику при клике
            });
        });
        
        // 3. Добавляем разделительные линии между секторами
        for (let i = 0; i < totalParticipants; i++) {
            const lineAngle = i * sectorAngle;
            
            const line = document.createElement('div');
            line.className = 'wheel-divider';
            line.style.position = 'absolute';
            line.style.top = '0';
            line.style.left = '50%';
            line.style.width = '2px';
            line.style.height = '50%';
            line.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
            line.style.transformOrigin = 'bottom center';
            line.style.transform = `translateX(-50%) rotate(${lineAngle}deg)`;
            line.style.zIndex = '1';
            
            participantsContainer.appendChild(line);
        }
        
        console.log(`✅ Колесо обновлено: ${totalParticipants} фото участников правильно позиционированы`);
    }

    // Метод для подсветки сектора победителя
    highlightWinnerSector() {
        const participants = document.querySelectorAll('.wheel-participant');
        
        participants.forEach(el => {
            const index = parseInt(el.getAttribute('data-index'));
            
            if (index === this.winnerIndex) {
                el.style.boxShadow = '0 0 20px gold';
                el.style.zIndex = '10';
                el.style.border = '3px solid gold';
            } else {
                el.style.boxShadow = '';
                el.style.zIndex = '';
                el.style.border = '3px solid #fff';
            }
        });
    }

    // Метод для проверки соответствия угла и сектора
    debugAngleToSector(finalAngle) {
        if (!finalAngle || this.participants.length === 0) return;
        
        const normalizedAngle = finalAngle % 360;
        const totalParticipants = this.participants.length;
        const sectorAngle = 360 / totalParticipants;
        
        console.log('=== ПРОВЕРКА УГЛА ===');
        console.log(`Финальный угол: ${finalAngle}°`);
        console.log(`Нормализованный: ${normalizedAngle}°`);
        console.log(`Участников: ${totalParticipants}`);
        console.log(`Сектор: ${sectorAngle}°`);
        
        // Показываем все сектора
        for (let i = 0; i < totalParticipants; i++) {
            const startAngle = i * sectorAngle;
            const endAngle = (i + 1) * sectorAngle;
            const isInSector = normalizedAngle >= startAngle && normalizedAngle < endAngle;
            console.log(`Сектор ${i}: ${startAngle}°-${endAngle}° ${isInSector ? '← ПОПАДАНИЕ!' : ''}`);
        }
        
        // Расчет сектора
        const calculatedSector = Math.floor(normalizedAngle / sectorAngle);
        console.log(`Расчетный сектор: ${calculatedSector}`);
        console.log(`Победитель: ${this.participants[calculatedSector]?.first_name || 'не найден'}`);
        console.log('====================');
    }
    
    renderParticipants() {
        const participantsList = document.getElementById('participantsList');
        if (!participantsList) return;
        
        if (this.participants.length === 0) {
            participantsList.innerHTML = `
                <div class="no-participants">
                    <p>👤 Пока никто не участвует</p>
                </div>
            `;
            return;
        }
        
        let html = '<div class="participants-grid">';
        
        this.participants.forEach((participant, index) => {
            const isCurrentUser = window.currentUser && participant.id === window.currentUser.id;
            const isWinner = this.winner && this.winner.id === participant.id;
            
            html += `
                <div class="participant-item ${isCurrentUser ? 'current-user' : ''} ${isWinner ? 'winner' : ''}">
                    <div class="participant-avatar">
                        ${participant.photo_url 
                            ? `<img src="${participant.photo_url}" alt="${participant.first_name}">`
                            : `<div class="initials">${this.getInitials(participant.first_name, participant.last_name)}</div>`
                        }
                        ${isWinner ? '<div class="winner-crown">👑</div>' : ''}
                    </div>
                    <div class="participant-name">
                        ${participant.first_name}
                        ${isCurrentUser ? '<br><span class="you-label">(Вы)</span>' : ''}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        participantsList.innerHTML = html;
    }
    
    updateTimer() {
        const timerElement = document.getElementById('gameTimer');
        const timerLabel = document.getElementById('timerLabel');
        
        if (!timerElement || !timerLabel) return;
        
        if (this.countdown !== null && this.countdown > 0) {
            timerElement.textContent = this.countdown;
            timerLabel.textContent = 'СЕКУНД ДО СТАРТА';
            timerElement.style.color = '#ff6b6b';
            timerElement.classList.add('pulse');
        } else {
            timerElement.textContent = this.participants.length;
            timerLabel.textContent = 'УЧАСТНИКОВ';
            timerElement.style.color = this.participants.length > 0 ? '#4ecdc4' : '#666';
            timerElement.classList.remove('pulse');
        }
    }
    
    updateButtons() {
        const joinButton = document.getElementById('joinButton');
        if (!joinButton) return;
        
        const isUserParticipating = window.currentUser && 
            this.participants.some(p => p.id === window.currentUser.id);
        
        if (!window.currentUser) {
            joinButton.disabled = true;
            joinButton.innerHTML = '<span class="icon">🔒</span> ВОЙДИТЕ ДЛЯ УЧАСТИЯ';
        } else if (this.isSpinning) {
            joinButton.disabled = true;
            joinButton.innerHTML = '<span class="icon">🎰</span> ИГРА АКТИВНА';
        } else if (isUserParticipating) {
            joinButton.disabled = true;
            joinButton.innerHTML = '<span class="icon">✅</span> ВЫ УЧАСТВУЕТЕ';
        } else {
            joinButton.disabled = false;
            joinButton.innerHTML = '<span class="icon">➕</span> УЧАСТВОВАТЬ';
        }
    }
    
    showWinner(winner) {
        // Используем push-уведомление вместо старой таблички
        this.showWinnerPush(winner);
        
        // Также обновляем старую табличку (на всякий случай)
        const winnerSection = document.getElementById('winnerSection');
        if (winnerSection) {
            winnerSection.style.display = 'none';
        }
    }
    
    hideWinner() {
        const winnerSection = document.getElementById('winnerSection');
        winnerSection.classList.remove('visible');
        
        setTimeout(() => {
            if (!winnerSection.classList.contains('visible')) {
                winnerSection.style.display = 'none';
            }
        }, 500);
    }
    
    getInitials(firstName, lastName) {
        if (!firstName && !lastName) return 'U';
        const first = firstName ? firstName.charAt(0).toUpperCase() : '';
        const last = lastName ? lastName.charAt(0).toUpperCase() : '';
        return (first + last) || 'U';
    }
    
    setupEventListeners() {
        const joinButton = document.getElementById('joinButton');
        if (joinButton) {
            joinButton.addEventListener('click', () => this.joinGame());
        }
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎡 Инициализация колеса фортуны...');
    window.fortuneWheel = new FortuneWheel();
});
