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
        
        // Нормализуем угол
        const normalizedAngle = finalAngle % 360;
        const sectorAngle = 360 / this.participants.length;
        
        console.log(`🎯 Фронтенд: определяем победителя по углу ${normalizedAngle}°`);
        console.log(`📏 Сектор: ${sectorAngle}°, Участников: ${this.participants.length}`);

        this.debugAngleToSector(finalAngle);
        
        // КОРРЕКТНЫЙ РАСЧЕТ ДЛЯ ФРОНТЕНДА:
        // Участники на колесе расположены против часовой стрелки
        // Колесо вращается по часовой стрелке
        // Указатель вверху (0°)
        
        let sector = Math.floor((360 - normalizedAngle) / sectorAngle) % this.participants.length;
        
        // Корректировка граничных случаев
        if (sector < 0) sector += this.participants.length;
        if (sector >= this.participants.length) sector = 0;
        
        const winner = this.participants[sector];
        
        if (winner) {
            console.log(`🏆 Фронтенд определил победителя: ${winner.first_name} (сектор: ${sector})`);
            
            // Синхронизируем с сервером
            this.winner = winner;
            this.showWinner(winner);
            
            return winner;
        }
        
        console.warn('❌ Фронтенд: победитель не найден');
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
    
    resetForNextRound() {
        console.log('🔄 Сброс клиента для нового раунда');
        
        this.hideWinner();
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
    
    updateWheel() {
        const participantsContainer = document.getElementById('wheelParticipants');
        
        if (!participantsContainer) return;
        
        // Всегда очищаем и перерисовываем
        participantsContainer.innerHTML = '';
        
        if (this.participants.length === 0) {
            this.wheelElement.style.background = '#222';
            return;
        }
        
        const totalParticipants = this.participants.length;
        const sectorAngle = 360 / totalParticipants;
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#fab1a0', '#a29bfe', '#fd79a8'];
        
        console.log(`🎨 Рисуем колесо: ${totalParticipants} участников, сектор: ${sectorAngle}°`);
        
        // Создаем конический градиент
        let gradientParts = [];
        for (let i = 0; i < totalParticipants; i++) {
            const startAngle = i * sectorAngle;
            const endAngle = (i + 1) * sectorAngle;
            const color = colors[i % colors.length];
            gradientParts.push(`${color} ${startAngle}deg ${endAngle}deg`);
            
            console.log(`Сектор ${i}: ${startAngle}°-${endAngle}° (${this.participants[i].first_name})`);
        }
        
        this.wheelElement.style.background = `conic-gradient(${gradientParts.join(', ')})`;
        
        // Добавляем метки участников
        this.participants.forEach((participant, index) => {
            // Центр сектора
            const centerAngle = (index * sectorAngle) + (sectorAngle / 2);
            
            // Переводим в радианы для расчета позиции
            const angleRad = (centerAngle - 90) * (Math.PI / 180); // -90° потому что 0° справа
            
            // Радиус от центра
            const radius = 110;
            
            // Создаем элемент участника
            const participantElement = document.createElement('div');
            participantElement.className = 'wheel-participant';
            participantElement.setAttribute('data-index', index);
            participantElement.title = `${participant.first_name} (сектор ${index})`;
            
            // Позиционирование
            participantElement.style.position = 'absolute';
            participantElement.style.width = '50px';
            participantElement.style.height = '50px';
            participantElement.style.top = '50%';
            participantElement.style.left = '50%';
            participantElement.style.marginLeft = '-25px';
            participantElement.style.marginTop = '-25px';
            
            // Расчет позиции по кругу
            const x = Math.cos(angleRad) * radius;
            const y = Math.sin(angleRad) * radius;
            
            participantElement.style.transform = `translate(${x}px, ${y}px)`;
            
            // Аватар или инициалы
            if (participant.photo_url) {
                const img = document.createElement('img');
                img.src = participant.photo_url;
                img.alt = participant.first_name;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                img.style.borderRadius = '50%';
                participantElement.appendChild(img);
            } else {
                const initials = this.getInitials(participant.first_name, participant.last_name);
                participantElement.innerHTML = `<div class="initials" style="
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 16px;
                    font-weight: bold;
                    color: white;
                    background: rgba(0,0,0,0.7);
                    border-radius: 50%;
                ">${initials}</div>`;
            }
            
            // Добавляем номер сектора для отладки
            const debugLabel = document.createElement('div');
            debugLabel.textContent = index;
            debugLabel.style.position = 'absolute';
            debugLabel.style.top = '-20px';
            debugLabel.style.left = '50%';
            debugLabel.style.transform = 'translateX(-50%)';
            debugLabel.style.color = 'white';
            debugLabel.style.fontSize = '12px';
            debugLabel.style.fontWeight = 'bold';
            debugLabel.style.background = 'rgba(0,0,0,0.5)';
            debugLabel.style.padding = '2px 5px';
            debugLabel.style.borderRadius = '3px';
            participantElement.appendChild(debugLabel);
            
            participantsContainer.appendChild(participantElement);
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
        if (!winner) {
            console.error('❌ showWinner вызван без победителя');
            return;
        }
        
        console.log(`🎉 Показываем победителя: ${winner.first_name} (ID: ${winner.id})`);
        
        const winnerAvatar = document.getElementById('winnerAvatar');
        const winnerName = document.getElementById('winnerName');
        const winnerSection = document.getElementById('winnerSection');
        const nextRoundTimer = document.getElementById('nextRoundTimer');

        // Показываем отладочную информацию
        const winnerDebug = document.getElementById('winnerDebug');
        const winnerSector = document.getElementById('winnerSector');
        const winnerAngle = document.getElementById('winnerAngle');
        
        if (winnerDebug && winnerSector && winnerAngle) {
            winnerDebug.style.display = 'block';
            winnerSector.textContent = this.winnerIndex !== undefined ? this.winnerIndex : '?';
            winnerAngle.textContent = this.finalAngle ? Math.round(this.finalAngle % 360) : '?';
        }
        
        // Проверяем элементы
        if (!winnerAvatar || !winnerName || !winnerSection) {
            console.error('❌ Не найдены элементы для отображения победителя');
            return;
        }
        
        // Очищаем предыдущий аватар
        winnerAvatar.innerHTML = '';
        
        // Создаем аватар
        if (winner.photo_url) {
            const img = document.createElement('img');
            img.src = winner.photo_url;
            img.alt = winner.first_name;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '50%';
            
            // Обработка ошибки загрузки фото
            img.onerror = () => {
                console.log('❌ Ошибка загрузки фото, показываем инициалы');
                const initials = this.getInitials(winner.first_name, winner.last_name);
                winnerAvatar.innerHTML = `<div class="initials" style="
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 2.5rem;
                    font-weight: bold;
                    color: white;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 50%;
                ">${initials}</div>`;
            };
            
            winnerAvatar.appendChild(img);
        } else {
            const initials = this.getInitials(winner.first_name, winner.last_name);
            winnerAvatar.innerHTML = `<div class="initials" style="
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 2.5rem;
                font-weight: bold;
                color: white;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 50%;
            ">${initials}</div>`;
        }
        
        // Устанавливаем имя
        winnerName.textContent = `${winner.first_name} ${winner.last_name || ''}`.trim();
        
        // Показываем секцию с анимацией
        winnerSection.style.display = 'block';
        
        // Небольшая задержка для анимации
        setTimeout(() => {
            winnerSection.classList.add('visible');
            
            // Анимация появления
            winnerSection.style.animation = 'pulse 2s infinite';
        }, 100);
        
        // Обновляем таймер следующего раунда
        if (nextRoundTimer && this.nextRoundTimer !== null && this.nextRoundTimer > 0) {
            nextRoundTimer.textContent = this.nextRoundTimer;
            
            // Обновляем каждую секунду
            const timerInterval = setInterval(() => {
                if (this.nextRoundTimer > 0) {
                    this.nextRoundTimer--;
                    nextRoundTimer.textContent = this.nextRoundTimer;
                } else {
                    clearInterval(timerInterval);
                }
            }, 1000);
        }
        
        // Показываем статус
        if (window.showStatus) {
            window.showStatus(`🎉 Победитель: ${winner.first_name}! Следующий раунд через 8 секунд`, 'success');
        }
        
        this.winnerAnnounced = true;
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
