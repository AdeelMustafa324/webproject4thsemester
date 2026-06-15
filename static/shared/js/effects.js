// SkipStep shared effects — scroll reveal, modal, nav scroll
document.addEventListener('DOMContentLoaded', () => {
    initScrollReveal();
    initNavScroll();
    initAlertDismiss();
    initComingSoonModal();
});

function initScrollReveal() {
    const reveals = document.querySelectorAll('.reveal, .reveal-stagger');
    if (!reveals.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    reveals.forEach(el => observer.observe(el));
}

function initNavScroll() {
    const header = document.querySelector('.site-header');
    if (!header) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
}

function initAlertDismiss() {
    const alerts = document.querySelectorAll('.alert');
    if (!alerts.length) return;

    setTimeout(() => {
        alerts.forEach(alert => {
            alert.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            alert.style.opacity = '0';
            alert.style.transform = 'translateY(-10px)';
            setTimeout(() => alert.remove(), 500);
        });
    }, 5000);
}

function initComingSoonModal() {
    const triggers = document.querySelectorAll('[data-action="edit-coming-soon"]');
    const overlay = document.getElementById('comingSoonModal');

    if (!overlay) {
        triggers.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                showComingSoonAlert();
            });
        });
        return;
    }

    const closeBtn = overlay.querySelector('.modal-close');

    triggers.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            overlay.classList.add('active');
        });
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', () => overlay.classList.remove('active'));
    }

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('active');
    });
}

function showComingSoonAlert() {
    let overlay = document.getElementById('comingSoonModal');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'comingSoonModal';
        overlay.className = 'modal-overlay active';
        overlay.innerHTML = `
            <div class="modal">
                <h3>Coming Soon</h3>
                <p>Full in-browser editing is on the way. Download your product for now.</p>
                <button class="modal-close">Got it</button>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    } else {
        overlay.classList.add('active');
    }
}

window.SkipStepEffects = { showComingSoonAlert };
