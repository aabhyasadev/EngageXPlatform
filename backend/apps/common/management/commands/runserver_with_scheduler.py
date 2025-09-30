"""
Management command to run Django development server with the scheduler
"""
import sys
import threading
import time
from django.core.management import execute_from_command_line
from django.core.management.base import BaseCommand
from django.core.management.commands.runserver import Command as RunServerCommand
import logging

logger = logging.getLogger(__name__)


class Command(RunServerCommand):
    help = 'Run Django development server with the lightweight scheduler'
    
    def __init__(self):
        super().__init__()
        self.scheduler_thread = None
    
    def add_arguments(self, parser):
        super().add_arguments(parser)
        parser.add_argument(
            '--no-scheduler',
            action='store_true',
            dest='no_scheduler',
            help='Run without the scheduler',
        )
    
    def handle(self, *args, **options):
        """Start both the scheduler and the Django server"""
        no_scheduler = options.get('no_scheduler', False)
        
        if not no_scheduler:
            # Start the scheduler in a separate thread
            self.start_scheduler()
        
        # Start the Django development server
        self.stdout.write(self.style.SUCCESS('Starting Django development server with scheduler...'))
        super().handle(*args, **options)
    
    def start_scheduler(self):
        """Start the scheduler in a background thread"""
        def run_scheduler():
            from apps.common.management.commands.start_scheduler import Command as SchedulerCommand
            
            try:
                # Create an instance of the scheduler command
                scheduler = SchedulerCommand()
                scheduler.stdout = self.stdout
                scheduler.stderr = self.stderr
                scheduler.style = self.style
                
                # Configure the scheduler
                self.stdout.write(self.style.SUCCESS('Configuring background scheduler...'))
                scheduler.setup_schedules()
                
                # Run the scheduler in this thread
                scheduler.run_scheduler()
                
            except Exception as e:
                logger.error(f"Failed to start scheduler: {str(e)}", exc_info=True)
                self.stderr.write(self.style.ERROR(f'Scheduler startup failed: {str(e)}'))
        
        # Create and start the scheduler thread
        self.scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
        self.scheduler_thread.start()
        
        # Give the scheduler a moment to start up
        time.sleep(2)
        
        if self.scheduler_thread.is_alive():
            self.stdout.write(self.style.SUCCESS('Background scheduler started successfully'))
        else:
            self.stderr.write(self.style.WARNING('Background scheduler may not have started properly'))