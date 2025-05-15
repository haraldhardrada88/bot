const { Markup } = require('telegraf');

module.exports = (bot) => {
    bot.start(ctx => {
        ctx.session.authStep = 'username';
        return ctx.reply('Вітаю! Введіть ваш username:');
    });
};