# Generated manually for SubscriptionHistory model

from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0011_organization_stripe_payment_method_id_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='SubscriptionHistory',
            fields=[
                ('id', models.CharField(default=uuid.uuid4, editable=False, max_length=36, primary_key=True, serialize=False)),
                ('event_type', models.CharField(choices=[('created', 'Created'), ('updated', 'Updated'), ('canceled', 'Canceled'), ('renewed', 'Renewed'), ('payment_succeeded', 'Payment Succeeded'), ('payment_failed', 'Payment Failed'), ('trial_started', 'Trial Started'), ('trial_ended', 'Trial Ended'), ('plan_changed', 'Plan Changed')], max_length=30)),
                ('stripe_event_id', models.CharField(blank=True, max_length=255, null=True, unique=True)),
                ('old_plan', models.CharField(blank=True, choices=[('free_trial', 'Free Trial'), ('basic_monthly', 'Basic Monthly'), ('basic_yearly', 'Basic Yearly'), ('pro_monthly', 'Pro Monthly'), ('pro_yearly', 'Pro Yearly'), ('premium_monthly', 'Premium Monthly'), ('premium_yearly', 'Premium Yearly')], max_length=30, null=True)),
                ('new_plan', models.CharField(blank=True, choices=[('free_trial', 'Free Trial'), ('basic_monthly', 'Basic Monthly'), ('basic_yearly', 'Basic Yearly'), ('pro_monthly', 'Pro Monthly'), ('pro_yearly', 'Pro Yearly'), ('premium_monthly', 'Premium Monthly'), ('premium_yearly', 'Premium Yearly')], max_length=30, null=True)),
                ('old_status', models.CharField(blank=True, choices=[('active', 'Active'), ('past_due', 'Past Due'), ('canceled', 'Canceled'), ('trialing', 'Trialing')], max_length=20, null=True)),
                ('new_status', models.CharField(blank=True, choices=[('active', 'Active'), ('past_due', 'Past Due'), ('canceled', 'Canceled'), ('trialing', 'Trialing')], max_length=20, null=True)),
                ('amount', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ('currency', models.CharField(default='USD', max_length=3)),
                ('payment_method', models.CharField(blank=True, max_length=50, null=True)),
                ('invoice_id', models.CharField(blank=True, max_length=255, null=True)),
                ('failure_reason', models.TextField(blank=True, null=True)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='subscription_history', to='core.organization')),
            ],
            options={
                'db_table': 'subscription_history',
                'ordering': ['-created_at'],
            },
        ),
    ]