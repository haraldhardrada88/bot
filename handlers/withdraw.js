const { Markup } = require('telegraf');
const db = require('../db');
const { isValidAmount, isValidCardNumber, formatNumber } = require('../utils');

module.exports = (bot) => {
    // Запуск сценарію
    bot.command('withdraw', async (ctx) => {
        ctx.session.withdraw = {};
        await ctx.reply('Введіть суму, яку бажаєте вивести');
        ctx.session.state = 'await_amount';
    });

    // Обробка текстових повідомлень
    bot.on('text', async (ctx) => {
        const text = ctx.message.text.trim();
        const { state, withdraw } = ctx.session;
        const user = ctx.session.user;

        if (state === 'await_amount') {
            if (!isValidAmount(text)) {
                return ctx.reply('Невірний формат суми, спробуйте ще раз');
            }
            const amount = parseFloat(text);
            const res = await db.query('SELECT balance FROM users WHERE username = $1', [user.username]);
            const balance = parseFloat(res.rows[0].balance);
            if (amount > balance) {
                return ctx.reply(`Недостатньо коштів. Ваш баланс: ${formatNumber(balance)}`);
            }
            withdraw.amount = amount;
            ctx.session.state = 'await_card';
            return ctx.reply('Введіть номер картки (16 цифр)');
        }

        if (state === 'await_card') {
            const card = text.replace(/\s+/g, '');
            if (!isValidCardNumber(card)) {
                return ctx.reply('Невірний формат картки, введіть 16 цифр');
            }
            withdraw.card = card;

            await db.query(
                `INSERT INTO withdrawals(date, transaction, sum, username) VALUES (NOW(), 'withdrawal', $1, $2)`,
                [withdraw.amount, user.username]
            );
            await db.query(
                `UPDATE users SET balance = balance - $1 WHERE username = $2`,
                [withdraw.amount, user.username]
            );

            await ctx.reply('Заявка на виведення успішно створена, очікуйте');

            const adminId = process.env.ADMIN_CHAT_ID;
            await ctx.telegram.sendMessage(
                adminId,
                `Нова заявка на виведення:\nКористувач: ${user.username}\nСума: ${formatNumber(withdraw.amount)}\nКартка: ${withdraw.card}`,
                Markup.inlineKeyboard([
                    Markup.button.callback('Підтвердити', `wd_confirm:${user.username}:${withdraw.amount}`),
                    Markup.button.callback('Скасувати', `wd_cancel:${user.username}:${withdraw.amount}`),
                ])
            );

            ctx.session.state = null;
        }
    });

    // Обробка inline-кнопок
    bot.on('callback_query', async (ctx) => {
        const data = ctx.callbackQuery.data;
        const [action, username, amount] = data.split(':');
        const amt = parseFloat(amount);

        if (action === 'wd_confirm') {
            await ctx.reply('Виведення підтверджено');
            await ctx.telegram.sendMessage(
                ctx.from.id,
                `Ваше виведення на суму ${formatNumber(amt)} підтверджено.`
            );
        }

        if (action === 'wd_cancel') {
            await db.query(
                `UPDATE users SET balance = balance + $1 WHERE username = $2`,
                [amt, username]
            );
            await ctx.reply('Виведення скасовано');
            const { chat_id } = (await db.query(
                'SELECT chat_id FROM users WHERE username = $1',
                [username]
            )).rows[0];
            await ctx.telegram.sendMessage(
                chat_id,
                `Ваше виведення було скасоване. ${formatNumber(amt)} повернено на ваш баланс.`
            );
        }
        await ctx.answerCbQuery();
    });
};
