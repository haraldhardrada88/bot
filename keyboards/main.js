const { Markup } = require('telegraf');
module.exports = (role) => {
    // Тепер перший рядок містить три кнопки:
    const row1 = ['Баланс', 'Вивести', 'Запити в очікуванні'];
    const row2 = role === 'admin' ? ['Додати проект', 'Додати картку'] : [];
    const row3 = role === 'admin' ? ['Додати платіж'] : [];
    return Markup.keyboard([row1, row2, row3]).resize();
};