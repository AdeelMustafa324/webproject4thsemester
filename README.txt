SkipStep Django Project Setup and Working Principles

1. Environment Setup
--------------------
1. Open a terminal in the project root:
   c:\Projects\web\SkipStep-20260608T104752Z-3-001\SkipStep

2. Create a virtual environment (if not already present):
   python -m venv .venv

3. Activate the virtual environment:
   PowerShell: .venv\Scripts\Activate.ps1
   CMD: .venv\Scripts\activate.bat

4. Install dependencies:
   python -m pip install -r requirements.txt

5. If requirements.txt is not present, install the needed packages manually:
   python -m pip install django==6.0.5 Pillow pdf2docx docx2pdf
   python -m pip freeze > requirements.txt

2. Database and Initial Commands
--------------------------------
1. Apply database migrations:
   python manage.py migrate

2. Create a superuser for admin access:
   python manage.py createsuperuser

3. Populate dummy data (optional):
   python manage.py populate_dummy_data

4. Run the development server:
   python manage.py runserver

5. Open the app in a browser:
   http://127.0.0.1:8000/
   Admin site: http://127.0.0.1:8000/admin/

3. Project Structure
--------------------
- manage.py: Django command-line utility
- skipstep_project/: Django project settings, URL config, wsgi/asgi
- core_app/: main app with models, views, URLs, utilities, and admin config
- templates/: HTML templates for the site
- static/: CSS and JavaScript assets
- media/: uploaded files, product files, thumbnails
- requirements.txt: pinned Python dependencies

4. Working Principles
---------------------
- The app uses Django built-in authentication and a custom user model `core_app.UserProfile`.
- Products are grouped into categories and can be purchased with "connects".
- User balance changes are tracked in the `Transaction` model.
- The marketplace, store, dashboard, and workspace pages are defined in `core_app.views`.
- File conversions are handled in `core_app.utils` using `pdf2docx` and `docx2pdf`.
- Static files are served from `static/`; media files are served from `media/` during development.
- In development, `DEBUG=True`, and media/static URLs are served automatically by Django.

5. Common Commands
------------------
- Start server: python manage.py runserver
- Create migration: python manage.py makemigrations
- Apply migration: python manage.py migrate
- Create admin user: python manage.py createsuperuser
- Load dummy data: python manage.py populate_dummy_data

6. Notes
--------
- Use the `.venv` virtual environment created in this project root.
- Keep `requirements.txt` updated when package dependencies change.
- For production, set `DEBUG=False` and configure allowed hosts, static file hosting, and database settings.
