# -*- coding: utf-8 -*-
# Generated by Django 1.11.2 on 2017-06-26 21:56

from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('zerver', '0085_fix_bots_with_none_bot_type'),
    ]

    operations = [
        migrations.AlterField(
            model_name='realm',
            name='org_type',
            field=models.PositiveSmallIntegerField(default=1),
        ),
    ]
