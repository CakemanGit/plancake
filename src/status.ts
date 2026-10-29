import { Client, GatewayIntentBits, ActivityType, PresenceUpdateStatus } from 'discord.js';
import * as dotenv from 'dotenv';

dotenv.config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
    rest: { timeout: 30000, retries: 5 }
});

const STATUS_TEXT = '🥞 Хаваю блины и планирую 24/7!';
let statusInterval: NodeJS.Timeout | null = null;

function applyIronStatus(botClient: Client) {
    if (!botClient.user) return;

    try {
        botClient.user.setPresence({
            activities: [{
                name: 'Custom Status',
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

client.on('ready', () => {
    console.log(`Железобетонный статус-менеджер запущен для: ${client.user?.tag}`);
    
    // Сброс старого таймера при перезапуске сети
    if (statusInterval) {
        clearInterval(statusInterval);
    }

    applyIronStatus(client);

    // Интервал-киллер
    statusInterval = setInterval(() => {
        if (client.readyAt) {
            applyIronStatus(client);
        } else {
            console.log('Потеряно соединение, ожидаем автоматического переподключения...');
        }
    }, 5 * 60 * 1000);
});


// Защита от разрывов сессии
client.on('shardDisconnect', () => {
    console.warn('Внимание: Shard отключен от сети. Ожидание восстановления...');
});

client.on('shardReconnecting', () => {
    console.log('Попытка восстановить соединение с Discord...');
});

// КРИТИЧЕСКАЯ ЗАЩИТА: Не даем процессу упасть
client.on('error', (err) => console.error('Ошибка Discord Client:', err));

process.on('unhandledRejection', (reason, promise) => {
    console.error('Перехвачено необработанное отклонение промиса:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Перехвачена критическая ошибка (процесс спасен от падения):', err);
});

client.login(process.env.DISCORD_TOKEN);