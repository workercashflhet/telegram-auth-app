// public/wheel.js - Логика колеса фортуны
class FortuneWheel {
    constructor() {
        this.participants = [];
        this.isSpinning = false;
        this.countdown = null;
        this.countdownTime = 30;
        this.timerInterval = null;
        this.wheelElement = document.getElementById('fortuneWheel');
        this.timerElement = document.getElementById('gameTimer');
        this.timerLabel = document.getElementById('timerLabel');
        this.participantsList = document.getElementById('participantsList');
        this.winnerSection = document.getElementById('winnerSection');
        this.winnerAvatar = document.getElementById('winnerAvatar');
        this.winnerName = document.getElementById('winnerName');
        this.joinButton = document.getElementById('joinButton');
        this.startButton = document.getElementById('startButton');
        
        this.init();
    }
    
    init() {
        this.renderParticipants();
        this.updateTimer();
        this.setupEventListeners();
    }
    
    // Добавить участника
    addParticipant(user) {
        if (this.isSpinning) return false;
        
        // Проверяем, не участвует ли уже
        const exists = this.participants.some(p => p.id === user.id);
        if (exists) return false;
        
        this.participants.push({
            ...user,
            angle: 0,
            position: this.participants.length
        });
        
        this.renderParticipants();
        this.updateWheel();
        
        // Автоматически запускаем таймер если участников > 1
        if (this.participants.length > 1 && !this.countdown) {
            this.startCountdown();
        }
        
        return true;
    }
    
    // Удалить участника
    removeParticipant(userId) {
        this.participants = this.participants.filter(p => p.id !== userId);
        this.renderParticipants();
        this.updateWheel();
        
        // Останавливаем таймер если участников < 2
        if (this.participants.length < 2 && this.countdown) {
            this.stopCountdown();
        }
    }
    
    // Начать отсчет до старта
    startCountdown() {
        if (this.countdown) return;
        
        this.countdown = this.countdownTime;
        this.updateTimer();
        
        this.timerInterval = setInterval(() => {
            this.countdown--;
            this.updateTimer();
            
            if (this.countdown <= 0) {
                this.startSpinning();
                this.stopCountdown();
            }
        }, 1000);
    }
    
    // Остановить отсчет
    stopCountdown() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.countdown = null;
        this.updateTimer();
    }
    
    // Обновить таймер на экране
    updateTimer() {
        if (this.countdown !== null) {
            this.timerElement.textContent = this.countdown;
            this.timerLabel.textContent = 'СЕКУНД ДО СТАРТА';
            this.timerElement.style.color = '#4ecdc4';
        } else {
            this.timerElement.textContent = this.participants.length;
            this.timerLabel.textContent = 'УЧАСТНИКОВ';
            this.timerElement.style.color = this.participants.length > 1 ? '#4ecdc4' : '#666';
        }
        
        // Обновляем состояние кнопок
        this.updateButtons();
    }
    
    // Обновить состояние кнопок
    updateButtons() {
        const isUserParticipating = this.participants.some(p => p.id === window.currentUser?.id);
        
        if (this.isSpinning) {
            this.joinButton.disabled = true;
            this.joinButton.innerHTML = '<span class="icon">⏳</span> КОЛЕСО КРУТИТСЯ';
            this.startButton.disabled = true;
            this.startButton.innerHTML = '<span class="icon">⏳</span> В ПРОЦЕССЕ';
        } else if (isUserParticipating) {
            this.joinButton.disabled = true;
            this.joinButton.innerHTML = '<span class="icon">✅</span> ВЫ УЧАСТВУЕТЕ';
            this.startButton.disabled = this.participants.length < 2;
            this.startButton.innerHTML = '<span class="icon">🎰</span> КРУТИТЬ КОЛЕСО';
        } else {
            this.joinButton.disabled = !window.currentUser || this.participants.length >= 8;
            this.joinButton.innerHTML = '<span class="icon">➕</span> УЧАСТВОВАТЬ';
            this.startButton.disabled = this.participants.length < 2;
            this.startButton.innerHTML = '<span class="icon">🎰</span> КРУТИТЬ КОЛЕСО';
        }
    }
    
    // Начать вращение колеса
    startSpinning() {
        if (this.isSpinning || this.participants.length < 2) return;
        
        this.isSpinning = true;
        this.updateButtons();
        this.hideWinner();
        
        // Случайный угол поворота (много оборотов + случайный сектор)
        const spins = 5; // Количество полных оборотов
        const sectorAngle = 360 / this.participants.length;
        const randomSector = Math.floor(Math.random() * this.participants.length);
        const finalAngle = spins * 360 + (randomSector * sectorAngle) + (Math.random() * sectorAngle);
        
        // Анимация вращения
        this.wheelElement.style.transition = 'transform 5s cubic-bezier(0.17, 0.67, 0.83, 0.67)';
        this.wheelElement.style.transform = `rotate(${finalAngle}deg)`;
        
        // Определяем победителя после вращения
        setTimeout(() => {
            this.determineWinner(finalAngle);
            this.isSpinning = false;
            this.updateButtons();
        }, 5000);
    }
    
    // Определить победителя
    determineWinner(finalAngle) {
        // Нормализуем угол
        const normalizedAngle = finalAngle % 360;
        const sectorAngle = 360 / this.participants.length;
        
        // Определяем сектор
        let sector = Math.floor(normalizedAngle / sectorAngle);
        sector = this.participants.length - 1 - sector; // Инвертируем, так как вращение по часовой
        
        if (sector < 0) sector = 0;
        if (sector >= this.participants.length) sector = this.participants.length - 1;
        
        const winner = this.participants[sector];
        this.showWinner(winner);
        
        // Убираем всех участников кроме победителя
        setTimeout(() => {
            this.participants = [winner];
            this.renderParticipants();
            this.updateWheel();
            this.stopCountdown();
        }, 5000);
    }
    
    // Показать победителя
    showWinner(winner) {
        if (winner.photo_url) {
            this.winnerAvatar.innerHTML = `<img src="${winner.photo_url}" alt="${winner.first_name}">`;
        } else {
            const initials = this.getInitials(winner.first_name, winner.last_name);
            this.winnerAvatar.innerHTML = `<div class="initials">${initials}</div>`;
        }
        
        this.winnerName.textContent = `${winner.first_name} ${winner.last_name || ''}`.trim();
        this.winnerSection.classList.add('visible');
    }
    
    // Скрыть победителя
    hideWinner() {
        this.winnerSection.classList.remove('visible');
    }
    
    // Обновить колесо на экране
    updateWheel() {
        const wheel = document.getElementById('fortuneWheel');
        const participantsContainer = document.getElementById('wheelParticipants');
        
        if (!participantsContainer) return;
        
        participantsContainer.innerHTML = '';
        
        if (this.participants.length === 0) {
            wheel.style.background = '#222';
            return;
        }
        
        // Создаем градиент для секторов
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
        
        // Размещаем участников на колесе
        this.participants.forEach((participant, index) => {
            const angle = (index * sectorAngle) + (sectorAngle / 2) - 90; // Центр сектора
            const radius = 120; // Радиус от центра
            
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
        if (!this.participantsList) return;
        
        if (this.participants.length === 0) {
            this.participantsList.innerHTML = `
                <div class="no-participants">
                    <p>Пока никто не участвует</p>
                    <p style="font-size: 0.9rem; color: #666; margin-top: 10px;">
                        Будьте первым!
                    </p>
                </div>
            `;
            return;
        }
        
        let html = '<div class="participants-grid">';
        
        this.participants.forEach(participant => {
            const isCurrentUser = participant.id === window.currentUser?.id;
            
            html += `
                <div class="participant-item ${isCurrentUser ? 'current-user' : ''}">
                    <div class="participant-avatar">
                        ${participant.photo_url 
                            ? `<img src="${participant.photo_url}" alt="${participant.first_name}">`
                            : `<div class="initials">${this.getInitials(participant.first_name, participant.last_name)}</div>`
                        }
                    </div>
                    <div class="participant-name">
                        ${participant.first_name} ${participant.last_name ? participant.last_name.charAt(0) + '.' : ''}
                        ${isCurrentUser ? ' (Вы)' : ''}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        this.participantsList.innerHTML = html;
    }
    
    // Получить инициалы
    getInitials(firstName, lastName) {
        const first = firstName ? firstName.charAt(0).toUpperCase() : 'T';
        const last = lastName ? lastName.charAt(0).toUpperCase() : '';
        return first + last;
    }
    
    // Настройка обработчиков событий
    setupEventListeners() {
        if (this.joinButton) {
            this.joinButton.addEventListener('click', () => {
                if (!window.currentUser) {
                    window.showStatus('Сначала войдите в аккаунт', 'error');
                    return;
                }
                
                if (this.addParticipant(window.currentUser)) {
                    window.showStatus('Вы участвуете в игре!', 'success');
                }
            });
        }
        
        if (this.startButton) {
            this.startButton.addEventListener('click', () => {
                this.startSpinning();
            });
        }
    }
}

// Глобальная переменная для колеса
let fortuneWheel = null;

// Инициализация колеса при загрузке
document.addEventListener('DOMContentLoaded', () => {
    fortuneWheel = new FortuneWheel();
    window.fortuneWheel = fortuneWheel; // Делаем доступным глобально
});