const express = require('express');
const router = express.Router();
const { validateTelegramData } = require('./utils/auth');

// Главная страница
router.get('/', (req, res) => {
  res.sendFile('index.html', { root: './public' });
});

// API эндпоинт для проверки авторизации
router.post('/api/validate', async (req, res) => {
  try {
    const { initData } = req.body;
    
    if (!initData) {
      return res.status(400).json({ 
        success: false, 
        error: 'Отсутствуют данные авторизации' 
      });
    }

    const userData = validateTelegramData(initData);
    
    if (!userData) {
      return res.status(401).json({ 
        success: false, 
        error: 'Недействительные данные авторизации' 
      });
    }

    res.json({
      success: true,
      user: userData
    });

  } catch (error) {
    console.error('Ошибка при валидации данных:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Внутренняя ошибка сервера' 
    });
  }
});

// Информация о боте
router.get('/api/bot-info', async (req, res) => {
  try {
    const botToken = process.env.BOT_TOKEN;
    
    if (!botToken) {
      return res.status(500).json({
        success: false,
        error: 'Токен бота не настроен'
      });
    }

    // Получаем информацию о боте
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await response.json();
    
    if (!data.ok) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось получить информацию о боте'
      });
    }

    res.json({
      success: true,
      bot: data.result
    });

  } catch (error) {
    console.error('Ошибка при получении информации о боте:', error);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

// Health check для Vercel
router.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'Telegram Auth App'
  });
});

module.exports = router;