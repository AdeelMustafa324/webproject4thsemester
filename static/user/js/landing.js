document.addEventListener('DOMContentLoaded', () => {
    const track = document.getElementById('carouselTrack');
    if (!track) return;

    const nextBtn = document.getElementById('nextBtn');
    const prevBtn = document.getElementById('prevBtn');
    let currentIndex = 0;

    const getSlideWidth = () => {
        const slide = track.querySelector('.carousel-slide');
        if (!slide) return 0;
        const style = window.getComputedStyle(track);
        const gap = parseFloat(style.gap) || 0;
        return slide.offsetWidth + gap;
    };

    const getMaxIndex = () => {
        const slides = track.querySelectorAll('.carousel-slide');
        const wrapper = document.querySelector('.carousel-track-wrapper');
        if (!wrapper) return 0;
        const visibleSlides = Math.floor(wrapper.offsetWidth / getSlideWidth());
        return Math.max(0, slides.length - visibleSlides);
    };

    const updateCarousel = () => {
        const maxIndex = getMaxIndex();
        currentIndex = Math.max(0, Math.min(currentIndex, maxIndex));
        track.style.transform = `translateX(-${currentIndex * getSlideWidth()}px)`;
    };

    nextBtn?.addEventListener('click', () => {
        if (currentIndex < getMaxIndex()) {
            currentIndex++;
            updateCarousel();
        }
    });

    prevBtn?.addEventListener('click', () => {
        if (currentIndex > 0) {
            currentIndex--;
            updateCarousel();
        }
    });

    window.addEventListener('resize', updateCarousel);
});
