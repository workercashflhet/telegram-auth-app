const express = require('express');
const cors = require('cors');
const routes = require('./routes');
require('dotenv').config();

if (!process.env.BOT_TOKEN) {
  console.error('⚠️  ВНИМАНИЕ: BOT_TOKEN не установлен!');
  console.error('   Для локальной разработки создайте файл .env');
  console.error('   Для Vercel добавьте переменную в настройках проекта');
} else {
  console.log('✅ BOT_TOKEN загружен успешно');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Маршруты
app.use('/', routes);

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Что-то пошло не так!' });
});

// Запуск сервера
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Telegram бот токен: ${process.env.BOT_TOKEN ? 'Установлен' : 'Не установлен'}`);
  });
}

module.exports = app;