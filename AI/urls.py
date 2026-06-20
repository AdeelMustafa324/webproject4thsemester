from django.urls import path
from . import views

app_name = 'ai'

urlpatterns = [
    # ── Persistent Chat Session Management ──────────────────────────────
    path('api/sessions/', views.list_chat_sessions_api, name='list_sessions'),
    path('api/sessions/new/', views.new_chat_session_api, name='new_session'),
    path('api/session/<int:session_id>/', views.get_chat_session_api, name='get_session'),
    path('api/session/<int:session_id>/delete/', views.delete_chat_session_api, name='delete_session'),

    # ── Chat ─────────────────────────────────────────────────────────────
    path('api/chat/', views.chat_api, name='chat_api'),
    path('api/clear/', views.clear_chat_api, name='clear_chat_api'),
    path('api/switch-model/', views.switch_model_api, name='switch_model_api'),

    # ── File Tools ───────────────────────────────────────────────────────
    path('api/files/', views.list_files_api, name='list_files_api'),
    path('api/upload-chat/', views.upload_chat_file, name='upload_chat_file'),
    path('api/user-files/', views.list_user_workspace_files, name='list_user_workspace_files'),
    path('api/download/<path:filename>/', views.download_file, name='download_file'),
    path('api/read/<path:filename>/', views.read_file_api, name='read_file_api'),
    path('api/save/<path:filename>/', views.save_file_api, name='save_file_api'),

    # ── Sheet Editor ─────────────────────────────────────────────────────
    path('api/sheet-edit/', views.sheet_edit_api, name='sheet_edit_api'),
    path('sheet-editor/<path:filename>/', views.sheet_editor_page, name='sheet_editor_page'),
]
