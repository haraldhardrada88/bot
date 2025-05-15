const { Telegraf, Markup } = require('telegraf');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// Стартове меню
bot.start((ctx) => {
    return ctx.reply(
        'Вітаю! Оберіть дію:',
        Markup.inlineKeyboard([
            [Markup.button.callback('💰 Мій баланс', 'my_balance')],
            [Markup.button.callback('🏧 Вивести', 'withdraw')]
        ])
    );
});

// Обробка кнопки «Мій баланс»
bot.action('my_balance', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.reply(
        'Оберіть валюту:',
        Markup.inlineKeyboard([
            [Markup.button.callback('UAH 🇺🇦', 'balance_uah')],
            [Markup.button.callback('EUR 💶', 'balance_eur')],
            [Markup.button.callback('USD 💵', 'balance_usd')]
        ])
    );
});

// Динамічні обробники для балансу в кожній валюті
const currencies = ['uah', 'eur', 'usd'];
currencies.forEach((cur) => {
    bot.action(`balance_${cur}`, async (ctx) => {
        await ctx.answerCbQuery();
        const user = await prisma.user.findUnique({
            where: { username: ctx.from.username },
            select: { [`balance_${cur}`]: true }
        });
        const amount = user[`balance_${cur}`].toFixed(2);
        const labels = { uah: 'UAH', eur: 'EUR', usd: 'USD' };
        return ctx.reply(`Ваш баланс: ${labels[cur]} ${amount}`);
    });
});

// /add_project — додаємо проект
bot.command('add_project', async (ctx) => {
    ctx.reply('Введіть назву нового проекту:');
    bot.on('text', async (msgCtx) => {
        const projectName = msgCtx.message.text.trim();
        try {
            const project = await prisma.project.create({ data: { name: projectName } });
            await msgCtx.reply(`Проект "${project.name}" створено (ID: ${project.id})`);
        } catch (e) {
            await msgCtx.reply('Помилка створення проекту. Спробуйте ще раз.');
        }
        bot.removeListener('text');
    });
});

// /add_cc — додаємо картку
bot.command('add_cc', async (ctx) => {
    ctx.reply('Введіть номер картки (16 цифр):');
    bot.on('text', async (msgCtx) => {
        const ccNumber = msgCtx.message.text.trim();
        if (!/^\d{16}$/.test(ccNumber)) {
            await msgCtx.reply('Невірний формат. Має бути 16 цифр. Виконайте /add_cc знову.');
        } else {
            await prisma.paymentCard.create({ data: { number: ccNumber, userId: ctx.from.id } });
            await msgCtx.reply('Картку збережено.');
        }
        bot.removeListener('text');
    });
});

// /add_payment — запис платежу та розподіл
bot.command('add_payment', async (ctx) => {
    const step = { stage: 0, data: {} };
    ctx.reply('Введіть суму та валюту (наприклад: 100 usd):');
    bot.on('text', async (msgCtx) => {
        if (step.stage === 0) {
            const [sumStr, currency] = msgCtx.message.text.trim().split(' ');
            const sum = parseFloat(sumStr);
            if (isNaN(sum) || !currencies.includes(currency)) {
                await msgCtx.reply('Невірно. Введіть суму та валюту, наприклад: 100 usd');
                return;
            }
            step.data.sum = sum;
            step.data.currency = currency;
            step.stage = 1;
            await msgCtx.reply('Введіть project ID для розподілу платежу:');
        } else if (step.stage === 1) {
            const projectId = parseInt(msgCtx.message.text.trim());
            const project = await prisma.project.findUnique({ where: { id: projectId } });
            if (!project) {
                await msgCtx.reply('Проект не знайдено. Спробуйте ще раз.');
                return;
            }
            const payment = await prisma.payment.create({
                data: {
                    amount: step.data.sum,
                    currency: step.data.currency,
                    projectId,
                    userId: ctx.from.id
                }
            });
            const users = await prisma.projectUser.findMany({ where: { projectId } });
            const share = step.data.sum / users.length;
            for (const u of users) {
                await prisma.user.update({
                    where: { id: u.userId },
                    data: { [`balance_${step.data.currency}`]: { increment: share } }
                });
            }
            await msgCtx.reply(`Платіж додано та розподілено між ${users.length} учасниками.`);
            bot.removeListener('text');
        }
    });
});

// /withdraw — виведення коштів
bot.action('withdraw', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply('Введіть суму та валюту для виведення (наприклад: 50 eur):');
    bot.on('text', async (msgCtx) => {
        const [sumStr, currency] = msgCtx.message.text.trim().split(' ');
        const sum = parseFloat(sumStr);
        if (isNaN(sum) || !currencies.includes(currency)) {
            await msgCtx.reply('Невірно. Спробуйте ще раз.');
            return;
        }
        const user = await prisma.user.findUnique({ where: { username: ctx.from.username } });
        if (user[`balance_${currency}`] < sum) {
            await msgCtx.reply(`Недостатньо коштів. Ваш баланс: ${user[`balance_${currency}`]}`);
        } else {
            await prisma.withdrawal.create({ data: { amount: sum, currency, userId: user.id } });
            await prisma.user.update({
                where: { id: user.id },
                data: { [`balance_${currency}`]: { decrement: sum } }
            });
            await msgCtx.reply(`Виведено ${sum} ${currency}.`);
        }
        bot.removeListener('text');
    });
});

// Запуск бота
bot.launch().then(() => console.log('Bot started'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));