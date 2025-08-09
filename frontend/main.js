// Custom Cursor
const cursor = document.querySelector('.cursor');

document.addEventListener('mousemove', (e) => {
    cursor.style.left = e.pageX + 'px';
    cursor.style.top = e.pageY + 'px';
});

// Cursor grow effect when hovering over clickable elements
const clickables = document.querySelectorAll('a, button, input[type="submit"], .service-card, .swiper-slide');

clickables.forEach(item => {
    item.addEventListener('mouseover', () => {
        cursor.classList.add('cursor-grow');
    });
    item.addEventListener('mouseleave', () => {
        cursor.classList.remove('cursor-grow');
    });
});

// Header scroll effect with hide on scroll down, show on scroll up
let lastScrollTop = 0;
const header = document.getElementById('header');
if (header) { // Check if header exists
    window.addEventListener('scroll', () => {
        let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        if (scrollTop > lastScrollTop && scrollTop > 50) {
            // Scrolling down
            header.style.transform = 'translateY(-100%)';
        } else {
            // Scrolling up
            header.style.transform = 'translateY(0)';
        }
        lastScrollTop = scrollTop <= 0 ? 0 : scrollTop; // For Mobile or negative scrolling

        // Also toggle scrolled class for styling
        if (scrollTop > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
}

// Animation on scroll - Only needed on home page
if (document.querySelector('.hero')) {
    const animateOnScroll = () => {
        const elements = document.querySelectorAll('.hero h1, .hero p, .btn');
        
        elements.forEach(element => {
            const elementPosition = element.getBoundingClientRect().top;
            const screenPosition = window.innerHeight / 1.3;
            
            if (elementPosition < screenPosition) {
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }
        });
    };
    
    // Set initial state for animated elements
    document.querySelectorAll('.hero h1, .hero p, .btn').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'all 0.6s ease';
    });
    
    window.addEventListener('load', animateOnScroll);
    window.addEventListener('scroll', animateOnScroll);
}