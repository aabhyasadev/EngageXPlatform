import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  decimal,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User roles enum
export const userRoleEnum = pgEnum('user_role', ['admin', 'campaign_manager', 'analyst', 'editor']);

// Subscription plan enum
export const subscriptionPlanEnum = pgEnum('subscription_plan', ['free_trial', 'monthly', 'yearly']);

// Campaign status enum
export const campaignStatusEnum = pgEnum('campaign_status', ['draft', 'scheduled', 'sending', 'sent', 'paused', 'failed']);

// Domain verification status enum
export const domainStatusEnum = pgEnum('domain_status', ['pending', 'verified', 'failed']);

// Organizations table
export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  subscriptionPlan: subscriptionPlanEnum("subscription_plan").default('free_trial').notNull(),
  trialEndsAt: timestamp("trial_ends_at"),
  contactsLimit: integer("contacts_limit").default(1000).notNull(),
  campaignsLimit: integer("campaigns_limit").default(10).notNull(),
  industry: varchar("industry", { length: 100 }),
  employeesRange: varchar("employees_range", { length: 50 }),
  contactsRange: varchar("contacts_range", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  organizationId: varchar("organization_id").references(() => organizations.id),
  role: userRoleEnum("role").default('campaign_manager').notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  mfaEnabled: boolean("mfa_enabled").default(false).notNull(),
  ssoEnabled: boolean("sso_enabled").default(false).notNull(),
  loginAttempts: integer("login_attempts").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Domains table
export const domains = pgTable("domains", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  domain: varchar("domain", { length: 255 }).notNull(),
  status: domainStatusEnum("status").default('pending').notNull(),
  dkimRecord: text("dkim_record"),
  cnameRecord: text("cname_record"),
  dmarcRecord: text("dmarc_record"),
  txtRecord: text("txt_record"),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contact groups table
export const contactGroups = pgTable("contact_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contacts table
export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  phone: varchar("phone", { length: 20 }),
  language: varchar("language", { length: 10 }).default('en'),
  isSubscribed: boolean("is_subscribed").default(true).notNull(),
  unsubscribedAt: timestamp("unsubscribed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contact group memberships table
export const contactGroupMemberships = pgTable("contact_group_memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").references(() => contacts.id).notNull(),
  groupId: varchar("group_id").references(() => contactGroups.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Email templates table
export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 255 }),
  htmlContent: text("html_content"),
  textContent: text("text_content"),
  isDefault: boolean("is_default").default(false),
  category: varchar("category", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Campaigns table
export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  fromEmail: varchar("from_email", { length: 255 }).notNull(),
  fromName: varchar("from_name", { length: 255 }),
  replyToEmail: varchar("reply_to_email", { length: 255 }),
  // New required fields for campaign creation
  templateId: varchar("template_id").references(() => emailTemplates.id),
  domainId: varchar("domain_id").references(() => domains.id),
  contactGroupId: varchar("contact_group_id").references(() => contactGroups.id),
  htmlContent: text("html_content"),
  textContent: text("text_content"),
  status: campaignStatusEnum("status").default('draft').notNull(),
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  totalRecipients: integer("total_recipients").default(0),
  totalSent: integer("total_sent").default(0),
  totalDelivered: integer("total_delivered").default(0),
  totalOpened: integer("total_opened").default(0),
  totalClicked: integer("total_clicked").default(0),
  totalBounced: integer("total_bounced").default(0),
  totalUnsubscribed: integer("total_unsubscribed").default(0),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Campaign recipients table
export const campaignRecipients = pgTable("campaign_recipients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").references(() => campaigns.id).notNull(),
  contactId: varchar("contact_id").references(() => contacts.id).notNull(),
  status: varchar("status", { length: 50 }).default('pending').notNull(), // pending, sent, delivered, opened, clicked, bounced, unsubscribed
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  bouncedAt: timestamp("bounced_at"),
  unsubscribedAt: timestamp("unsubscribed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Analytics events table
export const analyticsEvents = pgTable("analytics_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  campaignId: varchar("campaign_id").references(() => campaigns.id),
  contactId: varchar("contact_id").references(() => contacts.id),
  eventType: varchar("event_type", { length: 50 }).notNull(), // open, click, bounce, unsubscribe, spam_report
  userAgent: text("user_agent"),
  ipAddress: varchar("ip_address", { length: 45 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  domains: many(domains),
  contacts: many(contacts),
  contactGroups: many(contactGroups),
  emailTemplates: many(emailTemplates),
  campaigns: many(campaigns),
  analyticsEvents: many(analyticsEvents),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  createdCampaigns: many(campaigns),
}));

export const domainsRelations = relations(domains, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [domains.organizationId],
    references: [organizations.id],
  }),
  campaigns: many(campaigns),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [contacts.organizationId],
    references: [organizations.id],
  }),
  groupMemberships: many(contactGroupMemberships),
  campaignRecipients: many(campaignRecipients),
  analyticsEvents: many(analyticsEvents),
}));

export const contactGroupsRelations = relations(contactGroups, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [contactGroups.organizationId],
    references: [organizations.id],
  }),
  memberships: many(contactGroupMemberships),
  campaigns: many(campaigns),
}));

export const contactGroupMembershipsRelations = relations(contactGroupMemberships, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactGroupMemberships.contactId],
    references: [contacts.id],
  }),
  group: one(contactGroups, {
    fields: [contactGroupMemberships.groupId],
    references: [contactGroups.id],
  }),
}));

export const emailTemplatesRelations = relations(emailTemplates, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [emailTemplates.organizationId],
    references: [organizations.id],
  }),
  campaigns: many(campaigns),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [campaigns.organizationId],
    references: [organizations.id],
  }),
  createdBy: one(users, {
    fields: [campaigns.createdBy],
    references: [users.id],
  }),
  template: one(emailTemplates, {
    fields: [campaigns.templateId],
    references: [emailTemplates.id],
  }),
  domain: one(domains, {
    fields: [campaigns.domainId],
    references: [domains.id],
  }),
  contactGroup: one(contactGroups, {
    fields: [campaigns.contactGroupId],
    references: [contactGroups.id],
  }),
  recipients: many(campaignRecipients),
  analyticsEvents: many(analyticsEvents),
}));

export const campaignRecipientsRelations = relations(campaignRecipients, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignRecipients.campaignId],
    references: [campaigns.id],
  }),
  contact: one(contacts, {
    fields: [campaignRecipients.contactId],
    references: [contacts.id],
  }),
}));

export const analyticsEventsRelations = relations(analyticsEvents, ({ one }) => ({
  organization: one(organizations, {
    fields: [analyticsEvents.organizationId],
    references: [organizations.id],
  }),
  campaign: one(campaigns, {
    fields: [analyticsEvents.campaignId],
    references: [campaigns.id],
  }),
  contact: one(contacts, {
    fields: [analyticsEvents.contactId],
    references: [contacts.id],
  }),
}));

// Insert schemas
export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const upsertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertDomainSchema = createInsertSchema(domains).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContactGroupSchema = createInsertSchema(contactGroups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = z.infer<typeof insertUserSchema> & { id?: string };
export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Domain = typeof domains.$inferSelect;
export type InsertDomain = z.infer<typeof insertDomainSchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type ContactGroup = typeof contactGroups.$inferSelect;
export type InsertContactGroup = z.infer<typeof insertContactGroupSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type CampaignRecipient = typeof campaignRecipients.$inferSelect;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;

// API Response Types
export interface DashboardStats {
  totalContacts: number;
  activeCampaigns: number;
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  openRate: number;
  clickRate: number;
}

export interface UserWithOrganization extends User {
  organization?: Organization | null;
}
