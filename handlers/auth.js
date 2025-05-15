const db = require('../db');

module.exports = (bot) => {
    bot.on('text', async (ctx, next) => {
        const text = ctx.message.text.trim();

        // Якщо крок авторизації = username
        if (ctx.session.authStep === 'username') {
            ctx.session.username = text;
            ctx.session.authStep = 'password';
            return ctx.reply('Введіть пароль:');
        }

        // Якщо крок авторизації = password
        if (ctx.session.authStep === 'password') {
            const res = await db.query(
                'SELECT * FROM users WHERE LOWER(username)=LOWER($1)',
                [ctx.session.username]
            );
            if (!res.rows.length) return ctx.reply('Користувача не знайдено. /start');
            const user = res.rows[0];
            if (text !== user.password) return ctx.reply('Невірний пароль. /start');

            // Успішна авторизація
            ctx.session.isAuthenticated = true;
            ctx.session.userId = user.id;
            ctx.session.authStep = null;
            return ctx.reply('Успішно авторизовано! Оберіть дію:', require('../keyboards/mainMenu'));
        }

        // Якщо ні один з кроків авторизації — передаємо повідомлення далі до інших обробників
        return next();
    });
};