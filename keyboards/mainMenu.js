const { Markup } = require('telegraf');

module.exports = Markup.keyboard([
    ['Мій баланс', 'Вивести кошти'],
    ['Статистика']
]).resize();