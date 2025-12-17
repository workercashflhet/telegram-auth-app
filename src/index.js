const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Маршруты
app.use('/', routes);

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(500).json({ 
    success: false, 
    error: 'Внутренняя ошибка сервера',
    timestamp: new Date().toISOString()
  });
});

// Экспорт для Vercel
module.exports = app;

// Локальный запуск
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`
🚀 Telegram Auth App запущен!
📡 Порт: ${PORT}
🤖 BOT_TOKEN: ${process.env.BOT_TOKEN ? '✅ Настроен' : '❌ НЕ НАСТРОЕН!'}
🌐 Откройте: http://localhost:${PORT}

⚠️  Для реальной авторизации:
1. Создайте бота через @BotFather
2. Получите токен
3. Добавьте в .env: BOT_TOKEN=ваш_токен
4. Откройте приложение через Telegram бота
    `);
  });
}

// В конце src/index.js добавьте:
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Cleaning up...');
    // Здесь можно добавить очистку ресурсов
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});