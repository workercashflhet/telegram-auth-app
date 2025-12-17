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
        
        this.init();
    }
    
    async init() {
        this.wheelElement = document.getElementById('fortuneWheel');
        this.setupEventListeners();
        await this.loadGameState();
        
        setInterval(() => this.loadGameState(), 3000);
    }
    
    // Загрузить состояние игры
    // wheel.js - исправить метод loadGameState и добавить авто-вращение
    async loadGameState() {
        if (this.isSpinning) return;
        
        try {
            const response = await fetch('/api/game/state');
            if (!response.ok) throw new Error('Network error');
            
            const data = await response.json();
            
            if (data.success && data.game) {
                this.currentGameId = data.game.id;
                this.participants = data.game.participants || [];
                this.countdown = data.game.status === 'counting' ? data.game.countdown : null;
                this.isSpinning = data.game.status === 'spinning';
                
                // ВАЖНО: Если игра крутится, запускаем анимацию
                if (this.isSpinning && !this.spinningStarted) {
                    this.spinningStarted = true;
                    this.startSpinningAnimation();
                }
                
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
            }
        } catch (error) {
            console.error('Error loading game state:', error);
        }
    }

    // Новый метод для анимации вращения (автоматической)
    startSpinningAnimation() {
        if (this.participants.length < 2) return;
        
        this.isSpinning = true;
        this.updateButtons();
        this.hideWinner();
        
        // Анимация вращения
        const spins = 5;
        const sectorAngle = 360 / this.participants.length;
        const randomSector = Math.floor(Math.random() * this.participants.length);
        const finalAngle = spins * 360 + (randomSector * sectorAngle) + (Math.random() * sectorAngle);
        
        this.wheelElement.style.transition = 'transform 5s cubic-bezier(0.17, 0.67, 0.83, 0.67)';
        this.wheelElement.style.transform = `rotate(${finalAngle}deg)`;
        
        // Определяем победителя
        setTimeout(() => {
            this.determineWinner(finalAngle);
        }, 5000);
    }

    // Убираем старый метод startSpinning (он обращался к API, который больше не нужен)
    // Заменяем его на анимацию выше
    
    // Участвовать в игре
    // wheel.js - исправленная функция joinGame
    async joinGame() {
        // Проверяем авторизацию
        if (!window.currentUser || !window.currentUser.id) {
            window.showStatus('❌ Сначала войдите в аккаунт', 'error');
            
            // Если пользователь в демо-режиме, пробуем создать демо-пользователя
            if (!window.Telegram?.WebApp?.initData) {
                this.createDemoUserAndJoin();
                return false;
            }
            
            return false;
        }
        
        // Проверяем состояние игры
        if (this.isSpinning) {
            window.showStatus('❌ Игра уже началась', 'error');
            return false;
        }
        
        if (this.participants.length >= this.maxParticipants) {
            window.showStatus('❌ Достигнут лимит участников (8)', 'error');
            return false;
        }
        
        // Проверяем, не участвует ли уже
        const isAlreadyParticipating = this.participants.some(p => p.id === window.currentUser.id);
        if (isAlreadyParticipating) {
            window.showStatus('✅ Вы уже участвуете в игре', 'info');
            return false;
        }
        
        // Показываем загрузку
        const joinButton = document.getElementById('joinButton');
        const originalText = joinButton.innerHTML;
        joinButton.innerHTML = '<span class="icon">⏳</span> ПОДКЛЮЧЕНИЕ...';
        joinButton.disabled = true;
        
        try {
            const response = await fetch('/api/game/join', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: window.currentUser.id,
                    // Добавляем userData для демо-режима
                    userData: window.currentUser
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                window.showStatus('✅ Вы успешно присоединились к игре!', 'success');
                
                // Обновляем состояние
                this.participants = data.game.participants || [];
                this.countdown = data.game.countdown;
                
                this.renderParticipants();
                this.updateWheel();
                this.updateTimer();
                this.updateButtons();
                
                // Если участников стало больше 1, запускаем таймер
                if (this.participants.length > 1 && !this.timerInterval) {
                    this.startCountdownTimer();
                }
                
                return true;
            } else {
                window.showStatus(`❌ ${data.error || 'Ошибка при присоединении'}`, 'error');
                return false;
            }
        } catch (error) {
            console.error('Error joining game:', error);
            window.showStatus('❌ Ошибка соединения с сервером', 'error');
            return false;
        } finally {
            // Восстанавливаем кнопку
            joinButton.innerHTML = originalText;
            joinButton.disabled = false;
            this.updateButtons();
        }
    }

    // Новая функция для создания демо-пользователя
    createDemoUserAndJoin() {
        // Создаем демо-пользователя
        const demoUserId = Date.now(); // Уникальный ID
        const demoUser = {
            id: demoUserId,
            first_name: 'Демо',
            last_name: 'Пользователь',
            username: 'demo_user',
            photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + demoUserId,
            language_code: 'ru',
            is_premium: false,
            allows_write_to_pm: true
        };
        
        // Сохраняем в текущего пользователя
        window.currentUser = demoUser;
        
        // Обновляем профиль
        if (typeof updateProfileTab === 'function') {
            updateProfileTab();
        }
        
        // Показываем сообщение
        window.showStatus('🎮 Вы в демо-режиме. Создан демо-пользователь', 'info');
        
        // Повторяем попытку присоединиться
        setTimeout(() => {
            this.joinGame();
        }, 1000);
    }
    
    // Запустить таймер отсчета
    startCountdownTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        if (this.countdown === null || this.countdown <= 0) {
            this.countdown = this.countdownTime;
        }
        
        this.timerInterval = setInterval(() => {
            this.countdown--;
            this.updateTimer();
            
            if (this.countdown <= 0) {
                this.startSpinningAnimation();
                this.stopCountdownTimer();
            }
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
        
        // Через 5 секунд очищаем игру
        setTimeout(() => {
            this.participants = [];
            this.isSpinning = false;
            this.renderParticipants();
            this.updateWheel();
            this.updateButtons();
            this.hideWinner();
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