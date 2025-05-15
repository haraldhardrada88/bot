const { Telegraf, Markup } = require('telegraf');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const currencies = ['uah', 'eur', 'usd'];

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
        Markup.inlineKeyboard(
            currencies.map(cur => {
                const labels = { uah: 'UAH 🇺🇦', eur: 'EUR 💶', usd: 'USD 💵' };
                return [Markup.button.callback(labels[cur], `balance_${cur}`)];
            })
        )
    );
});

// Динамічні обробники балансу
currencies.forEach(cur => {
    bot.action(`balance_${cur}`, async (ctx) => {
        await ctx.answerCbQuery();
        const user = await prisma.user.findUnique({
            where: { username: ctx.from.username },
            select: { [`balance_${cur}`]: true }
        });
        const amount = user[`balance_${cur}`]?.toFixed(2) || '0.00';
        const labels = { uah: 'UAH', eur: 'EUR', usd: 'USD' };
        return ctx.reply(`Ваш баланс: ${labels[cur]} ${amount}`);
    });
});

// Підключення хендлерів
require('./handlers/auth')(bot, prisma);
require('./handlers/user')(bot, prisma);

// Запуск бота
bot.launch().then(() => console.log('Bot started'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));


// handlers/auth.js

module.exports = (bot, prisma) => {
    // Реєстрація /add_project
    bot.command('add_project', async (ctx) => {
        const listener = async (msgCtx) => {
            const name = msgCtx.message.text.trim();
            try {
                const project = await prisma.project.create({ data: { name } });
                await msgCtx.reply(`Проект "${project.name}" створено (ID: ${project.id})`);
            } catch {
                await msgCtx.reply('Помилка створення проекту.');
            }
            bot.off('text', listener);
        };
        await ctx.reply('Введіть назву нового проекту:');
        bot.on('text', listener);
    });

    // Додавання картки /add_cc
    bot.command('add_cc', async (ctx) => {
        const listener = async (msgCtx) => {
            const num = msgCtx.message.text.trim();
            if (!/^\d{16}$/.test(num)) {
                await msgCtx.reply('Невірний формат. Має бути 16 цифр.');
            } else {
                await prisma.paymentCard.create({ data: { number: num, userId: ctx.from.id } });
                await msgCtx.reply('Картку збережено.');
            }
            bot.off('text', listener);
        };
        await ctx.reply('Введіть номер картки (16 цифр):');
        bot.on('text', listener);
    });
};