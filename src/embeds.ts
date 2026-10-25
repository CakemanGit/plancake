import { EmbedBuilder } from 'discord.js';
import { ensureUser, type Task } from './db.js';
import {
  formatDateTag,
  getPeriodTitle,
  getTaskTimestamp,
  patternLabel,
  type DayPlan,
  type PlanPeriod,
} from './planner.js';

const BRAND = 0xB78BFA;
const SUCCESS = 0x43B581;
const WARNING = 0xF0B232;
const ERROR = 0xED4245;

function clip(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1))}…`;
}

export function infoEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BRAND)
    .setTitle('PlanCake • персональный планировщик')
    .setDescription('Планируй дела, повторяй привычные задачи и получай напоминания прямо в Discord.')
    .addFields(
      { name: 'Планирование', value: 'Сегодня, завтра, дата, неделя, будни, выходные, праздники и каникулы.', inline: false },
      { name: 'Напоминания', value: 'Укажи время `HH:MM` при создании задачи — PlanCake попробует прислать напоминание в ЛС.', inline: false },
      { name: 'Личный календарь', value: 'Праздники и периоды каникул настраиваются отдельно для каждого пользователя.', inline: false },
      { name: 'Приватность', value: 'Команды работают с задачами автора команды. Плановые ответы в сервере отправляются приватно.', inline: false },
    )
    .setFooter({ text: 'PlanCake • Планируй спокойно, выполняй по шагам' });
}

export function helpEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BRAND)
    .setTitle('PlanCake • Справочник команд')
    .setDescription('Все ответы планировщика оформлены в embed-сообщениях. Планы показываются автору команды приватно.')
    .addFields(
      { name: 'Начало работы', value: '`/info` — информация о боте\n`/help` — список команд', inline: false },
      { name: 'Задачи', value: '`/task add` — создать задачу\n`/task list` — список задач и их ID\n`/task complete` — отметить выполнение\n`/task delete` — удалить задачу', inline: false },
      { name: 'Планы', value: '`/plan today` · `/plan tomorrow`\n`/plan date` · `/plan week`\n`/plan weekdays` · `/plan weekend`\n`/plan holiday` · `/plan vacation`', inline: false },
      { name: 'Личные сообщения', value: '`/dm-plan` — отправить выбранный план в ЛС. Время в задаче включает личное напоминание.', inline: false },
      { name: 'Календарь', value: '`/calendar holiday-add` · `/calendar holiday-list` · `/calendar holiday-remove`\n`/calendar vacation-add` · `/calendar vacation-list` · `/calendar vacation-remove`', inline: false },
      { name: 'Настройки', value: '`/settings timezone` — часовой пояс\n`/settings reminders` — напоминания в ЛС', inline: false },
    )
    .setFooter({ text: 'Даты: YYYY-MM-DD • Время: HH:MM • Используется твой часовой пояс' });
}

export function successEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder().setColor(SUCCESS).setTitle(title).setDescription(description).setFooter({ text: 'PlanCake' });
}

export function warningEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder().setColor(WARNING).setTitle(title).setDescription(description).setFooter({ text: 'PlanCake' });
}

export function errorEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder().setColor(ERROR).setTitle(title).setDescription(description).setFooter({ text: 'PlanCake' });
}

export function taskListEmbed(tasks: Task[], timezone: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(BRAND)
    .setTitle('PlanCake • Твои задачи')
    .setDescription(tasks.length === 0 ? 'Пока нет ни одной задачи. Начни с `/task add`.' : `Всего задач: **${tasks.length}**.`);

  for (const task of tasks.slice(0, 20)) {
    const schedule = task.pattern === 'once'
      ? `Дата: **${task.scheduled_date ?? 'не задана'}**`
      : `Категория: ${String.fromCharCode(96)}${patternLabel(task.pattern)}${String.fromCharCode(96)}`;
    const timeLine = task.time ? `\nВремя: **${task.time}** (${timezone})` : '\nНапоминание: не задано';
    const details = task.details ? `\n${clip(task.details, 300)}` : '';
    embed.addFields({ name: `#${task.id} • ${clip(task.title, 200)}`, value: `${schedule}${timeLine}${details}`, inline: false });
  }
  if (tasks.length > 20) embed.addFields({ name: 'Остальные задачи', value: `Ещё ${tasks.length - 20}. Для удобства раздели или удали ненужные задачи.`, inline: false });
  return embed.setFooter({ text: 'ID задачи нужен для команд /task complete и /task delete' });
}

export function planEmbed(period: PlanPeriod, days: DayPlan[], timezone: string, emptyCalendar = false): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(BRAND)
    .setTitle(`PlanCake • ${getPeriodTitle(period)}`)
    .setDescription(`Часовой пояс: **${timezone}**\nФормат времени — твой локальный. Временные теги Discord могут отображаться в часовом поясе того, кто их читает.`);

  if (emptyCalendar) {
    const instruction = period === 'holiday'
      ? 'В календаре пока нет праздников. Добавь дату командой `/calendar holiday-add`.'
      : 'В календаре пока нет каникул. Добавь период командой `/calendar vacation-add`.';
    embed.addFields({ name: 'Календарь пока пуст', value: instruction, inline: false });
  } else if (days.length === 0) {
    embed.addFields({ name: 'Нет дат для отображения', value: 'Добавь соответствующие даты или периоды в `/calendar` и повтори команду.', inline: false });
  } else {
    for (const day of days.slice(0, 20)) {
      const labels: string[] = [];
      if (day.holidayNames.length) labels.push(`🎉 ${day.holidayNames.join(', ')}`);
      if (day.vacationNames.length) labels.push(`🏖️ ${day.vacationNames.join(', ')}`);

      const lines: string[] = [];
      if (labels.length) lines.push(labels.join(' · '));
      if (day.tasks.length === 0) {
        lines.push('_Нет задач на эту дату._');
      } else {
        for (const task of day.tasks.slice(0, 8)) {
          const icon = task.completed ? '✅' : '▫️';
          const title = task.completed ? `~~${clip(task.title, 150)}~~` : clip(task.title, 150);
          const time = getTaskTimestamp(task, day.date, timezone);
          const timeText = time === undefined ? '' : ` · ⏰ <t:${time}:t> (<t:${time}:R>)`;
          const tick = String.fromCharCode(96);
          lines.push(`${icon} ${tick}#${task.id}${tick} ${title}${timeText}`);
          lines.push(`　${tick}${patternLabel(task.pattern)}${tick}`);
        }
        if (day.tasks.length > 8) lines.push(`_И ещё ${day.tasks.length - 8} задач._`);
      }
      embed.addFields({
        name: `${day.date} · ${formatDateTag(day.date, timezone)}`,
        value: clip(lines.join('\n'), 1024),
        inline: false,
      });
    }
  }

  return embed.setFooter({ text: 'PlanCake • Выполненное отмечается отдельно для каждого дня' });
}

export function taskReminderEmbed(task: Task, date: string, timezone: string): EmbedBuilder {
  const timestamp = getTaskTimestamp(task, date, timezone);
  const description = [
    `**Дата:** ${date} (${formatDateTag(date, timezone)})`,
    timestamp === undefined ? '' : `**Время:** <t:${timestamp}:t> · <t:${timestamp}:R>`,
    task.details ? `\n${clip(task.details, 1000)}` : '',
  ].filter(Boolean).join('\n');
  return new EmbedBuilder()
    .setColor(WARNING)
    .setTitle(`⏰ PlanCake • ${clip(task.title, 200)}`)
    .setDescription(description)
    .addFields({ name: 'Категория', value: `\`${patternLabel(task.pattern)}\``, inline: true })
    .setFooter({ text: `Задача #${task.id} • Часовой пояс ${timezone}` });
}

export function calendarListEmbed(title: string, description: string, fields: Array<{ name: string; value: string }>): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(BRAND).setTitle(title).setDescription(description);
  for (const field of fields.slice(0, 25)) embed.addFields({ name: clip(field.name, 256), value: clip(field.value, 1024), inline: false });
  return embed.setFooter({ text: 'PlanCake • Личный календарь' });
}

export function settingsEmbed(userId: string): EmbedBuilder {
  const settings = ensureUser(userId);
  return new EmbedBuilder()
    .setColor(BRAND)
    .setTitle('PlanCake • Настройки обновлены')
    .setDescription(`Часовой пояс: **${settings.timezone}**\nНапоминания в ЛС: **${settings.reminders_enabled ? 'включены' : 'выключены'}**`);
}
