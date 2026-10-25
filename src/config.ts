import 'dotenv/config';

export const config = {
  token: process.env.DISCORD_TOKEN?.trim() ?? '',
  clientId: process.env.CLIENT_ID?.trim() ?? '',
  guildId: process.env.GUILD_ID?.trim() || undefined,
  databasePath: process.env.DATABASE_PATH?.trim() || './data/plancake.sqlite',
  defaultTimezone: process.env.DEFAULT_TIMEZONE?.trim() || 'Europe/Kyiv',
};

export function assertBotConfig(requireGuild = false): void {
  const missing: string[] = [];
  if (!config.token) missing.push('DISCORD_TOKEN');
  if (!config.clientId) missing.push('CLIENT_ID');
  if (requireGuild && !config.guildId) missing.push('GUILD_ID');

  if (missing.length > 0) {
    throw new Error(`Не заполнены переменные окружения: ${missing.join(', ')}. Скопируй .env.example в .env и укажи значения.`);
  }
}
