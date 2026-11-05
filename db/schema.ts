import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const therapists = sqliteTable('therapists', {
  id: text('id').primaryKey(), name: text('name').notNull(), specialty: text('specialty').notNull().default('ფსიქოლოგი'),
  ownerUserId: text('owner_user_id'), pinSalt: text('pin_salt'), pinHash: text('pin_hash'), createdAt: text('created_at').notNull(),
});
export const clients = sqliteTable('clients', {
  id: text('id').primaryKey(), therapistId: text('therapist_id').notNull().references(()=>therapists.id),
  code: text('code').notNull(), fullName: text('full_name').notNull(), age: integer('age').notNull(),
  sex: text('sex').notNull(), note: text('note').notNull().default(''), findings: text('findings').notNull().default('{}'),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, t=>[uniqueIndex('clients_therapist_code_unique').on(t.therapistId,t.code)]);
export const assessments = sqliteTable('assessments', {
  id: text('id').primaryKey(), clientId: text('client_id').notNull().references(()=>clients.id), therapistId: text('therapist_id').notNull().references(()=>therapists.id),
  testId: text('test_id').notNull(), stage: text('stage').notNull(), answers: text('answers').notNull(), result: text('result').notNull(), createdAt: text('created_at').notNull(),
});
export const qeegFiles = sqliteTable('qeeg_files', {
  id: text('id').primaryKey(), clientId: text('client_id').notNull().references(()=>clients.id), therapistId: text('therapist_id').notNull().references(()=>therapists.id),
  objectKey: text('object_key').notNull(), filename: text('filename').notNull(), bytes: integer('bytes').notNull(), createdAt: text('created_at').notNull(),
});
export const pinAttempts = sqliteTable('pin_attempts', { key: text('key').primaryKey(), failures: integer('failures').notNull().default(0), lockedUntil: integer('locked_until').notNull().default(0) });
