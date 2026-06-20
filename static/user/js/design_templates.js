/* ============ SkipStep Design Templates Gallery ============ */
(function() {
  'use strict';

  // Built-in template data
  // Each template has a Fabric.js JSON structure that gets loaded into the Design Studio
  const TEMPLATES = [
    // Social Media
    {
      id: 'sm-1', title: 'Modern Social Post', category: 'social-media',
      size: '1080×1080', width: 1080, height: 1080,
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      canvasJson: {
        version: '5.3.1',
        objects: [
          { type: 'rect', left: 0, top: 0, width: 1080, height: 1080, fill: '#667eea', selectable: false },
          { type: 'i-text', left: 140, top: 350, text: 'YOUR\nMESSAGE\nHERE', fontSize: 96, fontWeight: 'bold', fontFamily: 'Plus Jakarta Sans', fill: '#ffffff', lineHeight: 1.1 },
          { type: 'rect', left: 140, top: 680, width: 200, height: 4, fill: '#f3b942', rx: 2, ry: 2 },
          { type: 'i-text', left: 140, top: 720, text: '@yourbrand', fontSize: 28, fontFamily: 'Plus Jakarta Sans', fill: 'rgba(255,255,255,0.7)' },
        ],
        background: '#667eea'
      }
    },
    {
      id: 'sm-2', title: 'Gradient Story', category: 'social-media',
      size: '1080×1920', width: 1080, height: 1920,
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      canvasJson: {
        version: '5.3.1',
        objects: [
          { type: 'i-text', left: 100, top: 700, text: 'Tell Your\nStory', fontSize: 80, fontWeight: 'bold', fontFamily: 'Plus Jakarta Sans', fill: '#ffffff', lineHeight: 1.15 },
          { type: 'i-text', left: 100, top: 920, text: 'Share your journey with the world.\nSwipe up to learn more.', fontSize: 24, fontFamily: 'Plus Jakarta Sans', fill: 'rgba(255,255,255,0.7)', lineHeight: 1.6 },
          { type: 'circle', left: 480, top: 1700, radius: 30, fill: '#ffffff', opacity: 0.3 },
        ],
        background: '#f5576c'
      }
    },
    {
      id: 'sm-3', title: 'Bold Quote Post', category: 'social-media',
      size: '1080×1080', width: 1080, height: 1080,
      gradient: 'linear-gradient(135deg, #0a192f 0%, #16294a 100%)',
      canvasJson: {
        version: '5.3.1',
        objects: [
          { type: 'i-text', left: 540, top: 120, text: '"', fontSize: 200, fontFamily: 'Georgia', fill: '#f3b942', originX: 'center' },
          { type: 'i-text', left: 100, top: 340, text: 'Design is not just\nwhat it looks like.\nDesign is how\nit works.', fontSize: 56, fontWeight: 'bold', fontFamily: 'Plus Jakarta Sans', fill: '#ffffff', lineHeight: 1.3 },
          { type: 'i-text', left: 100, top: 780, text: '— Steve Jobs', fontSize: 28, fontFamily: 'Plus Jakarta Sans', fill: '#f3b942' },
          { type: 'rect', left: 100, top: 750, width: 60, height: 3, fill: '#f3b942' },
        ],
        background: '#0a192f'
      }
    },
    {
      id: 'sm-4', title: 'Sale Announcement', category: 'social-media',
      size: '1080×1080', width: 1080, height: 1080,
      gradient: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
      canvasJson: {
        version: '5.3.1',
        objects: [
          { type: 'i-text', left: 540, top: 200, text: 'FLASH', fontSize: 120, fontWeight: 'bold', fontFamily: 'Plus Jakarta Sans', fill: '#ffffff', originX: 'center' },
          { type: 'i-text', left: 540, top: 340, text: 'SALE', fontSize: 160, fontWeight: '800', fontFamily: 'Plus Jakarta Sans', fill: '#f3b942', originX: 'center' },
          { type: 'i-text', left: 540, top: 540, text: 'UP TO', fontSize: 32, fontFamily: 'Plus Jakarta Sans', fill: 'rgba(255,255,255,0.8)', originX: 'center' },
          { type: 'i-text', left: 540, top: 590, text: '70% OFF', fontSize: 100, fontWeight: 'bold', fontFamily: 'Plus Jakarta Sans', fill: '#ffffff', originX: 'center' },
          { type: 'i-text', left: 540, top: 780, text: 'Limited Time Only', fontSize: 24, fontFamily: 'Plus Jakarta Sans', fill: 'rgba(255,255,255,0.6)', originX: 'center' },
        ],
        background: '#e74c3c'
      }
    },

    // Presentations
    {
      id: 'pres-1', title: 'Startup Pitch Deck', category: 'presentation',
      size: '1920×1080', width: 1920, height: 1080,
      gradient: 'linear-gradient(135deg, #0a192f 0%, #1d3557 100%)',
      canvasJson: {
        version: '5.3.1',
        objects: [
          { type: 'i-text', left: 120, top: 350, text: 'YOUR\nSTARTUP', fontSize: 96, fontWeight: '800', fontFamily: 'Plus Jakarta Sans', fill: '#ffffff', lineHeight: 1.1 },
          { type: 'rect', left: 120, top: 600, width: 100, height: 5, fill: '#f3b942', rx: 3, ry: 3 },
          { type: 'i-text', left: 120, top: 640, text: 'Investor Pitch Deck 2026', fontSize: 28, fontFamily: 'Plus Jakarta Sans', fill: 'rgba(255,255,255,0.5)' },
          { type: 'circle', left: 1400, top: 200, radius: 250, fill: 'rgba(243,185,66,0.08)' },
          { type: 'circle', left: 1500, top: 600, radius: 180, fill: 'rgba(243,185,66,0.05)' },
        ],
        background: '#0a192f'
      }
    },
    {
      id: 'pres-2', title: 'Creative Portfolio', category: 'presentation',
      size: '1920×1080', width: 1920, height: 1080,
      gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      canvasJson: {
        version: '5.3.1',
        objects: [
          { type: 'i-text', left: 960, top: 400, text: 'PORTFOLIO', fontSize: 100, fontWeight: '800', fontFamily: 'Plus Jakarta Sans', fill: '#ffffff', originX: 'center' },
          { type: 'i-text', left: 960, top: 530, text: 'Creative Works & Projects', fontSize: 28, fontFamily: 'Plus Jakarta Sans', fill: 'rgba(255,255,255,0.4)', originX: 'center' },
          { type: 'rect', left: 860, top: 620, width: 200, height: 3, fill: '#f093fb' },
        ],
        background: '#1a1a2e'
      }
    },

    // Posters
    {
      id: 'post-1', title: 'Event Poster', category: 'poster',
      size: '1080×1520', width: 1080, height: 1520,
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      canvasJson: {
        version: '5.3.1',
        objects: [
          { type: 'i-text', left: 540, top: 200, text: 'DESIGN\nCONFERENCE', fontSize: 80, fontWeight: '800', fontFamily: 'Plus Jakarta Sans', fill: '#ffffff', originX: 'center', textAlign: 'center', lineHeight: 1.1 },
          { type: 'i-text', left: 540, top: 440, text: '2026', fontSize: 120, fontWeight: '800', fontFamily: 'Plus Jakarta Sans', fill: 'rgba(255,255,255,0.2)', originX: 'center' },
          { type: 'i-text', left: 540, top: 700, text: 'JUNE 25-27\nSAN FRANCISCO', fontSize: 32, fontFamily: 'Plus Jakarta Sans', fill: 'rgba(255,255,255,0.8)', originX: 'center', textAlign: 'center', lineHeight: 1.6 },
          { type: 'rect', left: 340, top: 950, width: 400, height: 60, rx: 30, ry: 30, fill: '#ffffff' },
          { type: 'i-text', left: 540, top: 965, text: 'Register Now', fontSize: 22, fontWeight: 'bold', fontFamily: 'Plus Jakarta Sans', fill: '#0a192f', originX: 'center' },
        ],
        background: '#4facfe'
      }
    },
    {
      id: 'post-2', title: 'Music Festival', category: 'poster',
      size: '1080×1520', width: 1080, height: 1520,
      gradient: 'linear-gradient(135deg, #e91e63 0%, #9c27b0 100%)',
      canvasJson: {
        version: '5.3.1',
        objects: [
          { type: 'i-text', left: 540, top: 300, text: 'SUMMER\nFEST', fontSize: 100, fontWeight: '800', fontFamily: 'Plus Jakarta Sans', fill: '#ffffff', originX: 'center', textAlign: 'center', lineHeight: 1.05 },
          { type: 'i-text', left: 540, top: 560, text: '✦', fontSize: 48, fill: '#f3b942', originX: 'center' },
          { type: 'i-text', left: 540, top: 700, text: 'LIVE MUSIC • FOOD • ART', fontSize: 22, fontFamily: 'Plus Jakarta Sans', fill: 'rgba(255,255,255,0.7)', originX: 'center', letterSpacing: 200 },
          { type: 'i-text', left: 540, top: 850, text: 'July 15-17, 2026', fontSize: 28, fontWeight: 'bold', fontFamily: 'Plus Jakarta Sans', fill: '#ffffff', originX: 'center' },
        ],
        background: '#9c27b0'
      }
    },

    // Business Cards
    {
      id: 'bc-1', title: 'Minimal Business Card', category: 'business-card',
      size: '1050×600', width: 1050, height: 600,
      gradient: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
      canvasJson: {
        version: '5.3.1',
        objects: [
          { type: 'rect', left: 0, top: 0, width: 8, height: 600, fill: '#f3b942' },
          { type: 'i-text', left: 60, top: 180, text: 'JOHN DOE', fontSize: 36, fontWeight: '800', fontFamily: 'Plus Jakarta Sans', fill: '#0a192f' },
          { type: 'i-text', left: 60, top: 235, text: 'Senior Designer', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fill: '#6b7689', letterSpacing: 200 },
          { type: 'rect', left: 60, top: 290, width: 40, height: 3, fill: '#f3b942' },
          { type: 'i-text', left: 60, top: 340, text: '+1 (555) 123-4567\njohn@company.com\nwww.company.com', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fill: '#6b7689', lineHeight: 2 },
        ],
        background: '#ffffff'
      }
    },
    {
      id: 'bc-2', title: 'Dark Premium Card', category: 'business-card',
      size: '1050×600', width: 1050, height: 600,
      gradient: 'linear-gradient(135deg, #0a192f 0%, #16294a 100%)',
      canvasJson: {
        version: '5.3.1',
        objects: [
          { type: 'i-text', left: 60, top: 160, text: 'JANE SMITH', fontSize: 36, fontWeight: '800', fontFamily: 'Plus Jakarta Sans', fill: '#ffffff' },
          { type: 'i-text', left: 60, top: 215, text: 'Creative Director', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fill: '#f3b942', letterSpacing: 200 },
          { type: 'rect', left: 60, top: 270, width: 40, height: 3, fill: '#f3b942' },
          { type: 'i-text', left: 60, top: 320, text: 'jane@studio.com • +1 555 987 6543', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fill: 'rgba(255,255,255,0.5)' },
          { type: 'circle', left: 850, top: 100, radius: 200, fill: 'rgba(243,185,66,0.05)' },
        ],
        background: '#0a192f'
      }
    },

    // Resumes
    {
      id: 'res-1', title: 'Professional Resume', category: 'resume',
      size: '2480×3508', width: 2480, height: 3508,
      gradient: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)',
      canvasJson: {
        version: '5.3.1',
        objects: [
          { type: 'rect', left: 0, top: 0, width: 2480, height: 500, fill: '#0a192f' },
          { type: 'i-text', left: 200, top: 150, text: 'ALEX JOHNSON', fontSize: 72, fontWeight: '800', fontFamily: 'Plus Jakarta Sans', fill: '#ffffff' },
          { type: 'i-text', left: 200, top: 260, text: 'Full Stack Developer', fontSize: 28, fontFamily: 'Plus Jakarta Sans', fill: '#f3b942' },
          { type: 'i-text', left: 200, top: 340, text: 'alex@email.com • (555) 123-4567 • linkedin.com/in/alex', fontSize: 20, fontFamily: 'Plus Jakarta Sans', fill: 'rgba(255,255,255,0.5)' },
          { type: 'i-text', left: 200, top: 600, text: 'EXPERIENCE', fontSize: 24, fontWeight: 'bold', fontFamily: 'Plus Jakarta Sans', fill: '#0a192f', letterSpacing: 300 },
          { type: 'rect', left: 200, top: 650, width: 80, height: 3, fill: '#f3b942' },
        ],
        background: '#ffffff'
      }
    },

    // Flyers
    {
      id: 'fly-1', title: 'Workshop Flyer', category: 'flyer',
      size: '1080×1520', width: 1080, height: 1520,
      gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      canvasJson: {
        version: '5.3.1',
        objects: [
          { type: 'i-text', left: 540, top: 200, text: 'FREE\nWORKSHOP', fontSize: 80, fontWeight: '800', fontFamily: 'Plus Jakarta Sans', fill: '#0a192f', originX: 'center', textAlign: 'center', lineHeight: 1.1 },
          { type: 'i-text', left: 540, top: 450, text: 'Learn Design Thinking', fontSize: 28, fontFamily: 'Plus Jakarta Sans', fill: '#0a192f', originX: 'center', opacity: 0.7 },
          { type: 'rect', left: 240, top: 600, width: 600, height: 60, rx: 10, ry: 10, fill: '#0a192f' },
          { type: 'i-text', left: 540, top: 615, text: 'JUNE 30, 2026 • 2:00 PM', fontSize: 20, fontWeight: 'bold', fontFamily: 'Plus Jakarta Sans', fill: '#43e97b', originX: 'center' },
          { type: 'i-text', left: 540, top: 780, text: 'Limited Seats Available\nRegister at workshop.com', fontSize: 20, fontFamily: 'Plus Jakarta Sans', fill: 'rgba(10,25,47,0.5)', originX: 'center', textAlign: 'center', lineHeight: 1.8 },
        ],
        background: '#43e97b'
      }
    },

    // Invitations
    {
      id: 'inv-1', title: 'Elegant Invitation', category: 'invitation',
      size: '1080×1520', width: 1080, height: 1520,
      gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
      canvasJson: {
        version: '5.3.1',
        objects: [
          { type: 'i-text', left: 540, top: 250, text: "You're Invited", fontSize: 56, fontFamily: 'Georgia', fontStyle: 'italic', fill: '#ffffff', originX: 'center' },
          { type: 'i-text', left: 540, top: 370, text: '✦', fontSize: 32, fill: '#f3b942', originX: 'center' },
          { type: 'i-text', left: 540, top: 470, text: 'CELEBRATION\nDINNER', fontSize: 64, fontWeight: '800', fontFamily: 'Plus Jakarta Sans', fill: '#ffffff', originX: 'center', textAlign: 'center', lineHeight: 1.2 },
          { type: 'i-text', left: 540, top: 700, text: 'Saturday, July 20th\n7:00 PM\nThe Grand Ballroom', fontSize: 22, fontFamily: 'Plus Jakarta Sans', fill: 'rgba(255,255,255,0.8)', originX: 'center', textAlign: 'center', lineHeight: 1.8 },
          { type: 'i-text', left: 540, top: 950, text: 'RSVP by July 10th', fontSize: 18, fontFamily: 'Plus Jakarta Sans', fill: 'rgba(255,255,255,0.5)', originX: 'center' },
        ],
        background: '#a18cd1'
      }
    },

    // Logos
    {
      id: 'logo-1', title: 'Modern Logo Template', category: 'logo',
      size: '1080×1080', width: 1080, height: 1080,
      gradient: 'linear-gradient(135deg, #0a192f 0%, #0a192f 100%)',
      canvasJson: {
        version: '5.3.1',
        objects: [
          { type: 'polygon', left: 430, top: 280, fill: '#f3b942', stroke: '', points: [{x:110,y:0},{x:220,y:60},{x:220,y:180},{x:110,y:240},{x:0,y:180},{x:0,y:60}] },
          { type: 'i-text', left: 540, top: 580, text: 'BRAND', fontSize: 64, fontWeight: '800', fontFamily: 'Plus Jakarta Sans', fill: '#ffffff', originX: 'center', letterSpacing: 500 },
          { type: 'i-text', left: 540, top: 660, text: 'STUDIO', fontSize: 24, fontFamily: 'Plus Jakarta Sans', fill: 'rgba(255,255,255,0.4)', originX: 'center', letterSpacing: 800 },
        ],
        background: '#0a192f'
      }
    },
    {
      id: 'logo-2', title: 'Minimal Logo', category: 'logo',
      size: '1080×1080', width: 1080, height: 1080,
      gradient: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
      canvasJson: {
        version: '5.3.1',
        objects: [
          { type: 'circle', left: 440, top: 280, radius: 100, fill: '', stroke: '#0a192f', strokeWidth: 6 },
          { type: 'i-text', left: 540, top: 375, text: 'S', fontSize: 80, fontWeight: '800', fontFamily: 'Plus Jakarta Sans', fill: '#0a192f', originX: 'center' },
          { type: 'i-text', left: 540, top: 540, text: 'STUDIO', fontSize: 48, fontWeight: '800', fontFamily: 'Plus Jakarta Sans', fill: '#0a192f', originX: 'center', letterSpacing: 600 },
          { type: 'rect', left: 420, top: 610, width: 240, height: 3, fill: '#f3b942' },
          { type: 'i-text', left: 540, top: 640, text: 'CREATIVE AGENCY', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fill: '#6b7689', originX: 'center', letterSpacing: 500 },
        ],
        background: '#ffffff'
      }
    },
  ];

  // ============ INIT ============
  function init() {
    renderTemplates(TEMPLATES);
    bindCategoryTabs();
    bindSearch();
  }

  // ============ RENDER ============
  function renderTemplates(templates) {
    const grid = document.getElementById('templateGrid');
    const noResults = document.getElementById('noResults');
    if (!grid) return;

    grid.innerHTML = '';
    if (templates.length === 0) {
      noResults.style.display = '';
      return;
    }
    noResults.style.display = 'none';

    templates.forEach(tpl => {
      const card = document.createElement('article');
      card.className = 'tpl-card';
      card.dataset.category = tpl.category;

      card.innerHTML = `
        <div class="tpl-card-preview">
          <div class="tpl-card-preview-img" style="background:${tpl.gradient};"></div>
          <div class="tpl-card-overlay">
            <button class="tpl-use-btn" data-id="${tpl.id}"><i class="lucide lucide-wand-2"></i> Use Template</button>
          </div>
        </div>
        <div class="tpl-card-body">
          <div class="tpl-card-category tpl-badge-${tpl.category}">${formatCategory(tpl.category)}</div>
          <div class="tpl-card-title">${tpl.title}</div>
          <div class="tpl-card-size">${tpl.size}</div>
        </div>
      `;

      card.querySelector('.tpl-use-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        useTemplate(tpl);
      });

      card.addEventListener('click', () => useTemplate(tpl));
      grid.appendChild(card);
    });
  }

  function formatCategory(cat) {
    return cat.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  function useTemplate(tpl) {
    // Store template data in sessionStorage and redirect to design studio
    sessionStorage.setItem('skipstep_template', JSON.stringify({
      title: tpl.title,
      canvasJson: tpl.canvasJson,
      width: tpl.width,
      height: tpl.height,
    }));
    window.location.href = '/design-studio/';
  }

  // ============ CATEGORY TABS ============
  function bindCategoryTabs() {
    document.querySelectorAll('.tpl-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tpl-cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const cat = btn.dataset.cat;

        if (cat === 'all') {
          renderTemplates(TEMPLATES);
        } else {
          renderTemplates(TEMPLATES.filter(t => t.category === cat));
        }
      });
    });
  }

  // ============ SEARCH ============
  function bindSearch() {
    const input = document.getElementById('templateSearch');
    if (!input) return;

    input.addEventListener('input', () => {
      const q = input.value.toLowerCase().trim();
      const activeCat = document.querySelector('.tpl-cat-btn.active')?.dataset.cat || 'all';

      let filtered = TEMPLATES;
      if (activeCat !== 'all') {
        filtered = filtered.filter(t => t.category === activeCat);
      }
      if (q) {
        filtered = filtered.filter(t =>
          t.title.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
        );
      }
      renderTemplates(filtered);
    });
  }

  // ============ START ============
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
