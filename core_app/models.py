from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.text import slugify

class UserProfile(AbstractUser):
    connects_balance = models.IntegerField(default=0)

    def __str__(self):
        return self.username

class Category(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True, blank=True)
    description = models.TextField(blank=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name_plural = 'Categories'

class Product(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField()
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='products')
    cost = models.IntegerField(default=0, help_text="Cost in Connects")
    file_url = models.FileField(upload_to='products/files/', blank=True, null=True)
    thumbnail_url = models.ImageField(upload_to='products/thumbnails/', blank=True, null=True)

    def __str__(self):
        return self.title

class Transaction(models.Model):
    TRANSACTION_TYPES = (
        ('purchase_connects', 'Purchase Connects'),
        ('spend_connects', 'Spend Connects'),
    )

    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='transactions')
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    amount = models.IntegerField(help_text="Amount of connects")
    timestamp = models.DateTimeField(auto_now_add=True)
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} - {self.get_transaction_type_display()} ({self.amount})"


class WorkspaceFile(models.Model):
    FILE_SOURCES = (
        ('uploaded', 'Uploaded'),
        ('converted', 'Converted'),
    )

    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, null=True, blank=True, related_name='workspace_files')
    session_key = models.CharField(max_length=64, blank=True, db_index=True)
    original_name = models.CharField(max_length=255)
    file = models.FileField(upload_to='workspace/files/')
    source = models.CharField(max_length=20, choices=FILE_SOURCES, default='uploaded')
    conversion_type = models.CharField(max_length=30, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.original_name
