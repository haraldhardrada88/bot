module.exports = (bot, prisma) => {
    // Зберігатимемо сесію в пам'яті (для простоти)
    const sessions = new Map();

    // Команда /login
    bot.command('login', async (ctx) => {
        sessions.set(ctx.from.id, { stage: 0, data: {} });
        await ctx.reply('Будь ласка, уведіть ваш username:');
    });

    // Лістенер для тексту, коли користувач у процесі логіну
    bot.on('text', async (ctx, next) => {
        const session = sessions.get(ctx.from.id);
        if (!session) return next(); // не в процесі логіну — передати далі

        const text = ctx.message.text.trim();
        if (session.stage === 0) {
            // отримали username
            session.data.username = text;
            session.stage = 1;
            return ctx.reply('Тепер введіть ваш пароль:');
        }

        if (session.stage === 1) {
            // отримали password
            const { username } = session.data;
            const password = text;
            // Перевіряємо у БД
            const user = await prisma.user.findUnique({
                where: { username },
                select: { password: true }
            });
            if (!user || user.password !== password) {
                sessions.delete(ctx.from.id);
                return ctx.reply('Неправильний логін або пароль. Використайте /login ще раз.');
            }
            // Успішна автентифікація
            sessions.set(ctx.from.id, { authenticated: true, userId: user.id });
            await ctx.reply(`Вітаю, ${username}! Тепер ви авторизовані.`);
            return;
        }
    });

    // Middleware: перевірка перед командами
    const requireAuth = async (ctx, next) => {
        const sess = sessions.get(ctx.from.id);
        if (sess && sess.authenticated) {
            ctx.state.user = { id: sess.userId };
            return next();
        } else {
            return ctx.reply('Ви повинні увійти через /login перед виконанням цієї команди.');
        }
    };

    // Підключаємо middleware до всієї групи команд
    bot.use((ctx, next) => {
        const publicCommands = ['/start', '/login'];
        if (ctx.message && publicCommands.includes(ctx.message.text)) {
            return next();
        }
        // для callback-кнопок перевіряємо ctx.callbackQuery.data
        if (ctx.callbackQuery) {
            const action = ctx.callbackQuery.data;
            if (['my_balance','withdraw','balance_uah','balance_eur','balance_usd'].includes(action)) {
                return requireAuth(ctx, next);
            }
        }
        // для слеш-команд:
        if (ctx.updateType === 'message' && ctx.message.text.startsWith('/')) {
            const cmd = ctx.message.text.split(' ')[0];
            if (['/add_project','/add_cc','/add_payment','/withdraw'].includes(cmd)) {
                return requireAuth(ctx, next);
            }
        }
        return next();
    });
};