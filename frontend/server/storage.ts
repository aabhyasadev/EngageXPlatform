import {
  users,
  organizations,
  domains,
  contacts,
  contactGroups,
  contactGroupMemberships,
  emailTemplates,
  campaigns,
  campaignRecipients,
  analyticsEvents,
  type User,
  type UpsertUser,
  type Organization,
  type InsertOrganization,
  type Domain,
  type InsertDomain,
  type Contact,
  type InsertContact,
  type ContactGroup,
  type InsertContactGroup,
  type EmailTemplate,
  type InsertEmailTemplate,
  type Campaign,
  type InsertCampaign,
  type CampaignRecipient,
  type AnalyticsEvent,
  type InsertAnalyticsEvent,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, count, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getUsersByOrganization(organizationId: string): Promise<User[]>;
  
  // Organization operations
  getOrganization(id: string): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganization(id: string, updates: Partial<InsertOrganization>): Promise<Organization>;
  
  // Domain operations
  getDomainsByOrganization(organizationId: string): Promise<Domain[]>;
  createDomain(domain: InsertDomain): Promise<Domain>;
  updateDomain(id: string, updates: Partial<InsertDomain>): Promise<Domain>;
  getDomain(id: string): Promise<Domain | undefined>;
  
  // Contact operations
  getContactsByOrganization(organizationId: string): Promise<Contact[]>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, updates: Partial<InsertContact>): Promise<Contact>;
  deleteContact(id: string): Promise<void>;
  getContact(id: string): Promise<Contact | undefined>;
  
  // Contact group operations
  getContactGroupsByOrganization(organizationId: string): Promise<ContactGroup[]>;
  createContactGroup(group: InsertContactGroup): Promise<ContactGroup>;
  updateContactGroup(id: string, updates: Partial<InsertContactGroup>): Promise<ContactGroup>;
  deleteContactGroup(id: string): Promise<void>;
  addContactToGroup(contactId: string, groupId: string): Promise<void>;
  removeContactFromGroup(contactId: string, groupId: string): Promise<void>;
  getContactsInGroup(groupId: string): Promise<Contact[]>;
  
  // Email template operations
  getEmailTemplatesByOrganization(organizationId: string): Promise<EmailTemplate[]>;
  createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate>;
  updateEmailTemplate(id: string, updates: Partial<InsertEmailTemplate>): Promise<EmailTemplate>;
  deleteEmailTemplate(id: string): Promise<void>;
  getEmailTemplate(id: string): Promise<EmailTemplate | undefined>;
  
  // Campaign operations
  getCampaignsByOrganization(organizationId: string): Promise<Campaign[]>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: string, updates: Partial<InsertCampaign>): Promise<Campaign>;
  deleteCampaign(id: string): Promise<void>;
  getCampaign(id: string): Promise<Campaign | undefined>;
  
  // Campaign recipients
  addCampaignRecipients(campaignId: string, contactIds: string[]): Promise<void>;
  getCampaignRecipients(campaignId: string): Promise<CampaignRecipient[]>;
  updateRecipientStatus(recipientId: string, status: string, timestamp?: Date): Promise<void>;
  
  // Analytics
  createAnalyticsEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent>;
  getAnalyticsEventsByOrganization(organizationId: string): Promise<AnalyticsEvent[]>;
  getOrganizationStats(organizationId: string): Promise<{
    totalContacts: number;
    activeCampaigns: number;
    totalSent: number;
    totalOpened: number;
    totalClicked: number;
    openRate: number;
    clickRate: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Handle both email and ID conflicts by using try-catch with multiple strategies
    try {
      // First try: insert new user (will fail if email OR ID already exists)
      const [user] = await db.insert(users).values(userData).returning();
      return user;
    } catch (error: any) {
      // If insertion fails due to conflict, handle it gracefully
      if (error.code === '23505') { // PostgreSQL unique constraint violation
        // Try to find existing user by email first, then by ID
        let existingUser: User | undefined;
        
        if (userData.email) {
          [existingUser] = await db.select().from(users).where(eq(users.email, userData.email));
        }
        
        if (!existingUser && userData.id) {
          existingUser = await this.getUser(userData.id);
        }
        
        if (existingUser) {
          // Update existing user with provided fields only (prevent accidental nulling)
          const [user] = await db
            .update(users)
            .set({
              firstName: userData.firstName,
              lastName: userData.lastName,
              profileImageUrl: userData.profileImageUrl,
              ...(userData.organizationId !== undefined && { organizationId: userData.organizationId }),
              ...(userData.role !== undefined && { role: userData.role }),
              updatedAt: new Date(),
            })
            .where(eq(users.id, existingUser.id))
            .returning();
          return user;
        }
      }
      
      // If we can't handle the error gracefully, re-throw it
      throw error;
    }
  }

  async getUsersByOrganization(organizationId: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.organizationId, organizationId));
  }

  // Organization operations
  async getOrganization(id: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  }

  async createOrganization(orgData: InsertOrganization): Promise<Organization> {
    const [org] = await db.insert(organizations).values(orgData).returning();
    return org;
  }

  async updateOrganization(id: string, updates: Partial<InsertOrganization>): Promise<Organization> {
    const [org] = await db
      .update(organizations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();
    return org;
  }

  // Domain operations
  async getDomainsByOrganization(organizationId: string): Promise<Domain[]> {
    return await db.select().from(domains).where(eq(domains.organizationId, organizationId));
  }

  async createDomain(domainData: InsertDomain): Promise<Domain> {
    const [domain] = await db.insert(domains).values(domainData).returning();
    return domain;
  }

  async updateDomain(id: string, updates: Partial<InsertDomain>): Promise<Domain> {
    const [domain] = await db
      .update(domains)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(domains.id, id))
      .returning();
    return domain;
  }

  async getDomain(id: string): Promise<Domain | undefined> {
    const [domain] = await db.select().from(domains).where(eq(domains.id, id));
    return domain;
  }

  // Contact operations
  async getContactsByOrganization(organizationId: string): Promise<Contact[]> {
    return await db.select().from(contacts).where(eq(contacts.organizationId, organizationId));
  }

  async createContact(contactData: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values(contactData).returning();
    return contact;
  }

  async updateContact(id: string, updates: Partial<InsertContact>): Promise<Contact> {
    const [contact] = await db
      .update(contacts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(contacts.id, id))
      .returning();
    return contact;
  }

  async deleteContact(id: string): Promise<void> {
    await db.delete(contacts).where(eq(contacts.id, id));
  }

  async getContact(id: string): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    return contact;
  }

  // Contact group operations
  async getContactGroupsByOrganization(organizationId: string): Promise<ContactGroup[]> {
    return await db.select().from(contactGroups).where(eq(contactGroups.organizationId, organizationId));
  }

  async createContactGroup(groupData: InsertContactGroup): Promise<ContactGroup> {
    const [group] = await db.insert(contactGroups).values(groupData).returning();
    return group;
  }

  async updateContactGroup(id: string, updates: Partial<InsertContactGroup>): Promise<ContactGroup> {
    const [group] = await db
      .update(contactGroups)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(contactGroups.id, id))
      .returning();
    return group;
  }

  async deleteContactGroup(id: string): Promise<void> {
    await db.delete(contactGroups).where(eq(contactGroups.id, id));
  }

  async addContactToGroup(contactId: string, groupId: string): Promise<void> {
    await db.insert(contactGroupMemberships).values({
      contactId,
      groupId,
    });
  }

  async removeContactFromGroup(contactId: string, groupId: string): Promise<void> {
    await db.delete(contactGroupMemberships)
      .where(and(
        eq(contactGroupMemberships.contactId, contactId),
        eq(contactGroupMemberships.groupId, groupId)
      ));
  }

  async getContactsInGroup(groupId: string): Promise<Contact[]> {
    const result = await db
      .select({
        id: contacts.id,
        organizationId: contacts.organizationId,
        email: contacts.email,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        phone: contacts.phone,
        language: contacts.language,
        isSubscribed: contacts.isSubscribed,
        unsubscribedAt: contacts.unsubscribedAt,
        createdAt: contacts.createdAt,
        updatedAt: contacts.updatedAt,
      })
      .from(contacts)
      .innerJoin(contactGroupMemberships, eq(contacts.id, contactGroupMemberships.contactId))
      .where(eq(contactGroupMemberships.groupId, groupId));
    
    return result;
  }

  // Email template operations
  async getEmailTemplatesByOrganization(organizationId: string): Promise<EmailTemplate[]> {
    return await db.select().from(emailTemplates).where(eq(emailTemplates.organizationId, organizationId));
  }

  async createEmailTemplate(templateData: InsertEmailTemplate): Promise<EmailTemplate> {
    const [template] = await db.insert(emailTemplates).values(templateData).returning();
    return template;
  }

  async updateEmailTemplate(id: string, updates: Partial<InsertEmailTemplate>): Promise<EmailTemplate> {
    const [template] = await db
      .update(emailTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(emailTemplates.id, id))
      .returning();
    return template;
  }

  async deleteEmailTemplate(id: string): Promise<void> {
    await db.delete(emailTemplates).where(eq(emailTemplates.id, id));
  }

  async getEmailTemplate(id: string): Promise<EmailTemplate | undefined> {
    const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id));
    return template;
  }

  // Campaign operations
  async getCampaignsByOrganization(organizationId: string): Promise<Campaign[]> {
    return await db.select().from(campaigns)
      .where(eq(campaigns.organizationId, organizationId))
      .orderBy(desc(campaigns.createdAt));
  }

  async createCampaign(campaignData: InsertCampaign): Promise<Campaign> {
    const [campaign] = await db.insert(campaigns).values(campaignData).returning();
    return campaign;
  }

  async updateCampaign(id: string, updates: Partial<InsertCampaign>): Promise<Campaign> {
    const [campaign] = await db
      .update(campaigns)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(campaigns.id, id))
      .returning();
    return campaign;
  }

  async deleteCampaign(id: string): Promise<void> {
    await db.delete(campaigns).where(eq(campaigns.id, id));
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return campaign;
  }

  // Campaign recipients
  async addCampaignRecipients(campaignId: string, contactIds: string[]): Promise<void> {
    const recipients = contactIds.map(contactId => ({
      campaignId,
      contactId,
    }));
    await db.insert(campaignRecipients).values(recipients);
  }

  async getCampaignRecipients(campaignId: string): Promise<CampaignRecipient[]> {
    return await db.select().from(campaignRecipients).where(eq(campaignRecipients.campaignId, campaignId));
  }

  async updateRecipientStatus(recipientId: string, status: string, timestamp?: Date): Promise<void> {
    const updates: any = { status };
    
    switch (status) {
      case 'sent':
        updates.sentAt = timestamp || new Date();
        break;
      case 'delivered':
        updates.deliveredAt = timestamp || new Date();
        break;
      case 'opened':
        updates.openedAt = timestamp || new Date();
        break;
      case 'clicked':
        updates.clickedAt = timestamp || new Date();
        break;
      case 'bounced':
        updates.bouncedAt = timestamp || new Date();
        break;
      case 'unsubscribed':
        updates.unsubscribedAt = timestamp || new Date();
        break;
    }

    await db.update(campaignRecipients)
      .set(updates)
      .where(eq(campaignRecipients.id, recipientId));
  }

  // Analytics
  async createAnalyticsEvent(eventData: InsertAnalyticsEvent): Promise<AnalyticsEvent> {
    const [event] = await db.insert(analyticsEvents).values(eventData).returning();
    return event;
  }

  async getAnalyticsEventsByOrganization(organizationId: string): Promise<AnalyticsEvent[]> {
    return await db.select().from(analyticsEvents)
      .where(eq(analyticsEvents.organizationId, organizationId))
      .orderBy(desc(analyticsEvents.createdAt));
  }

  async getOrganizationStats(organizationId: string): Promise<{
    totalContacts: number;
    activeCampaigns: number;
    totalSent: number;
    totalOpened: number;
    totalClicked: number;
    openRate: number;
    clickRate: number;
  }> {
    // Get total contacts
    const [contactsCount] = await db
      .select({ count: count() })
      .from(contacts)
      .where(and(
        eq(contacts.organizationId, organizationId),
        eq(contacts.isSubscribed, true)
      ));

    // Get active campaigns
    const [activeCampaignsCount] = await db
      .select({ count: count() })
      .from(campaigns)
      .where(and(
        eq(campaigns.organizationId, organizationId),
        sql`${campaigns.status} IN ('sending', 'scheduled')`
      ));

    // Get campaign stats
    const [campaignStats] = await db
      .select({
        totalSent: sql<number>`sum(${campaigns.totalSent})`,
        totalOpened: sql<number>`sum(${campaigns.totalOpened})`,
        totalClicked: sql<number>`sum(${campaigns.totalClicked})`,
      })
      .from(campaigns)
      .where(eq(campaigns.organizationId, organizationId));

    const totalSent = campaignStats?.totalSent || 0;
    const totalOpened = campaignStats?.totalOpened || 0;
    const totalClicked = campaignStats?.totalClicked || 0;

    return {
      totalContacts: contactsCount.count,
      activeCampaigns: activeCampaignsCount.count,
      totalSent,
      totalOpened,
      totalClicked,
      openRate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
      clickRate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0,
    };
  }
}

export const storage = new DatabaseStorage();
