import { DataSource, ViewColumn, ViewEntity } from 'typeorm';

// Notifications per user - daily
@ViewEntity({
  name: 'mv_notifications_per_user_daily',
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('n."userId"', 'userId')
      .addSelect("DATE_TRUNC('day', n." + '"sentAt"' + ")", 'periodStart')
      .addSelect('COUNT(*)', 'count')
      .from('notifications', 'n')
      .where('n."sentAt" IS NOT NULL')
      .groupBy('n."userId"')
      .addGroupBy("DATE_TRUNC('day', n." + '"sentAt"' + ")"),
})
export class NotificationsPerUserDailyView {
  @ViewColumn()
  userId!: string;

  @ViewColumn()
  periodStart!: Date;

  @ViewColumn()
  count!: number;
}

// Notifications per user - weekly
@ViewEntity({
  name: 'mv_notifications_per_user_weekly',
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('n."userId"', 'userId')
      .addSelect("DATE_TRUNC('week', n." + '"sentAt"' + ")", 'periodStart')
      .addSelect('COUNT(*)', 'count')
      .from('notifications', 'n')
      .where('n."sentAt" IS NOT NULL')
      .groupBy('n."userId"')
      .addGroupBy("DATE_TRUNC('week', n." + '"sentAt"' + ")"),
})
export class NotificationsPerUserWeeklyView {
  @ViewColumn()
  userId!: string;

  @ViewColumn()
  periodStart!: Date;

  @ViewColumn()
  count!: number;
}

// Notifications per user - monthly
@ViewEntity({
  name: 'mv_notifications_per_user_monthly',
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('n."userId"', 'userId')
      .addSelect("DATE_TRUNC('month', n." + '"sentAt"' + ")", 'periodStart')
      .addSelect('COUNT(*)', 'count')
      .from('notifications', 'n')
      .where('n."sentAt" IS NOT NULL')
      .groupBy('n."userId"')
      .addGroupBy("DATE_TRUNC('month', n." + '"sentAt"' + ")"),
})
export class NotificationsPerUserMonthlyView {
  @ViewColumn()
  userId!: string;

  @ViewColumn()
  periodStart!: Date;

  @ViewColumn()
  count!: number;
}

// Notifications per user - all time
@ViewEntity({
  name: 'mv_notifications_per_user_all_time',
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('n."userId"', 'userId')
      .addSelect('COUNT(*)', 'count')
      .from('notifications', 'n')
      .where('n."sentAt" IS NOT NULL')
      .groupBy('n."userId"'),
})
export class NotificationsPerUserAllTimeView {
  @ViewColumn()
  userId!: string;

  @ViewColumn()
  count!: number;
}

// Events per system token (PUSH_PASSTHROUGH) - daily
@ViewEntity({
  name: 'mv_notifications_per_system_token_daily',
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('e."objectId"', 'systemTokenId')
      .addSelect("DATE_TRUNC('day', e." + '"createdAt"' + ")", 'periodStart')
      .addSelect('COUNT(*)', 'count')
      .from('events', 'e')
      .where("e.type = 'PUSH_PASSTHROUGH'")
      .groupBy('e."objectId"')
      .addGroupBy("DATE_TRUNC('day', e." + '"createdAt"' + ")"),
})
export class NotificationsPerSystemTokenDailyView {
  @ViewColumn()
  systemTokenId!: string;

  @ViewColumn()
  periodStart!: Date;

  @ViewColumn()
  count!: number;
}

// Weekly
@ViewEntity({
  name: 'mv_notifications_per_system_token_weekly',
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('e."objectId"', 'systemTokenId')
      .addSelect("DATE_TRUNC('week', e." + '"createdAt"' + ")", 'periodStart')
      .addSelect('COUNT(*)', 'count')
      .from('events', 'e')
      .where("e.type = 'PUSH_PASSTHROUGH'")
      .groupBy('e."objectId"')
      .addGroupBy("DATE_TRUNC('week', e." + '"createdAt"' + ")"),
})
export class NotificationsPerSystemTokenWeeklyView {
  @ViewColumn()
  systemTokenId!: string;

  @ViewColumn()
  periodStart!: Date;

  @ViewColumn()
  count!: number;
}

// Monthly
@ViewEntity({
  name: 'mv_notifications_per_system_token_monthly',
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('e."objectId"', 'systemTokenId')
      .addSelect("DATE_TRUNC('month', e." + '"createdAt"' + ")", 'periodStart')
      .addSelect('COUNT(*)', 'count')
      .from('events', 'e')
      .where("e.type = 'PUSH_PASSTHROUGH'")
      .groupBy('e."objectId"')
      .addGroupBy("DATE_TRUNC('month', e." + '"createdAt"' + ")"),
})
export class NotificationsPerSystemTokenMonthlyView {
  @ViewColumn()
  systemTokenId!: string;

  @ViewColumn()
  periodStart!: Date;

  @ViewColumn()
  count!: number;
}

// All time
@ViewEntity({
  name: 'mv_notifications_per_system_token_all_time',
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('e."objectId"', 'systemTokenId')
      .addSelect('COUNT(*)', 'count')
      .from('events', 'e')
      .where("e.type = 'PUSH_PASSTHROUGH'")
      .groupBy('e."objectId"'),
})
export class NotificationsPerSystemTokenAllTimeView {
  @ViewColumn()
  systemTokenId!: string;

  @ViewColumn()
  count!: number;
}


