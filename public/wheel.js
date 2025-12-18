// public/wheel.js - Исправленная версия
class FortuneWheel {
    constructor() {
        this.participants = [];
        this.sectors = [];
        this.isSpinning = false;
        this.countdown = null;
        this.winner = null;
        this.finalAngle = null;
        this.wheelElement = null;
        this.sectorsContainer = null;
        this.participantsContainer = null;
        this.spinStartTime = null;
        this.winnerAnnounced = false;
        this.nextRoundTimer = null;
        this.spinDuration = 5000; // 5 секунд вращения
        this.currentRotation = 0;
        this.animationFrameId = null;
        
        this.init();

    }

    async init() {
        this.wheelElement = document.getElementById('fortuneWheel');
        this.sectorsContainer = document.getElementById('wheelSectors');
        this.participantsContainer = document.getElementById('wheelParticipants');
        
        this.setupEventListeners();
        
        // Загружаем начальное состояние
        await this.loadGameState();
        
        // Автообновление каждые 2 секунды
        setInterval(() => {
            this.loadGameState();
        }, 2000);
        
        // Запускаем анимационный цикл
        this.animate();
        
        console.log('✅ Рулетка инициализирована');
    }

    // Анимационный цикл
    animate() {
        if (this.isSpinning && this.spinStartTime) {
            this.updateSpinAnimation();
        }
        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }

    updateSpinAnimation() {
        if (!this.spinStartTime || !this.finalAngle) return;
        
        const now = Date.now();
        const elapsed = now - this.spinStartTime;
        
        if (elapsed > this.spinDuration + 1000) {
            // Вращение завершено
            this.isSpinning = false;
            this.wheelElement.style.transition = 'none';
            return;
        }
        
        const progress = Math.min(elapsed / this.spinDuration, 1);
        
        // Кривая замедления (ease-out cubic)
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        // Рассчитываем текущий угол
        const currentAngle = easeProgress * this.finalAngle;
        
        // Применяем вращение
        this.wheelElement.style.transform = `rotate(${currentAngle}deg)`;
        
        // Если вращение завершено и есть победитель - показываем его
        if (progress >= 1 && this.winner && !this.winnerAnnounced) {
            this.winnerAnnounced = true;
            setTimeout(() => {
                this.showWinner(this.winner);
            }, 500);
        }
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
                // Проверяем изменение участников
                const participantsChanged = JSON.stringify(this.participants) !== 
                                          JSON.stringify(data.game.participants);
                
                this.participants = data.game.participants || [];
                this.countdown = data.game.countdown;
                this.winner = data.game.winner;
                this.finalAngle = data.game.finalAngle;
                this.nextRoundTimer = data.game.nextRoundTimer;
                
                // Проверяем изменение состояния вращения
                const wasSpinning = this.isSpinning;
                this.isSpinning = data.game.status === 'spinning';
                
                // Если участники изменились - перерисовываем колесо
                if (participantsChanged) {
                    console.log('🔄 Обновляем колесо фортуны');
                    this.createWheelSectors();
                }
                
                // Если началось вращение
                if (this.isSpinning && !wasSpinning && data.game.spinStartedAt) {
                    console.log('🎰 Начинаем вращение!');
                    this.startSpinAnimation(data.game.spinStartedAt);
                }
                
                // Если вращение завершилось и есть победитель
                if (!this.isSpinning && wasSpinning && this.winner && !this.winnerAnnounced) {
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

    // Создание секторов рулетки
    createWheelSectors() {
        if (!this.sectorsContainer || !this.participantsContainer) return;
        
        // Очищаем контейнеры
        this.sectorsContainer.innerHTML = '';
        this.participantsContainer.innerHTML = '';
        
        if (this.participants.length === 0) {
            console.log('🎡 Колесо пустое');
            return;
        }
        
        console.log(`🎡 Создаем рулетку с ${this.participants.length} секторами`);
        
        const totalSectors = this.participants.length;
        const sectorAngle = 360 / totalSectors;
        
        // Цвета для секторов
        const sectorColors = [
            'color-1', 'color-2', 'color-3', 'color-4',
            'color-5', 'color-6', 'color-7', 'color-8'
        ];
        
        // Создаем сектора
        for (let i = 0; i < totalSectors; i++) {
            const participant = this.participants[i];
            const colorClass = sectorColors[i % sectorColors.length];
            
            // Создаем сектор
            const sector = document.createElement('div');
            sector.className = `wheel-sector ${colorClass}`;
            sector.dataset.index = i;
            sector.dataset.userId = participant.id;
            
            // Угол поворота сектора
            const rotation = i * sectorAngle;
            sector.style.transform = `rotate(${rotation}deg)`;
            sector.style.setProperty('--sector-angle', `${sectorAngle}deg`);
            
            this.sectorsContainer.appendChild(sector);
            
            // Создаем участника в секторе
            this.createParticipantInSector(participant, i, sectorAngle);
        }
        
        // Подсвечиваем сектор победителя
        this.highlightWinnerSector();
    }
    
    // Создание участника внутри сектора
    createParticipantInSector(participant, index, sectorAngle) {
        const participantElement = document.createElement('div');
        participantElement.className = 'wheel-participant';
        participantElement.dataset.index = index;
        participantElement.dataset.userId = participant.id;
        participantElement.title = `${participant.first_name}${participant.last_name ? ' ' + participant.last_name : ''}`;
        
        // Позиционирование в центре сектора
        const radius = 100; // Расстояние от центра
        const angle = (index * sectorAngle) + (sectorAngle / 2) - 90; // -90 чтобы начать сверху
        const angleRad = angle * (Math.PI / 180);
        
        const centerX = 150; // Центр колеса (300px / 2)
        const centerY = 150;
        const x = centerX + Math.cos(angleRad) * radius;
        const y = centerY + Math.sin(angleRad) * radius;
        
        participantElement.style.left = `${x}px`;
        participantElement.style.top = `${y}px`;
        
        // Создаем контейнер для фото/инициалов
        const innerContainer = document.createElement('div');
        innerContainer.className = 'wheel-participant-inner';
        
        if (participant.photo_url && participant.photo_url.trim() !== '') {
            const img = document.createElement('img');
            img.className = 'wheel-participant-photo';
            img.src = participant.photo_url;
            img.alt = participant.first_name;
            img.loading = 'lazy';
            
            // Предзагрузка и обработка ошибок
            const preloadImg = new Image();
            preloadImg.onload = () => {
                img.src = participant.photo_url;
            };
            preloadImg.onerror = () => {
                // Если фото не загружается, показываем инициалы
                this.showParticipantInitials(innerContainer, participant, index);
            };
            preloadImg.src = participant.photo_url;
            
            innerContainer.appendChild(img);
        } else {
            // Если нет фото, показываем инициалы
            this.showParticipantInitials(innerContainer, participant, index);
        }
        
        participantElement.appendChild(innerContainer);
        
        // Добавляем коронку если это победитель
        if (this.winner && participant.id === this.winner.id) {
            const crown = document.createElement('div');
            crown.className = 'winner-crown';
            crown.innerHTML = '👑';
            crown.title = `Победитель: ${participant.first_name}`;
            participantElement.appendChild(crown);
        }
        
        this.participantsContainer.appendChild(participantElement);
    }
    
    // Показать инициалы участника
    showParticipantInitials(container, participant, index) {
        const initialsDiv = document.createElement('div');
        initialsDiv.className = 'wheel-participant-initials';
        
        const initials = this.getInitials(participant.first_name, participant.last_name);
        initialsDiv.textContent = initials;
        initialsDiv.title = participant.first_name;
        
        // Добавляем цвет в зависимости от индекса
        const colorClasses = ['color-1', 'color-2', 'color-3', 'color-4', 'color-5', 'color-6', 'color-7', 'color-8'];
        initialsDiv.classList.add(colorClasses[index % colorClasses.length]);
        
        container.appendChild(initialsDiv);
    }

    // Начало анимации вращения
    startSpinAnimation(spinStartedAt) {
        if (!this.finalAngle || this.participants.length < 2) return;
        
        console.log(`🌀 Запускаем вращение: угол=${this.finalAngle}°`);
        
        this.isSpinning = true;
        this.winnerAnnounced = false;
        this.spinStartTime = new Date(spinStartedAt).getTime();
        
        // Сбрасываем позицию колеса
        this.wheelElement.style.transition = 'none';
        this.wheelElement.style.transform = 'rotate(0deg)';
        
        // Принудительный reflow
        void this.wheelElement.offsetWidth;
        
        // Скрываем победителя
        this.hideWinner();
        
        // Запускаем плавное вращение
        setTimeout(() => {
            this.wheelElement.style.transition = `transform ${this.spinDuration}ms cubic-bezier(0.2, 0.8, 0.3, 1)`;
            this.wheelElement.style.transform = `rotate(${this.finalAngle}deg)`;
        }, 10);
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
    
    // Обновление UI
    updateUI() {
        this.updateTimer();
        this.updateButtons();
        this.renderParticipants();
    }
    
    updateTimer() {
        const timerElement = document.getElementById('gameTimer');
        const timerLabel = document.getElementById('timerLabel');
        
        if (!timerElement || !timerLabel) return;
        
        if (this.countdown !== null && this.countdown > 0) {
            // Режим отсчета до старта
            timerElement.textContent = this.countdown;
            timerLabel.textContent = 'СЕКУНД ДО СТАРТА';
            timerElement.style.color = '#ff6b6b';
            timerElement.classList.add('pulse');
        } else {
            // Режим показа участников
            timerElement.textContent = this.participants.length;
            timerLabel.textContent = 'УЧАСТНИКОВ';
            timerElement.style.color = this.participants.length > 0 ? '#4ecdc4' : '#666';
            timerElement.classList.remove('pulse');
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
    // Звук победы
    playWinnerSound() {
        try {
            // Простой звук с использованием Web Audio API
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Мелодия победы
            oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
            oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
            oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
            oscillator.frequency.setValueAtTime(1046.50, audioContext.currentTime + 0.3); // C6
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            console.log('🔇 Звук недоступен');
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
    // Присоединиться к игре
    async joinGame() {
        console.log('🎮 Присоединение к игре...');
        
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
                // Обновляем состояние игры
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

    // Push-уведомление о победителе
    showWinnerPush(winner) {
        const winnerPush = document.getElementById('winnerPush');
        const winnerPushPhoto = document.getElementById('winnerPushPhoto');
        const winnerPushInitials = document.getElementById('winnerPushInitials');
        const winnerPushName = document.getElementById('winnerPushName');
        const winnerPushTimer = document.getElementById('winnerPushTimer');
        
        if (!winnerPush) return;
        
        // Обновляем фото/инициалы
        if (winner.photo_url && winner.photo_url.trim() !== '') {
            winnerPushPhoto.src = winner.photo_url;
            winnerPushPhoto.style.display = 'block';
            winnerPushInitials.style.display = 'none';
        } else {
            const initials = this.getInitials(winner.first_name, winner.last_name);
            winnerPushInitials.textContent = initials;
            winnerPushInitials.style.display = 'flex';
            winnerPushPhoto.style.display = 'none';
        }
        
        // Обновляем имя
        winnerPushName.textContent = `${winner.first_name} ${winner.last_name || ''}`.trim();
        
        // Обновляем таймер
        if (winnerPushTimer && this.nextRoundTimer !== null) {
            winnerPushTimer.textContent = Math.max(0, this.nextRoundTimer);
        }
        
        // Показываем уведомление
        winnerPush.classList.remove('hide');
        winnerPush.classList.add('show');
        
        // Автоскрытие через 8 секунд
        setTimeout(() => {
            this.hideWinnerPush();
        }, 8000);
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
    // Показать победителя
    showWinner(winner) {
        if (!winner) return;
        
        console.log(`🎉 Показываем победителя: ${winner.first_name}`);
        
        // Подсвечиваем сектор победителя
        this.highlightWinnerSector();
        
        // Показываем push-уведомление
        this.showWinnerPush(winner);
        
        // Обновляем список участников
        this.renderParticipants();
        
        // Проигрываем звук победы (опционально)
        this.playWinnerSound();
    }

    updateWinnerHighlight() {
        const participants = document.querySelectorAll('.wheel-participant');
        
        participants.forEach(el => {
            const userId = el.dataset.userId;
            el.classList.remove('winner');
            
            // Удаляем существующие короны
            const existingCrown = el.querySelector('.winner-crown');
            if (existingCrown) {
                existingCrown.remove();
            }
            
            // Если это победитель - добавляем подсветку
            if (this.winner && userId && parseInt(userId) === this.winner.id) {
                el.classList.add('winner');
                
                const crown = document.createElement('div');
                crown.className = 'winner-crown';
                crown.innerHTML = '👑';
                crown.title = `Победитель: ${this.winner.first_name}`;
                el.appendChild(crown);
            }
        });
    }

    
    updateWheel() {
        const participantsContainer = document.getElementById('wheelParticipants');
        
        if (!participantsContainer) {
            console.error('❌ Контейнер для участников не найден!');
            return;
        }
        
        // Полностью очищаем контейнер
        participantsContainer.innerHTML = '';
        
        if (this.participants.length === 0) {
            console.log('❌ Нет участников для отображения');
            return;
        }
        
        console.log(`🎨 Отрисовываем ${this.participants.length} участников на колесе`);
        
        // Массив цветов для участников
        const colorClasses = [
            'color-1', 'color-2', 'color-3', 'color-4',
            'color-5', 'color-6', 'color-7', 'color-8'
        ];
        
        // Создаем элементы для каждого участника
        this.participants.forEach((participant, index) => {
            const participantElement = document.createElement('div');
            participantElement.className = `wheel-participant ${colorClasses[index % colorClasses.length]}`;
            participantElement.dataset.index = index;
            participantElement.dataset.userId = participant.id;
            
            // Позиционирование
            const totalParticipants = this.participants.length;
            const angle = (360 / totalParticipants) * index;
            const radius = 120; // Расстояние от центра
            
            // Расчет позиции (центр колеса в середине)
            const centerX = 150; // Половина width колеса
            const centerY = 150; // Половина height колеса
            const radian = (angle - 90) * (Math.PI / 180); // -90 чтобы начать сверху
            
            const x = centerX + Math.cos(radian) * radius;
            const y = centerY + Math.sin(radian) * radius;
            
            participantElement.style.left = `${x}px`;
            participantElement.style.top = `${y}px`;
            
            // Добавляем фото или инициалы
            const photoContainer = document.createElement('div');
            photoContainer.className = 'wheel-participant-photo-container';
            
            if (participant.photo_url && participant.photo_url.trim() !== '') {
                const img = document.createElement('img');
                img.className = 'wheel-participant-photo';
                img.src = participant.photo_url;
                img.alt = participant.first_name;
                img.loading = 'lazy';
                
                // Обработчик ошибки загрузки фото
                img.onerror = () => {
                    photoContainer.innerHTML = '';
                    const initials = this.getInitials(participant.first_name, participant.last_name);
                    const initialsDiv = document.createElement('div');
                    initialsDiv.className = 'wheel-participant-initials';
                    initialsDiv.textContent = initials;
                    photoContainer.appendChild(initialsDiv);
                    console.log(`❌ Не удалось загрузить фото для ${participant.first_name}, показываем инициалы`);
                };
                
                photoContainer.appendChild(img);
            } else {
                const initials = this.getInitials(participant.first_name, participant.last_name);
                const initialsDiv = document.createElement('div');
                initialsDiv.className = 'wheel-participant-initials';
                initialsDiv.textContent = initials;
                photoContainer.appendChild(initialsDiv);
            }
            
            participantElement.appendChild(photoContainer);
            
            // Добавляем коронку победителя если нужно
            if (this.winner && participant.id === this.winner.id) {
                const crown = document.createElement('div');
                crown.className = 'winner-crown';
                crown.innerHTML = '👑';
                crown.title = `Победитель: ${participant.first_name}`;
                participantElement.appendChild(crown);
                participantElement.classList.add('winner');
            }
            
            // Добавляем подсказку
            participantElement.title = `${participant.first_name}${participant.last_name ? ' ' + participant.last_name : ''}${participant.username ? ' (@' + participant.username + ')' : ''}`;
            
            participantsContainer.appendChild(participantElement);
        });
        
        console.log(`✅ Участники добавлены на колесо`);
    }

    // Подсветка сектора победителя
    highlightWinnerSector() {
        if (!this.winner || this.participants.length === 0) return;
        
        // Снимаем подсветку со всех секторов
        document.querySelectorAll('.wheel-sector').forEach(sector => {
            sector.classList.remove('winner');
        });
        
        // Находим индекс победителя
        const winnerIndex = this.participants.findIndex(p => p.id === this.winner.id);
        if (winnerIndex !== -1) {
            const winnerSector = document.querySelector(`.wheel-sector[data-index="${winnerIndex}"]`);
            if (winnerSector) {
                winnerSector.classList.add('winner');
            }
        }
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
                    <p style="color: #666; font-size: 0.9rem; margin-top: 10px;">
                        Станьте первым участником!
                    </p>
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
                            ? `<img src="${participant.photo_url}" alt="${participant.first_name}" loading="lazy">`
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
    
    // Обновление кнопок
    updateButtons() {
        const joinButton = document.getElementById('joinButton');
        if (!joinButton) return;
        
        const isUserParticipating = window.currentUser && 
            this.participants.some(p => p.id === window.currentUser.id);
        
        if (!window.currentUser) {
            // Пользователь не авторизован
            joinButton.disabled = true;
            joinButton.innerHTML = '<span class="icon">🔒</span> ВОЙДИТЕ ДЛЯ УЧАСТИЯ';
        } else if (this.isSpinning) {
            // Игра в процессе
            joinButton.disabled = true;
            joinButton.innerHTML = '<span class="icon">🎰</span> ИГРА АКТИВНА';
        } else if (isUserParticipating) {
            // Пользователь уже участвует
            joinButton.disabled = true;
            joinButton.innerHTML = '<span class="icon">✅</span> ВЫ УЧАСТВУЕТЕ';
        } else {
            // Можно присоединиться
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
    
    // Скрыть победителя
    hideWinner() {
        const winnerSection = document.getElementById('winnerSection');
        if (winnerSection) {
            winnerSection.style.display = 'none';
        }
        
        // Снимаем подсветку с секторов
        document.querySelectorAll('.wheel-sector').forEach(sector => {
            sector.classList.remove('winner');
        });
    }
    
    // Получение инициалов
    getInitials(firstName, lastName) {
        if (!firstName && !lastName) return 'U';
        const first = firstName ? firstName.charAt(0).toUpperCase() : '';
        const last = lastName ? lastName.charAt(0).toUpperCase() : '';
        return (first + last) || 'U';
    }
    
    // Настройка обработчиков событий
    setupEventListeners() {
        const joinButton = document.getElementById('joinButton');
        if (joinButton) {
            joinButton.addEventListener('click', () => this.joinGame());
        }
        
        // Обработчик для кнопки закрытия push-уведомления
        const closeButton = document.querySelector('.winner-push-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => this.hideWinnerPush());
        }

    }
    // Очистка ресурсов
    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎡 Инициализация рулетки...');
    window.fortuneWheel = new FortuneWheel();
    
    // Делаем метод доступным глобально для кнопок
    window.joinGame = () => window.fortuneWheel.joinGame();
    window.hideWinnerPush = () => window.fortuneWheel?.hideWinnerPush();
});
