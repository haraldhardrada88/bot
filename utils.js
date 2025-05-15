// Перевіряє формат суми: цифри, опціонально крапка з максимум двома знаками після неї
function isValidAmount(text) {
    return /^\d+(?:\.\d{1,2})?$/.test(text);
}

// Перевіряє, що номер картки складається рівно з 16 цифр
function isValidCardNumber(text) {
    return /^\d{16}$/.test(text);
}

// Форматує число з розділенням тисяч і двома десятковими
function formatNumber(num) {
    return num.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

module.exports = {
    isValidAmount,
    isValidCardNumber,
    formatNumber,
};
