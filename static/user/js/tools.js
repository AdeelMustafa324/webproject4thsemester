document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('.tool-form');
    if (!form) return;

    const dropArea = document.getElementById('toolDropArea');
    const fileInput = form.querySelector('.tool-file-input');
    const dropMsg = document.getElementById('toolDropMsg');
    const result = document.getElementById('toolResult');
    const resultMsg = document.getElementById('toolResultMsg');
    const downloadLink = document.getElementById('toolDownloadLink');
    const conversionType = form.dataset.type;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
        dropArea?.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); });
    });

    ['dragenter', 'dragover'].forEach(evt => {
        dropArea?.addEventListener(evt, () => dropArea.classList.add('dragover'));
    });

    ['dragleave', 'drop'].forEach(evt => {
        dropArea?.addEventListener(evt, () => dropArea.classList.remove('dragover'));
    });

    dropArea?.addEventListener('drop', e => {
        fileInput.files = e.dataTransfer.files;
        if (e.dataTransfer.files[0] && dropMsg) dropMsg.textContent = e.dataTransfer.files[0].name;
    });

    fileInput?.addEventListener('change', e => {
        if (e.target.files.length > 0 && dropMsg) dropMsg.textContent = e.target.files[0].name;
    });

    form.addEventListener('submit', e => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        formData.append('type', conversionType);
        formData.append('csrfmiddlewaretoken', form.querySelector('[name=csrfmiddlewaretoken]').value);

        const submitBtn = form.querySelector('.tool-submit');
        submitBtn.textContent = 'Converting...';
        submitBtn.disabled = true;
        result?.classList.add('hidden');

        fetch('/api/convert/', {
            method: 'POST',
            body: formData,
            headers: { 'X-CSRFToken': formData.get('csrfmiddlewaretoken') }
        })
        .then(res => res.json())
        .then(data => {
            result?.classList.remove('hidden');
            resultMsg.textContent = data.message;

            if (data.success && data.download_url) {
                result.style.backgroundColor = '#D4EDDA';
                result.style.color = '#155724';
                downloadLink.href = data.download_url;
                downloadLink.classList.remove('hidden');
            } else {
                result.style.backgroundColor = '#F8D7DA';
                result.style.color = '#721C24';
                downloadLink.classList.add('hidden');
            }
        })
        .catch(() => {
            result?.classList.remove('hidden');
            resultMsg.textContent = 'An error occurred during conversion.';
            result.style.backgroundColor = '#F8D7DA';
            result.style.color = '#721C24';
            downloadLink.classList.add('hidden');
        })
        .finally(() => {
            submitBtn.textContent = submitBtn.dataset.originalText || 'Convert';
            submitBtn.disabled = false;
        });
    });

    const submitBtn = form.querySelector('.tool-submit');
    if (submitBtn) submitBtn.dataset.originalText = submitBtn.textContent;
});
