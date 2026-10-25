import { Client } from 'discord.js';
import { DateTime } from 'luxon';
import {
  ensureUser,
  isTaskCompleted,
  listRemindableTasks,
  markReminderSent,
  wasReminderSent,
} from './db.js';
import { taskReminderEmbed } from './embeds.js';
import { taskMatchesDate } from './planner.js';

let loopRunning = false;

export function startReminderLoop(client: Client): void {
  const run = async (): Promise<void> => {
    if (loopRunning || !client.isReady()) return;
    loopRunning = true;
    try {
      for (const task of listRemindableTasks()) {
        const settings = ensureUser(task.user_id);
        if (!settings.reminders_enabled || !task.time) continue;

        const now = DateTime.now().setZone(settings.timezone);
        if (!now.isValid) continue;
        const date = now.toISODate();
        if (!date) continue;

        const due = DateTime.fromISO(`${date}T${task.time}`, { zone: settings.timezone });
        if (!due.isValid) continue;
        const minutesLate = now.diff(due, 'minutes').minutes;
        // Разрешаем небольшой люфт на расписание таймера/сеть, но не шлём старые напоминания после долгого простоя.
        if (minutesLate < 0 || minutesLate > 5) continue;
        if (wasReminderSent(task.id, date) || isTaskCompleted(task.id, date)) continue;
        if (!taskMatchesDate(task, task.user_id, date)) continue;

        try {
          const user = await client.users.fetch(task.user_id);
          await user.send({
            embeds: [taskReminderEmbed(task, date, settings.timezone)],
            allowedMentions: { parse: [] },
          });
        } catch (error) {
          console.warn(`[PlanCake] Не удалось отправить напоминание для задачи #${task.id} пользователю ${task.user_id}:`, error);
        } finally {
          // Не повторяем отправку каждую минуту, если ЛС закрыты или Discord вернул ошибку.
          markReminderSent(task.id, date);
        }
      }
    } catch (error) {
      console.error('[PlanCake] Ошибка цикла напоминаний:', error);
    } finally {
      loopRunning = false;
    }
  };

  // Небольшая задержка после входа в Gateway даёт клиенту время полностью подключиться.
  setTimeout(() => void run(), 10_000);
  setInterval(() => void run(), 30_000);
}
