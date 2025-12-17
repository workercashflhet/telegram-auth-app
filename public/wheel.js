// public/wheel.js - Исправленная версия
class FortuneWheel {
    constructor() {
        this.participants = [];
        this.isSpinning = false;
        this.countdown = null;
        this.countdownTime = 30;
        this.timerInterval = null;
        this.maxParticipants = 8;
        this.currentGameId = null;
        this.wheelElement = null;
        this.spinningStarted = false;
        this.spinStartTime = null;
        this.finalAngle = null;
        this.winner = null;
        this.winnerAnnounced = false;
        this.lastUpdateTime = null;
        this.autoRefreshInterval = null;
        this.syncInterval = null;
        this.lastServerTime = null;
        this.clientTimeOffset = 0;
        this.spinAnimation = null;
        
        this.init();
    }
    
    async init() {
        this.wheelElement = document.getElementById('fortuneWheel');
        this.setupEventListeners();
        
        // Сначала синхронизируем время с сервером
        await this.syncTimeWithServer();
        
        // Загружаем начальное состояние
        await this.loadGameState();
        
        // Настраиваем автоматическое обновление
        this.setupAutoRefresh();
        
        // Настраиваем синхронизацию вращения
        this.setupSpinSync();
        
        console.log('✅ Колесо инициализировано с синхронизацией времени');
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
                this.currentGameId = data.game.id;
                
                // Обновляем участников если изменились
                const participantsChanged = JSON.stringify(this.participants) !== JSON.stringify(data.game.participants);
                this.participants = data.game.participants || [];
                
                this.countdown = data.game.status === 'counting' ? data.game.countdown : null;
                this.winner = data.game.winner || null;
                this.finalAngle = data.game.finalAngle || null;
                
                const wasSpinning = this.isSpinning;
                this.isSpinning = data.game.status === 'spinning';
                
                // Обновляем UI
                if (participantsChanged) {
                    this.renderParticipants();
                    this.updateWheel();
                }
                
                this.updateTimer();
                this.updateButtons();
                
                // Управляем таймером обратного отсчета
                if (this.countdown !== null && !this.timerInterval) {
                    this.startCountdownTimer();
                } else if (this.countdown === null && this.timerInterval) {
                    this.stopCountdownTimer();
                }
                
                // Синхронизация вращения
                if (this.isSpinning && this.finalAngle) {
                    if (!wasSpinning) {
                        // Вращение только началось
                        console.log(`🌀 Начало синхронизированного вращения: ${this.finalAngle}°`);
                        this.startSynchronizedSpin(data.game.spinStartedAt);
                    } else if (data.game.spinSyncData) {
                        // Продолжаем синхронизацию существующего вращения
                        this.syncExistingSpin(data.game.spinSyncData);
                    }
                }
                
                // Если игра закончилась и есть победитель
                if (data.game.status === 'finished' && this.winner && !this.winnerAnnounced) {
                    console.log(`🏆 Победитель: ${this.winner.first_name}`);
                    this.showWinner(this.winner);
                    this.winnerAnnounced = true;
                    
                    // Перезапуск через 8 секунд
                    setTimeout(() => {
                        this.resetForNextRound();
                    }, 8000);
                }
                
                this.lastUpdateTime = new Date();
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки состояния игры:', error);
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
        
        // Нормализуем угол (убираем полные обороты)
        const normalizedAngle = finalAngle % 360;
        
        // Участники расположены по часовой стрелке, указатель сверху (0°)
        const sectorAngle = 360 / this.participants.length;
        
        // Определяем сектор (от 0 до participants.length-1)
        let sector = Math.floor(normalizedAngle / sectorAngle);
        
        // Инвертируем, так как вращение идет по часовой стрелке
        sector = (this.participants.length - sector) % this.participants.length;
        if (sector < 0) sector += this.participants.length;
        
        const winner = this.participants[sector];
        
        if (winner) {
            console.log(`🎯 Рассчитан победитель по углу: ${winner.first_name} (сектор: ${sector})`);
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
    
    resetForNextRound() {
        console.log('🔄 Сбрасываем игру для следующего раунда');
        
        this.hideWinner();
        this.isSpinning = false;
        this.winnerAnnounced = false;
        this.finalAngle = null;
        this.winner = null;
        
        // Плавный сброс колеса
        this.resetWheelPosition();
        
        // Обновляем UI
        this.updateButtons();
        
        // Перезагружаем состояние игры через 1 секунду
        setTimeout(() => {
            this.loadGameState();
        }, 1000);
    }
    
    // В wheel.js полностью перепишите метод joinGame:
    // В wheel.js упростите метод joinGame:
    async joinGame() {
        console.log('🎮 joinGame вызван');
        
        // Проверяем наличие пользователя
        if (!window.currentUser) {
            console.error('❌ Нет текущего пользователя');
            window.showStatus('❌ Сначала войдите в аккаунт', 'error');
            return;
        }
        
        console.log('👤 Текущий пользователь:', window.currentUser.first_name);
        
        try {
            // Прямой вызов API
            const response = await fetch('/api/game/join', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
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
                
                // Обновляем UI
                this.updateButtons();
                this.renderParticipants();
                this.updateWheel();
                
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
        
        // Очищаем только если нужно
        if (participantsContainer.children.length !== this.participants.length) {
            participantsContainer.innerHTML = '';
        }
        
        if (this.participants.length === 0) {
            this.wheelElement.style.background = '#222';
            return;
        }
        
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#fab1a0', '#a29bfe', '#fd79a8'];
        const sectorAngle = 360 / this.participants.length;
        
        // Создаем конический градиент
        let gradientParts = [];
        for (let i = 0; i < this.participants.length; i++) {
            const startAngle = i * sectorAngle;
            const endAngle = (i + 1) * sectorAngle;
            const color = colors[i % colors.length];
            gradientParts.push(`${color} ${startAngle}deg ${endAngle}deg`);
        }
        
        this.wheelElement.style.background = `conic-gradient(${gradientParts.join(', ')})`;
        
        // Добавляем участников на колесо (только если их еще нет)
        if (participantsContainer.children.length !== this.participants.length) {
            this.participants.forEach((participant, index) => {
                // Центр сектора (в градусах)
                const centerAngle = (index * sectorAngle) + (sectorAngle / 2);
                
                const participantElement = document.createElement('div');
                participantElement.className = 'wheel-participant';
                participantElement.setAttribute('data-index', index);
                participantElement.setAttribute('data-user-id', participant.id);
                
                // Позиционирование
                const radius = 110; // px от центра
                const angleRad = (centerAngle - 90) * (Math.PI / 180);
                
                participantElement.style.position = 'absolute';
                participantElement.style.width = '50px';
                participantElement.style.height = '50px';
                participantElement.style.top = `calc(50% - 25px)`;
                participantElement.style.left = `calc(50% - 25px)`;
                participantElement.style.transform = `
                    translate(${Math.cos(angleRad) * radius}px, ${Math.sin(angleRad) * radius}px)
                `;
                participantElement.style.transformOrigin = 'center';
                
                // Аватар или инициалы
                if (participant.photo_url) {
                    const img = document.createElement('img');
                    img.src = participant.photo_url;
                    img.alt = participant.first_name;
                    img.style.width = '100%';
                    img.style.height = '100%';
                    img.style.objectFit = 'cover';
                    img.style.borderRadius = '50%';
                    img.onerror = () => {
                        participantElement.innerHTML = `
                            <div class="initials" style="
                                width: 100%;
                                height: 100%;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                font-size: 16px;
                                background: rgba(0,0,0,0.7);
                                color: white;
                                border-radius: 50%;
                            ">
                                ${this.getInitials(participant.first_name, participant.last_name)}
                            </div>
                        `;
                    };
                    participantElement.appendChild(img);
                } else {
                    participantElement.innerHTML = `
                        <div class="initials" style="
                            width: 100%;
                            height: 100%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 16px;
                            background: rgba(0,0,0,0.7);
                            color: white;
                            border-radius: 50%;
                        ">
                            ${this.getInitials(participant.first_name, participant.last_name)}
                        </div>
                    `;
                }
                
                participantsContainer.appendChild(participantElement);
            });
        }
    }
    
    renderParticipants() {
        const participantsList = document.getElementById('participantsList');
        
        if (!participantsList) return;
        
        if (this.participants.length === 0) {
            participantsList.innerHTML = `
                <div class="no-participants">
                    <p>👤 Пока никто не участвует</p>
                    <p style="font-size: 0.9rem; color: #666; margin-top: 10px;">
                        Нажмите "Участвовать", чтобы начать игру
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
                <div class="participant-item ${isCurrentUser ? 'current-user' : ''} ${isWinner ? 'winner' : ''}" 
                     data-index="${index}">
                    <div class="participant-avatar">
                        ${participant.photo_url 
                            ? `<img src="${participant.photo_url}" alt="${participant.first_name}" 
                                 onerror="this.parentElement.innerHTML='<div class=\\'initials\\'>${this.getInitials(participant.first_name, participant.last_name)}</div>'">`
                            : `<div class="initials">${this.getInitials(participant.first_name, participant.last_name)}</div>`
                        }
                        ${isWinner ? '<div class="winner-crown">👑</div>' : ''}
                    </div>
                    <div class="participant-name">
                        ${participant.first_name}
                        ${participant.last_name ? ` ${participant.last_name.charAt(0)}.` : ''}
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
        
        // Кнопка "Участвовать"
        if (!window.currentUser) {
            joinButton.disabled = true;
            joinButton.innerHTML = '<span class="icon">🔒</span> ВОЙДИТЕ ДЛЯ УЧАСТИЯ';
            joinButton.title = 'Сначала войдите через Telegram';
        } else if (this.isSpinning || this.winnerAnnounced) {
            joinButton.disabled = true;
            joinButton.innerHTML = '<span class="icon">🎰</span> ИГРА АКТИВНА';
            joinButton.title = 'Дождитесь окончания текущей игры';
        } else if (isUserParticipating) {
            joinButton.disabled = true;
            joinButton.innerHTML = '<span class="icon">✅</span> ВЫ УЧАСТВУЕТЕ';
            joinButton.title = 'Вы уже участвуете в этой игре';
        } else if (this.participants.length >= this.maxParticipants) {
            joinButton.disabled = true;
            joinButton.innerHTML = '<span class="icon">🚫</span> МЕСТ НЕТ';
            joinButton.title = 'Достигнут лимит участников';
        } else if (this.countdown !== null && this.countdown <= 10) {
            joinButton.disabled = true;
            joinButton.innerHTML = '<span class="icon">⏳</span> ЗАПУСК СКОРО';
            joinButton.title = 'Игра скоро начнется';
        } else if (this.countdown !== null) {
            joinButton.disabled = false;
            joinButton.innerHTML = '<span class="icon">➕</span> УСПЕЙ УЧАСТВОВАТЬ';
            joinButton.title = 'Присоединиться до запуска';
        } else {
            joinButton.disabled = false;
            joinButton.innerHTML = '<span class="icon">➕</span> УЧАСТВОВАТЬ';
            joinButton.title = 'Присоединиться к игре';
        }
    }
    
    showWinner(winner) {
        if (!winner) return;
        
        const winnerAvatar = document.getElementById('winnerAvatar');
        const winnerName = document.getElementById('winnerName');
        const winnerSection = document.getElementById('winnerSection');
        const nextRoundTimer = document.getElementById('nextRoundTimer');
        
        // Обновляем аватар
        winnerAvatar.innerHTML = '';
        if (winner.photo_url) {
            const img = document.createElement('img');
            img.src = winner.photo_url;
            img.alt = winner.first_name;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '50%';
            img.onerror = () => {
                const initials = this.getInitials(winner.first_name, winner.last_name);
                winnerAvatar.innerHTML = `<div class="initials">${initials}</div>`;
            };
            winnerAvatar.appendChild(img);
        } else {
            const initials = this.getInitials(winner.first_name, winner.last_name);
            winnerAvatar.innerHTML = `<div class="initials">${initials}</div>`;
        }
        
        winnerName.textContent = `${winner.first_name} ${winner.last_name || ''}`.trim();
        
        // Показываем секцию
        winnerSection.style.display = 'block';
        setTimeout(() => {
            winnerSection.classList.add('visible');
        }, 10);
        
        // Запускаем таймер следующего раунда
        let timer = 8;
        nextRoundTimer.textContent = timer;
        
        const countdownInterval = setInterval(() => {
            timer--;
            nextRoundTimer.textContent = timer;
            
            if (timer <= 0) {
                clearInterval(countdownInterval);
            }
        }, 1000);
        
        // Показываем статус
        if (window.showStatus) {
            window.showStatus(`🎉 Победитель: ${winner.first_name}!`, 'success');
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
        
        // Обновляем кнопки при изменении пользователя
        if (window) {
            window.addEventListener('userChanged', () => {
                this.updateButtons();
            });
        }
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎡 Инициализация синхронизированного колеса фортуны...');
    window.fortuneWheel = new FortuneWheel();
});
