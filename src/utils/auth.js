const crypto = require('crypto');

/**
 * Реальная валидация данных Telegram Web App
 */
function validateTelegramData(initData) {
  try {
    if (!initData || !process.env.BOT_TOKEN) {
      console.log('Нет initData или BOT_TOKEN');
      return null;
    }

    // Парсим данные
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    
    if (!hash) {
      console.log('Нет hash в initData');
      return null;
    }

    // Удаляем hash из параметров для проверки
    params.delete('hash');
    
    // Сортируем параметры
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Секретный ключ
    const secretKey = crypto.createHmac('sha256', 'WebAppData')
      .update(process.env.BOT_TOKEN)
      .digest();

    // Проверяем подпись
    const calculatedHash = crypto.createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) {
      console.log('Неверная подпись Telegram');
      return null;
    }

    // Извлекаем данные пользователя
    const userStr = params.get('user');
    if (!userStr) {
      console.log('Нет данных пользователя');
      return null;
    }

    const userData = JSON.parse(userStr);
    
    // Формируем полные данные
    return {
      id: userData.id,
      first_name: userData.first_name,
      last_name: userData.last_name || null,
      username: userData.username || null,
      language_code: userData.language_code || null,
      is_premium: userData.is_premium || false,
      allows_write_to_pm: userData.allows_write_to_pm || false,
      photo_url: userData.photo_url || null,
      auth_date: new Date(parseInt(params.get('auth_date')) * 1000),
      query_id: params.get('query_id'),
      chat_type: params.get('chat_type') || null,
      chat_instance: params.get('chat_instance') || null
    };

  } catch (error) {
    console.error('Ошибка валидации Telegram:', error);
    return null;
  }
}

/**
 * Генерация демо-данных (только если нет реальной авторизации)
 */
function generateDemoData() {
  const userId = Math.floor(Math.random() * 1000000000);
  const firstNames = ['Алексей', 'Мария', 'Дмитрий', 'Анна', 'Сергей', 'Екатерина'];
  const lastNames = ['Иванов', 'Петрова', 'Сидоров', 'Смирнова', 'Кузнецов', 'Попова'];
  const username = ['alexey_tg', 'maria_tg', 'dmitry_tg', 'anna_tg', 'sergey_tg', 'ekaterina_tg'];
  
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const user = username[Math.floor(Math.random() * username.length)];
  
  return {
    id: userId,
    first_name: firstName,
    last_name: lastName,
    username: user,
    language_code: Math.random() > 0.5 ? 'ru' : 'en',
    is_premium: Math.random() > 0.7,
    allows_write_to_pm: true,
    photo_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}&backgroundColor=000000`,
    auth_date: new Date(),
    query_id: `query_${Date.now()}`,
    chat_type: 'private',
    chat_instance: `chat_${userId}`,
    is_demo: true // Флаг демо-данных
  };
}

module.exports = {
  validateTelegramData,
  generateDemoData
};