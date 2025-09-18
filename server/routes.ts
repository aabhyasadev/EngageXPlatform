import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { sendEmail } from "./sendgrid.js";
import multer from "multer";
import * as XLSX from "xlsx";
import { insertContactSchema, insertCampaignSchema, insertDomainSchema, insertContactGroupSchema, insertEmailTemplateSchema } from "@shared/schema";
import { z } from "zod";

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Default templates seeding function with idempotency
async function seedDefaultTemplates(organizationId: string) {
  // Double-check to prevent race conditions
  const existingTemplates = await storage.getEmailTemplatesByOrganization(organizationId);
  if (existingTemplates.length > 0) {
    return existingTemplates;
  }
  const defaultTemplates = [
    {
      name: "Welcome Email",
      subject: "Welcome to {{organizationName}}! 🎉",
      category: "marketing",
      isDefault: true,
      organizationId,
      htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333; text-align: center;">Welcome to Our Community!</h1>
        <p>Hi {{firstName}},</p>
        <p>We're thrilled to have you join us! Your account has been successfully created and you're now part of our growing community.</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #495057; margin-top: 0;">What's Next?</h3>
          <ul style="color: #6c757d;">
            <li>Complete your profile setup</li>
            <li>Explore our features and services</li>
            <li>Connect with other members</li>
          </ul>
        </div>
        <p>If you have any questions, feel free to reach out to our support team.</p>
        <p>Best regards,<br>The {{organizationName}} Team</p>
      </div>`,
      textContent: `Hi {{firstName}},

Welcome to our community! We're thrilled to have you join us.

Your account has been successfully created and you're now part of our growing community.

What's Next?
- Complete your profile setup
- Explore our features and services  
- Connect with other members

If you have any questions, feel free to reach out to our support team.

Best regards,
The {{organizationName}} Team`
    },
    {
      name: "Order Confirmation", 
      subject: "Order Confirmation #{{orderNumber}}",
      category: "transactional",
      isDefault: true,
      organizationId,
      htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #28a745; text-align: center;">Order Confirmed! ✅</h1>
        <p>Hi {{firstName}},</p>
        <p>Thank you for your order! We've received your payment and your order is being processed.</p>
        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #155724; margin-top: 0;">Order Details</h3>
          <p><strong>Order Number:</strong> #{{orderNumber}}</p>
          <p><strong>Order Date:</strong> {{orderDate}}</p>
          <p><strong>Total Amount:</strong> $${'{{orderTotal}}'}</p>
        </div>
        <p>We'll send you a shipping confirmation email with tracking information once your order ships.</p>
        <p>Thank you for choosing {{organizationName}}!</p>
        <p>Best regards,<br>Customer Service Team</p>
      </div>`,
      textContent: `Hi {{firstName}},

Thank you for your order! We've received your payment and your order is being processed.

Order Details:
- Order Number: #{{orderNumber}}
- Order Date: {{orderDate}}
- Total Amount: $${'{{orderTotal}}'}

We'll send you a shipping confirmation email with tracking information once your order ships.

Thank you for choosing {{organizationName}}!

Best regards,
Customer Service Team`
    },
    {
      name: "Monthly Newsletter",
      subject: "{{organizationName}} Monthly Update - {{monthYear}}",
      category: "newsletter", 
      isDefault: true,
      organizationId,
      htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #007bff; text-align: center;">Monthly Newsletter</h1>
        <h2 style="color: #495057;">Hi {{firstName}}!</h2>
        <p>Here's what's been happening at {{organizationName}} this month:</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #495057; margin-top: 0;">📈 This Month's Highlights</h3>
          <ul style="color: #6c757d;">
            <li>New product launches and updates</li>
            <li>Customer success stories</li>
            <li>Upcoming events and webinars</li>
          </ul>
        </div>
        
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #856404; margin-top: 0;">🚀 Coming Next Month</h3>
          <p style="color: #856404;">Stay tuned for exciting new features and improvements!</p>
        </div>
        
        <p>Thank you for being part of our community!</p>
        <p>Best regards,<br>The {{organizationName}} Team</p>
      </div>`,
      textContent: `Hi {{firstName}}!

Here's what's been happening at {{organizationName}} this month:

This Month's Highlights:
- New product launches and updates
- Customer success stories  
- Upcoming events and webinars

Coming Next Month:
Stay tuned for exciting new features and improvements!

Thank you for being part of our community!

Best regards,
The {{organizationName}} Team`
    },
    {
      name: "Password Reset",
      subject: "Reset Your Password - {{organizationName}}",
      category: "transactional",
      isDefault: true,
      organizationId,
      htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #dc3545; text-align: center;">Password Reset Request 🔒</h1>
        <p>Hi {{firstName}},</p>
        <p>We received a request to reset the password for your account associated with {{email}}.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="{{resetLink}}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #6c757d; font-size: 14px;">This link will expire in 24 hours for security reasons.</p>
        <p>If you didn't request a password reset, please ignore this email or contact our support team if you have concerns.</p>
        <p>Best regards,<br>Security Team</p>
      </div>`,
      textContent: `Hi {{firstName}},

We received a request to reset the password for your account associated with {{email}}.

Please click the following link to reset your password:
{{resetLink}}

This link will expire in 24 hours for security reasons.

If you didn't request a password reset, please ignore this email or contact our support team if you have concerns.

Best regards,
Security Team`
    },
    {
      name: "Product Launch Announcement",
      subject: "🚀 Introducing Our Latest Product!",
      category: "marketing",
      isDefault: true,
      organizationId,
      htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #28a745; text-align: center;">🚀 New Product Launch!</h1>
        <p>Hi {{firstName}},</p>
        <p>We're excited to announce the launch of our newest product that will revolutionize the way you work!</p>
        
        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <h3 style="color: #155724; margin-top: 0;">{{productName}}</h3>
          <p style="color: #155724; font-size: 18px;">{{productDescription}}</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #495057; margin-top: 0;">✨ Key Features</h3>
          <ul style="color: #6c757d;">
            <li>Feature 1: Enhanced productivity</li>
            <li>Feature 2: Seamless integration</li>
            <li>Feature 3: Advanced security</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="{{productLink}}" style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-size: 16px;">Learn More</a>
        </div>
        
        <p>Best regards,<br>The {{organizationName}} Team</p>
      </div>`,
      textContent: `Hi {{firstName}},

We're excited to announce the launch of our newest product that will revolutionize the way you work!

{{productName}}
{{productDescription}}

Key Features:
- Feature 1: Enhanced productivity
- Feature 2: Seamless integration  
- Feature 3: Advanced security

Learn more: {{productLink}}

Best regards,
The {{organizationName}} Team`
    }
  ];

  // Create all default templates with better error handling
  const createdTemplates = [];
  for (const template of defaultTemplates) {
    try {
      const validatedData = insertEmailTemplateSchema.parse(template);
      const createdTemplate = await storage.createEmailTemplate(validatedData);
      createdTemplates.push(createdTemplate);
    } catch (error) {
      console.error('Error creating default template:', template.name, error);
    }
  }

  // Re-query to get the authoritative list after seeding
  return await storage.getEmailTemplatesByOrganization(organizationId);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Get organization info
      const organization = await storage.getOrganization(user.organizationId!);
      
      res.json({ ...user, organization });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Organization routes
  app.post('/api/organizations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, industry, employeesRange, contactsRange } = req.body;
      
      // Create organization
      const organization = await storage.createOrganization({
        name,
        industry,
        employeesRange,
        contactsRange,
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
      });
      
      // Update user with organization and admin role
      await storage.upsertUser({
        id: userId,
        email: req.user.claims.email,
        firstName: req.user.claims.first_name,
        lastName: req.user.claims.last_name,
        profileImageUrl: req.user.claims.profile_image_url,
        organizationId: organization.id,
        role: 'admin',
      });
      
      res.json(organization);
    } catch (error) {
      console.error("Error creating organization:", error);
      res.status(500).json({ message: "Failed to create organization" });
    }
  });

  app.get('/api/organizations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const orgId = req.params.id;
      
      // Verify user has access to this organization
      if (user?.organizationId !== orgId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const organization = await storage.getOrganization(orgId);
      if (!organization) {
        return res.status(404).json({ message: "Organization not found" });
      }
      
      res.json(organization);
    } catch (error) {
      console.error("Error fetching organization:", error);
      res.status(500).json({ message: "Failed to fetch organization" });
    }
  });

  app.put('/api/organizations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const orgId = req.params.id;
      
      // Verify user has access to this organization and is admin
      if (user?.organizationId !== orgId) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const { name, industry, employeesRange } = req.body;
      
      const updatedOrganization = await storage.updateOrganization(orgId, {
        name,
        industry,
        employeesRange,
      });
      
      res.json(updatedOrganization);
    } catch (error) {
      console.error("Error updating organization:", error);
      res.status(500).json({ message: "Failed to update organization" });
    }
  });

  // Dashboard stats
  app.get('/api/dashboard/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.organizationId) {
        return res.status(400).json({ message: "User not associated with organization" });
      }
      
      const stats = await storage.getOrganizationStats(user.organizationId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Contacts routes
  app.get('/api/contacts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.organizationId) {
        return res.status(400).json({ message: "User not associated with organization" });
      }
      
      const contacts = await storage.getContactsByOrganization(user.organizationId);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.post('/api/contacts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.organizationId) {
        return res.status(400).json({ message: "User not associated with organization" });
      }
      
      const contactData = insertContactSchema.parse({
        ...req.body,
        organizationId: user.organizationId,
      });
      
      const contact = await storage.createContact(contactData);
      res.json(contact);
    } catch (error) {
      console.error("Error creating contact:", error);
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  app.put('/api/contacts/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.organizationId) {
        return res.status(400).json({ message: "User not associated with organization" });
      }
      
      // Verify contact belongs to user's organization
      const existingContact = await storage.getContact(req.params.id);
      if (!existingContact || existingContact.organizationId !== user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Validate and sanitize update data - never allow organizationId changes
      const updateData = {
        firstName: req.body.firstName,
        lastName: req.body.lastName, 
        email: req.body.email,
        phone: req.body.phone,
        language: req.body.language,
        isSubscribed: req.body.isSubscribed,
      };
      
      const contact = await storage.updateContact(req.params.id, updateData);
      res.json(contact);
    } catch (error) {
      console.error("Error updating contact:", error);
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  app.delete('/api/contacts/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.organizationId) {
        return res.status(400).json({ message: "User not associated with organization" });
      }
      
      // Verify contact belongs to user's organization
      const existingContact = await storage.getContact(req.params.id);
      if (!existingContact || existingContact.organizationId !== user.organizationId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteContact(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting contact:", error);
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  // Bulk contact import
  app.post('/api/contacts/import', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.organizationId) {
        return res.status(400).json({ message: "User not associated with organization" });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Parse Excel file
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      
      const contacts = [];
      const errors = [];
      
      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any;
        try {
          const contactData = insertContactSchema.parse({
            organizationId: user.organizationId,
            email: row.email || row.Email,
            firstName: row.firstName || row['First Name'] || row.first_name,
            lastName: row.lastName || row['Last Name'] || row.last_name,
            phone: row.phone || row.Phone,
            language: row.language || row.Language || 'en',
          });
          
          const contact = await storage.createContact(contactData);
          contacts.push(contact);
        } catch (error) {
          errors.push({ row: i + 1, error: error instanceof Error ? error.message : 'Invalid data' });
        }
      }
      
      res.json({ contacts, errors, imported: contacts.length });
    } catch (error) {
      console.error("Error importing contacts:", error);
      res.status(500).json({ message: "Failed to import contacts" });
    }
  });

  // Contact groups routes
  app.get('/api/contact-groups', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.organizationId) {
        return res.status(400).json({ message: "User not associated with organization" });
      }
      
      const groups = await storage.getContactGroupsByOrganization(user.organizationId);
      res.json(groups);
    } catch (error) {
      console.error("Error fetching contact groups:", error);
      res.status(500).json({ message: "Failed to fetch contact groups" });
    }
  });

  app.post('/api/contact-groups', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.organizationId) {
        return res.status(400).json({ message: "User not associated with organization" });
      }
      
      const groupData = insertContactGroupSchema.parse({
        ...req.body,
        organizationId: user.organizationId,
      });
      
      const group = await storage.createContactGroup(groupData);
      res.json(group);
    } catch (error) {
      console.error("Error creating contact group:", error);
      res.status(500).json({ message: "Failed to create contact group" });
    }
  });

  app.post('/api/contact-groups/:groupId/contacts/:contactId', isAuthenticated, async (req: any, res) => {
    try {
      await storage.addContactToGroup(req.params.contactId, req.params.groupId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error adding contact to group:", error);
      res.status(500).json({ message: "Failed to add contact to group" });
    }
  });

  // Campaigns routes
  app.get('/api/campaigns', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.organizationId) {
        return res.status(400).json({ message: "User not associated with organization" });
      }
      
      const campaigns = await storage.getCampaignsByOrganization(user.organizationId);
      res.json(campaigns);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  app.post('/api/campaigns', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.organizationId) {
        return res.status(400).json({ message: "User not associated with organization" });
      }
      
      const campaignData = insertCampaignSchema.parse({
        ...req.body,
        organizationId: user.organizationId,
        createdBy: userId,
      });
      
      const campaign = await storage.createCampaign(campaignData);
      res.json(campaign);
    } catch (error) {
      console.error("Error creating campaign:", error);
      res.status(500).json({ message: "Failed to create campaign" });
    }
  });

  app.post('/api/campaigns/:id/send', isAuthenticated, async (req: any, res) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Get recipients (contacts in specified groups or all contacts)
      const { contactGroupIds } = req.body;
      let contacts = [];
      
      if (contactGroupIds && contactGroupIds.length > 0) {
        for (const groupId of contactGroupIds) {
          const groupContacts = await storage.getContactsInGroup(groupId);
          contacts.push(...groupContacts);
        }
      } else {
        contacts = await storage.getContactsByOrganization(campaign.organizationId);
      }
      
      // Filter subscribed contacts
      const subscribedContacts = contacts.filter(contact => contact.isSubscribed);
      
      // Add campaign recipients
      await storage.addCampaignRecipients(
        campaign.id,
        subscribedContacts.map(c => c.id)
      );
      
      // Update campaign status and stats
      await storage.updateCampaign(campaign.id, {
        status: 'sending',
        totalRecipients: subscribedContacts.length,
        sentAt: new Date(),
      });
      
      // Send emails asynchronously
      let sentCount = 0;
      for (const contact of subscribedContacts) {
        try {
          const success = await sendEmail(process.env.SENDGRID_API_KEY!, {
            to: contact.email,
            from: campaign.fromEmail,
            subject: campaign.subject,
            html: campaign.htmlContent || undefined,
            text: campaign.textContent || undefined,
          });
          
          if (success) {
            sentCount++;
          }
        } catch (error) {
          console.error(`Failed to send email to ${contact.email}:`, error);
        }
      }
      
      // Update campaign with final stats
      await storage.updateCampaign(campaign.id, {
        status: 'sent',
        totalSent: sentCount,
      });
      
      res.json({ sent: sentCount, total: subscribedContacts.length });
    } catch (error) {
      console.error("Error sending campaign:", error);
      res.status(500).json({ message: "Failed to send campaign" });
    }
  });

  // Domains routes
  app.get('/api/domains', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.organizationId) {
        return res.status(400).json({ message: "User not associated with organization" });
      }
      
      const domains = await storage.getDomainsByOrganization(user.organizationId);
      res.json(domains);
    } catch (error) {
      console.error("Error fetching domains:", error);
      res.status(500).json({ message: "Failed to fetch domains" });
    }
  });

  app.post('/api/domains', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.organizationId) {
        return res.status(400).json({ message: "User not associated with organization" });
      }
      
      const domainData = insertDomainSchema.parse({
        ...req.body,
        organizationId: user.organizationId,
      });
      
      // Generate DNS records for verification
      const dkimRecord = `v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...`; // Placeholder
      const cnameRecord = `mail.${domainData.domain}`;
      const dmarcRecord = `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domainData.domain}`;
      const txtRecord = `v=spf1 include:sendgrid.net ~all`;
      
      const domain = await storage.createDomain({
        ...domainData,
        dkimRecord,
        cnameRecord,
        dmarcRecord,
        txtRecord,
      });
      
      res.json(domain);
    } catch (error) {
      console.error("Error creating domain:", error);
      res.status(500).json({ message: "Failed to create domain" });
    }
  });

  app.post('/api/domains/:id/verify', isAuthenticated, async (req: any, res) => {
    try {
      // Get the domain first
      const domain = await storage.getDomain(req.params.id);
      if (!domain) {
        return res.status(404).json({ message: "Domain not found" });
      }
      
      // Import DNS verification service
      const { DnsVerificationService } = await import('./dns-verification.js');
      const dnsService = new DnsVerificationService();
      
      // Perform real DNS verification
      const verificationResult = await dnsService.verifyDomain(domain.domain, {
        txtRecord: domain.txtRecord!,
        cnameRecord: domain.cnameRecord!,
        dkimRecord: domain.dkimRecord!,
        dmarcRecord: domain.dmarcRecord!,
      });
      
      // Update domain based on verification result
      const updatedDomain = await storage.updateDomain(req.params.id, {
        status: verificationResult.verified ? 'verified' : 'failed',
        verifiedAt: verificationResult.verified ? new Date() : undefined,
      });
      
      res.json({
        ...updatedDomain,
        verificationResult
      });
    } catch (error) {
      console.error("Error verifying domain:", error);
      
      // Update domain status to failed on error
      try {
        await storage.updateDomain(req.params.id, {
          status: 'failed',
        });
      } catch (updateError) {
        console.error("Error updating domain status:", updateError);
      }
      
      res.status(500).json({ message: "DNS verification failed" });
    }
  });

  // Email templates routes
  app.get('/api/templates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.organizationId) {
        return res.status(400).json({ message: "User not associated with organization" });
      }
      
      let templates = await storage.getEmailTemplatesByOrganization(user.organizationId);
      
      // If no templates exist, seed with default templates
      if (templates.length === 0) {
        try {
          templates = await seedDefaultTemplates(user.organizationId);
        } catch (seedError) {
          console.error("Error seeding default templates:", seedError);
          // Continue with empty array if seeding fails
        }
      }
      
      res.json(templates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  app.post('/api/templates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.organizationId) {
        return res.status(400).json({ message: "User not associated with organization" });
      }
      
      // Validate and sanitize input using drizzle-zod schema
      const validatedData = insertEmailTemplateSchema.parse({
        name: req.body.name,
        subject: req.body.subject,
        htmlContent: req.body.htmlContent,
        textContent: req.body.textContent,
        category: req.body.category,
        isDefault: req.body.isDefault || false,
        organizationId: user.organizationId, // Force organizationId from authenticated user
      });
      
      const template = await storage.createEmailTemplate(validatedData);
      res.json(template);
    } catch (error) {
      console.error("Error creating template:", error);
      res.status(500).json({ message: "Failed to create template" });
    }
  });

  app.put('/api/templates/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.organizationId) {
        return res.status(400).json({ message: "User not associated with organization" });
      }
      
      // Verify template belongs to user's organization
      const existingTemplate = await storage.getEmailTemplate(req.params.id);
      if (!existingTemplate || existingTemplate.organizationId !== user.organizationId) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      // SECURITY: Validate and sanitize input - prevent organizationId/id/timestamps mutation
      const validatedData = insertEmailTemplateSchema.parse({
        name: req.body.name,
        subject: req.body.subject,
        htmlContent: req.body.htmlContent,
        textContent: req.body.textContent,
        category: req.body.category,
        isDefault: req.body.isDefault,
        organizationId: existingTemplate.organizationId, // Force existing organizationId (security)
      });
      
      const template = await storage.updateEmailTemplate(req.params.id, validatedData);
      res.json(template);
    } catch (error) {
      console.error("Error updating template:", error);
      res.status(500).json({ message: "Failed to update template" });
    }
  });

  app.delete('/api/templates/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.organizationId) {
        return res.status(400).json({ message: "User not associated with organization" });
      }
      
      // Verify template belongs to user's organization
      const existingTemplate = await storage.getEmailTemplate(req.params.id);
      if (!existingTemplate || existingTemplate.organizationId !== user.organizationId) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      await storage.deleteEmailTemplate(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting template:", error);
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  // Analytics routes
  app.get('/api/analytics/events', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.organizationId) {
        return res.status(400).json({ message: "User not associated with organization" });
      }
      
      const events = await storage.getAnalyticsEventsByOrganization(user.organizationId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching analytics events:", error);
      res.status(500).json({ message: "Failed to fetch analytics events" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
