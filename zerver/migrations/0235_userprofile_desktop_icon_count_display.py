# -*- coding: utf-8 -*-
# Generated by Django 1.11.20 on 2019-06-29 18:22
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('zerver', '0234_add_external_account_custom_profile_field'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='desktop_icon_count_display',
            field=models.PositiveSmallIntegerField(default=1),
        ),
    ]
