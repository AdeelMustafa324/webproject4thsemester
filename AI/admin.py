from django.contrib import admin
from .models import AIChatSession, AIChatMessage


class AIChatMessageInline(admin.TabularInline):
    model = AIChatMessage
    extra = 0
    readonly_fields = ('role', 'content', 'file_actions', 'created_at')
    can_delete = False


@admin.register(AIChatSession)
class AIChatSessionAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'title', 'created_at', 'updated_at')
    list_filter = ('user',)
    search_fields = ('user__username', 'title')
    readonly_fields = ('created_at', 'updated_at')
    inlines = [AIChatMessageInline]


@admin.register(AIChatMessage)
class AIChatMessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'session', 'role', 'created_at')
    list_filter = ('role',)
    search_fields = ('content', 'session__user__username')
    readonly_fields = ('created_at',)
