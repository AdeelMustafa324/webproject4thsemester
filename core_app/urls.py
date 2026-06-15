from django.urls import path
from . import views

app_name = 'core_app'

urlpatterns = [
    # User panel
    path('', views.home, name='home'),
    path('marketplace/', views.marketplace, name='marketplace'),
    path('product/<int:product_id>/', views.product_detail, name='product_detail'),
    path('login/', views.user_login, name='login'),
    path('register/', views.user_register, name='register'),
    path('logout/', views.user_logout, name='logout'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('store/', views.store, name='store'),
    path('workspace/', views.workspace, name='workspace'),

    # Conversion tools
    path('tools/pdf-to-word/', views.tool_pdf_to_word, name='tool_pdf_to_word'),
    path('tools/word-to-pdf/', views.tool_word_to_pdf, name='tool_word_to_pdf'),
    path('tools/excel-to-csv/', views.tool_excel_to_csv, name='tool_excel_to_csv'),

    # APIs
    path('api/convert/', views.convert_file, name='convert_file'),
    path('api/upload/', views.upload_file, name='upload_file'),
    path('api/workspace/<str:file_id>/delete/', views.delete_workspace_file, name='delete_workspace_file'),
    path('api/workspace/<str:file_id>/read/', views.read_workspace_file, name='read_workspace_file'),
    path('api/workspace/<str:file_id>/save/', views.save_workspace_file, name='save_workspace_file'),
    path('api/workspace/<str:file_id>/rename/', views.rename_workspace_file, name='rename_workspace_file'),

    # Manage panel
    path('manage/login/', views.manage_login, name='manage_login'),
    path('manage/logout/', views.manage_logout, name='manage_logout'),
    path('manage/', views.manage_dashboard, name='manage_dashboard'),
    path('manage/products/', views.manage_products, name='manage_products'),
    path('manage/products/new/', views.manage_product_form, name='manage_product_form'),
    path('manage/categories/', views.manage_categories, name='manage_categories'),
    path('manage/users/', views.manage_users, name='manage_users'),
    path('manage/transactions/', views.manage_transactions, name='manage_transactions'),
]
