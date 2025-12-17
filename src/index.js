const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Статические файлы - ВАЖНО для Vercel
app.use(express.static(path.join(__dirname, '../public')));

// Главная страница - отдаем HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// API маршруты
app.get('/api/test', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Сервер работает на Vercel',
    timestamp: new Date().toISOString(),
    botToken: process.env.BOT_TOKEN ? 'Есть' : 'Нет'
  });
});

// Простая авторизация для теста
app.post('/api/auth', (req, res) => {
  try {
    const { initData } = req.body;
    
    // Для демо - всегда возвращаем успех
    const demoUser = {
      id: Math.floor(Math.random() * 1000000000),
      first_name: 'Telegram',
      last_name: 'User',
      username: 'telegram_user',
      language_code: 'ru',
      is_premium: false,
      allows_write_to_pm: true,
      photo_url: null,
      auth_date: new Date().toISOString(),
      query_id: 'test_query_id',
      chat_type: 'private',
      chat_instance: 'test_chat_instance'
    };
    
    res.json({
      success: true,
      user: demoUser
    });
    
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Обработка всех остальных маршрутов - отдаем index.html для SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Экспортируем для Vercel
module.exports = app;