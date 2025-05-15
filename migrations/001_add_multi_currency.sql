BEGIN;

-- 1. Створення типу валют
CREATE TYPE currency_type AS ENUM ('uah', 'usd', 'eur');

-- 2. Додавання колонок балансу в Users
ALTER TABLE Users
    ADD COLUMN balance_uah NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN balance_usd NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN balance_eur NUMERIC(12,2) NOT NULL DEFAULT 0.00;

-- 3. Додавання колонки currency в таблицю Payments
ALTER TABLE Payments
    ADD COLUMN currency currency_type NOT NULL DEFAULT 'uah';

-- 4. Додавання колонки currency в таблицю Withdrawals
ALTER TABLE Withdrawals
    ADD COLUMN currency currency_type NOT NULL DEFAULT 'uah';

-- 5. Міграція існуючих даних (якщо є стара колонка Balance)
-- UPDATE Users SET balance_uah = Balance;
-- ALTER TABLE Users DROP COLUMN Balance;

COMMIT;