from django.core.management.base import BaseCommand
from core_app.models import Category, Product
import random
import urllib.request
from django.core.files.base import ContentFile

class Command(BaseCommand):
    help = 'Populates the database with dummy categories and products'

    def handle(self, *args, **kwargs):
        self.stdout.write('Clearing existing data...')
        Product.objects.all().delete()
        Category.objects.all().delete()

        categories_data = [
            {'name': 'Business Excel', 'description': 'Professional Excel templates for business.'},
            {'name': 'Canva Designs', 'description': 'Beautiful Canva templates for social media.'},
            {'name': 'PowerPoint', 'description': 'Engaging PowerPoint presentations.'},
            {'name': 'Word Documents', 'description': 'Standardized Word document templates.'},
        ]

        categories = {}
        for cat_data in categories_data:
            cat = Category.objects.create(name=cat_data['name'], description=cat_data['description'])
            categories[cat.name] = cat
            self.stdout.write(f'Created category: {cat.name}')

        base_products = [
            {'title': 'Financial Model Pro', 'cat': 'Business Excel', 'cost': 150},
            {'title': 'Startup Budget Tracker', 'cat': 'Business Excel', 'cost': 50},
            {'title': 'Instagram Post Pack', 'cat': 'Canva Designs', 'cost': 100},
            {'title': 'YouTube Thumbnail Kit', 'cat': 'Canva Designs', 'cost': 75},
            {'title': 'Pitch Deck Master', 'cat': 'PowerPoint', 'cost': 200},
            {'title': 'Quarterly Review Slides', 'cat': 'PowerPoint', 'cost': 120},
            {'title': 'Freelance Contract', 'cat': 'Word Documents', 'cost': 30},
            {'title': 'Professional Resume', 'cat': 'Word Documents', 'cost': 45},
            {'title': 'Marketing Plan Template', 'cat': 'Word Documents', 'cost': 110},
            {'title': 'Project Management Board', 'cat': 'Business Excel', 'cost': 80},
        ]

        products_data = []
        for i in range(1, 31):
            base = random.choice(base_products)
            products_data.append({
                'title': f"{base['title']} V{i}",
                'cat': base['cat'],
                'cost': base['cost'] + random.randint(-10, 50)
            })

        for p_data in products_data:
            product = Product.objects.create(
                title=p_data['title'],
                description=f"This is a premium {p_data['title']} template designed to boost your productivity. It includes all necessary assets and is fully customizable.",
                category=categories[p_data['cat']],
                cost=p_data['cost']
            )
            
            # Download a dummy image for the thumbnail
            image_url = f"https://picsum.photos/seed/{random.randint(1,1000)}/400/300"
            try:
                result = urllib.request.urlopen(image_url)
                product.thumbnail_url.save(f"thumb_{product.id}.jpg", ContentFile(result.read()))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f"Could not download thumbnail for {p_data['title']}: {e}"))

            # Create a dummy text file for the file_url
            dummy_file_content = b"This is a dummy file content."
            product.file_url.save(f"file_{product.id}.txt", ContentFile(dummy_file_content))
            
            self.stdout.write(f"Created product: {p_data['title']}")

        self.stdout.write(self.style.SUCCESS('Successfully populated dummy data'))
