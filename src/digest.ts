import { Client, EmbedBuilder } from 'discord.js';

interface DigestUserRow {
    userId: string;
}

interface UserStatsRow {
    total: number;
    completed: number;
}

export class WeeklyDigestService {
    private client: Client;
    private db: any;
    private interval: NodeJS.Timeout | null = null;

    constructor(client: Client, db: any) {
        this.client = client;
        this.db = db;
    }

    // Запуск проверки (проверяет каждые 6 часов, наступило ли нужное время)
    public start() {
        const SIX_HOURS = 6 * 60 * 60 * 1000;
        
        this.interval = setInterval(() => {
            const now = new Date();
            // Отправляем, например, каждое воскресенье в 20:00
            if (now.getDay() === 0 && now.getHours() >= 20 && now.getHours() < 26) {
                this.sendWeeklyDigest();
            }
        }, SIX_HOURS);
    }

    private async sendWeeklyDigest() {
        console.log('[Digest Service] Запуск рассылки еженедельного дайджеста...');

        try {
            // Получаем список всех уникальных пользователей, у которых есть задачи
            const users = this.db.prepare(`SELECT DISTINCT userId FROM tasks`).all() as DigestUserRow[];

            for (const userRow of users) {
                const userId = userRow.userId;

                // Собираем статистику по одноразовым задачам за последние 7 дней
                const stats = this.db.prepare(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN isCompleted = 1 THEN 1 ELSE 0 END) as completed
                    FROM tasks
                    WHERE userId = ? AND pattern = 'once'
                `).get(userId) as UserStatsRow;

                const total = stats?.total || 0;
                const completed = stats?.completed || 0;

                // Если у пользователя вообще нет задач, пропускаем его
                if (total === 0) continue;

                const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

                try {
                    const discordUser = await this.client.users.fetch(userId);
                    
                    const digestEmbed = new EmbedBuilder()
                        .setColor('#5865F2')
                        .setTitle('🥞 Ваш еженедельный дайджест PlanCake')
                        .setDescription(`Привет, ${discordUser.username}! Вот итоги твоей продуктивности за прошедшие 7 дней:`)
                        .addFields(
                            { name: '📝 Всего задач было', value: `\`${total}\``, inline: true },
                            { name: '✅ Выполнено', value: `\`${completed}\``, inline: true },
                            { name: '📊 Успеваемость', value: `**${rate}%**`, inline: true }
                        )
                        .setFooter({ text: 'Удачи на следующей неделе! Вы справитесь! ✨' })
                        .setTimestamp();

                    await discordUser.send({ embeds: [digestEmbed] });
                } catch (dmError) {
                    // Игнорируем ошибку, если у пользователя закрыты ЛС
                    console.warn(`[Digest Service] Не удалось отправить ЛС пользователю ${userId}:`, dmError instanceof Error ? dmError.message : String(dmError));
                }
            }
        } catch (error) {
            console.error('[Digest Service] Критическая ошибка при сборке дайджеста:', error);
        }
    }
}