import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { assertBotConfig, config } from './config.js';
import { commands } from './command-data.js';

assertBotConfig();

const rest = new REST({ version: '10' }).setToken(config.token);
const payload = commands.map(command => command.toJSON());

try {
  if (config.guildId) {
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: payload });
    console.log(`[PlanCake] Зарегистрировано ${payload.length} команд для сервера ${config.guildId}.`);
    console.log('[PlanCake] Серверные команды обычно доступны почти сразу.');
  } else {
    await rest.put(Routes.applicationCommands(config.clientId), { body: payload });
    console.log(`[PlanCake] Зарегистрировано ${payload.length} глобальных команд.`);
    console.log('[PlanCake] Глобальные команды могут появиться не мгновенно.');
  }
} catch (error) {
  console.error('[PlanCake] Ошибка регистрации команд:', error);
  process.exitCode = 1;
}
