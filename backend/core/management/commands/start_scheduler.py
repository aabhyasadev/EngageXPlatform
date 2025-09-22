"""
Management command to run scheduled tasks using Python's schedule library
"""
import schedule
import time
import threading
import logging
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime, timedelta
from django.db import connection, connections

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Start the lightweight scheduler for subscription reminders and notifications'
    
    def __init__(self):
        super().__init__()
        self.running = True
        self.scheduler_thread = None
        
    def handle(self, *args, **kwargs):
        """Main entry point for the command"""
        self.stdout.write(self.style.SUCCESS('Starting lightweight scheduler...'))
        
        # Schedule tasks
        self.setup_schedules()
        
        # Start scheduler in a separate thread
        self.scheduler_thread = threading.Thread(target=self.run_scheduler, daemon=True)
        self.scheduler_thread.start()
        
        try:
            # Keep the main thread alive
            while self.running:
                time.sleep(60)  # Check every minute
                self.stdout.write(f'Scheduler is running... Next job at: {self.get_next_run_time()}')
        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING('Scheduler stopped by user'))
            self.running = False
    
    def setup_schedules(self):
        """Configure scheduled tasks"""
        # Schedule trial expiration checks daily at 9:00 AM
        schedule.every().day.at("09:00").do(self.run_in_thread, self.check_trial_expirations)
        
        # Schedule subscription expiration checks daily at 9:00 AM
        schedule.every().day.at("09:00").do(self.run_in_thread, self.check_subscription_expirations)
        
        # Schedule usage limit checks every 6 hours
        schedule.every(6).hours.do(self.run_in_thread, self.check_usage_limits)
        
        # Also run usage checks at specific times for consistency
        for hour in ["00:00", "06:00", "12:00", "18:00"]:
            schedule.every().day.at(hour).do(self.run_in_thread, self.check_usage_limits)
        
        self.stdout.write(self.style.SUCCESS('Scheduled tasks configured:'))
        self.stdout.write('  - Trial expiration check: Daily at 9:00 AM')
        self.stdout.write('  - Subscription expiration check: Daily at 9:00 AM')
        self.stdout.write('  - Usage limit check: Every 6 hours (00:00, 06:00, 12:00, 18:00)')
    
    def run_scheduler(self):
        """Run the scheduler loop"""
        while self.running:
            try:
                schedule.run_pending()
                time.sleep(30)  # Check every 30 seconds
            except Exception as e:
                logger.error(f"Scheduler error: {str(e)}", exc_info=True)
                time.sleep(60)  # Wait a minute before retrying
    
    def run_in_thread(self, func):
        """Run a function in a separate thread to avoid blocking"""
        thread = threading.Thread(target=self.execute_task, args=(func,))
        thread.daemon = True
        thread.start()
    
    def execute_task(self, func):
        """Execute a task with proper error handling and database connection cleanup"""
        task_name = func.__name__
        start_time = timezone.now()
        
        try:
            logger.info(f"Starting scheduled task: {task_name}")
            self.stdout.write(f'[{start_time}] Running task: {task_name}')
            
            # Execute the task
            result = func()
            
            # Close database connections to avoid connection leaks
            connections.close_all()
            
            end_time = timezone.now()
            duration = (end_time - start_time).total_seconds()
            
            logger.info(f"Completed task {task_name} in {duration:.2f} seconds")
            self.stdout.write(self.style.SUCCESS(
                f'[{end_time}] Completed {task_name} in {duration:.2f}s'
            ))
            
            if result:
                self.stdout.write(f'  Result: {result}')
                
        except Exception as e:
            logger.error(f"Error in task {task_name}: {str(e)}", exc_info=True)
            self.stdout.write(self.style.ERROR(f'Error in {task_name}: {str(e)}'))
            
            # Ensure connections are closed even on error
            connections.close_all()
    
    def check_trial_expirations(self):
        """Check for expiring trials and send reminders"""
        from core.models import Organization, SubscriptionPlan
        from core.notifications import send_trial_expiry_reminder
        
        now = timezone.now()
        results = {'7_day': 0, '1_day': 0, 'errors': 0}
        
        # Check for trials expiring in 7 days
        seven_days_from_now = now + timedelta(days=7)
        orgs_7_days = Organization.objects.filter(
            subscription_plan=SubscriptionPlan.FREE_TRIAL,
            trial_ends_at__date=seven_days_from_now.date(),
            is_subscription_active=True
        )
        
        for org in orgs_7_days:
            try:
                if send_trial_expiry_reminder(org, 7):
                    results['7_day'] += 1
                    logger.info(f"Sent 7-day trial expiry reminder to org {org.id}")
            except Exception as e:
                results['errors'] += 1
                logger.error(f"Failed to send 7-day reminder to org {org.id}: {str(e)}")
        
        # Check for trials expiring tomorrow
        tomorrow = now + timedelta(days=1)
        orgs_1_day = Organization.objects.filter(
            subscription_plan=SubscriptionPlan.FREE_TRIAL,
            trial_ends_at__date=tomorrow.date(),
            is_subscription_active=True
        )
        
        for org in orgs_1_day:
            try:
                if send_trial_expiry_reminder(org, 1):
                    results['1_day'] += 1
                    logger.info(f"Sent 1-day trial expiry reminder to org {org.id}")
            except Exception as e:
                results['errors'] += 1
                logger.error(f"Failed to send 1-day reminder to org {org.id}: {str(e)}")
        
        return f"Sent {results['7_day']} 7-day reminders, {results['1_day']} 1-day reminders ({results['errors']} errors)"
    
    def check_subscription_expirations(self):
        """Check for expiring subscriptions and send notifications"""
        from core.models import Organization, SubscriptionStatus
        from core.notifications import send_subscription_expiry_reminder
        
        now = timezone.now()
        results = {'30_day': 0, '7_day': 0, '1_day': 0, 'errors': 0}
        
        # Check active subscriptions that are not free trials
        active_orgs = Organization.objects.filter(
            subscription_status=SubscriptionStatus.ACTIVE,
            is_subscription_active=True
        ).exclude(subscription_plan='free_trial')
        
        for org in active_orgs:
            if not org.subscription_ends_at:
                continue
                
            days_until_expiry = (org.subscription_ends_at - now).days
            
            try:
                # Send reminders at 30, 7, and 1 days before expiry
                if days_until_expiry == 30:
                    if send_subscription_expiry_reminder(org, 30):
                        results['30_day'] += 1
                        logger.info(f"Sent 30-day subscription expiry reminder to org {org.id}")
                elif days_until_expiry == 7:
                    if send_subscription_expiry_reminder(org, 7):
                        results['7_day'] += 1
                        logger.info(f"Sent 7-day subscription expiry reminder to org {org.id}")
                elif days_until_expiry == 1:
                    if send_subscription_expiry_reminder(org, 1):
                        results['1_day'] += 1
                        logger.info(f"Sent 1-day subscription expiry reminder to org {org.id}")
                        
            except Exception as e:
                results['errors'] += 1
                logger.error(f"Failed to send subscription reminder to org {org.id}: {str(e)}")
        
        # Also check for expired subscriptions that haven't been marked inactive
        expired_orgs = Organization.objects.filter(
            subscription_ends_at__lt=now,
            is_subscription_active=True
        ).exclude(subscription_plan='free_trial')
        
        for org in expired_orgs:
            try:
                # Mark as inactive and send notification
                org.subscription_status = SubscriptionStatus.EXPIRED
                org.is_subscription_active = False
                org.save()
                
                from core.notifications import send_subscription_expired_notification
                send_subscription_expired_notification(org)
                logger.info(f"Marked org {org.id} subscription as expired")
                
            except Exception as e:
                logger.error(f"Failed to handle expired subscription for org {org.id}: {str(e)}")
        
        return f"Sent {results['30_day']} 30-day, {results['7_day']} 7-day, {results['1_day']} 1-day reminders ({results['errors']} errors)"
    
    def check_usage_limits(self):
        """Check usage limits and send warnings when approaching limits"""
        from core.models import Organization, UsageTracking
        from core.notifications import send_usage_limit_warning
        
        results = {'warnings_sent': 0, 'errors': 0}
        
        # Get all active organizations
        active_orgs = Organization.objects.filter(
            is_subscription_active=True
        )
        
        for org in active_orgs:
            try:
                # Get current month's usage
                usage = UsageTracking.get_current_usage(org)
                limits = org.get_plan_limits()
                
                if not limits:
                    continue
                
                # Check if approaching limits (80% threshold)
                warnings_needed = []
                
                # Check contacts limit
                if limits.get('max_contacts', 0) > 0:
                    contact_usage = usage.get('contacts_count', 0)
                    contact_limit = limits['max_contacts']
                    if contact_usage >= contact_limit * 0.8:
                        warnings_needed.append({
                            'type': 'contacts',
                            'current': contact_usage,
                            'limit': contact_limit,
                            'percentage': int((contact_usage / contact_limit) * 100)
                        })
                
                # Check campaigns limit
                if limits.get('max_campaigns', 0) > 0:
                    campaign_usage = usage.get('campaigns_sent', 0)
                    campaign_limit = limits['max_campaigns']
                    if campaign_usage >= campaign_limit * 0.8:
                        warnings_needed.append({
                            'type': 'campaigns',
                            'current': campaign_usage,
                            'limit': campaign_limit,
                            'percentage': int((campaign_usage / campaign_limit) * 100)
                        })
                
                # Check emails limit
                if limits.get('emails_per_month', 0) > 0:
                    email_usage = usage.get('emails_sent', 0)
                    email_limit = limits['emails_per_month']
                    if email_usage >= email_limit * 0.8:
                        warnings_needed.append({
                            'type': 'emails',
                            'current': email_usage,
                            'limit': email_limit,
                            'percentage': int((email_usage / email_limit) * 100)
                        })
                
                # Send warnings if needed
                if warnings_needed:
                    for warning in warnings_needed:
                        if send_usage_limit_warning(org, warning):
                            results['warnings_sent'] += 1
                            logger.info(f"Sent {warning['type']} usage warning to org {org.id}")
                        
            except Exception as e:
                results['errors'] += 1
                logger.error(f"Failed to check usage limits for org {org.id}: {str(e)}")
        
        return f"Sent {results['warnings_sent']} usage warnings ({results['errors']} errors)"
    
    def get_next_run_time(self):
        """Get the time of the next scheduled job"""
        jobs = schedule.get_jobs()
        if not jobs:
            return "No jobs scheduled"
        
        next_job = min(jobs, key=lambda job: job.next_run)
        return next_job.next_run.strftime('%Y-%m-%d %H:%M:%S')