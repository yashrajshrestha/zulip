# -*- coding: utf-8 -*-
# Generated by Django 1.10.5 on 2017-03-18 12:38

import os

from boto.s3.connection import S3Connection
from boto.s3.key import Key
from django.conf import settings
from django.db import migrations
from django.db.backends.postgresql_psycopg2.schema import DatabaseSchemaEditor
from django.db.migrations.state import StateApps

from typing import Optional

class MissingUploadFileException(Exception):
    pass

def get_file_size_local(path_id: str) -> int:
    file_path = os.path.join(settings.LOCAL_UPLOADS_DIR, 'files', path_id)
    try:
        size = os.path.getsize(file_path)
    except OSError:
        raise MissingUploadFileException
    return size

def sync_filesizes(apps: StateApps, schema_editor: DatabaseSchemaEditor) -> None:
    attachments = apps.get_model('zerver', 'Attachment')
    if settings.LOCAL_UPLOADS_DIR is not None:
        for attachment in attachments.objects.all():
            if attachment.size is None:
                try:
                    new_size = get_file_size_local(attachment.path_id)
                except MissingUploadFileException:
                    new_size = 0
                attachment.size = new_size
                attachment.save(update_fields=["size"])
    else:
        conn = S3Connection(settings.S3_KEY, settings.S3_SECRET_KEY)
        bucket_name = settings.S3_AUTH_UPLOADS_BUCKET
        bucket = conn.get_bucket(bucket_name, validate=False)
        for attachment in attachments.objects.all():
            if attachment.size is None:
                file_key = bucket.get_key(attachment.path_id)  # type: Optional[Key]
                if file_key is None:
                    new_size = 0
                else:
                    new_size = file_key.size
                attachment.size = new_size
                attachment.save(update_fields=["size"])

def reverse_sync_filesizes(apps: StateApps, schema_editor: DatabaseSchemaEditor) -> None:
    """Does nothing"""
    return None

class Migration(migrations.Migration):

    dependencies = [
        ('zerver', '0063_realm_description'),
    ]

    operations = [
        migrations.RunPython(sync_filesizes, reverse_sync_filesizes),
    ]
