// Animated particles system
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    const particleCount = 20;

    // Tech logos and icons to display
            const techLogos = [
                { type: 'text', content: 'AR', color: '#00ff88' },
                { type: 'text', content: 'VR', color: '#00d4ff' },
                { type: 'text', content: 'C#', color: '#ff6b6b' },
                { type: 'text', content: 'JS', color: '#f7df1e' },
                { type: 'icon', content: '🥽', color: '#00ff88' }, // VR Headset
                { type: 'icon', content: '📱', color: '#00d4ff' }, // Mobile
                { type: 'icon', content: '🎮', color: '#ff6b6b' }, // Gaming
                { type: 'icon', content: '🔧', color: '#f7df1e' }, // Tools
                { type: 'icon', content: '⚡', color: '#00ff88' }, // Unity/Engine
                { type: 'icon', content: '🌐', color: '#00d4ff' }, // Web/AR
                { type: 'icon', content: '🤖', color: '#ff6b6b' }, // Android
                { type: 'icon', content: '🎯', color: '#f7df1e' }, // Target/Precision
                { type: 'icon', content: '🚀', color: '#00ff88' }, // Innovation
                { type: 'icon', content: '💻', color: '#00d4ff' }, // Development
                { type: 'icon', content: '🎨', color: '#ff6b6b' }, // Design
                { type: 'text', content: 'XR', color: '#f7df1e' },
                { type: 'text', content: 'AI', color: '#00ff88' },
                { type: 'text', content: '3D', color: '#00d4ff' },
            ];


     for (let i = 0; i < particleCount; i++) {
                const particle = document.createElement('div');
                const logoData = techLogos[Math.floor(Math.random() * techLogos.length)];
                
                particle.className = `particle ${logoData.type === 'text' ? 'text-logo' : 'icon-logo'}`;
                particle.textContent = logoData.content;
                particle.style.color = logoData.color;
                particle.style.left = Math.random() * 100 + '%';
                particle.style.top = Math.random() * 100 + '%';
                particle.style.animationDelay = Math.random() * 6 + 's';
                particle.style.animationDuration = (Math.random() * 4 + 4) + 's';
                
                // Add subtle glow effect
                particle.style.textShadow = `0 0 10px ${logoData.color}`;
                
                // Add rotation animation for some particles
                if (Math.random() > 0.5) {
                    particle.style.animation += `, rotate 8s linear infinite`;
                }
                
                particlesContainer.appendChild(particle);
            }
}

// Smooth scrolling for navigation links
function initSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// Check if element is in viewport
function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

// Handle scroll animations
function handleScrollAnimations() {
    const elements = document.querySelectorAll('.fade-in');
    elements.forEach(el => {
        if (isElementInViewport(el)) {
            el.classList.add('visible');
        }
    });
}

// Header background change on scroll
function handleHeaderScroll() {
    const header = document.querySelector('header');
    if (window.scrollY > 100) {
        header.style.background = 'rgba(0, 0, 0, 0.95)';
    } else {
        header.style.background = 'rgba(0, 0, 0, 0.9)';
    }
}

// Enhanced project card interactions
function addProjectInteractions() {
    const projectCards = document.querySelectorAll('.project-card');
    
    projectCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-15px) rotateX(5deg)';
            this.style.transition = 'all 0.3s ease';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) rotateX(0deg)';
        });

        // Add click effect
        card.addEventListener('click', function() {
            this.style.transform = 'translateY(-10px) scale(0.98)';
            setTimeout(() => {
                this.style.transform = 'translateY(-15px) rotateX(5deg)';
            }, 150);
        });
    });
}

// Enhanced skill card interactions
function addSkillCardInteractions() {
    document.querySelectorAll('.skill-card').forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.05)';
            this.style.transition = 'all 0.3s ease';
            
            // Add glow effect to icon
            const icon = this.querySelector('.skill-icon');
            if (icon) {
                icon.style.textShadow = '0 0 20px #00ff88';
            }
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
            
            // Remove glow effect from icon
            const icon = this.querySelector('.skill-icon');
            if (icon) {
                icon.style.textShadow = 'none';
            }
        });
    });
}

// Add typing effect to hero subtitle
function addTypingEffect() {
    const subtitle = document.querySelector('.hero-content h2');
    const text = subtitle.textContent;
    subtitle.textContent = '';
    
    let i = 0;
    const timer = setInterval(() => {
        if (i < text.length) {
            subtitle.textContent += text.charAt(i);
            i++;
        } else {
            clearInterval(timer);
        }
    }, 100);
}

// Add parallax effect to hero section
function addParallaxEffect() {
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const hero = document.querySelector('.hero');
        const rate = scrolled * -0.5;
        hero.style.transform = `translateY(${rate}px)`;
    });
}

// Add contact link hover effects
function addContactLinkEffects() {
    document.querySelectorAll('.contact-link').forEach(link => {
        link.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px) scale(1.05)';
            this.style.boxShadow = '0 10px 25px rgba(0, 255, 136, 0.3)';
        });
        
        link.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
            this.style.boxShadow = 'none';
        });
    });
}

// Add dynamic particle interaction
function addParticleInteraction() {
    const particles = document.querySelectorAll('.particle');
    
    document.addEventListener('mousemove', (e) => {
        const mouseX = e.clientX / window.innerWidth;
        const mouseY = e.clientY / window.innerHeight;
        
        particles.forEach((particle, index) => {
            const speed = (index % 3 + 1) * 0.5;
            const x = (mouseX - 0.5) * speed;
            const y = (mouseY - 0.5) * speed;
            
            particle.style.transform += ` translate(${x}px, ${y}px)`;
        });
    });
}

// Initialize loading animation
function initLoadingAnimation() {
    const elements = document.querySelectorAll('.fade-in');
    elements.forEach((el, index) => {
        el.style.transitionDelay = `${index * 0.1}s`;
    });
}

// Add navigation highlight on scroll
function addNavigationHighlight() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
    
    window.addEventListener('scroll', () => {
        let current = '';
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (window.pageYOffset >= sectionTop - 200) {
                current = section.getAttribute('id');
            }
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });
}

// Performance optimization for scroll events
function throttle(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize all functionality
function init() {
    // Create particles
    createParticles();
    
    // Initialize interactions
    initSmoothScrolling();
    addProjectInteractions();
    addSkillCardInteractions();
    addContactLinkEffects();
    addNavigationHighlight();
    initLoadingAnimation();
    
    // Add effects with delay to ensure DOM is ready
    setTimeout(() => {
        addTypingEffect();
        addParallaxEffect();
        addParticleInteraction();
    }, 500);
    
    // Initial animation check
    handleScrollAnimations();
}

// Event listeners
document.addEventListener('DOMContentLoaded', init);

// Throttled scroll events for better performance
const throttledScrollHandler = throttle(() => {
    handleScrollAnimations();
    handleHeaderScroll();
}, 16); // ~60fps

window.addEventListener('scroll', throttledScrollHandler);

// Handle window resize
window.addEventListener('resize', throttle(() => {
    handleScrollAnimations();
}, 250));