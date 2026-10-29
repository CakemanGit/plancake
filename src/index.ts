import 'dotenv/config';
import {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
} from 'discord.js';
import { assertBotConfig, config } from './config.js';
import { errorEmbed } from './embeds.js';
import { handleCommand } from './handlers.js';
import { startReminderLoop } from './reminders.js';

assertBotConfig();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, readyClient => {
    // Получаем актуальное количество серверов из кэша
    const serverCount = readyClient.guilds.cache.size;

    readyClient.user.setPresence({
        activities: [{ name: `за ${serverCount} серверами`, type: ActivityType.Watching }],
        status: 'online',
    });

    console.log(`[PlanCake] Вошёл как ${readyClient.user.tag}.`);
    console.log(`[PlanCake] Статус: Смотрит за серверами.`);
    console.log(`[PlanCake] База данных: ${config.databasePath}`);
    
    startReminderLoop(readyClient);
});


client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  try {
    await handleCommand(interaction);
  } catch (error) {
    console.error(`[PlanCake] Ошибка команды /${interaction.commandName}:`, error);
    const response = {
      embeds: [errorEmbed('Внутренняя ошибка', 'Во время выполнения команды произошла ошибка. Повтори попытку немного позже. Если проблема повторяется, проверь логи процесса.')],
      allowedMentions: { parse: [] as never[] },
      ...(interaction.inGuild() ? { flags: 64 } : {}),
    };
    try {
      if (interaction.replied || interaction.deferred) await interaction.followUp(response);
      else await interaction.reply(response);
    } catch (replyError) {
      console.error('[PlanCake] Не удалось отправить сообщение об ошибке:', replyError);
    }
  }
});

client.on(Events.Error, error => console.error('[PlanCake] Ошибка Discord-клиента:', error));
process.on('unhandledRejection', error => console.error('[PlanCake] Необработанный Promise rejection:', error));

process.on('SIGINT', () => {
  console.log('[PlanCake] Получен SIGINT, отключаюсь...');
  client.destroy();
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.log('[PlanCake] Получен SIGTERM, отключаюсь...');
  client.destroy();
  process.exit(0);
});

client.login(config.token).catch(error => {
  console.error('[PlanCake] Не удалось войти в Discord. Проверь DISCORD_TOKEN:', error);
  process.exitCode = 1;
});