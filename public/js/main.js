// 3D Lattice Background System with True 3D Layers and Scroll Rotation
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
        this.screenX = 0;
        this.screenY = 0;
        this.screenZ = 0;
        this.visible = true;
    }
    
    // 3D rotation and projection
    project(rotationX, rotationY, rotationZ, centerX, centerY) {
        // Apply 3D rotations (no centering offset here - we want the lattice to extend infinitely)
        let x = this.baseX;
        let y = this.baseY;
        let z = this.baseZ;
        
        // Rotation around Y axis (left-right)
        let cosY = Math.cos(rotationY);
        let sinY = Math.sin(rotationY);
        let tempX = x * cosY - z * sinY;
        let tempZ = x * sinY + z * cosY;
        x = tempX;
        z = tempZ;
        
        // Rotation around X axis (up-down)
        let cosX = Math.cos(rotationX);
        let sinX = Math.sin(rotationX);
        let tempY = y * cosX - z * sinX;
        tempZ = y * sinX + z * cosX;
        y = tempY;
        z = tempZ;
        
        // Rotation around Z axis (roll)
        let cosZ = Math.cos(rotationZ);
        let sinZ = Math.sin(rotationZ);
        tempX = x * cosZ - y * sinZ;
        tempY = x * sinZ + y * cosZ;
        x = tempX;
        y = tempY;
        
        // 3D to 2D projection with perspective
        const perspective = 800;
        const scale = perspective / (perspective + z);
        
        this.screenX = (x * scale) + centerX;
        this.screenY = (y * scale) + centerY;
        this.screenZ = z;
        this.visible = z > -400; // Only show points not too far behind
        
        return scale;
    }
    
    update(time, rotationX, rotationY, rotationZ, centerX, centerY) {
        // Subtle floating animation
        const floatAmount = 1;
        this.baseX = this.x + Math.sin(time * 0.0008 + this.animationOffset) * floatAmount;
        this.baseY = this.y + Math.cos(time * 0.0006 + this.animationOffset) * floatAmount;
        this.baseZ = this.z + Math.sin(time * 0.001 + this.animationOffset) * floatAmount;
        
        // Project to screen coordinates
        return this.project(rotationX, rotationY, rotationZ, centerX, centerY);
    }
}

class LatticeBackground {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.points = [];
        this.animationId = null;
        this.lastTime = 0;
        this.scrollY = 0;
        this.rotationX = 0;
        this.rotationY = 0;
        this.rotationZ = 0;
        
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
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
    }
    
    generateLattice() {
        this.points = [];
        
        // Create infinite-appearing 3D lattice that covers entire screen
        const isMobile = window.innerWidth < 768;
        const isTablet = window.innerWidth < 1024;
        
        const spacing = isMobile ? 100 : isTablet ? 80 : 70;
        const layers = isMobile ? 6 : isTablet ? 8 : 10; // More layers for true 3D effect
        
        // Calculate grid size to cover screen plus extra for infinite effect
        const extraSpace = 400; // Extra space beyond screen edges
        const cols = Math.ceil((this.width + extraSpace * 2) / spacing);
        const rows = Math.ceil((this.height + extraSpace * 2) / spacing);
        
        // Generate 3D lattice that extends beyond screen boundaries
        for (let layer = 0; layer < layers; layer++) {
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    // Position points to cover screen area plus extra space
                    const x = (col * spacing) - extraSpace - (this.width / 2);
                    const y = (row * spacing) - extraSpace - (this.height / 2);
                    const z = (layer - layers/2) * spacing;
                    
                    const point = new LatticePoint(x, y, z);
                    this.points.push(point);
                }
            }
        }
        
        // Generate connections between nearby points
        this.generateConnections();
    }
    
    generateConnections() {
        const maxDistance = window.innerWidth < 768 ? 120 : 100;
        
        this.points.forEach(point => {
            point.connections = [];
            
            this.points.forEach(otherPoint => {
                if (point === otherPoint) return;
                
                const dx = point.x - otherPoint.x;
                const dy = point.y - otherPoint.y;
                const dz = point.z - otherPoint.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                // Connect to nearby points (creating lattice structure)
                if (distance < maxDistance && distance > 0) {
                    point.connections.push({
                        point: otherPoint,
                        distance: distance,
                        strength: 1 - (distance / maxDistance)
                    });
                }
            });
        });
    }
    
    updateRotation() {
        // Scroll-based rotation for revealing 3D depth
        const scrollProgress = window.scrollY / (document.body.scrollHeight - window.innerHeight);
        
        this.rotationY = scrollProgress * Math.PI * 2; // Full rotation based on scroll
        this.rotationX = Math.sin(scrollProgress * Math.PI) * 0.3; // Subtle X rotation
        this.rotationZ = scrollProgress * 0.2; // Slight roll
    }
    
    animate(currentTime = 0) {
        this.lastTime = currentTime;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Update rotation based on scroll
        this.updateRotation();
        
        // Update and project all points
        const projectedPoints = [];
        this.points.forEach(point => {
            const scale = point.update(currentTime, this.rotationX, this.rotationY, this.rotationZ, this.centerX, this.centerY);
            if (point.visible) {
                projectedPoints.push({ point, scale });
            }
        });
        
        // Sort points by Z-depth for proper rendering
        projectedPoints.sort((a, b) => b.point.screenZ - a.point.screenZ);
        
        // Draw connections first (behind points)
        this.drawConnections(projectedPoints);
        
        // Draw points on top
        this.drawPoints(projectedPoints);
        
        this.animationId = requestAnimationFrame((time) => this.animate(time));
    }
    
    drawConnections(projectedPoints) {
        projectedPoints.forEach(({ point }) => {
            point.connections.forEach(connection => {
                if (!connection.point.visible) return;
                
                // Much more subtle white connections
                const depthOpacity = Math.max(0.05, 1 - Math.abs(point.screenZ) / 300);
                const opacity = connection.strength * depthOpacity * 0.08; // Reduced from 0.2 to 0.08
                
                this.ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
                this.ctx.lineWidth = 0.5;
                this.ctx.beginPath();
                this.ctx.moveTo(point.screenX, point.screenY);
                this.ctx.lineTo(connection.point.screenX, connection.point.screenY);
                this.ctx.stroke();
            });
        });
    }
    
    drawPoints(projectedPoints) {
        projectedPoints.forEach(({ point, scale }) => {
            // Much more subtle white nodes with reduced opacity
            const baseSize = 2;
            const size = baseSize * scale;
            const depthOpacity = Math.max(0.05, 1 - Math.abs(point.screenZ) / 400);
            const opacity = depthOpacity * 0.25; // Reduced from 0.6 to 0.25 for subtlety
            
            // Very subtle glow effect
            const gradient = this.ctx.createRadialGradient(
                point.screenX, point.screenY, 0,
                point.screenX, point.screenY, size * 3 // Reduced glow radius
            );
            
            gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity * 0.8})`);
            gradient.addColorStop(0.7, `rgba(255, 255, 255, ${opacity * 0.3})`);
            gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);
            
            // Draw subtle glow
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(point.screenX, point.screenY, size * 3, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Draw very subtle core point
            this.ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 1.2})`; // Reduced brightness
            this.ctx.beginPath();
            this.ctx.arc(point.screenX, point.screenY, size * 0.8, 0, Math.PI * 2); // Slightly smaller core
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