import { Client, GatewayIntentBits, ActivityType, PresenceUpdateStatus } from 'discord.js';
import * as dotenv from 'dotenv';

dotenv.config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
    // Настройки для быстрого восстановления сессии при сбоях сети из-за HiOS
    rest: { timeout: 30000, retries: 5 }
});

const STATUS_TEXT = '🥞 Хаваю блины и планирую 24/7!';

function applyIronStatus(botClient: Client) {
    if (!botClient.user) return;

    try {
        botClient.user.setPresence({
            activities: [{
                name: 'custom', 
                type: ActivityType.Custom,
                state: STATUS_TEXT
            }],
            status: PresenceUpdateStatus.Online
        });
        console.log(`[${new Date().toLocaleTimeString()}] Статус успешно обновлен: "${STATUS_TEXT}"`);
    } catch (error) {
        console.error('Не удалось установить статус:', error);
    }
}

client.once('ready', () => {
    console.log(`Железобетонный статус-менеджер запущен для: ${client.user?.tag}`);
    applyIronStatus(client);

    // Интервал-киллер для агрессивного энергосбережения телефона.
    // Каждые 5 минут шлем сигнал, что процесс активен, и обновляем статус.
    setInterval(() => {
        if (client.readyAt) {
            applyIronStatus(client);
        } else {
            console.log('Потеряно соединение, ожидаем автоматического переподключения...');
        }
    }, 5 * 60 * 1000);
});

// Защита от разрывов сессии (когда телефон на время отключает Wi-Fi/4G в фоне)
client.on('shardDisconnect', () => {
    console.warn('Внимание: Shard отключен от сети. Ожидание восстановления...');
});

client.on('shardReconnecting', () => {
    console.log('Попытка восстановить соединение с Discord...');
});

client.on('ready', () => {
    // Вызывается также при успешном автоматическом реконнекте
    applyIronStatus(client);
});

// КРИТИЧЕСКАЯ ЗАЩИТА: Не даем процессу упасть при любых системных или сетевых ошибках
client.on('error', (err) => console.error('Ошибка Discord Client:', err));

process.on('unhandledRejection', (reason, promise) => {
    console.error('Перехвачено необработанное отклонение промиса:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Перехвачена критическая ошибка (процесс спасен от падения):', err);
});

client.login(process.env.DISCORD_TOKEN);