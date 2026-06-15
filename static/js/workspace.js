// Workspace JS
document.addEventListener('DOMContentLoaded', () => {
    
    // Editor Format Selection
    const formatBtns = document.querySelectorAll('.format-btn');
    const editorContainer = document.getElementById('editorContainer');

    formatBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            formatBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const format = btn.getAttribute('data-format');
            
            // Simulate loading the respective editor API
            editorContainer.innerHTML = `
                <div class="mock-editor">
                    <div class="mock-toolbar">
                        SkipStep Live Editor API - ${format.charAt(0).toUpperCase() + format.slice(1)} Mode
                    </div>
                    <div class="mock-canvas">
                        <div class="mock-document">
                            <h3>Start editing your ${format} template...</h3>
                        </div>
                    </div>
                </div>
            `;
        });
    });

    // File Upload Drag & Drop
    const fileDropArea = document.getElementById('fileDropArea');
    const fileInput = document.getElementById('fileInput');
    const dropMsg = document.querySelector('.drop-msg');

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        fileDropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        fileDropArea.addEventListener(eventName, () => fileDropArea.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        fileDropArea.addEventListener(eventName, () => fileDropArea.classList.remove('dragover'), false);
    });

    fileDropArea.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        fileInput.files = files;
        updateFileText(files[0].name);
    });

    fileInput.addEventListener('change', (e) => {
        if(e.target.files.length > 0) {
            updateFileText(e.target.files[0].name);
        }
    });

    function updateFileText(name) {
        dropMsg.textContent = name;
    }

    // Document Converter Form Submission
    const converterForm = document.getElementById('converterForm');
    const converterResult = document.getElementById('converterResult');
    const converterMsg = document.getElementById('converterMsg');
    const downloadLink = document.getElementById('downloadLink');

    if(converterForm) {
        converterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const formData = new FormData(converterForm);
            const submitBtn = converterForm.querySelector('button[type="submit"]');
            
            submitBtn.textContent = 'Converting...';
            submitBtn.disabled = true;
            
            fetch('/api/convert/', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRFToken': formData.get('csrfmiddlewaretoken')
                }
            })
            .then(response => response.json())
            .then(data => {
                converterResult.classList.remove('hidden');
                converterMsg.textContent = data.message;
                
                if(data.success && data.download_url) {
                    converterResult.style.backgroundColor = '#D4EDDA';
                    converterResult.style.color = '#155724';
                    downloadLink.href = data.download_url;
                    downloadLink.classList.remove('hidden');
                } else {
                    converterResult.style.backgroundColor = '#F8D7DA';
                    converterResult.style.color = '#721C24';
                    downloadLink.classList.add('hidden');
                }
            })
            .catch(err => {
                converterResult.classList.remove('hidden');
                converterMsg.textContent = 'An error occurred during conversion.';
                converterResult.style.backgroundColor = '#F8D7DA';
                converterResult.style.color = '#721C24';
                downloadLink.classList.add('hidden');
            })
            .finally(() => {
                submitBtn.textContent = 'Convert Document';
                submitBtn.disabled = false;
            });
        });
    }
});
