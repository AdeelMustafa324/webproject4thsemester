// Home Javascript
document.addEventListener('DOMContentLoaded', () => {
    const track = document.getElementById('carouselTrack');
    if (!track) return;
    
    const nextBtn = document.getElementById('nextBtn');
    const prevBtn = document.getElementById('prevBtn');
    
    let currentIndex = 0;
    
    const getSlideWidth = () => {
        const slide = track.querySelector('.carousel-slide');
        if(!slide) return 0;
        const style = window.getComputedStyle(track);
        const gap = parseFloat(style.gap) || 0;
        return slide.offsetWidth + gap;
    };

    const getMaxIndex = () => {
        const slides = track.querySelectorAll('.carousel-slide');
        const containerWidth = document.querySelector('.carousel-track-wrapper').offsetWidth;
        const visibleSlides = Math.floor(containerWidth / getSlideWidth());
        return Math.max(0, slides.length - visibleSlides);
    };

    const updateCarousel = () => {
        const maxIndex = getMaxIndex();
        if (currentIndex > maxIndex) currentIndex = maxIndex;
        if (currentIndex < 0) currentIndex = 0;
        
        const offset = currentIndex * getSlideWidth();
        track.style.transform = `translateX(-${offset}px)`;
    };

    if(nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentIndex < getMaxIndex()) {
                currentIndex++;
                updateCarousel();
            }
        });
    }

    if(prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentIndex > 0) {
                currentIndex--;
                updateCarousel();
            }
        });
    }

    window.addEventListener('resize', updateCarousel);
});
