import { DataSource, ViewColumn, ViewEntity } from 'typeorm';
import { Field, ObjectType } from '@nestjs/graphql';

// Events per user - daily
@ViewEntity({
  name: 'mv_events_per_user_daily',
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('e."userId"', 'userId')
      .addSelect("DATE_TRUNC('day', e." + '"createdAt"' + ")", 'periodStart')
      .addSelect('COUNT(*)', 'count')
      .from('events', 'e')
      .where('e."userId" IS NOT NULL AND e."type" = \'NOTIFICATION\'')
      .groupBy('e."userId"')
      .addGroupBy("DATE_TRUNC('day', e." + '"createdAt"' + ")"),
})
@ObjectType()
export class EventsPerUserDailyView {
  @ViewColumn()
  @Field()
  userId!: string;

  @ViewColumn()
  @Field()
  periodStart!: Date;

  @ViewColumn()
  @Field()
  count!: number;
}

// Events per user - weekly
@ViewEntity({
  name: 'mv_events_per_user_weekly',
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('e."userId"', 'userId')
      .addSelect("DATE_TRUNC('week', e." + '"createdAt"' + ")", 'periodStart')
      .addSelect('COUNT(*)', 'count')
      .from('events', 'e')
      .where('e."userId" IS NOT NULL AND e."type" = \'NOTIFICATION\'')
      .groupBy('e."userId"')
      .addGroupBy("DATE_TRUNC('week', e." + '"createdAt"' + ")"),
})
@ObjectType()
export class EventsPerUserWeeklyView {
  @ViewColumn()
  @Field()
  userId!: string;

  @ViewColumn()
  @Field()
  periodStart!: Date;

  @ViewColumn()
  @Field()
  count!: number;
}

// Events per user - monthly
@ViewEntity({
  name: 'mv_events_per_user_monthly',
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('e."userId"', 'userId')
      .addSelect("DATE_TRUNC('month', e." + '"createdAt"' + ")", 'periodStart')
      .addSelect('COUNT(*)', 'count')
      .from('events', 'e')
      .where('e."userId" IS NOT NULL AND e."type" = \'NOTIFICATION\'')
      .groupBy('e."userId"')
      .addGroupBy("DATE_TRUNC('month', e." + '"createdAt"' + ")"),
})
@ObjectType()
export class EventsPerUserMonthlyView {
  @ViewColumn()
  @Field()
  userId!: string;

  @ViewColumn()
  @Field()
  periodStart!: Date;

  @ViewColumn()
  @Field()
  count!: number;
}

// Events per user - all time
@ViewEntity({
  name: 'mv_events_per_user_all_time',
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('e."userId"', 'userId')
      .addSelect('COUNT(*)', 'count')
      .from('events', 'e')
      .where('e."userId" IS NOT NULL AND e."type" = \'NOTIFICATION\'')
      .groupBy('e."userId"'),
})
@ObjectType()
export class EventsPerUserAllTimeView {
  @ViewColumn()
  @Field()
  userId!: string;

  @ViewColumn()
  @Field()
  count!: number;
}

// Events per bucket - daily
@ViewEntity({
  name: 'mv_events_per_bucket_daily',
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('e."objectId"', 'bucketId')
      .addSelect("DATE_TRUNC('day', e." + '"createdAt"' + ")", 'periodStart')
      .addSelect('COUNT(*)', 'count')
      .from('events', 'e')
      .where('e."objectId" IS NOT NULL AND e."type" = \'NOTIFICATION\'')
      .groupBy('e."objectId"')
      .addGroupBy("DATE_TRUNC('day', e." + '"createdAt"' + ")"),
})
@ObjectType()
export class EventsPerBucketDailyView {
  @ViewColumn()
  @Field()
  bucketId!: string;

  @ViewColumn()
  @Field()
  periodStart!: Date;

  @ViewColumn()
  @Field()
  count!: number;
}

// Events per bucket - weekly
@ViewEntity({
  name: 'mv_events_per_bucket_weekly',
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('e."objectId"', 'bucketId')
      .addSelect("DATE_TRUNC('week', e." + '"createdAt"' + ")", 'periodStart')
      .addSelect('COUNT(*)', 'count')
      .from('events', 'e')
      .where('e."objectId" IS NOT NULL AND e."type" = \'NOTIFICATION\'')
      .groupBy('e."objectId"')
      .addGroupBy("DATE_TRUNC('week', e." + '"createdAt"' + ")"),
})
@ObjectType()
export class EventsPerBucketWeeklyView {
  @ViewColumn()
  @Field()
  bucketId!: string;

  @ViewColumn()
  @Field()
  periodStart!: Date;

  @ViewColumn()
  @Field()
  count!: number;
}

// Events per bucket - monthly
@ViewEntity({
  name: 'mv_events_per_bucket_monthly',
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('e."objectId"', 'bucketId')
      .addSelect("DATE_TRUNC('month', e." + '"createdAt"' + ")", 'periodStart')
      .addSelect('COUNT(*)', 'count')
      .from('events', 'e')
      .where('e."objectId" IS NOT NULL AND e."type" = \'NOTIFICATION\'')
      .groupBy('e."objectId"')
      .addGroupBy("DATE_TRUNC('month', e." + '"createdAt"' + ")"),
})
@ObjectType()
export class EventsPerBucketMonthlyView {
  @ViewColumn()
  @Field()
  bucketId!: string;

  @ViewColumn()
  @Field()
  periodStart!: Date;

  @ViewColumn()
  @Field()
  count!: number;
}

// Events per bucket - all time
@ViewEntity({
  name: 'mv_events_per_bucket_all_time',
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('e."objectId"', 'bucketId')
      .addSelect('COUNT(*)', 'count')
      .from('events', 'e')
      .where('e."objectId" IS NOT NULL AND e."type" = \'NOTIFICATION\'')
      .groupBy('e."objectId"'),
})
@ObjectType()
export class EventsPerBucketAllTimeView {
  @ViewColumn()
  @Field()
  bucketId!: string;

  @ViewColumn()
  @Field()
  count!: number;
}

// Events per device - daily
@ViewEntity({
  name: 'mv_events_per_device_daily',
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('e."deviceId"', 'deviceId')
      .addSelect("DATE_TRUNC('day', e." + '"createdAt"' + ")", 'periodStart')
      .addSelect('COUNT(*)', 'count')
      .from('events', 'e')
      .where('e."deviceId" IS NOT NULL AND e."type" = \'NOTIFICATION\'')
      .groupBy('e."deviceId"')
      .addGroupBy("DATE_TRUNC('day', e." + '"createdAt"' + ")"),
})
@ObjectType()
export class EventsPerDeviceDailyView {
  @ViewColumn()
  @Field()
  deviceId!: string;

  @ViewColumn()
  @Field()
  periodStart!: Date;

  @ViewColumn()
  @Field()
  count!: number;
}

// Events per device - weekly
@ViewEntity({
  name: 'mv_events_per_device_weekly',
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('e."deviceId"', 'deviceId')
      .addSelect("DATE_TRUNC('week', e." + '"createdAt"' + ")", 'periodStart')
      .addSelect('COUNT(*)', 'count')
      .from('events', 'e')
      .where('e."deviceId" IS NOT NULL AND e."type" = \'NOTIFICATION\'')
      .groupBy('e."deviceId"')
      .addGroupBy("DATE_TRUNC('week', e." + '"createdAt"' + ")"),
})
@ObjectType()
export class EventsPerDeviceWeeklyView {
  @ViewColumn()
  @Field()
  deviceId!: string;

  @ViewColumn()
  @Field()
  periodStart!: Date;

  @ViewColumn()
  @Field()
  count!: number;
}

// Events per device - monthly
@ViewEntity({
  name: 'mv_events_per_device_monthly',
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('e."deviceId"', 'deviceId')
      .addSelect("DATE_TRUNC('month', e." + '"createdAt"' + ")", 'periodStart')
      .addSelect('COUNT(*)', 'count')
      .from('events', 'e')
      .where('e."deviceId" IS NOT NULL AND e."type" = \'NOTIFICATION\'')
      .groupBy('e."deviceId"')
      .addGroupBy("DATE_TRUNC('month', e." + '"createdAt"' + ")"),
})
@ObjectType()
export class EventsPerDeviceMonthlyView {
  @ViewColumn()
  @Field()
  deviceId!: string;

  @ViewColumn()
  @Field()
  periodStart!: Date;

  @ViewColumn()
  @Field()
  count!: number;
}

// Events per device - all time
@ViewEntity({
  name: 'mv_events_per_device_all_time',
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('e."deviceId"', 'deviceId')
      .addSelect('COUNT(*)', 'count')
      .from('events', 'e')
      .where('e."deviceId" IS NOT NULL AND e."type" = \'NOTIFICATION\'')
      .groupBy('e."deviceId"'),
})
@ObjectType()
export class EventsPerDeviceAllTimeView {
  @ViewColumn()
  @Field()
  deviceId!: string;

  @ViewColumn()
  @Field()
  count!: number;
}

// Events per type - daily
@ViewEntity({
  name: 'mv_events_per_type_daily',
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('e."type"', 'eventType')
      .addSelect("DATE_TRUNC('day', e." + '"createdAt"' + ")", 'periodStart')
      .addSelect('COUNT(*)', 'count')
      .from('events', 'e')
      .where('e."type" = \'NOTIFICATION\'')
      .groupBy('e."type"')
      .addGroupBy("DATE_TRUNC('day', e." + '"createdAt"' + ")"),
})
@ObjectType()
export class EventsPerTypeDailyView {
  @ViewColumn()
  @Field()
  eventType!: string;

  @ViewColumn()
  @Field()
  periodStart!: Date;

  @ViewColumn()
  @Field()
  count!: number;
}

// Events per type - weekly
@ViewEntity({
  name: 'mv_events_per_type_weekly',
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('e."type"', 'eventType')
      .addSelect("DATE_TRUNC('week', e." + '"createdAt"' + ")", 'periodStart')
      .addSelect('COUNT(*)', 'count')
      .from('events', 'e')
      .where('e."type" = \'NOTIFICATION\'')
      .groupBy('e."type"')
      .addGroupBy("DATE_TRUNC('week', e." + '"createdAt"' + ")"),
})
@ObjectType()
export class EventsPerTypeWeeklyView {
  @ViewColumn()
  @Field()
  eventType!: string;

  @ViewColumn()
  @Field()
  periodStart!: Date;

  @ViewColumn()
  @Field()
  count!: number;
}

// Events per type - monthly
@ViewEntity({
  name: 'mv_events_per_type_monthly',
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('e."type"', 'eventType')
      .addSelect("DATE_TRUNC('month', e." + '"createdAt"' + ")", 'periodStart')
      .addSelect('COUNT(*)', 'count')
      .from('events', 'e')
      .where('e."type" = \'NOTIFICATION\'')
      .groupBy('e."type"')
      .addGroupBy("DATE_TRUNC('month', e." + '"createdAt"' + ")"),
})
@ObjectType()
export class EventsPerTypeMonthlyView {
  @ViewColumn()
  @Field()
  eventType!: string;

  @ViewColumn()
  @Field()
  periodStart!: Date;

  @ViewColumn()
  @Field()
  count!: number;
}

// Events per type - all time
@ViewEntity({
  name: 'mv_events_per_type_all_time',
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('e."type"', 'eventType')
      .addSelect('COUNT(*)', 'count')
      .from('events', 'e')
      .where('e."type" = \'NOTIFICATION\'')
      .groupBy('e."type"'),
})
@ObjectType()
export class EventsPerTypeAllTimeView {
  @ViewColumn()
  @Field()
  eventType!: string;

  @ViewColumn()
  @Field()
  count!: number;
}

// Events per bucket per user - daily
@ViewEntity({
  name: 'mv_events_per_bucket_user_daily',
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('e."objectId"', 'bucketId')
      .addSelect('e."userId"', 'userId')
      .addSelect("DATE_TRUNC('day', e." + '"createdAt"' + ")", 'periodStart')
      .addSelect('COUNT(*)', 'count')
      .from('events', 'e')
      .where('e."objectId" IS NOT NULL AND e."userId" IS NOT NULL AND e."type" = \'NOTIFICATION\'')
      .groupBy('e."objectId"')
      .addGroupBy('e."userId"')
      .addGroupBy("DATE_TRUNC('day', e." + '"createdAt"' + ")"),
})
@ObjectType()
export class EventsPerBucketUserDailyView {
  @ViewColumn()
  @Field()
  bucketId!: string;

  @ViewColumn()
  @Field()
  userId!: string;

  @ViewColumn()
  @Field()
  periodStart!: Date;

  @ViewColumn()
  @Field()
  count!: number;
}

// Events per bucket per user - weekly
@ViewEntity({
  name: 'mv_events_per_bucket_user_weekly',
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('e."objectId"', 'bucketId')
      .addSelect('e."userId"', 'userId')
      .addSelect("DATE_TRUNC('week', e." + '"createdAt"' + ")", 'periodStart')
      .addSelect('COUNT(*)', 'count')
      .from('events', 'e')
      .where('e."objectId" IS NOT NULL AND e."userId" IS NOT NULL AND e."type" = \'NOTIFICATION\'')
      .groupBy('e."objectId"')
      .addGroupBy('e."userId"')
      .addGroupBy("DATE_TRUNC('week', e." + '"createdAt"' + ")"),
})
@ObjectType()
export class EventsPerBucketUserWeeklyView {
  @ViewColumn()
  @Field()
  bucketId!: string;

  @ViewColumn()
  @Field()
  userId!: string;

  @ViewColumn()
  @Field()
  periodStart!: Date;

  @ViewColumn()
  @Field()
  count!: number;
}

// Events per bucket per user - monthly
@ViewEntity({
  name: 'mv_events_per_bucket_user_monthly',
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('e."objectId"', 'bucketId')
      .addSelect('e."userId"', 'userId')
      .addSelect("DATE_TRUNC('month', e." + '"createdAt"' + ")", 'periodStart')
      .addSelect('COUNT(*)', 'count')
      .from('events', 'e')
      .where('e."objectId" IS NOT NULL AND e."userId" IS NOT NULL AND e."type" = \'NOTIFICATION\'')
      .groupBy('e."objectId"')
      .addGroupBy('e."userId"')
      .addGroupBy("DATE_TRUNC('month', e." + '"createdAt"' + ")"),
})
@ObjectType()
export class EventsPerBucketUserMonthlyView {
  @ViewColumn()
  @Field()
  bucketId!: string;

  @ViewColumn()
  @Field()
  userId!: string;

  @ViewColumn()
  @Field()
  periodStart!: Date;

  @ViewColumn()
  @Field()
  count!: number;
}

// Events per bucket per user - all time
@ViewEntity({
  name: 'mv_events_per_bucket_user_all_time',
  materialized: true,
  expression: (dataSource: DataSource) =>
    dataSource
      .createQueryBuilder()
      .select('e."objectId"', 'bucketId')
      .addSelect('e."userId"', 'userId')
      .addSelect('COUNT(*)', 'count')
      .from('events', 'e')
      .where('e."objectId" IS NOT NULL AND e."userId" IS NOT NULL AND e."type" = \'NOTIFICATION\'')
      .groupBy('e."objectId"')
      .addGroupBy('e."userId"'),
})
@ObjectType()
export class EventsPerBucketUserAllTimeView {
  @ViewColumn()
  @Field()
  bucketId!: string;

  @ViewColumn()
  @Field()
  userId!: string;

  @ViewColumn()
  @Field()
  count!: number;
}
