module.exports = (ctx, next) => {
    const isAuth = ctx.session && ctx.session.isAuthenticated;
    const authStep = ctx.session && ctx.session.authStep;
    // Дозволити рухатися далі, якщо користувач в процесі логіну
    if (authStep) {
        return next();
    }
    const command = ctx.update.message && ctx.update.message.text
        ? ctx.update.message.text.split(' ')[0].replace('/', '')
        : '';
    // Дозволити /start для початку авторизації
    if (!isAuth && command !== 'start') {
        return ctx.reply('Будь ласка, авторизуйтесь через /start перед використанням бота.');
    }
    return next();
};