from django.contrib import admin
from .models import WorkspaceFile
from django.contrib.auth.admin import UserAdmin
from .models import UserProfile, Category, Product, Transaction

class UserProfileAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ('SkipStep Profile', {'fields': ('connects_balance',)}),
    )

class CategoryAdmin(admin.ModelAdmin):
    prepopulated_fields = {'slug': ('name',)}
    list_display = ('name', 'slug')

class ProductAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'cost')
    list_filter = ('category',)
    search_fields = ('title',)

class TransactionAdmin(admin.ModelAdmin):
    list_display = ('user', 'transaction_type', 'amount', 'timestamp', 'product')
    list_filter = ('transaction_type', 'timestamp')
    search_fields = ('user__username', 'product__title')

admin.site.register(UserProfile, UserProfileAdmin)
admin.site.register(Category, CategoryAdmin)
admin.site.register(Product, ProductAdmin)
class WorkspaceFileAdmin(admin.ModelAdmin):
    list_display = ('original_name', 'user', 'source', 'conversion_type', 'created_at')
    list_filter = ('source', 'conversion_type')

admin.site.register(Transaction, TransactionAdmin)
admin.site.register(WorkspaceFile, WorkspaceFileAdmin)
