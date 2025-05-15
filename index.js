const { Telegraf, Markup } = require('telegraf');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();
const bot = new Telegraf(process.env.BOT_TOKEN);

const currencies = ['uah', 'eur', 'usd'];

// =======================
// 1) Стартове меню
// =======================
bot.start((ctx) => {
    return ctx.reply(
        'Вітаю! Оберіть дію:',
        Markup.inlineKeyboard([
            [ Markup.button.callback('💰 Мій баланс', 'my_balance') ],
            [ Markup.button.callback('🏧 Вивести',     'withdraw') ]
        ])
    );
});

// =======================
// 2) Обробка «Мій баланс»
// =======================
bot.action('my_balance', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.reply(
        'Оберіть валюту:',
        Markup.inlineKeyboard(
            currencies.map(cur => {
                const labels = { uah: 'UAH 🇺🇦', eur: 'EUR 💶', usd: 'USD 💵' };
                return [ Markup.button.callback(labels[cur], `balance_${cur}`) ];
            })
        )
    );
});

// =======================
// 3) Динамічні обробники для кожної валюти
// =======================
currencies.forEach(cur => {
    bot.action(`balance_${cur}`, async (ctx) => {
        await ctx.answerCbQuery();
        const user = await prisma.user.findUnique({
            where: { username: ctx.from.username },
            select: { [`balance_${cur}`]: true }
        });
        const amount = (user?.[`balance_${cur}`] ?? 0).toFixed(2);
        const labels = { uah: 'UAH', eur: 'EUR', usd: 'USD' };
        return ctx.reply(`Ваш баланс: ${labels[cur]} ${amount}`);
    });
});

// =======================
// 4) Підключаємо хендлери
//    - handlers/auth.js — /login + middleware + /add_project + /add_cc
//    - handlers/user.js — /add_payment + withdraw
// =======================
require('./handlers/auth')(bot, prisma);
require('./handlers/user')(bot, prisma);

// =======================
// 5) Запуск та graceful shutdown
// =======================
bot.launch()
    .then(() => console.log('Bot started'))
    .catch(console.error);

process.once('SIGINT',  () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));