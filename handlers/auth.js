const { Markup } = require('telegraf');

module.exports = function authHandler(bot, prisma, sessions) {
    // /start запускає логін-флоу
    bot.start(async (ctx) => {
        const sid = ctx.from.id;
        sessions.set(sid, {
            stage: 0,
            data: {},
            telegramId: sid   // зберігаємо telegramId
        });
        return ctx.reply('Вітаю! Введіть ваш username:', Markup.removeKeyboard());
    });

    // Логін: username → password
    bot.on('text', async (ctx, next) => {
        const sid = ctx.from.id;
        const session = sessions.get(sid);
        if (!session || session.authenticated) return next();

        const text = ctx.message.text.trim();
        if (session.stage === 0) {
            session.data.username = text;
            session.stage = 1;
            return ctx.reply('Тепер введіть ваш пароль:');
        }
        if (session.stage === 1) {
            const { username } = session.data;
            const password = text;
            const user = await prisma.user.findUnique({ where: { username } });
            if (!user || user.password !== password) {
                sessions.delete(sid);
                return ctx.reply('Невірний логін або пароль. Виконайте /start ще раз.');
            }
            // успішна автентифікація
            session.authenticated = true;
            session.userId = user.id;
            session.role = user.role;
            session.stage = null;
            const mainKb = require('../keyboards/main');
            return ctx.reply('Успішно увійшли!', mainKb(user.role));
        }
    });
};