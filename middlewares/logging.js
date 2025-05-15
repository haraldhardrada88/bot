module.exports = (ctx, next) => {
    const from = ctx.from && ctx.from.username ? ctx.from.username : ctx.from.id;
    console.log(`[${new Date().toISOString()}] @${from}: ${ctx.updateType}`);
    return next();
};