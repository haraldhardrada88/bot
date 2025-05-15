const { Markup } = require('telegraf');

module.exports = function userHandler(bot, prisma, sessions) {
    const currencies = ['uah', 'eur', 'usd'];
    const labels = { uah: 'UAH 🇺🇦', eur: 'EUR 💶', usd: 'USD 💵' };

    function getSession(ctx) {
        const session = sessions.get(ctx.from.id);
        console.log('[DEBUG] session for', ctx.from.username, session);
        return session;
    }

    // Show balance menu
    bot.hears('Баланс', async (ctx) => {
        const session = getSession(ctx);
        if (!session?.authenticated) return ctx.reply('Будь ласка, увійдіть через /start');
        return ctx.reply(
            'Оберіть валюту:',
            Markup.inlineKeyboard(currencies.map(cur => [Markup.button.callback(labels[cur], `bal_${cur}`)]))
        );
    });

    // Handle balance selection
    currencies.forEach(cur => {
        bot.action(`bal_${cur}`, async (ctx) => {
            await ctx.answerCbQuery();
            const session = getSession(ctx);
            if (!session?.authenticated) return ctx.reply('Будь ласка, увійдіть через /start');
            const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { [`balance_${cur}`]: true } });
            const amount = (user[`balance_${cur}`] || 0).toFixed(2);
            const mainKb = require('../keyboards/main');
            return ctx.reply(
                `Ваш баланс: ${labels[cur].split(' ')[0]} ${amount}`,
                mainKb(session.role)
            );
        });
    });

    // Withdrawal: choose currency
    bot.hears('Вивести', async (ctx) => {
        const session = getSession(ctx);
        if (!session?.authenticated) return ctx.reply('Будь ласка, увійдіть через /start');
        session.stage = 'choose_currency';
        return ctx.reply(
            'Оберіть валюту для виведення:',
            Markup.inlineKeyboard(currencies.map(cur => [Markup.button.callback(labels[cur], `wd_curr_${cur}`)]))
        );
    });

    currencies.forEach(cur => {
        bot.action(`wd_curr_${cur}`, async (ctx) => {
            await ctx.answerCbQuery();
            const session = getSession(ctx);
            session.stage = 'enter_amount';
            session.data = { currency: cur };
            return ctx.reply(`Введіть суму для виведення у ${labels[cur]} (до 2 знаків):`);
        });
    });

    // Enter amount
    bot.on('text', async (ctx, next) => {
        const session = getSession(ctx);
        if (!(session?.authenticated && session.stage === 'enter_amount')) return next();
        const text = ctx.message.text.trim();
        if (!/^[0-9]+(\.[0-9]{1,2})?$/.test(text)) return ctx.reply('Невірний формат суми, спробуйте ще раз');
        session.data.sum = parseFloat(text);
        session.stage = 'enter_card';
        return ctx.reply('Введіть номер картки (16 цифр, можна з пробілами):');
    });

    // Enter card
    bot.on('text', async (ctx, next) => {
        const session = getSession(ctx);
        if (!(session?.authenticated && session.stage === 'enter_card')) return next();
        const raw = ctx.message.text.replace(/\s+/g, '');
        if (!/^\d{16}$/.test(raw)) return ctx.reply('Невірний формат картки, спробуйте ще раз');

        const { sum, currency } = session.data;
        const userId = session.userId;
        const dbUsername = (await prisma.user.findUnique({ where: { id: userId }, select: { username: true } })).username;
        const withdraw = await prisma.withdrawal.create({ data: { amount: sum, currency, userId, cardNumber: raw, status: 'pending' } });
        await prisma.user.update({ where: { id: userId }, data: { [`balance_${currency}`]: { decrement: sum } } });
        session.stage = null;
        const mainKb = require('../keyboards/main');
        await ctx.reply('Заявка створена, очікуйте', mainKb(session.role));

        // Notify admin
        const adminChatId = process.env.ADMIN_CHAT_ID;
        if (adminChatId) {
            const msg = `Запит #${withdraw.id}:
Користувач: ${dbUsername}
Сума: ${sum} ${currency}
Картка: ${raw}`;
            await bot.telegram.sendMessage(adminChatId, msg, Markup.inlineKeyboard([
                Markup.button.callback('Підтвердити', `wd_conf_${withdraw.id}`),
                Markup.button.callback('Скасувати', `wd_cancel_${withdraw.id}`)
            ]));
        }
    });

    // Confirm by admin
    bot.action(/wd_conf_\d+/, async (ctx) => {
        await ctx.answerCbQuery();
        const id = parseInt(ctx.callbackQuery.data.split('_')[2]);
        const w = await prisma.withdrawal.update({ where: { id }, data: { status: 'confirmed' } });
        await ctx.deleteMessage();

        const sessionUser = [...sessions.values()].find(s => s.userId === w.userId);
        const username = (await prisma.user.findUnique({ where: { id: w.userId }, select: { username: true } })).username;
        if (sessionUser?.telegramId) {
            await bot.telegram.sendMessage(sessionUser.telegramId, `Ваш запит #${w.id} підтверджено. Сума: ${w.amount} ${w.currency}`);
        }
        return ctx.reply(`Підтверджено запит #${w.id}:
Користувач: ${username}
Сума: ${w.amount} ${w.currency}
Картка: ${w.cardNumber}`);
    });

    // Cancel by admin
    bot.action(/wd_cancel_\d+/, async (ctx) => {
        await ctx.answerCbQuery();
        const id = parseInt(ctx.callbackQuery.data.split('_')[2]);
        const w = await prisma.withdrawal.update({ where: { id }, data: { status: 'cancelled' } });
        await prisma.user.update({ where: { id: w.userId }, data: { [`balance_${w.currency}`]: { increment: w.amount } } });
        await ctx.deleteMessage();

        const sessionUser = [...sessions.values()].find(s => s.userId === w.userId);
        const username = (await prisma.user.findUnique({ where: { id: w.userId }, select: { username: true } })).username;
        if (sessionUser?.telegramId) {
            await bot.telegram.sendMessage(sessionUser.telegramId, `Ваш запит #${w.id} скасовано. ${w.amount} ${w.currency} повернулись на баланс`);
        }
        return ctx.reply(`Скасовано запит #${w.id}:
Користувач: ${username}
Сума: ${w.amount} ${w.currency}
Картка: ${w.cardNumber}`);
    });

    // Pending requests
    bot.hears('Запити в очікуванні', async (ctx) => {
        const session = getSession(ctx);
        if (!session?.authenticated) return ctx.reply('Будь ласка, /start');
        const isAdmin = session.role === 'admin';
        const where = isAdmin
            ? { status: 'pending' }
            : { userId: session.userId, status: 'pending' };
        const reqs = await prisma.withdrawal.findMany({ where, orderBy: { createdAt: 'desc' } });
        if (!reqs.length) {
            return ctx.reply('Немає запитів.', require('../keyboards/main')(session.role));
        }
        for (const w of reqs) {
            const userName = isAdmin
                ? (await prisma.user.findUnique({ where: { id: w.userId }, select: { username: true } })).username
                : ctx.from.username;
            const msg = `ID: ${w.id}\nКористувач: ${userName}\nСума: ${w.amount} ${w.currency}\nКартка: ${w.cardNumber}`;
            if (isAdmin) {
                await ctx.reply(msg, Markup.inlineKeyboard([
                    Markup.button.callback('Підтвердити', `wd_conf_${w.id}`),
                    Markup.button.callback('Скасувати', `wd_cancel_${w.id}`)
                ]));
            } else {
                await ctx.reply(msg);
            }
        }
        return ctx.reply('Ось ваші запити.', require('../keyboards/main')(session.role));
    });
};
