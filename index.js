require('dotenv').config();
const { Telegraf, session } = require('telegraf');

// Ініціалізація бота
const bot = new Telegraf(process.env.BOT_TOKEN);

// Підключення middleware
// Сесії користувача з налаштуванням початкового об'єкта
bot.use(session({ defaultSession: () => ({}) }));
bot.use(require('./middlewares/logging'));      // Логування запитів
bot.use(require('./middlewares/auth'));         // Перевірка авторизації

// Підключення обробників
require('./handlers/start')(bot);           // Команда /start
require('./handlers/auth')(bot);            // Логін/пароль
require('./handlers/admin')(bot);
require('./handlers/user')(bot);           // Адмінські команди

// Глобальний ловчик помилок
bot.catch((err, ctx) => {
    console.error('Помилка в обробнику:', err);
    return ctx.reply('Вибачте, сталася помилка.');
});

// Запуск бота
bot.launch()
    .then(() => console.log('Bot started'))
    .catch(err => console.error('Bot failed to start:', err));

