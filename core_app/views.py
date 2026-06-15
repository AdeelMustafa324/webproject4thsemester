import os
import uuid
import json
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib import messages
from django.http import JsonResponse
from django.utils import timezone
from django.db.models import Sum, Max
from django.core.files.base import ContentFile
from django.views.decorators.csrf import csrf_exempt
from .models import Product, Category, Transaction, UserProfile, WorkspaceFile
from .utils import convert_pdf_to_docx, convert_docx_to_pdf, convert_excel_to_csv

staff_required = user_passes_test(
    lambda u: u.is_authenticated and u.is_staff,
    login_url='/manage/login/'
)


def _get_format_category_links():
    format_defs = [
        ('excel', 'Excel', 'excel'),
        ('powerpoint', 'PowerPoint', 'ppt'),
        ('word', 'Word', 'word'),
        ('canva', 'Canva', 'canva'),
    ]
    categories = list(Category.objects.all())
    links = []
    for key, label, css_key in format_defs:
        category = next(
            (c for c in categories if key in c.slug or key in c.name.lower()),
            None
        )
        links.append({
            'key': css_key,
            'label': label,
            'slug': category.slug if category else '',
        })
    return links


def _ensure_session_key(request):
    if not request.session.session_key:
        request.session.create()
    return request.session.session_key


def _get_workspace_files(request):
    if request.user.is_authenticated:
        return WorkspaceFile.objects.filter(user=request.user)
    session_key = _ensure_session_key(request)
    return WorkspaceFile.objects.filter(session_key=session_key, user__isnull=True)


def _save_workspace_file(request, file_path, original_name, source, conversion_type=''):
    session_key = _ensure_session_key(request)
    with open(file_path, 'rb') as f:
        content = f.read()

    ws_file = WorkspaceFile(
        user=request.user if request.user.is_authenticated else None,
        session_key=session_key if not request.user.is_authenticated else '',
        original_name=original_name,
        source=source,
        conversion_type=conversion_type,
    )
    ws_file.file.save(original_name, ContentFile(content), save=True)
    return ws_file


def home(request):
    featured_products = Product.objects.all()[:5]
    format_links = _get_format_category_links()
    return render(request, 'user/landing.html', {
        'featured_products': featured_products,
        'format_links': format_links,
    })


def marketplace(request):
    products = Product.objects.all()
    categories = Category.objects.all()
    category_slug = request.GET.get('category')
    max_cost = Product.objects.aggregate(m=Max('cost'))['m'] or 500

    if category_slug:
        products = products.filter(category__slug=category_slug)

    return render(request, 'user/marketplace.html', {
        'products': products,
        'categories': categories,
        'current_category': category_slug,
        'max_cost': max_cost,
    })


def product_detail(request, product_id):
    product = get_object_or_404(Product, id=product_id)
    has_purchased = False

    if request.user.is_authenticated:
        has_purchased = Transaction.objects.filter(
            user=request.user,
            product=product,
            transaction_type='spend_connects'
        ).exists()

    if request.method == 'POST' and request.user.is_authenticated:
        if not has_purchased:
            if request.user.connects_balance >= product.cost:
                request.user.connects_balance -= product.cost
                request.user.save()
                Transaction.objects.create(
                    user=request.user,
                    transaction_type='spend_connects',
                    amount=product.cost,
                    product=product
                )
                messages.success(request, f"Successfully purchased {product.title}!")
                return redirect('core_app:dashboard')
            else:
                messages.error(request, "Not enough connects. Please purchase more.")
                return redirect('core_app:store')

    return render(request, 'user/product_detail.html', {
        'product': product,
        'has_purchased': has_purchased
    })


@login_required
def dashboard(request):
    from AI.ai_tools import list_files
    from django.utils import timezone

    transactions = Transaction.objects.filter(user=request.user).order_by('-timestamp')
    purchased_products = []
    seen_products = set()
    for t in transactions:
        if t.transaction_type == 'spend_connects' and t.product and t.product.id not in seen_products:
            purchased_products.append(t.product)
            seen_products.add(t.product.id)
            
    db_files = list(_get_workspace_files(request))
    workspace_id = f'user_{request.user.id}'
    ai_result = list_files(workspace_id)
    ai_files = []
    if ai_result.get('status') == 'ok':
        for f in ai_result.get('files', []):
            ai_files.append({
                'id': f'ai_{f["name"]}',
                'original_name': f['name'],
                'source': 'ai_generated',
                'get_source_display': 'AI Generated',
                'conversion_type': 'ai',
                'created_at': timezone.now(),
                'file': { 'url': f'/ai/api/download/{f["name"]}/' },
                'is_ai': True,
                'name': f['name']
            })
            
    all_files = db_files + ai_files
    # Sort files safely
    def get_date(f):
        return f.created_at if not isinstance(f, dict) else f['created_at']
    
    all_files.sort(key=get_date, reverse=True)
    
    stats = {
        'files_converted': len(db_files),
        'templates_owned': len(purchased_products),
        'ai_generations': len(ai_files),
    }

    return render(request, 'user/dashboard.html', {
        'transactions': transactions[:5],
        'purchased_products': purchased_products[:4],
        'recent_files': all_files[:4],
        'stats': stats,
    })


@login_required
def store(request):
    if request.method == 'POST':
        package = request.POST.get('package')
        amount = 0
        if package == 'basic':
            amount = 100
        elif package == 'pro':
            amount = 500
        elif package == 'enterprise':
            amount = 2000

        if amount > 0:
            request.user.connects_balance += amount
            request.user.save()
            Transaction.objects.create(
                user=request.user,
                transaction_type='purchase_connects',
                amount=amount
            )
            messages.success(request, f"Successfully purchased {amount} connects!")
            return redirect('core_app:dashboard')

    return render(request, 'user/store.html')


def workspace(request):
    from AI.ai_tools import list_files
    from django.utils import timezone
    
    db_files = list(_get_workspace_files(request))
    if request.user.is_authenticated:
        workspace_id = f'user_{request.user.id}'
    else:
        workspace_id = _ensure_session_key(request)
    
    ai_result = list_files(workspace_id)
    ai_files = []
    if ai_result.get('status') == 'ok':
        for f in ai_result.get('files', []):
            ai_files.append({
                'id': f'ai_{f["name"]}',
                'original_name': f['name'],
                'source': 'ai_generated',
                'get_source_display': 'AI Generated',
                'conversion_type': 'ai',
                'created_at': timezone.now(),
                'file': { 'url': f'/ai/api/download/{f["name"]}/' },
                'is_ai': True,
                'name': f['name']
            })
            
    all_files = db_files + ai_files
    return render(request, 'user/workspace.html', {'files': all_files})


def tool_pdf_to_word(request):
    return render(request, 'user/pdf_to_word.html', {
        'tool_title': 'PDF to Word',
        'tool_type': 'pdf2docx',
        'accept': '.pdf',
        'hint': 'Upload a .pdf file to convert to Word (.docx)',
    })


def tool_word_to_pdf(request):
    return render(request, 'user/word_to_pdf.html', {
        'tool_title': 'Word to PDF',
        'tool_type': 'docx2pdf',
        'accept': '.docx',
        'hint': 'Upload a .docx file to convert to PDF',
    })


def tool_excel_to_csv(request):
    return render(request, 'user/excel_to_csv.html', {
        'tool_title': 'Excel / Numbers to CSV',
        'tool_type': 'excel2csv',
        'accept': '.xlsx,.xls,.numbers',
        'hint': 'Upload Excel (.xlsx, .xls) or Apple Numbers (.numbers) to convert to CSV',
    })


def user_login(request):
    if request.user.is_authenticated:
        return redirect('core_app:dashboard')

    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            next_url = request.GET.get('next', '')
            if next_url.startswith('/'):
                return redirect(next_url)
            return redirect('core_app:dashboard')
        messages.error(request, 'Invalid username or password.')

    return render(request, 'user/login.html')


def user_register(request):
    if request.user.is_authenticated:
        return redirect('core_app:dashboard')

    if request.method == 'POST':
        username = request.POST.get('username')
        email = request.POST.get('email', '')
        password1 = request.POST.get('password1')
        password2 = request.POST.get('password2')

        if password1 != password2:
            messages.error(request, 'Passwords do not match.')
        elif UserProfile.objects.filter(username=username).exists():
            messages.error(request, 'Username already taken.')
        elif len(password1) < 8:
            messages.error(request, 'Password must be at least 8 characters.')
        else:
            user = UserProfile.objects.create_user(
                username=username,
                email=email,
                password=password1
            )
            login(request, user)
            messages.success(request, 'Account created successfully!')
            return redirect('core_app:dashboard')

    return render(request, 'user/register.html')


@login_required
def user_logout(request):
    if request.method != 'POST':
        # Redirect GET requests to home rather than logging out (CSRF protection)
        return redirect('core_app:home')
    logout(request)
    return redirect('core_app:home')


def convert_file(request):
    if request.method != 'POST' or not request.FILES.get('file'):
        return JsonResponse({'success': False, 'message': 'Invalid request'})

    uploaded_file = request.FILES['file']
    conversion_type = request.POST.get('type')
    temp_dir = os.path.join('media', 'temp')
    os.makedirs(temp_dir, exist_ok=True)

    unique = uuid.uuid4().hex[:8]
    base, ext = os.path.splitext(uploaded_file.name)
    safe_name = f"{base}_{unique}{ext}"
    file_path = os.path.join(temp_dir, safe_name)

    with open(file_path, 'wb+') as destination:
        for chunk in uploaded_file.chunks():
            destination.write(chunk)

    _save_workspace_file(request, file_path, uploaded_file.name, 'uploaded', conversion_type)

    try:
        if conversion_type == 'pdf2docx' and ext.lower() == '.pdf':
            out_name = f"{base}_{unique}.docx"
            out_path = os.path.join(temp_dir, out_name)
            convert_pdf_to_docx(file_path, out_path)
            ws = _save_workspace_file(request, out_path, out_name, 'converted', conversion_type)
            return JsonResponse({
                'success': True,
                'message': 'Converted to Word successfully.',
                'download_url': ws.file.url,
                'workspace_url': '/workspace/',
            })
        elif conversion_type == 'docx2pdf' and ext.lower() == '.docx':
            out_name = f"{base}_{unique}.pdf"
            out_path = os.path.join(temp_dir, out_name)
            convert_docx_to_pdf(file_path, out_path)
            ws = _save_workspace_file(request, out_path, out_name, 'converted', conversion_type)
            return JsonResponse({
                'success': True,
                'message': 'Converted to PDF successfully.',
                'download_url': ws.file.url,
                'workspace_url': '/workspace/',
            })
        elif conversion_type == 'excel2csv' and ext.lower() in ('.xlsx', '.xls', '.numbers'):
            out_name = f"{base}_{unique}.csv"
            out_path = os.path.join(temp_dir, out_name)
            convert_excel_to_csv(file_path, out_path)
            ws = _save_workspace_file(request, out_path, out_name, 'converted', conversion_type)
            return JsonResponse({
                'success': True,
                'message': 'Converted to CSV successfully.',
                'download_url': ws.file.url,
                'workspace_url': '/workspace/',
            })
        else:
            return JsonResponse({'success': False, 'message': 'Invalid file type or conversion requested.'})
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})


def upload_file(request):
    if request.method != 'POST' or not request.FILES.get('file'):
        return JsonResponse({'success': False, 'message': 'No file provided.'})

    uploaded_file = request.FILES['file']
    temp_dir = os.path.join('media', 'temp')
    os.makedirs(temp_dir, exist_ok=True)

    unique = uuid.uuid4().hex[:8]
    base, ext = os.path.splitext(uploaded_file.name)
    safe_name = f"{base}_{unique}{ext}"
    file_path = os.path.join(temp_dir, safe_name)

    with open(file_path, 'wb+') as destination:
        for chunk in uploaded_file.chunks():
            destination.write(chunk)

    ws = _save_workspace_file(request, file_path, uploaded_file.name, 'uploaded')
    return JsonResponse({
        'success': True,
        'message': 'File uploaded to workspace.',
        'download_url': ws.file.url,
        'file_id': ws.id,
    })


@login_required
@csrf_exempt
def delete_workspace_file(request, file_id):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Invalid request'})

    if str(file_id).startswith('ai_'):
        filename = str(file_id)[3:]
        from AI.ai_tools import delete_file
        session_id = _ensure_session_key(request)
        res = delete_file(session_id, filename)
        if res['status'] == 'ok':
            return JsonResponse({'success': True, 'message': 'File deleted.'})
        return JsonResponse({'success': False, 'message': res.get('message', 'Failed to delete')})

    try:
        int_id = int(file_id)
    except ValueError:
        return JsonResponse({'success': False, 'message': 'Invalid ID'})

    files = _get_workspace_files(request)
    ws_file = get_object_or_404(files, id=int_id)
    ws_file.file.delete(save=False)
    ws_file.delete()
    return JsonResponse({'success': True, 'message': 'File deleted.'})


@login_required
def doc_editor_view(request, file_id):
    if str(file_id).startswith('ai_'):
        filename = str(file_id)[3:]
    else:
        try:
            int_id = int(file_id)
            files = _get_workspace_files(request)
            ws_file = get_object_or_404(files, id=int_id)
            filename = ws_file.original_name
        except ValueError:
            return HttpResponse("Invalid file ID", status=400)
    
    return render(request, 'user/doc_editor.html', {
        'file_id': file_id,
        'filename': filename
    })


def _convert_doc_to_docx_win32(file_path):
    import os
    if not file_path.lower().endswith('.doc'):
        return file_path
    
    new_path = file_path + 'x'
    if os.path.exists(new_path):
        return new_path
        
    try:
        import win32com.client as win32
        import pythoncom
        pythoncom.CoInitialize()
        word = win32.DispatchEx('Word.Application')
        word.Visible = False
        doc = word.Documents.Open(os.path.abspath(file_path))
        doc.SaveAs(os.path.abspath(new_path), FileFormat=16) # 16 = docx
        try:
            doc.Close()
        except:
            pass
            
        try:
            word.Quit()
        except:
            pass
            
        pythoncom.CoUninitialize()
        
        if os.path.exists(new_path):
            return new_path
        return None
    except Exception as e:
        print("win32com conversion failed:", e)
        if os.path.exists(new_path):
            return new_path
        return None

@login_required
def read_workspace_file(request, file_id):
    if str(file_id).startswith('ai_'):
        filename = str(file_id)[3:]
        from AI.ai_tools import read_file
        session_id = _ensure_session_key(request)
        res = read_file(session_id, filename)
        return JsonResponse(res)

    try:
        int_id = int(file_id)
    except ValueError:
        return JsonResponse({'status': 'error', 'message': 'Invalid ID'})

    files = _get_workspace_files(request)
    ws_file = get_object_or_404(files, id=int_id)
    try:
        # Auto-convert .doc to .docx permanently in the database
        if ws_file.original_name.lower().endswith('.doc') and not ws_file.original_name.lower().endswith('.docx'):
            new_path = _convert_doc_to_docx_win32(ws_file.file.path)
            if new_path:
                import os
                # Delete old .doc file from disk
                try:
                    os.remove(ws_file.file.path)
                except:
                    pass
                # Update Django model
                ws_file.file.name = ws_file.file.name + 'x'
                ws_file.original_name = ws_file.original_name + 'x'
                ws_file.save()
            else:
                return JsonResponse({'status': 'error', 'message': 'Could not convert .doc to .docx natively. Please install MS Word or upload a .docx.'})

        if ws_file.original_name.lower().endswith('.docx'):
            import mammoth
            with open(ws_file.file.path, 'rb') as docx_file:
                result = mammoth.convert_to_html(docx_file)
                html = result.value
            return JsonResponse({'status': 'ok', 'content': html, 'filename': ws_file.original_name})
            
        with open(ws_file.file.path, 'r', encoding='utf-8') as f:
            content = f.read(20000) # Cap size to 20K chars
        return JsonResponse({'status': 'ok', 'content': content, 'filename': ws_file.original_name})
    except UnicodeDecodeError:
        return JsonResponse({'status': 'error', 'message': 'File is binary or not UTF-8.'})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})


@login_required
@csrf_exempt
def save_workspace_file(request, file_id):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Invalid method.'})
        
    try:
        data = json.loads(request.body)
        content = data.get('content', '')
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Invalid JSON.'})

    if str(file_id).startswith('ai_'):
        filename = str(file_id)[3:]
        from AI.ai_tools import create_file
        session_id = _ensure_session_key(request)
        res = create_file(session_id, filename, content)
        return JsonResponse(res)

    try:
        int_id = int(file_id)
    except ValueError:
        return JsonResponse({'status': 'error', 'message': 'Invalid ID'})

    files = _get_workspace_files(request)
    ws_file = get_object_or_404(files, id=int_id)
    try:
        if ws_file.original_name.lower().endswith('.docx'):
            from htmldocx import HtmlToDocx
            from docx import Document
            new_doc = Document()
            HtmlToDocx().add_html_to_document(content, new_doc)
            new_doc.save(ws_file.file.path)
        else:
            with open(ws_file.file.path, 'w', encoding='utf-8') as f:
                f.write(content)
        return JsonResponse({'status': 'ok', 'message': 'File saved.'})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})


@login_required
@csrf_exempt
def rename_workspace_file(request, file_id):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Invalid method.'})

    try:
        data = json.loads(request.body)
        new_name = data.get('new_name', '').strip()
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Invalid JSON.'})

    if not new_name:
        return JsonResponse({'status': 'error', 'message': 'New name required.'})

    if str(file_id).startswith('ai_'):
        filename = str(file_id)[3:]
        from AI.ai_tools import rename_file
        session_id = _ensure_session_key(request)
        res = rename_file(session_id, filename, new_name)
        return JsonResponse(res)

    try:
        int_id = int(file_id)
    except ValueError:
        return JsonResponse({'status': 'error', 'message': 'Invalid ID'})

    files = _get_workspace_files(request)
    ws_file = get_object_or_404(files, id=int_id)
    ws_file.original_name = new_name
    ws_file.save()
    return JsonResponse({'status': 'ok', 'message': 'File renamed.'})


# --- Manage Panel Views ---

def manage_login(request):
    if request.user.is_authenticated and request.user.is_staff:
        return redirect('core_app:manage_dashboard')

    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        user = authenticate(request, username=username, password=password)
        if user is not None and user.is_staff:
            login(request, user)
            return redirect('core_app:manage_dashboard')
        messages.error(request, 'Invalid credentials or insufficient permissions.')

    return render(request, 'manage/login.html')


@staff_required
def manage_logout(request):
    logout(request)
    return redirect('core_app:manage_login')


@staff_required
def manage_dashboard(request):
    today = timezone.now().date()
    connects_revenue = Transaction.objects.filter(
        transaction_type='purchase_connects'
    ).aggregate(total=Sum('amount'))['total'] or 0

    return render(request, 'manage/dashboard.html', {
        'product_count': Product.objects.count(),
        'user_count': UserProfile.objects.count(),
        'connects_revenue': connects_revenue,
        'transactions_today': Transaction.objects.filter(timestamp__date=today).count(),
        'recent_transactions': Transaction.objects.select_related('user', 'product').order_by('-timestamp')[:8],
        'recent_products': Product.objects.select_related('category').order_by('-id')[:5],
    })


@staff_required
def manage_products(request):
    products = Product.objects.select_related('category').all()
    return render(request, 'manage/products.html', {'products': products})


@staff_required
def manage_product_form(request):
    product = None
    product_id = request.GET.get('id')
    if product_id:
        product = get_object_or_404(Product, id=product_id)

    return render(request, 'manage/product_form.html', {
        'product': product,
        'categories': Category.objects.all(),
    })


@staff_required
def manage_categories(request):
    categories = Category.objects.prefetch_related('products').all()
    return render(request, 'manage/categories.html', {'categories': categories})


@staff_required
def manage_users(request):
    users = UserProfile.objects.all().order_by('-date_joined')
    return render(request, 'manage/users.html', {'users': users})


@staff_required
def manage_transactions(request):
    transactions = Transaction.objects.select_related('user', 'product').order_by('-timestamp')
    return render(request, 'manage/transactions.html', {'transactions': transactions})
