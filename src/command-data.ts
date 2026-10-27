import { SlashCommandBuilder } from 'discord.js';

export const commands = [
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Показать справку по командам PlanCake'),

  new SlashCommandBuilder()
    .setName('info')
    .setDescription('Информация о PlanCake и его возможностях'),

  new SlashCommandBuilder()
    .setName('task')
    .setDescription('Создание и управление личными задачами')
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Добавить задачу')
      .addStringOption(option => option.setName('title').setDescription('Краткое название задачи').setMaxLength(100).setRequired(true))
      .addStringOption(option => option.setName('pattern').setDescription('Когда задача должна повторяться').setRequired(true).addChoices(
        { name: 'Один раз', value: 'once' },
        { name: 'Каждый день', value: 'daily' },
        { name: 'По будням', value: 'weekdays' },
        { name: 'По выходным', value: 'weekend' },
        { name: 'В праздники', value: 'holiday' },
        { name: 'Во время каникул', value: 'vacation' },
      ))
      .addStringOption(option => option.setName('date').setDescription('Дата YYYY-MM-DD; обязательна для задачи «Один раз»').setMaxLength(10).setRequired(false))
      .addStringOption(option => option.setName('time').setDescription('Время HH:MM в твоём часовом поясе; включает ЛС-напоминание').setMaxLength(5).setRequired(false))
      .addStringOption(option => option.setName('details').setDescription('Дополнительные подробности').setMaxLength(500).setRequired(false)))
    .addSubcommand(sub => sub.setName('list').setDescription('Показать все свои задачи'))
    .addSubcommand(sub => sub
      .setName('complete')
      .setDescription('Отметить задачу выполненной на определённую дату')
      .addIntegerOption(option => option.setName('id').setDescription('ID задачи из списка').setMinValue(1).setRequired(true))
      .addStringOption(option => option.setName('date').setDescription('Дата YYYY-MM-DD; по умолчанию сегодня или дата одноразовой задачи').setMaxLength(10).setRequired(false)))
    .addSubcommand(sub => sub
      .setName('delete')
      .setDescription('Удалить свою задачу')
      .addIntegerOption(option => option.setName('id').setDescription('ID задачи').setMinValue(1).setRequired(true))),

  new SlashCommandBuilder()
    .setName('plan')
    .setDescription('Показать расписание на выбранный период')
    .addSubcommand(sub => sub.setName('today').setDescription('План на сегодня'))
    .addSubcommand(sub => sub.setName('tomorrow').setDescription('План на завтра'))
    .addSubcommand(sub => sub.setName('date').setDescription('План на конкретную дату')
      .addStringOption(option => option.setName('date').setDescription('Дата в формате YYYY-MM-DD').setMaxLength(10).setRequired(true)))
    .addSubcommand(sub => sub.setName('week').setDescription('План на следующие 7 дней'))
    .addSubcommand(sub => sub.setName('weekdays').setDescription('План на следующие 5 будних дней'))
    .addSubcommand(sub => sub.setName('weekend').setDescription('План на ближайшие выходные'))
    .addSubcommand(sub => sub.setName('holiday').setDescription('План на ближайшие добавленные праздники'))
    .addSubcommand(sub => sub.setName('vacation').setDescription('План на добавленные периоды каникул')),

  new SlashCommandBuilder()
    .setName('calendar')
    .setDescription('Настройка персональных праздников и каникул')
    .addSubcommand(sub => sub.setName('holiday-add').setDescription('Добавить праздничную дату')
      .addStringOption(option => option.setName('date').setDescription('Дата YYYY-MM-DD').setMaxLength(10).setRequired(true))
      .addStringOption(option => option.setName('name').setDescription('Название праздника').setMaxLength(80).setRequired(true)))
    .addSubcommand(sub => sub.setName('holiday-list').setDescription('Показать праздничные даты'))
    .addSubcommand(sub => sub.setName('holiday-remove').setDescription('Удалить праздник по дате')
      .addStringOption(option => option.setName('date').setDescription('Дата YYYY-MM-DD').setMaxLength(10).setRequired(true)))
    .addSubcommand(sub => sub.setName('vacation-add').setDescription('Добавить период каникул или отпуска')
      .addStringOption(option => option.setName('start').setDescription('Начало периода YYYY-MM-DD').setMaxLength(10).setRequired(true))
      .addStringOption(option => option.setName('end').setDescription('Конец периода YYYY-MM-DD').setMaxLength(10).setRequired(true))
      .addStringOption(option => option.setName('name').setDescription('Название периода').setMaxLength(80).setRequired(true)))
    .addSubcommand(sub => sub.setName('vacation-list').setDescription('Показать периоды каникул'))
    .addSubcommand(sub => sub.setName('vacation-remove').setDescription('Удалить период по ID')
      .addIntegerOption(option => option.setName('id').setDescription('ID периода из списка').setMinValue(1).setRequired(true))),

  new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Персональные настройки PlanCake')
    .addSubcommand(sub => sub.setName('timezone').setDescription('Установить часовой пояс')
      .addStringOption(option => option.setName('timezone').setDescription('Например Europe/Kyiv или Europe/Warsaw').setMaxLength(64).setRequired(true)))
    .addSubcommand(sub => sub.setName('reminders').setDescription('Включить или выключить напоминания в ЛС')
      .addBooleanOption(option => option.setName('enabled').setDescription('Включить напоминания').setRequired(true))),

  new SlashCommandBuilder()
    .setName('dm-plan')
    .setDescription('Отправить твой план в личные сообщения Discord')
    .addStringOption(option => option.setName('period').setDescription('На какой период отправить план').setRequired(true).addChoices(
      { name: 'Сегодня', value: 'today' },
      { name: 'Завтра', value: 'tomorrow' },
      { name: 'Следующие 7 дней', value: 'week' },
      { name: 'Будни', value: 'weekdays' },
      { name: 'Ближайшие выходные', value: 'weekend' },
      { name: 'Праздники', value: 'holiday' },
      { name: 'Каникулы', value: 'vacation' },
    )),
];
