const crypto = require('crypto');

/**
 * Валидация данных Telegram Web App
 * @param {string} initData - Строка initData от Telegram Web App
 * @returns {Object|null} Данные пользователя или null если невалидны
 */
function validateTelegramData(initData) {
  try {
    // Парсим query string
    const params = new URLSearchParams(initData);
    
    // Извлекаем хэш и удаляем его из параметров для проверки
    const hash = params.get('hash');
    params.delete('hash');
    
    // Сортируем параметры по ключу
    const sortedParams = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    // Секретный ключ для HMAC
    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
      console.error('BOT_TOKEN не установлен в переменных окружения');
      return null;
    }
    
    const secretKey = crypto.createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();
    
    // Вычисляем HMAC
    const computedHash = crypto.createHmac('sha256', secretKey)
      .update(sortedParams)
      .digest('hex');
    
    // Сравниваем хэши
    if (computedHash !== hash) {
      console.error('Хэши не совпадают');
      return null;
    }
    
    // Извлекаем данные пользователя
    const userStr = params.get('user');
    if (!userStr) {
      console.error('Данные пользователя не найдены');
      return null;
    }
    
    const userData = JSON.parse(userStr);
    
    // Возвращаем все доступные данные
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
      chat_instance: params.get('chat_instance') || null,
      start_param: params.get('start_param') || null,
      can_send_after: params.get('can_send_after') || null
    };
    
  } catch (error) {
    console.error('Ошибка при валидации данных Telegram:', error);
    return null;
  }
}

module.exports = {
  validateTelegramData
};