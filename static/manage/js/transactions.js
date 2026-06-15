document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('txSearch');
    const table = document.getElementById('transactionsTable');
    if (!searchInput || !table) return;

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        table.querySelectorAll('tbody tr[data-user]').forEach(row => {
            const user = row.getAttribute('data-user') || '';
            row.style.display = user.includes(query) ? '' : 'none';
        });
    });
});
