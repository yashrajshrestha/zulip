# -*- coding: utf-8 -*-
# Generated by Django 1.11.20 on 2019-06-28 21:45
from __future__ import unicode_literals

from django.db import migrations
from django.db.backends.postgresql_psycopg2.schema import DatabaseSchemaEditor
from django.db.migrations.state import StateApps
from unicodedata import category

NAME_INVALID_CHARS = ['*', '`', "\\", '>', '"', '@']


def remove_name_illegal_chars(apps: StateApps, schema_editor: DatabaseSchemaEditor) -> None:
    UserProfile = apps.get_model("zerver", "UserProfile")
    for user in UserProfile.objects.all():
        stripped = []
        for char in user.full_name:
            if (char not in NAME_INVALID_CHARS) and (category(char)[0] != "C"):
                stripped.append(char)
        user.full_name = "".join(stripped)
        user.save(update_fields=["full_name"])

class Migration(migrations.Migration):

    dependencies = [
        ('zerver', '0235_userprofile_desktop_icon_count_display'),
    ]

    operations = [
        migrations.RunPython(remove_name_illegal_chars)
    ]
