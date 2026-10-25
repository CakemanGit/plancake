import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import {
  addHoliday,
  addVacation,
  createTask,
  deleteTask,
  ensureUser,
  getTaskForUser,
  listHolidays,
  listTasks,
  listVacations,
  markTaskCompleted,
  removeHoliday,
  removeVacation,
  setRemindersEnabled,
  setUserTimezone,
  type TaskPattern,
} from './db.js';
import {
  calendarListEmbed,
  errorEmbed,
  helpEmbed,
  infoEmbed,
  planEmbed,
  settingsEmbed,
  successEmbed,
  taskListEmbed,
} from './embeds.js';
import {
  buildDayPlans,
  formatDateTag,
  getLocalNow,
  getPlanDates,
  isValidDateKey,
  isValidTime,
  isValidTimezone,
  taskMatchesDate,
  patternLabel,
  type PlanPeriod,
} from './planner.js';

export async function replyEmbed(interaction: ChatInputCommandInteraction, embed: EmbedBuilder): Promise<void> {
  await interaction.reply({
    embeds: [embed],
    allowedMentions: { parse: [] },
    ...(interaction.inGuild() ? { flags: MessageFlags.Ephemeral } : {}),
  });
}

function makePlanEmbed(userId: string, period: PlanPeriod, customDate?: string): EmbedBuilder {
  const settings = ensureUser(userId);
  const dates = getPlanDates(userId, period, customDate);
  const holidays = listHolidays(userId);
  const vacations = listVacations(userId);
  const emptyHolidayCalendar = period === 'holiday' && holidays.filter(item => item.date >= getLocalNow(userId).toISODate()!).length === 0;
  const emptyVacationCalendar = period === 'vacation' && vacations.filter(item => item.end_date >= getLocalNow(userId).toISODate()!).length === 0;
  return planEmbed(period, buildDayPlans(userId, dates), settings.timezone, emptyHolidayCalendar || emptyVacationCalendar);
}

async function handleTask(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const settings = ensureUser(userId);
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'add') {
    const title = interaction.options.getString('title', true).trim();
    const pattern = interaction.options.getString('pattern', true) as TaskPattern;
    const rawDate = interaction.options.getString('date');
    const rawTime = interaction.options.getString('time');
    const details = interaction.options.getString('details')?.trim() || null;

    if (!title) {
      await replyEmbed(interaction, errorEmbed('Не удалось создать задачу', 'Название не должно быть пустым.'));
      return;
    }
    if (pattern === 'once' && !rawDate) {
      await replyEmbed(interaction, errorEmbed('Нужна дата', 'Для задачи «Один раз» укажи `date` в формате `YYYY-MM-DD`.'));
      return;
    }
    if (pattern !== 'once' && rawDate) {
      await replyEmbed(interaction, errorEmbed('Лишняя дата', 'Поле `date` используется только для задачи «Один раз». Для повторяющихся задач дата выбирается календарём.'));
      return;
    }
    if (rawDate && !isValidDateKey(rawDate, settings.timezone)) {
      await replyEmbed(interaction, errorEmbed('Неверная дата', 'Используй существующую дату в формате `YYYY-MM-DD`, например `2026-12-24`.'));
      return;
    }
    if (rawTime && !isValidTime(rawTime, settings.timezone)) {
      await replyEmbed(interaction, errorEmbed('Неверное время', 'Используй формат `HH:MM` в 24-часовом формате, например `08:30`.'));
      return;
    }

    const task = createTask({
      userId,
      title,
      details,
      pattern,
      scheduledDate: rawDate,
      time: rawTime,
    });
    const lines = [
      `**ID:** \`#${task.id}\``,
      `**Задача:** ${task.title}`,
      `**Категория:** \`${patternLabel(pattern)}\``,
      task.scheduled_date ? `**Дата:** ${task.scheduled_date}` : '',
      task.time ? `**Время:** ${task.time} (${settings.timezone})` : '**Напоминание:** время не задано',
      task.time ? (settings.reminders_enabled ? 'PlanCake попробует прислать напоминание в ЛС.' : 'Напоминания сейчас выключены. Их можно включить через `/settings reminders`.') : '',
      details ? `**Подробности:** ${details}` : '',
      (pattern === 'holiday' && listHolidays(userId).length === 0) ? 'Добавь праздничные даты через `/calendar holiday-add`, чтобы задача попадала в праздничные планы.' : '',
      (pattern === 'vacation' && listVacations(userId).length === 0) ? 'Добавь каникулы через `/calendar vacation-add`, чтобы задача попадала в планы на каникулы.' : '',
    ].filter(Boolean);
    await replyEmbed(interaction, successEmbed('Задача создана', lines.join('\n')));
    return;
  }

  if (subcommand === 'list') {
    await replyEmbed(interaction, taskListEmbed(listTasks(userId), settings.timezone));
    return;
  }

  if (subcommand === 'delete') {
    const id = interaction.options.getInteger('id', true);
    const task = getTaskForUser(id, userId);
    if (!task) {
      await replyEmbed(interaction, errorEmbed('Задача не найдена', `Не нашёл задачу #${id} в твоём личном списке.`));
      return;
    }
    deleteTask(id, userId);
    await replyEmbed(interaction, successEmbed('Задача удалена', `Задача **${task.title}** (#${id}) удалена. Её отметки выполнения и записи напоминаний также очищены.`));
    return;
  }

  if (subcommand === 'complete') {
    const id = interaction.options.getInteger('id', true);
    const task = getTaskForUser(id, userId);
    if (!task) {
      await replyEmbed(interaction, errorEmbed('Задача не найдена', `Не нашёл задачу #${id} в твоём личном списке.`));
      return;
    }
    const rawDate = interaction.options.getString('date');
    const date = rawDate ?? (task.pattern === 'once' && task.scheduled_date ? task.scheduled_date : getLocalNow(userId).toISODate()!);
    if (!isValidDateKey(date, settings.timezone)) {
      await replyEmbed(interaction, errorEmbed('Неверная дата', 'Укажи существующую дату в формате `YYYY-MM-DD`.'));
      return;
    }
    if (!taskMatchesDate(task, userId, date)) {
      await replyEmbed(interaction, errorEmbed('Задача не запланирована на эту дату', `Задача #${id} по категории **${task.pattern}** не активна ${date}. Проверь категорию или выбери подходящую дату.`));
      return;
    }
    const changed = markTaskCompleted(id, date);
    await replyEmbed(interaction, changed
      ? successEmbed('Задача выполнена', `✅ **${task.title}** отмечена выполненной на **${date}**.`)
      : successEmbed('Уже выполнено', `Задача **${task.title}** уже отмечена выполненной на **${date}**.`));
    return;
  }
}

async function handlePlan(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand() as PlanPeriod;
  const customDate = subcommand === 'date' ? interaction.options.getString('date', true) : undefined;
  if (customDate && !isValidDateKey(customDate, ensureUser(interaction.user.id).timezone)) {
    await replyEmbed(interaction, errorEmbed('Неверная дата', 'Укажи существующую дату в формате `YYYY-MM-DD`, например `2026-12-24`.'));
    return;
  }
  await replyEmbed(interaction, makePlanEmbed(interaction.user.id, subcommand, customDate));
}

async function handleCalendar(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const timezone = ensureUser(userId).timezone;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'holiday-add') {
    const date = interaction.options.getString('date', true);
    const name = interaction.options.getString('name', true).trim();
    if (!name) {
      await replyEmbed(interaction, errorEmbed('Нужно название', 'Название праздника не может быть пустым.'));
      return;
    }
    if (!isValidDateKey(date, timezone)) {
      await replyEmbed(interaction, errorEmbed('Неверная дата', 'Укажи существующую дату в формате `YYYY-MM-DD`.'));
      return;
    }
    addHoliday(userId, date, name);
    await replyEmbed(interaction, successEmbed('Праздник сохранён', `**${name}** добавлен на **${date}**. Если дата уже существовала, её название обновлено.`));
    return;
  }

  if (subcommand === 'holiday-list') {
    const holidays = listHolidays(userId);
    const fields = holidays.map(item => ({ name: `${item.date} • ${item.name}`, value: `Discord: ${formatDateTag(item.date, timezone)}\nУдаление: \`/calendar holiday-remove date:${item.date}\`` }));
    await replyEmbed(interaction, calendarListEmbed('PlanCake • Праздничные даты', holidays.length ? `Сохранено дат: **${holidays.length}**.` : 'Праздничных дат пока нет. Добавь первую командой `/calendar holiday-add`.', fields));
    return;
  }

  if (subcommand === 'holiday-remove') {
    const date = interaction.options.getString('date', true);
    if (!isValidDateKey(date, timezone)) {
      await replyEmbed(interaction, errorEmbed('Неверная дата', 'Укажи существующую дату в формате `YYYY-MM-DD`.'));
      return;
    }
    const changed = removeHoliday(userId, date);
    await replyEmbed(interaction, changed ? successEmbed('Праздник удалён', `Дата **${date}** удалена из твоего календаря.`) : errorEmbed('Дата не найдена', `В твоём календаре нет праздника на **${date}**.`));
    return;
  }

  if (subcommand === 'vacation-add') {
    const start = interaction.options.getString('start', true);
    const end = interaction.options.getString('end', true);
    const name = interaction.options.getString('name', true).trim();
    if (!name) {
      await replyEmbed(interaction, errorEmbed('Нужно название', 'Название периода не может быть пустым.'));
      return;
    }
    if (!isValidDateKey(start, timezone) || !isValidDateKey(end, timezone)) {
      await replyEmbed(interaction, errorEmbed('Неверная дата', 'Начало и конец периода должны быть существующими датами в формате `YYYY-MM-DD`.'));
      return;
    }
    if (start > end) {
      await replyEmbed(interaction, errorEmbed('Неверный период', 'Дата начала не может быть позже даты окончания.'));
      return;
    }
    const id = addVacation(userId, start, end, name);
    await replyEmbed(interaction, successEmbed('Период сохранён', `**${name}** (#${id})\n**Начало:** ${start}\n**Окончание:** ${end}\nЗадачи категории ${'КАНИКУЛЫ'} будут появляться в этот период.`));
    return;
  }

  if (subcommand === 'vacation-list') {
    const vacations = listVacations(userId);
    const fields = vacations.map(item => ({ name: `#${item.id} • ${item.name}`, value: `**${item.start_date} — ${item.end_date}**\nУдаление: \`/calendar vacation-remove id:${item.id}\`` }));
    await replyEmbed(interaction, calendarListEmbed('PlanCake • Каникулы и отпуск', vacations.length ? `Сохранено периодов: **${vacations.length}**.` : 'Периодов пока нет. Добавь первый командой `/calendar vacation-add`.', fields));
    return;
  }

  if (subcommand === 'vacation-remove') {
    const id = interaction.options.getInteger('id', true);
    const changed = removeVacation(userId, id);
    await replyEmbed(interaction, changed ? successEmbed('Период удалён', `Период каникул #${id} удалён.`) : errorEmbed('Период не найден', `В твоём календаре нет периода #${id}.`));
  }
}

async function handleSettings(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'timezone') {
    const timezone = interaction.options.getString('timezone', true).trim();
    if (!isValidTimezone(timezone)) {
      await replyEmbed(interaction, errorEmbed('Неизвестный часовой пояс', 'Используй название из базы IANA, например `Europe/Kyiv`, `Europe/Warsaw` или `America/New_York`.'));
      return;
    }
    setUserTimezone(userId, timezone);
    await replyEmbed(interaction, settingsEmbed(userId));
    return;
  }

  if (subcommand === 'reminders') {
    const enabled = interaction.options.getBoolean('enabled', true);
    setRemindersEnabled(userId, enabled);
    await replyEmbed(interaction, settingsEmbed(userId));
  }
}

async function handleDmPlan(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const period = interaction.options.getString('period', true) as PlanPeriod;
  const embed = makePlanEmbed(userId, period);
  await interaction.deferReply(interaction.inGuild() ? { flags: MessageFlags.Ephemeral } : {});
  try {
    await interaction.user.send({ embeds: [embed], allowedMentions: { parse: [] } });
    await interaction.editReply({
      embeds: [successEmbed('План отправлен в ЛС', `Готово. Твой план на выбранный период отправлен в личные сообщения Discord.\n\nПериод: **${period}**`)],
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    console.warn(`[PlanCake] Не удалось отправить DM пользователю ${userId}:`, error);
    await interaction.editReply({
      embeds: [errorEmbed('Не удалось отправить ЛС', 'Discord не разрешил отправить тебе личное сообщение. Проверь настройки приватности для личных сообщений от участников сервера. Сам план доступен через `/plan`.')],
      allowedMentions: { parse: [] },
    });
  }
}

export async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  switch (interaction.commandName) {
    case 'help':
      await replyEmbed(interaction, helpEmbed());
      return;
    case 'info':
      await replyEmbed(interaction, infoEmbed());
      return;
    case 'task':
      await handleTask(interaction);
      return;
    case 'plan':
      await handlePlan(interaction);
      return;
    case 'calendar':
      await handleCalendar(interaction);
      return;
    case 'settings':
      await handleSettings(interaction);
      return;
    case 'dm-plan':
      await handleDmPlan(interaction);
      return;
    default:
      await replyEmbed(interaction, errorEmbed('Команда не найдена', 'Используй `/help`, чтобы посмотреть доступные команды.'));
  }
}
