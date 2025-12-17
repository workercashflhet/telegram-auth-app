// public/wheel.js - Логика колеса фортуны для реальных пользователей
class FortuneWheel {
    constructor() {
        this.participants = [];
        this.isSpinning = false;
        this.countdown = null;
        this.countdownTime = 30;
        this.timerInterval = null;
        this.maxParticipants = 8;
        this.currentGameId = null;
        
        this.init();
    }
    
    async init() {
        this.renderParticipants();
        this.updateTimer();
        this.setupEventListeners();
        
        // Загружаем текущее состояние игры с сервера
        await this.loadGameState();
        
        // Если есть активная игра, подключаемся к ней
        if (this.currentGameId) {
            this.startPolling();
        }
    }
    
    // Загрузить состояние игры с сервера
    async loadGameState() {
        try {
            const response = await fetch('/api/game/state');
            const data = await response.json();
            
            if (data.success && data.game) {
                this.currentGameId = data.game.id;
                this.participants = data.game.participants || [];
                this.countdown = data.game.status === 'counting' ? data.game.countdown : null;
                this.isSpinning = data.game.status === 'spinning';
                
                // Обновляем таймер
                if (this.countdown !== null && !this.timerInterval) {
                    this.startCountdownTimer();
                }
                
                this.renderParticipants();
                this.updateWheel();
                this.updateTimer();
                this.updateButtons();
            }
        } catch (error) {
            console.error('Error loading game state:', error);
        }
    }
    
    // Присоединиться к игре
    async joinGame() {
        if (!window.currentUser) {
            window.showStatus('Сначала войдите в аккаунт', 'error');
            return false;
        }
        
        if (this.isSpinning) {
            window.showStatus('Игра уже началась', 'error');
            return false;
        }
        
        if (this.participants.length >= this.maxParticipants) {
            window.showStatus('Достигнут лимит участников', 'error');
            return false;
        }
        
        // Проверяем, не участвует ли уже
        const isAlreadyParticipating = this.participants.some(p => p.id === window.currentUser.id);
        if (isAlreadyParticipating) {
            window.showStatus('Вы уже участвуете в игре', 'info');
            return false;
        }
        
        try {
            const response = await fetch('/api/game/join', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: window.currentUser.id,
                    gameId: this.currentGameId
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.participants = data.game.participants;
                this.currentGameId = data.game.id;
                
                window.showStatus('Вы присоединились к игре!', 'success');
                this.renderParticipants();
                this.updateWheel();
                this.updateTimer();
                this.updateButtons();
                
                // Автоматически запускаем таймер если участников > 1
                if (this.participants.length > 1 && !this.countdown) {
                    this.startCountdownTimer();
                }
                
                return true;
            } else {
                window.showStatus(data.error || 'Ошибка при присоединении', 'error');
                return false;
            }
        } catch (error) {
            console.error('Error joining game:', error);
            window.showStatus('Ошибка соединения с сервером', 'error');
            return false;
        }
    }
    
    // Начать вращение колеса
    async startSpinning() {
        if (this.isSpinning || this.participants.length < 2) {
            return;
        }
        
        try {
            const response = await fetch('/api/game/spin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    gameId: this.currentGameId
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.isSpinning = true;
                this.updateButtons();
                this.hideWinner();
                
                // Анимация вращения колеса
                const spins = 5;
                const sectorAngle = 360 / this.participants.length;
                const randomSector = Math.floor(Math.random() * this.participants.length);
                const finalAngle = spins * 360 + (randomSector * sectorAngle) + (Math.random() * sectorAngle);
                
                this.wheelElement.style.transition = 'transform 5s cubic-bezier(0.17, 0.67, 0.83, 0.67)';
                this.wheelElement.style.transform = `rotate(${finalAngle}deg)`;
                
                // Определяем победителя после вращения
                setTimeout(() => {
                    this.determineWinner(finalAngle);
                    this.isSpinning = false;
                    this.updateButtons();
                }, 5000);
                
            } else {
                window.showStatus(data.error || 'Не удалось запустить колесо', 'error');
            }
        } catch (error) {
            console.error('Error starting spin:', error);
            window.showStatus('Ошибка соединения с сервером', 'error');
        }
    }
    
    // Запустить таймер отсчета
    startCountdownTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        if (this.countdown === null) {
            this.countdown = this.countdownTime;
        }
        
        this.timerInterval = setInterval(() => {
            this.countdown--;
            this.updateTimer();
            
            // Когда таймер достигнет 0, запускаем колесо
            if (this.countdown <= 0) {
                this.startSpinning();
                this.stopCountdownTimer();
            }
            
            // Обновляем состояние на сервере
            this.updateGameState();
        }, 1000);
    }
    
    // Остановить таймер
    stopCountdownTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.countdown = null;
        this.updateTimer();
    }
    
    // Опрос сервера для обновления состояния игры
    startPolling() {
        // Опрашиваем сервер каждые 3 секунды для обновления состояния
        setInterval(async () => {
            if (!this.isSpinning) {
                await this.loadGameState();
            }
        }, 3000);
    }
    
    // Обновить состояние игры на сервере
    async updateGameState() {
        // В реальном приложении здесь был бы WebSocket
        // Для демо просто обновляем локальное состояние
    }
    
    // Определить победителя
    determineWinner(finalAngle) {
        const normalizedAngle = finalAngle % 360;
        const sectorAngle = 360 / this.participants.length;
        
        let sector = Math.floor(normalizedAngle / sectorAngle);
        sector = this.participants.length - 1 - sector;
        
        if (sector < 0) sector = 0;
        if (sector >= this.participants.length) sector = this.participants.length - 1;
        
        const winner = this.participants[sector];
        this.showWinner(winner);
        
        // Очищаем список участников через 5 секунд
        setTimeout(() => {
            this.participants = [];
            this.renderParticipants();
            this.updateWheel();
            this.stopCountdownTimer();
            this.updateButtons();
        }, 5000);
    }
    
    // Показать победителя
    showWinner(winner) {
        if (!winner) return;
        
        const winnerAvatar = document.getElementById('winnerAvatar');
        const winnerName = document.getElementById('winnerName');
        const winnerSection = document.getElementById('winnerSection');
        
        if (winner.photo_url) {
            winnerAvatar.innerHTML = `<img src="${winner.photo_url}" alt="${winner.first_name}">`;
        } else {
            const initials = this.getInitials(winner.first_name, winner.last_name);
            winnerAvatar.innerHTML = `<div class="initials">${initials}</div>`;
        }
        
        winnerName.textContent = `${winner.first_name} ${winner.last_name || ''}`.trim();
        winnerSection.classList.add('visible');
    }
    
    // Скрыть победителя
    hideWinner() {
        const winnerSection = document.getElementById('winnerSection');
        winnerSection.classList.remove('visible');
    }
    
    // Обновить колесо
    updateWheel() {
        const wheel = document.getElementById('fortuneWheel');
        const participantsContainer = document.getElementById('wheelParticipants');
        
        if (!participantsContainer) return;
        
        participantsContainer.innerHTML = '';
        
        if (this.participants.length === 0) {
            wheel.style.background = '#222';
            return;
        }
        
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#fab1a0', '#a29bfe', '#fd79a8'];
        const sectorAngle = 360 / this.participants.length;
        
        let gradientParts = [];
        for (let i = 0; i < this.participants.length; i++) {
            const startAngle = i * sectorAngle;
            const endAngle = (i + 1) * sectorAngle;
            const color = colors[i % colors.length];
            gradientParts.push(`${color} ${startAngle}deg ${endAngle}deg`);
        }
        
        wheel.style.background = `conic-gradient(${gradientParts.join(', ')})`;
        
        this.participants.forEach((participant, index) => {
            const angle = (index * sectorAngle) + (sectorAngle / 2) - 90;
            const radius = 120;
            
            const participantElement = document.createElement('div');
            participantElement.className = 'wheel-participant';
            participantElement.style.transform = `
                rotate(${angle}deg) 
                translate(${radius}px) 
                rotate(${-angle}deg)
            `;
            
            if (participant.photo_url) {
                participantElement.innerHTML = `<img src="${participant.photo_url}" alt="${participant.first_name}">`;
            } else {
                const initials = this.getInitials(participant.first_name, participant.last_name);
                participantElement.innerHTML = `<div class="initials">${initials}</div>`;
            }
            
            participantsContainer.appendChild(participantElement);
        });
    }
    
    // Отобразить список участников
    renderParticipants() {
        const participantsList = document.getElementById('participantsList');
        
        if (!participantsList) return;
        
        if (this.participants.length === 0) {
            participantsList.innerHTML = `
                <div class="no-participants">
                    <p>Пока никто не участвует</p>
                    <p style="font-size: 0.9rem; color: #666; margin-top: 10px;">
                        Будьте первым! Нажмите "Участвовать"
                    </p>
                </div>
            `;
            return;
        }
        
        let html = '<div class="participants-grid">';
        
        this.participants.forEach(participant => {
            const isCurrentUser = window.currentUser && participant.id === window.currentUser.id;
            
            html += `
                <div class="participant-item ${isCurrentUser ? 'current-user' : ''}">
                    <div class="participant-avatar">
                        ${participant.photo_url 
                            ? `<img src="${participant.photo_url}" alt="${participant.first_name}">`
                            : `<div class="initials">${this.getInitials(participant.first_name, participant.last_name)}</div>`
                        }
                    </div>
                    <div class="participant-name">
                        ${participant.first_name}
                        ${isCurrentUser ? '<br><span style="color: #4ecdc4; font-size: 0.8rem;">(Вы)</span>' : ''}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        participantsList.innerHTML = html;
    }
    
    // Обновить таймер
    updateTimer() {
        const timerElement = document.getElementById('gameTimer');
        const timerLabel = document.getElementById('timerLabel');
        
        if (!timerElement || !timerLabel) return;
        
        if (this.countdown !== null) {
            timerElement.textContent = this.countdown;
            timerLabel.textContent = 'СЕКУНД ДО СТАРТА';
            timerElement.style.color = '#4ecdc4';
        } else {
            timerElement.textContent = this.participants.length;
            timerLabel.textContent = 'УЧАСТНИКОВ';
            timerElement.style.color = this.participants.length > 1 ? '#4ecdc4' : '#666';
        }
        
        this.updateButtons();
    }
    
    // Обновить кнопки
    updateButtons() {
        const joinButton = document.getElementById('joinButton');
        const startButton = document.getElementById('startButton');
        
        if (!joinButton || !startButton) return;
        
        const isUserParticipating = window.currentUser && 
            this.participants.some(p => p.id === window.currentUser.id);
        
        if (this.isSpinning) {
            joinButton.disabled = true;
            joinButton.innerHTML = '<span class="icon">⏳</span> ИДЁТ ИГРА';
            startButton.disabled = true;
            startButton.innerHTML = '<span class="icon">⏳</span> В ПРОЦЕССЕ';
        } else if (isUserParticipating) {
            joinButton.disabled = true;
            joinButton.innerHTML = '<span class="icon">✅</span> ВЫ УЧАСТВУЕТЕ';
            startButton.disabled = this.participants.length < 2;
            startButton.innerHTML = '<span class="icon">🎰</span> ЗАПУСТИТЬ';
        } else {
            joinButton.disabled = !window.currentUser || 
                this.participants.length >= this.maxParticipants ||
                this.countdown !== null;
            joinButton.innerHTML = '<span class="icon">➕</span> УЧАСТВОВАТЬ';
            startButton.disabled = this.participants.length < 2 || this.countdown !== null;
            startButton.innerHTML = '<span class="icon">🎰</span> ЗАПУСТИТЬ РАНЬШЕ';
        }
    }
    
    // Получить инициалы
    getInitials(firstName, lastName) {
        const first = firstName ? firstName.charAt(0).toUpperCase() : 'T';
        const last = lastName ? lastName.charAt(0).toUpperCase() : '';
        return first + last;
    }
    
    // Настройка обработчиков
    setupEventListeners() {
        const joinButton = document.getElementById('joinButton');
        const startButton = document.getElementById('startButton');
        
        if (joinButton) {
            joinButton.addEventListener('click', () => {
                this.joinGame();
            });
        }
        
        if (startButton) {
            startButton.addEventListener('click', () => {
                if (this.participants.length >= 2) {
                    this.startSpinning();
                }
            });
        }
        
        // Обновляем элементы DOM
        this.wheelElement = document.getElementById('fortuneWheel');
    }
}

// Глобальная переменная
let fortuneWheel = null;

document.addEventListener('DOMContentLoaded', () => {
    fortuneWheel = new FortuneWheel();
    window.fortuneWheel = fortuneWheel;
});