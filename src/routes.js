const express = require('express');
const router = express.Router();
const { validateTelegramData, generateDemoData } = require('./utils/auth');

// Главная страница
router.get('/', (req, res) => {
  res.sendFile('index.html', { root: './public' });
});

// Проверка сервера
router.get('/api/test', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Telegram Auth Server',
    timestamp: new Date().toISOString(),
    botToken: process.env.BOT_TOKEN ? '✅ Настроен' : '❌ Не настроен',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Реальная авторизация Telegram
router.post('/api/auth', (req, res) => {
  try {
    const { initData } = req.body;
    
    if (!initData) {
      return res.status(400).json({
        success: false,
        error: 'Отсутствуют данные авторизации',
        user: generateDemoData()
      });
    }

    // Валидируем реальные данные Telegram
    const userData = validateTelegramData(initData);
    
    if (userData) {
      // Реальные данные Telegram
      console.log('✅ Реальная авторизация Telegram:', userData.id);
      return res.json({
        success: true,
        user: userData,
        source: 'telegram',
        message: 'Авторизация через Telegram успешна'
      });
    } else {
      // Демо-данные (если нет валидных данных Telegram)
      console.log('⚠️ Демо-авторизация');
      const demoUser = generateDemoData();
      return res.json({
        success: true,
        user: demoUser,
        source: 'demo',
        message: 'Демо-режим. Откройте через Telegram бота для реальной авторизации'
      });
    }

  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера',
      user: generateDemoData()
    });
  }
});

// Информация о боте
router.get('/api/bot-info', async (req, res) => {
  try {
    const botToken = process.env.BOT_TOKEN;
    
    if (!botToken) {
      return res.json({
        success: false,
        error: 'Токен бота не настроен',
        instructions: 'Добавьте BOT_TOKEN в настройках Vercel'
      });
    }

    // Получаем реальную информацию о боте
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await response.json();
    
    res.json({
      success: data.ok,
      bot: data.ok ? data.result : null,
      error: data.ok ? null : data.description
    });

  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      bot: null
    });
  }
});

module.exports = router;