module.exports = (bot, prisma) => {
    // Додавання платежу /add_payment
    bot.command('add_payment', async (ctx) => {
        const step = { stage: 0, data: {} };
        const listener = async (msgCtx) => {
            const text = msgCtx.message.text.trim().split(' ');
            if (step.stage === 0) {
                const [sumStr, cur] = text;
                const sum = parseFloat(sumStr);
                if (isNaN(sum) || !['uah','eur','usd'].includes(cur)) {
                    return msgCtx.reply('Невірно. Формат: 100 usd');
                }
                step.data = { sum, currency: cur };
                step.stage = 1;
                return msgCtx.reply('Введіть ID проекту:');
            }
            if (step.stage === 1) {
                const projectId = parseInt(text[0]);
                const project = await prisma.project.findUnique({ where: { id: projectId } });
                if (!project) return msgCtx.reply('Проект не знайдено.');
                const { sum, currency } = step.data;
                await prisma.payment.create({ data: { amount: sum, currency, projectId, userId: ctx.from.id } });
                const users = await prisma.projectUser.findMany({ where: { projectId } });
                const share = sum / users.length;
                await Promise.all(users.map(u => prisma.user.update({ where:{id:u.userId}, data:{[`balance_${currency}`]:{increment:share}} })))
                await msgCtx.reply(`Платіж розподілено між ${users.length}`);
                bot.off('text', listener);
            }
        };
        await ctx.reply('Введіть суму та валюту, напр.: 100 usd');
        bot.on('text', listener);
    });

    // Виведення коштів
    bot.action('withdraw', async (ctx) => {
        await ctx.answerCbQuery();
        const listener = async (msgCtx) => {
            const [sumStr, cur] = msgCtx.message.text.trim().split(' ');
            const sum = parseFloat(sumStr);
            if (isNaN(sum) || !['uah','eur','usd'].includes(cur)) return msgCtx.reply('Спробуйте ще раз.');
            const user = await prisma.user.findUnique({ where:{ username:ctx.from.username}, select:{[`balance_${cur}`]:true} });
            if (user[`balance_${cur}`] < sum) {
                return msgCtx.reply(`Недостатньо. Ваш баланс: ${user[`balance_${cur}`]}`);
            }
            await prisma.withdrawal.create({ data:{ amount: sum, currency: cur, userId: user.id } });
            await prisma.user.update({ where:{id:user.id}, data:{[`balance_${cur}`]:{decrement: sum}} });
            return msgCtx.reply(`Виведено ${sum} ${cur}`);
        };
        await ctx.reply('Введіть суму та валюту, напр.: 50 eur');
        bot.on('text', listener);
    });
};