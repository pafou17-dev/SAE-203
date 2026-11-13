import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const consultationVotes = sqliteTable('consultation_votes', {
  voterKey: text('voter_key').primaryKey(),
  model: text('model', { enum: ['classique', 'cargo', 'pluie'] }).notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
export const consultationComments = sqliteTable('consultation_comments', {
  id: text('id').primaryKey(),
  authorKey: text('author_key').notNull(),
  alias: text('alias').notNull(),
  model: text('model', { enum: ['classique', 'cargo', 'pluie'] }),
  body: text('body').notNull(),
  status: text('status', { enum: ['published', 'hidden'] }).notNull().default('published'),
  createdAt: integer('created_at').notNull(),
}, table => [index('comments_published_date').on(table.status, table.createdAt), index('comments_author_date').on(table.authorKey, table.createdAt)]);
