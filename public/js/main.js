// 3D Lattice Background System
class LatticePoint {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.baseX = x;
        this.baseY = y;
        this.baseZ = z;
        this.connections = [];
        this.animationOffset = Math.random() * Math.PI * 2;
        this.glowIntensity = Math.random() * 0.5 + 0.5;
    }
    
    update(time) {
        // Subtle floating animation
        const floatAmount = 2;
        this.x = this.baseX + Math.sin(time * 0.001 + this.animationOffset) * floatAmount;
        this.y = this.baseY + Math.cos(time * 0.0008 + this.animationOffset) * floatAmount;
        this.z = this.baseZ + Math.sin(time * 0.0012 + this.animationOffset) * floatAmount;
    }
}

class LatticeBackground {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.points = [];
        this.animationId = null;
        this.lastTime = 0;
        
        this.colors = {
            purple: 'rgba(139, 92, 246, ',
            indigo: 'rgba(99, 102, 241, ',
            teal: 'rgba(20, 184, 166, ',
            pink: 'rgba(236, 72, 153, '
        };
        
        this.init();
        this.setupEventListeners();
    }
    
    init() {
        this.resize();
        this.generateLattice();
        this.animate();
    }
    
    resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        this.ctx.scale(dpr, dpr);
        this.width = rect.width;
        this.height = rect.height;
    }
    
    generateLattice() {
        this.points = [];
        
        // Responsive grid spacing and performance optimization
        const isMobile = window.innerWidth < 768;
        const isTablet = window.innerWidth < 1024;
        
        const spacing = isMobile ? 80 : isTablet ? 70 : 60;
        const layers = isMobile ? 2 : 3; // Reduce layers on mobile for performance
        const maxPoints = isMobile ? 150 : isTablet ? 300 : 500; // Limit points for performance
        
        const cols = Math.ceil(this.width / spacing) + 2;
        const rows = Math.ceil(this.height / spacing) + 2;
        
        // Generate grid points with performance limits
        let pointCount = 0;
        for (let layer = 0; layer < layers && pointCount < maxPoints; layer++) {
            for (let row = 0; row < rows && pointCount < maxPoints; row++) {
                for (let col = 0; col < cols && pointCount < maxPoints; col++) {
                    const x = col * spacing - spacing;
                    const y = row * spacing - spacing;
                    const z = (layer - 1) * 50; // Z-depth
                    
                    const point = new LatticePoint(x, y, z);
                    this.points.push(point);
                    pointCount++;
                }
            }
        }
        
        // Generate connections
        this.generateConnections();
    }
    
    generateConnections() {
        const maxDistance = 120;
        
        this.points.forEach(point => {
            point.connections = [];
            
            this.points.forEach(otherPoint => {
                if (point === otherPoint) return;
                
                const dx = point.baseX - otherPoint.baseX;
                const dy = point.baseY - otherPoint.baseY;
                const dz = point.baseZ - otherPoint.baseZ;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (distance < maxDistance && Math.random() > 0.7) {
                    point.connections.push({
                        point: otherPoint,
                        distance: distance,
                        strength: 1 - (distance / maxDistance)
                    });
                }
            });
        });
    }
    
    animate(currentTime = 0) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Update points
        this.points.forEach(point => point.update(currentTime));
        
        // Draw connections
        this.drawConnections();
        
        // Draw points
        this.drawPoints();
        
        this.animationId = requestAnimationFrame((time) => this.animate(time));
    }
    
    drawConnections() {
        this.points.forEach(point => {
            point.connections.forEach(connection => {
                const opacity = connection.strength * 0.3;
                const colorKeys = Object.keys(this.colors);
                const colorKey = colorKeys[Math.floor(Math.random() * colorKeys.length)];
                
                this.ctx.strokeStyle = this.colors[colorKey] + opacity + ')';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.moveTo(point.x, point.y);
                this.ctx.lineTo(connection.point.x, connection.point.y);
                this.ctx.stroke();
            });
        });
    }
    
    drawPoints() {
        this.points.forEach(point => {
            const size = 2 + (point.z + 50) / 50; // Size based on Z-depth
            const opacity = (0.4 + (point.z + 50) / 100) * point.glowIntensity;
            
            // Glow effect
            const gradient = this.ctx.createRadialGradient(
                point.x, point.y, 0,
                point.x, point.y, size * 3
            );
            
            const colorKeys = Object.keys(this.colors);
            const colorKey = colorKeys[Math.floor(point.animationOffset * colorKeys.length) % colorKeys.length];
            
            gradient.addColorStop(0, this.colors[colorKey] + opacity + ')');
            gradient.addColorStop(1, this.colors[colorKey] + '0)');
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, size * 3, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Core point
            this.ctx.fillStyle = this.colors[colorKey] + (opacity * 2) + ')';
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
    
    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.resize();
            this.generateLattice();
        });
        
        // Pause animation when page is not visible
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (this.animationId) {
                    cancelAnimationFrame(this.animationId);
                }
            } else {
                this.animate();
            }
        });
    }
    
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        window.removeEventListener('resize', this.resize);
    }
}

// Initialize lattice background
let latticeBackground;

// Smooth scrolling for navigation links
document.addEventListener('DOMContentLoaded', function() {
    // Initialize 3D Lattice Background
    const canvas = document.getElementById('lattice-canvas');
    if (canvas) {
        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        if (!prefersReducedMotion) {
            latticeBackground = new LatticeBackground(canvas);
        }
    }
    // Add smooth scrolling to all links with href starting with #
    const links = document.querySelectorAll('a[href^="#"]');
    
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                const headerOffset = 80; // Account for sticky navbar
                const elementPosition = targetElement.offsetTop;
                const offsetPosition = elementPosition - headerOffset;
                
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Add animation on scroll for feature cards
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe all feature cards for animation
    const featureCards = document.querySelectorAll('.feature-card, .api-card, .doc-card');
    featureCards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });
    
    // Add download tracking (optional)
    const downloadBtn = document.querySelector('.download-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
            // Track download event (you can add analytics here)
            console.log('WordPress plugin download initiated');
        });
    }
    
    // Add copy functionality for API examples
    const apiExamples = document.querySelectorAll('.api-example pre');
    apiExamples.forEach(example => {
        example.style.position = 'relative';
        example.style.cursor = 'pointer';
        example.title = 'Click to copy';
        
        example.addEventListener('click', function() {
            const text = this.textContent;
            navigator.clipboard.writeText(text).then(() => {
                // Create temporary feedback
                const feedback = document.createElement('div');
                feedback.textContent = 'Copied!';
                feedback.style.position = 'absolute';
                feedback.style.top = '10px';
                feedback.style.right = '10px';
                feedback.style.backgroundColor = '#28a745';
                feedback.style.color = 'white';
                feedback.style.padding = '5px 10px';
                feedback.style.borderRadius = '3px';
                feedback.style.fontSize = '12px';
                feedback.style.zIndex = '10';
                
                this.appendChild(feedback);
                
                setTimeout(() => {
                    feedback.remove();
                }, 1500);
            });
        });
    });
}); 