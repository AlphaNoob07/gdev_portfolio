import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const contactSubmissions = pgTable('contact_submissions', {
  id: serial('id').primaryKey(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  subject: text('subject'),
  message: text('message').notNull(),
  ipHash: text('ip_hash').notNull(),
  deliveryStatus: text('delivery_status').notNull().default('pending'),
  resendId: text('resend_id'),
  status: text('status').notNull().default('unread'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
  count: integer('count').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const chatUsageDaily = pgTable('chat_usage_daily', {
  day: text('day').primaryKey(),
  count: integer('count').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const analyticsSnapshots = pgTable('analytics_snapshots', {
  day: text('day').primaryKey(),
  visits: integer('visits').notNull(),
  uniques: integer('uniques').notNull(),
  pageviews: integer('pageviews').notNull(),
  bounces: integer('bounces').notNull().default(0),
  totalTime: integer('total_time').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
