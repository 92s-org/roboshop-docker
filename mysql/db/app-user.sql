-- MySQL 8.4 disables mysql_native_password by default,
-- so the user is created with the default caching_sha2_password
CREATE USER IF NOT EXISTS 'shipping'@'%' IDENTIFIED BY 'RoboShop@1';
GRANT ALL ON cities.* TO 'shipping'@'%';
FLUSH PRIVILEGES;
