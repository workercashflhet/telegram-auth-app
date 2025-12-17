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
        
        this.init();
    }
    
    async init() {
        this.wheelElement = document.getElementById('fortuneWheel');
        this.setupEventListeners();
        await this.loadGameState();
        
        // Чаще обновляем состояние во время игры
        setInterval(() => this.loadGameState(), 1000);
    }
    
    async loadGameState() {
        try {
            const response = await fetch('/api/game/state');
            if (!response.ok) throw new Error('Network error');
            
            const data = await response.json();
            
            if (data.success && data.game) {
                this.currentGameId = data.game.id;
                this.participants = data.game.participants || [];
                this.countdown = data.game.status === 'counting' ? data.game.countdown : null;
                this.winner = data.game.winner || null;
                this.finalAngle = data.game.finalAngle || null;
                
                const wasSpinning = this.isSpinning;
                this.isSpinning = data.game.status === 'spinning';
                
                // Обновляем UI
                this.renderParticipants();
                this.updateWheel();
                this.updateTimer();
                this.updateButtons();
                
                // Обновляем таймер если нужно
                if (this.countdown !== null && !this.timerInterval) {
                    this.startCountdownTimer();
                } else if (this.countdown === null && this.timerInterval) {
                    this.stopCountdownTimer();
                }
                
                // Если игра только начала крутиться
                if (this.isSpinning && !wasSpinning && this.finalAngle) {
                    this.startSynchronizedSpin();
                }
                
                // Если игра закончилась и есть победитель
                if (data.game.status === 'finished' && this.winner && !this.winnerAnnounced) {
                    this.showWinner(this.winner);
                    this.winnerAnnounced = true;
                    
                    // Через 10 секунд очищаем
                    setTimeout(() => {
                        this.winnerAnnounced = false;
                        this.hideWinner();
                    }, 10000);
                }
            }
        } catch (error) {
            console.error('Error loading game state:', error);
        }
    }
    
    // Синхронизированное вращение
    startSynchronizedSpin() {
        if (!this.finalAngle || this.participants.length < 2) return;
        
        this.isSpinning = true;
        this.updateButtons();
        this.hideWinner();
        
        console.log(`🌀 Запускаем синхронизированное вращение: ${this.finalAngle}°`);
        
        // Сбрасываем трансформацию перед новым вращением
        this.wheelElement.style.transition = 'none';
        this.wheelElement.style.transform = 'rotate(0deg)';
        
        // Ждем немного для сброса анимации
        setTimeout(() => {
            this.wheelElement.style.transition = 'transform 5s cubic-bezier(0.17, 0.67, 0.83, 0.67)';
            this.wheelElement.style.transform = `rotate(${this.finalAngle}deg)`;
            
            // Через 5 секунд показываем победителя
            setTimeout(() => {
                if (this.winner) {
                    this.showWinner(this.winner);
                } else {
                    // Если победитель еще не пришел с сервера, пытаемся рассчитать
                    this.determineWinnerFromAngle(this.finalAngle);
                }
            }, 5000);
        }, 50);
    }
    
    // Определить победителя по углу (резервный метод)
    determineWinnerFromAngle(finalAngle) {
        if (!finalAngle || this.participants.length === 0) return;
        
        const normalizedAngle = finalAngle % 360;
        const sectorAngle = 360 / this.participants.length;
        
        let sector = Math.floor(normalizedAngle / sectorAngle);
        sector = this.participants.length - 1 - sector;
        
        if (sector < 0) sector = 0;
        if (sector >= this.participants.length) sector = this.participants.length - 1;
        
        const winner = this.participants[sector];
        this.showWinner(winner);
    }
    
    // ... остальные методы (joinGame, updateWheel, renderParticipants и т.д.) остаются как были ...
    
    // Обновить кнопки
    updateButtons() {
        const joinButton = document.getElementById('joinButton');
        
        if (!joinButton) return;
        
        const isUserParticipating = window.currentUser && 
            this.participants.some(p => p.id === window.currentUser.id);
        
        // Кнопка "Участвовать"
        if (!window.currentUser) {
            joinButton.disabled = true;
            joinButton.innerHTML = '<span class="icon">🔒</span> ВОЙДИТЕ ДЛЯ УЧАСТИЯ';
        } else if (this.isSpinning || this.winnerAnnounced) {
            joinButton.disabled = true;
            joinButton.innerHTML = '<span class="icon">🎰</span> ИГРА АКТИВНА';
        } else if (isUserParticipating) {
            joinButton.disabled = true;
            joinButton.innerHTML = '<span class="icon">✅</span> ВЫ УЧАСТВУЕТЕ';
        } else if (this.participants.length >= this.maxParticipants) {
            joinButton.disabled = true;
            joinButton.innerHTML = '<span class="icon">🚫</span> МЕСТ НЕТ';
        } else if (this.countdown !== null) {
            joinButton.disabled = true;
            joinButton.innerHTML = '<span class="icon">⏳</span> ОТСЧЁТ ИДЁТ';
        } else {
            joinButton.disabled = false;
            joinButton.innerHTML = '<span class="icon">➕</span> УЧАСТВОВАТЬ';
        }
    }
    
    // Показать победителя с улучшенной анимацией
    showWinner(winner) {
        if (!winner) return;
        
        const winnerAvatar = document.getElementById('winnerAvatar');
        const winnerName = document.getElementById('winnerName');
        const winnerSection = document.getElementById('winnerSection');
        
        // Очищаем и заполняем аватар
        if (winner.photo_url) {
            winnerAvatar.innerHTML = `<img src="${winner.photo_url}" alt="${winner.first_name}" style="width: 100%; height: 100%; object-fit: cover;">`;
        } else {
            const initials = this.getInitials(winner.first_name, winner.last_name);
            winnerAvatar.innerHTML = `<div class="initials" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: bold;">${initials}</div>`;
        }
        
        winnerName.textContent = `${winner.first_name} ${winner.last_name || ''}`.trim();
        
        // Анимация появления
        winnerSection.style.display = 'block';
        setTimeout(() => {
            winnerSection.classList.add('visible');
        }, 10);
        
        // Показываем статус
        window.showStatus(`🎉 Победитель: ${winner.first_name}!`, 'success');
        
        this.winnerAnnounced = true;
    }
    
    // Скрыть победителя
    hideWinner() {
        const winnerSection = document.getElementById('winnerSection');
        winnerSection.classList.remove('visible');
        
        setTimeout(() => {
            winnerSection.style.display = 'none';
        }, 500);
    }
    
    // Обновить колесо
    // wheel.js - исправить метод updateWheel
    updateWheel() {
        const participantsContainer = document.getElementById('wheelParticipants');
        
        if (!participantsContainer) return;
        
        participantsContainer.innerHTML = '';
        
        if (this.participants.length === 0) {
            this.wheelElement.style.background = '#222';
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
        
        this.wheelElement.style.background = `conic-gradient(${gradientParts.join(', ')})`;
        
        this.participants.forEach((participant, index) => {
            // ИСПРАВЛЕНИЕ: правильный расчет угла
            const angle = (index * sectorAngle) + (sectorAngle / 2) - 90;
            const radius = 100; // Уменьшаем радиус для лучшего позиционирования
            
            const participantElement = document.createElement('div');
            participantElement.className = 'wheel-participant';
            
            // ИСПРАВЛЕНИЕ: правильное позиционирование
            participantElement.style.position = 'absolute';
            participantElement.style.top = '50%';
            participantElement.style.left = '50%';
            participantElement.style.transform = `
                translate(-50%, -50%)
                rotate(${angle}deg) 
                translate(${radius}px) 
                rotate(${-angle}deg)
            `;
            participantElement.style.transformOrigin = '0 0';
            
            if (participant.photo_url) {
                const img = document.createElement('img');
                img.src = participant.photo_url;
                img.alt = participant.first_name;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                img.onerror = () => {
                    // Если фото не загружается, показываем инициалы
                    const initials = this.getInitials(participant.first_name, participant.last_name);
                    participantElement.innerHTML = `<div class="initials" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 24px;">${initials}</div>`;
                };
                participantElement.appendChild(img);
            } else {
                const initials = this.getInitials(participant.first_name, participant.last_name);
                participantElement.innerHTML = `<div class="initials" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 24px;">${initials}</div>`;
            }
            
            participantsContainer.appendChild(participantElement);
        });
    }
    
    // Отобразить участников
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
        
        this.participants.forEach(participant => {
            const isCurrentUser = window.currentUser && participant.id === window.currentUser.id;
            
            html += `
                <div class="participant-item ${isCurrentUser ? 'current-user' : ''}">
                    <div class="participant-avatar">
                        ${participant.photo_url 
                            ? `<img src="${participant.photo_url}" alt="${participant.first_name}" onerror="this.parentElement.innerHTML='<div class=\\'initials\\'>${this.getInitials(participant.first_name, participant.last_name)}</div>'">`
                            : `<div class="initials">${this.getInitials(participant.first_name, participant.last_name)}</div>`
                        }
                    </div>
                    <div class="participant-name">
                        ${participant.first_name}
                        ${participant.last_name ? ` ${participant.last_name.charAt(0)}.` : ''}
                        ${isCurrentUser ? '<br><span style="color: #4ecdc4; font-size: 0.8rem;">(Вы)</span>' : ''}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        participantsList.innerHTML = html;
    }

    // wheel.js - добавить метод для таймера следующего раунда
    startNextRoundTimer() {
        let timer = 5;
        const timerElement = document.getElementById('nextRoundTimer');
        
        if (!timerElement) return;
        
        const countdown = setInterval(() => {
            timer--;
            timerElement.textContent = timer;
            
            if (timer <= 0) {
                clearInterval(countdown);
                this.resetForNextRound();
            }
        }, 1000);
    }

    resetForNextRound() {
        this.hideWinner();
        this.participants = [];
        this.isSpinning = false;
        this.winnerAnnounced = false;
        this.finalAngle = null;
        this.winner = null;
        
        // Сбрасываем колесо
        this.wheelElement.style.transition = 'none';
        this.wheelElement.style.transform = 'rotate(0deg)';
        
        // Обновляем UI
        this.renderParticipants();
        this.updateWheel();
        this.updateTimer();
        this.updateButtons();
        
        // Перезагружаем состояние игры
        setTimeout(() => {
            this.loadGameState();
        }, 1000);
    }
    
    // Обновить таймер
    updateTimer() {
        const timerElement = document.getElementById('gameTimer');
        const timerLabel = document.getElementById('timerLabel');
        
        if (!timerElement || !timerLabel) return;
        
        if (this.countdown !== null && this.countdown > 0) {
            timerElement.textContent = this.countdown;
            timerLabel.textContent = 'СЕКУНД ДО СТАРТА';
            timerElement.style.color = '#ff6b6b';
        } else {
            timerElement.textContent = this.participants.length;
            timerLabel.textContent = 'УЧАСТНИКОВ';
            timerElement.style.color = this.participants.length > 0 ? '#4ecdc4' : '#666';
        }
    }
    
    // Обновить кнопки
      // Обновить кнопки (теперь только одна кнопка)
    updateButtons() {
        const joinButton = document.getElementById('joinButton');
        
        if (!joinButton) return;
        
        const isUserParticipating = window.currentUser && 
            this.participants.some(p => p.id === window.currentUser.id);
        
        // Кнопка "Участвовать"
        if (!window.currentUser) {
            joinButton.disabled = true;
            joinButton.innerHTML = '<span class="icon">🔒</span> ВОЙДИТЕ ДЛЯ УЧАСТИЯ';
        } else if (this.isSpinning) {
            joinButton.disabled = true;
            joinButton.innerHTML = '<span class="icon">⏳</span> ИДЁТ ИГРА';
        } else if (isUserParticipating) {
            joinButton.disabled = true;
            joinButton.innerHTML = '<span class="icon">✅</span> ВЫ УЧАСТВУЕТЕ';
        } else if (this.participants.length >= this.maxParticipants) {
            joinButton.disabled = true;
            joinButton.innerHTML = '<span class="icon">🚫</span> МЕСТ НЕТ';
        } else if (this.countdown !== null) {
            joinButton.disabled = true;
            joinButton.innerHTML = '<span class="icon">⏳</span> ОТСЧЁТ ИДЁТ';
        } else {
            joinButton.disabled = false;
            joinButton.innerHTML = '<span class="icon">➕</span> УЧАСТВОВАТЬ';
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
        
        if (joinButton) {
            joinButton.addEventListener('click', () => this.joinGame());
        }
        
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    window.fortuneWheel = new FortuneWheel();
});