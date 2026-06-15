document.addEventListener('DOMContentLoaded', () => {
    initSearch();
    initPriceFilter();
});

function initSearch() {
    const searchInput = document.getElementById('productSearch');
    const grid = document.getElementById('productsGrid');
    if (!searchInput || !grid) return;

    searchInput.addEventListener('input', () => applyFilters());
}

function initPriceFilter() {
    const slider = document.getElementById('priceSlider');
    const priceValue = document.getElementById('priceValue');
    if (!slider) return;

    const updateSliderFill = () => {
        const max = parseInt(slider.max, 10);
        const val = parseInt(slider.value, 10);
        const pct = (val / max) * 100;
        slider.style.background = `linear-gradient(to right, var(--color-gold) ${pct}%, #e0e0e0 ${pct}%)`;
    };

    slider.addEventListener('input', () => {
        priceValue.textContent = slider.value;
        updateSliderFill();
        applyFilters();
    });

    updateSliderFill();
}

function applyFilters() {
    const searchInput = document.getElementById('productSearch');
    const slider = document.getElementById('priceSlider');
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    const query = (searchInput?.value || '').toLowerCase().trim();
    const maxPrice = slider ? parseInt(slider.value, 10) : Infinity;

    grid.querySelectorAll('.product-card').forEach(card => {
        const title = card.getAttribute('data-title') || '';
        const cost = parseInt(card.getAttribute('data-cost') || '0', 10);
        const matchSearch = title.includes(query);
        const matchPrice = cost <= maxPrice;
        const show = matchSearch && matchPrice;

        if (show) {
            card.style.display = '';
            requestAnimationFrame(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0) scale(1)';
            });
        } else {
            card.style.opacity = '0';
            card.style.transform = 'translateY(12px) scale(0.96)';
            setTimeout(() => { card.style.display = 'none'; }, 280);
        }
    });
}
