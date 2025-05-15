const db = require('../db');

module.exports = (bot) => {
    // Показати баланс
    bot.hears('Мій баланс', async ctx => {
        const res = await db.query(
            'SELECT balance FROM users WHERE id=$1',
            [ctx.session.userId]
        );
        const balance = res.rows[0]?.balance || 0;
        return ctx.reply(`Ваш поточний баланс: ${balance} грн`);
    });

    // Почати виведення коштів
    bot.hears('Вивести кошти', ctx => {
        ctx.session.withdrawStep = 'amount';
        return ctx.reply('Введіть суму для виведення:');
    });

    // Обробка введення суми для виведення
    bot.on('text', async ctx => {
        if (ctx.session.withdrawStep === 'amount') {
            const amount = parseFloat(ctx.message.text.replace(',', '.'));
            // Перевірка валідності
            if (isNaN(amount) || amount <= 0) {
                return ctx.reply('Невірний формат суми. Введіть число:');
            }
            // Перевірка балансу
            const res = await db.query(
                'SELECT balance FROM users WHERE id=$1', [ctx.session.userId]
            );
            const balance = parseFloat(res.rows[0]?.balance || 0);
            if (amount > balance) {
                ctx.session.withdrawStep = null;
                return ctx.reply('Недостатньо коштів. Спробуйте іншу суму або натисніть Мій баланс.');
            }
            ctx.session.withdrawAmount = amount;
            ctx.session.withdrawStep = 'card';
            return ctx.reply('Введіть номер картки для виведення:');
        }
        if (ctx.session.withdrawStep === 'card') {
            const cardNumber = ctx.message.text.trim();
            // TODO: валідація формату картки
            await db.query(
                'INSERT INTO withdrawals(user_id, card_id, amount, status) VALUES($1, (SELECT id FROM cards WHERE card_number=$2), $3, $4)',
                [ctx.session.userId, cardNumber, ctx.session.withdrawAmount, 'pending']
            );
            ctx.session.withdrawStep = null;
            return ctx.reply('Заявка на виведення створена. Адміністратор обробить її найближчим часом.');
        }
    });

    // Статистика: загальні суми платежів та виведень
    bot.hears('Статистика', async ctx => {
        const pay = await db.query(
            'SELECT SUM(amount) AS total_payments FROM payments'
        );
        const wd = await db.query(
            'SELECT SUM(amount) AS total_withdrawals FROM withdrawals'
        );
        return ctx.reply(
            `Статистика:+
        Усього платежів: ${pay.rows[0].total_payments || 0} грн
+
        Усього виведено: ${wd.rows[0].total_withdrawals || 0} грн`
        );
    });
};