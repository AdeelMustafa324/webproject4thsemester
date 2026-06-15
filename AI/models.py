"""
AI app models — persistent chat sessions and messages.

Two tables:
  AIChatSession — one row per named chat conversation (belongs to a user)
  AIChatMessage — one row per turn (user or model) in a session
"""

from django.db import models
from core_app.models import UserProfile


class AIChatSession(models.Model):
    """
    Represents a named chat conversation for a user.
    Title is auto-generated from the first message if not provided.
    """
    user = models.ForeignKey(
        UserProfile,
        on_delete=models.CASCADE,
        related_name='ai_chat_sessions',
    )
    title = models.CharField(
        max_length=200,
        default='New Chat',
        help_text='Short title, auto-set from the first user message.',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f'{self.user.username} — {self.title} ({self.id})'


class AIChatMessage(models.Model):
    """
    One turn in a chat session.
    role is either 'user' or 'model' (matching Gemini API conventions).
    """
    ROLE_CHOICES = [
        ('user', 'User'),
        ('model', 'Model'),
    ]

    session = models.ForeignKey(
        AIChatSession,
        on_delete=models.CASCADE,
        related_name='messages',
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    # Stores a JSON list of {'action': ..., 'filename': ...} dicts
    file_actions = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        preview = self.content[:60].replace('\n', ' ')
        return f'[{self.role}] {preview}'
