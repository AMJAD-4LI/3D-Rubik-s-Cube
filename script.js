// ===== Global Variables =====
let scene, camera, renderer, cube;
let cubies = [];
let isAnimating = false;
let rotationSpeed = 0.05;
let moveHistory = [];
let isPaused = false;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let cubeRotation = { x: 0, y: 0 };
let particles = [];
let animationId;
let hintActive = false;
let hintHighlightMesh = null;
let layerHighlight = null;
let activeCubies = [];

// Standard Rubik's Cube colors
const COLORS = {
    white: 0xffffff,
    yellow: 0xffff00,
    red: 0xff0000,
    blue: 0x0000ff,
    green: 0x00ff00,
    orange: 0xff8c00,
    black: 0x111111
};

// ===== Initialize Application =====
document.addEventListener('DOMContentLoaded', () => {
    initLoadingScreen();
    initParticles();
    initThreeJS();
    initControls();
    initEventListeners();
    animate();
});

// ===== Loading Screen =====
function initLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    setTimeout(() => {
        loadingScreen.classList.add('hidden');
    }, 2000);
}

// ===== Background Particles =====
function initParticles() {
    const canvas = document.getElementById('particles-canvas');
    const ctx = canvas.getContext('2d');
    
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2 + 1;
            this.speedX = Math.random() * 0.5 - 0.25;
            this.speedY = Math.random() * 0.5 - 0.25;
            this.opacity = Math.random() * 0.5 + 0.2;
        }

        update() {
            this.x += this.speedX;
            this.y += this.speedY;

            if (this.x > canvas.width) this.x = 0;
            if (this.x < 0) this.x = canvas.width;
            if (this.y > canvas.height) this.y = 0;
            if (this.y < 0) this.y = canvas.height;
        }

        draw() {
            ctx.fillStyle = `rgba(0, 212, 255, ${this.opacity})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Create particles
    for (let i = 0; i < 50; i++) {
        particles.push(new Particle());
    }

    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw gradient background
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#0a0a0f');
        gradient.addColorStop(0.5, '#0f0f1a');
        gradient.addColorStop(1, '#0a0a0f');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        particles.forEach(particle => {
            particle.update();
            particle.draw();
        });

        requestAnimationFrame(animateParticles);
    }
    animateParticles();
}

// ===== Three.js Setup =====
function initThreeJS() {
    const canvas = document.getElementById('cube-canvas');
    const container = canvas.parentElement;

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);

    // Camera
    camera = new THREE.PerspectiveCamera(
        45,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
    );
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ 
        canvas: canvas, 
        antialias: true,
        alpha: true 
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const pointLight1 = new THREE.PointLight(0x00d4ff, 0.5, 100);
    pointLight1.position.set(-10, 10, 10);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x7b2cbf, 0.5, 100);
    pointLight2.position.set(10, -10, -10);
    scene.add(pointLight2);

    // Create Rubik's Cube
    createRubiksCube();

    // Handle resize
    window.addEventListener('resize', onWindowResize);
}

// ===== Create Rubik's Cube =====
function createRubiksCube() {
    cube = new THREE.Group();
    
    const cubieSize = 0.95;
    const gap = 0.05;

    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) {
                const cubie = createCubie(cubieSize);
                cubie.position.set(
                    x * (cubieSize + gap),
                    y * (cubieSize + gap),
                    z * (cubieSize + gap)
                );
                cubie.userData = { 
                    originalPosition: { x, y, z },
                    currentPosition: { x, y, z }
                };
                cubies.push(cubie);
                cube.add(cubie);
            }
        }
    }

    scene.add(cube);
}

// ===== Create Single Cubie =====
function createCubie(size) {
    const geometry = new THREE.BoxGeometry(size, size, size);
    
    // Create materials for each face with proper face tracking
    const materials = [
        new THREE.MeshPhongMaterial({ color: COLORS.orange }),  // Right (index 0)
        new THREE.MeshPhongMaterial({ color: COLORS.red }),    // Left (index 1)
        new THREE.MeshPhongMaterial({ color: COLORS.white }),  // Top (index 2)
        new THREE.MeshPhongMaterial({ color: COLORS.yellow }), // Bottom (index 3)
        new THREE.MeshPhongMaterial({ color: COLORS.green }),  // Front (index 4)
        new THREE.MeshPhongMaterial({ color: COLORS.blue })    // Back (index 5)
    ];

    // Create mesh with different materials for faces
    const mesh = new THREE.Mesh(geometry, materials);
    
    // Add edge geometry for better visual
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    mesh.add(wireframe);

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
}

// ===== Animation Loop =====
function animate() {
    animationId = requestAnimationFrame(animate);

    if (!isPaused && !isAnimating) {
        // Apply cube rotation from mouse/touch
        cube.rotation.x += cubeRotation.x;
        cube.rotation.y += cubeRotation.y;
        
        // Damping
        cubeRotation.x *= 0.95;
        cubeRotation.y *= 0.95;
    }

    renderer.render(scene, camera);
}

// ===== Window Resize Handler =====
function onWindowResize() {
    const canvas = document.getElementById('cube-canvas');
    const container = canvas.parentElement;
    
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

// ===== Cube Rotation Functions =====
function rotateFace(face, direction, animate = true) {
    if (isAnimating) return;
    isAnimating = true;

    const rotationAxis = new THREE.Vector3();
    const cubiesToRotate = [];

    // Determine which cubies to rotate based on face and their current position
    cubies.forEach(cubie => {
        const pos = cubie.userData.currentPosition;
        let shouldRotate = false;

        switch(face) {
            case 'R': // Right face (x = 1)
                if (Math.abs(pos.x - 1) < 0.1) {
                    rotationAxis.set(1, 0, 0);
                    shouldRotate = true;
                }
                break;
            case 'L': // Left face (x = -1)
                if (Math.abs(pos.x - (-1)) < 0.1) {
                    rotationAxis.set(-1, 0, 0);
                    shouldRotate = true;
                }
                break;
            case 'U': // Up face (y = 1)
                if (Math.abs(pos.y - 1) < 0.1) {
                    rotationAxis.set(0, 1, 0);
                    shouldRotate = true;
                }
                break;
            case 'D': // Down face (y = -1)
                if (Math.abs(pos.y - (-1)) < 0.1) {
                    rotationAxis.set(0, -1, 0);
                    shouldRotate = true;
                }
                break;
            case 'F': // Front face (z = 1)
                if (Math.abs(pos.z - 1) < 0.1) {
                    rotationAxis.set(0, 0, 1);
                    shouldRotate = true;
                }
                break;
            case 'B': // Back face (z = -1)
                if (Math.abs(pos.z - (-1)) < 0.1) {
                    rotationAxis.set(0, 0, -1);
                    shouldRotate = true;
                }
                break;
        }

        if (shouldRotate) {
            cubiesToRotate.push(cubie);
        }
    });

    // Highlight the rotating layer
    if (animate) {
        highlightLayer(cubiesToRotate);
    }

    const angle = direction === 'clockwise' ? -Math.PI / 2 : Math.PI / 2;

    if (animate) {
        // Animate rotation using GSAP
        const pivot = new THREE.Group();
        pivot.rotation.set(0, 0, 0);
        scene.add(pivot);

        cubiesToRotate.forEach(cubie => {
            cube.remove(cubie);
            pivot.add(cubie);
        });

        gsap.to(pivot.rotation, {
            x: rotationAxis.x * angle,
            y: rotationAxis.y * angle,
            z: rotationAxis.z * angle,
            duration: 0.4 / (rotationSpeed * 20),
            ease: "power2.inOut",
            onComplete: () => {
                // Update positions and move back to cube
                cubiesToRotate.forEach(cubie => {
                    pivot.remove(cubie);
                    
                    // Apply the rotation to the cubie's world position
                    cubie.position.applyAxisAngle(rotationAxis, angle);
                    cubie.rotation.x += rotationAxis.x * angle;
                    cubie.rotation.y += rotationAxis.y * angle;
                    cubie.rotation.z += rotationAxis.z * angle;

                    // Update current position with proper rounding
                    updateCubiePosition(cubie);
                    
                    cube.add(cubie);
                });

                scene.remove(pivot);
                removeLayerHighlight();
                isAnimating = false;

                // Add to move history
                addMoveToHistory(face, direction);
            }
        });
    } else {
        // Instant rotation (for reset)
        cubiesToRotate.forEach(cubie => {
            cubie.position.applyAxisAngle(rotationAxis, angle);
            cubie.rotation.x += rotationAxis.x * angle;
            cubie.rotation.y += rotationAxis.y * angle;
            cubie.rotation.z += rotationAxis.z * angle;
            updateCubiePosition(cubie);
        });
        isAnimating = false;
    }
}

// ===== Update Cubie Position with Proper Snapping =====
function updateCubiePosition(cubie) {
    // Round to nearest grid position ( -1, 0, or 1 )
    cubie.userData.currentPosition = {
        x: Math.round(cubie.position.x / 1.0) * 1.0,
        y: Math.round(cubie.position.y / 1.0) * 1.0,
        z: Math.round(cubie.position.z / 1.0) * 1.0
    };
    
    // Snap the actual position to grid
    cubie.position.x = cubie.userData.currentPosition.x;
    cubie.position.y = cubie.userData.currentPosition.y;
    cubie.position.z = cubie.userData.currentPosition.z;
}

// ===== Highlight Rotating Layer =====
function highlightLayer(cubies) {
    // Create a highlight effect for the rotating layer
    cubies.forEach(cubie => {
        if (cubie.children.length > 0) {
            const wireframe = cubie.children[0];
            if (wireframe) {
                wireframe.material.color.setHex(0xffd700);
                wireframe.material.linewidth = 3;
            }
        }
    });
}

// ===== Remove Layer Highlight =====
function removeLayerHighlight() {
    cubies.forEach(cubie => {
        if (cubie.children.length > 0) {
            const wireframe = cubie.children[0];
            if (wireframe) {
                wireframe.material.color.setHex(0x000000);
                wireframe.material.linewidth = 2;
            }
        }
    });
}

// ===== Move History =====
function addMoveToHistory(face, direction) {
    const move = face + (direction === 'clockwise' ? '' : "'");
    moveHistory.push(move);
    updateMoveHistoryDisplay();
}

function updateMoveHistoryDisplay() {
    const historyContainer = document.getElementById('move-history');
    
    if (moveHistory.length === 0) {
        historyContainer.innerHTML = '<p class="no-moves">No moves yet</p>';
        return;
    }

    historyContainer.innerHTML = moveHistory.map(move => 
        `<span class="move-item">${move}</span>`
    ).join('');
    
    // Scroll to bottom
    historyContainer.scrollTop = historyContainer.scrollHeight;
}

function clearMoveHistory() {
    moveHistory = [];
    updateMoveHistoryDisplay();
}

// ===== Control Panel Functions =====
function initControls() {
    // Scramble button
    document.getElementById('btn-shuffle').addEventListener('click', shuffleCube);
    
    // Reset button
    document.getElementById('btn-reset').addEventListener('click', resetCube);
    
    // Hint button
    document.getElementById('btn-hint').addEventListener('click', showHint);
    
    // Undo button
    document.getElementById('btn-undo').addEventListener('click', undoLastMove);
    
    // Solve button
    document.getElementById('btn-solve').addEventListener('click', solveCube);
    
    // Pause button
    document.getElementById('btn-pause').addEventListener('click', togglePause);
    
    // Speed slider
    document.getElementById('speed-slider').addEventListener('input', (e) => {
        rotationSpeed = e.target.value / 100;
        document.getElementById('speed-value').textContent = e.target.value;
    });

    // Clear history button
    document.getElementById('btn-clear-history').addEventListener('click', clearMoveHistory);

    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // Panel toggle
    document.getElementById('panel-toggle').addEventListener('click', togglePanel);

    // Mobile menu
    document.getElementById('mobile-menu-btn').addEventListener('click', toggleMobileMenu);
}

// ===== Notification System =====
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const icon = document.getElementById('notification-icon');
    const text = document.getElementById('notification-text');

    // Set icon based on type
    switch(type) {
        case 'success':
            icon.textContent = '✓';
            break;
        case 'warning':
            icon.textContent = '⚠';
            break;
        case 'info':
            icon.textContent = 'ℹ';
            break;
        default:
            icon.textContent = '✓';
    }

    text.textContent = message;
    notification.className = `notification ${type}`;
    
    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
        notification.classList.remove('hidden');
    }, 100);

    // Hide after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        notification.classList.add('hidden');
    }, 3000);
}

// ===== Shuffle Cube =====
function shuffleCube() {
    if (isAnimating) return;
    
    const faces = ['R', 'L', 'U', 'D', 'F', 'B'];
    const directions = ['clockwise', 'counterclockwise'];
    const shuffleMoves = 20;

    let moveIndex = 0;
    const scrambleSequence = [];

    function performNextMove() {
        if (moveIndex >= shuffleMoves) {
            showNotification(`Cube Scrambled! Sequence: ${scrambleSequence.join(' ')}`, 'success');
            return;
        }

        const randomFace = faces[Math.floor(Math.random() * faces.length)];
        const randomDirection = directions[Math.floor(Math.random() * directions.length)];
        const moveNotation = randomFace + (randomDirection === 'counterclockwise' ? "'" : '');
        
        scrambleSequence.push(moveNotation);
        rotateFace(randomFace, randomDirection, true);
        
        moveIndex++;
        
        setTimeout(performNextMove, 500);
    }

    showNotification('Scrambling cube...', 'info');
    performNextMove();
}

// ===== Reset Cube =====
function resetCube() {
    if (isAnimating) return;

    // Remove all cubies
    cubies.forEach(cubie => {
        cube.remove(cubie);
    });
    cubies = [];

    // Recreate cube
    createRubiksCube();

    // Reset rotation
    cube.rotation.set(0, 0, 0);
    cubeRotation = { x: 0, y: 0 };

    // Clear history
    clearMoveHistory();
    
    // Remove hint highlight if active
    removeHintHighlight();
    
    showNotification('Cube reset to original state', 'info');
}

// ===== Undo Last Move =====
function undoLastMove() {
    if (isAnimating || moveHistory.length === 0) {
        if (moveHistory.length === 0) {
            showNotification('No moves to undo', 'warning');
        }
        return;
    }

    const lastMove = moveHistory.pop();
    const face = lastMove[0];
    const direction = lastMove.includes("'") ? 'clockwise' : 'counterclockwise';
    
    rotateFace(face, direction, true);
    
    // Remove from display after rotation
    setTimeout(() => {
        updateMoveHistoryDisplay();
    }, 600);
    
    showNotification(`Undone: ${lastMove}`, 'info');
}

// ===== Hint System =====
function showHint() {
    if (isAnimating) return;
    
    // Remove previous hint
    removeHintHighlight();
    
    if (moveHistory.length === 0) {
        showNotification('Cube is already solved!', 'success');
        return;
    }

    // Simple hint: suggest reversing the last move
    const lastMove = moveHistory[moveHistory.length - 1];
    const face = lastMove[0];
    const isCounterClockwise = lastMove.includes("'");
    
    // The inverse of the last move
    const inverseDirection = isCounterClockwise ? 'clockwise' : 'counterclockwise';
    const suggestedMove = face + (inverseDirection === 'counterclockwise' ? "'" : '');
    
    // Get face name for user-friendly message
    const faceNames = {
        'R': 'Right',
        'L': 'Left',
        'U': 'Top',
        'D': 'Bottom',
        'F': 'Front',
        'B': 'Back'
    };
    
    const directionText = inverseDirection === 'clockwise' ? 'clockwise' : 'counter-clockwise';
    
    // Highlight the affected face cubies
    highlightFaceCubies(face);
    
    // Show notification with hint
    showNotification(`Hint: Rotate ${faceNames[face]} face ${directionText} (${suggestedMove})`, 'warning');
    
    // Activate hint mode on canvas
    document.querySelector('.canvas-container').classList.add('hint-active');
    hintActive = true;
    
    // Remove hint highlight after 4 seconds
    setTimeout(() => {
        removeHintHighlight();
    }, 4000);
}

function highlightFaceCubies(face) {
    // Highlight cubies on the specified face
    cubies.forEach(cubie => {
        const pos = cubie.userData.currentPosition;
        let shouldHighlight = false;

        switch(face) {
            case 'R':
                if (Math.abs(pos.x - 1) < 0.1) shouldHighlight = true;
                break;
            case 'L':
                if (Math.abs(pos.x - (-1)) < 0.1) shouldHighlight = true;
                break;
            case 'U':
                if (Math.abs(pos.y - 1) < 0.1) shouldHighlight = true;
                break;
            case 'D':
                if (Math.abs(pos.y - (-1)) < 0.1) shouldHighlight = true;
                break;
            case 'F':
                if (Math.abs(pos.z - 1) < 0.1) shouldHighlight = true;
                break;
            case 'B':
                if (Math.abs(pos.z - (-1)) < 0.1) shouldHighlight = true;
                break;
        }

        if (shouldHighlight && cubie.children.length > 0) {
            const wireframe = cubie.children[0];
            if (wireframe) {
                wireframe.material.color.setHex(0x00d4ff);
                wireframe.material.linewidth = 4;
            }
        }
    });
}

function removeHintHighlight() {
    // Remove all highlights
    cubies.forEach(cubie => {
        if (cubie.children.length > 0) {
            const wireframe = cubie.children[0];
            if (wireframe) {
                wireframe.material.color.setHex(0x000000);
                wireframe.material.linewidth = 2;
            }
        }
    });
    
    const canvasContainer = document.querySelector('.canvas-container');
    canvasContainer.classList.remove('hint-active');
    hintActive = false;
}

// ===== Solve Cube (Basic Reverse) =====
function solveCube() {
    if (isAnimating || moveHistory.length === 0) {
        if (moveHistory.length === 0) {
            showNotification('Cube is already solved!', 'success');
        }
        return;
    }

    showNotification('Auto-solving cube...', 'info');

    // Reverse the moves
    const reversedMoves = [...moveHistory].reverse();
    clearMoveHistory();

    let moveIndex = 0;

    function performNextMove() {
        if (moveIndex >= reversedMoves.length) {
            showNotification('Cube solved successfully!', 'success');
            return;
        }

        const move = reversedMoves[moveIndex];
        const face = move[0];
        const direction = move.includes("'") ? 'clockwise' : 'counterclockwise';
        
        rotateFace(face, direction, true);
        
        moveIndex++;
        
        setTimeout(performNextMove, 600);
    }

    performNextMove();
}

// ===== Toggle Pause =====
function togglePause() {
    isPaused = !isPaused;
    const btn = document.getElementById('btn-pause');
    
    if (isPaused) {
        btn.innerHTML = '<span class="btn-icon">▶️</span><span class="btn-text">Resume</span>';
    } else {
        btn.innerHTML = '<span class="btn-icon">⏸️</span><span class="btn-text">Pause</span>';
    }
}

// ===== Toggle Theme =====
function toggleTheme() {
    document.body.classList.toggle('light-theme');
    const btn = document.getElementById('theme-toggle');
    const icon = btn.querySelector('.theme-icon');
    const text = btn.querySelector('.theme-text');

    if (document.body.classList.contains('light-theme')) {
        icon.textContent = '☀️';
        text.textContent = 'Light Mode';
        scene.background = new THREE.Color(0xf0f0f5);
    } else {
        icon.textContent = '🌙';
        text.textContent = 'Dark Mode';
        scene.background = new THREE.Color(0x0a0a0f);
    }
}

// ===== Toggle Panel =====
function togglePanel() {
    const panel = document.getElementById('panel-content');
    panel.classList.toggle('collapsed');
}

// ===== Toggle Mobile Menu =====
function toggleMobileMenu() {
    const menu = document.querySelector('.nav-menu');
    const btn = document.getElementById('mobile-menu-btn');
    menu.classList.toggle('open');
    btn.classList.toggle('active');
}

// ===== Mouse/Touch Controls =====
function initEventListeners() {
    const canvas = document.getElementById('cube-canvas');

    // Mouse events
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);

    // Touch events
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);

    // Keyboard controls
    document.addEventListener('keydown', onKeyDown);
}

function onMouseDown(e) {
    if (isAnimating) return;
    isDragging = true;
    previousMousePosition = {
        x: e.clientX,
        y: e.clientY
    };
}

function onMouseMove(e) {
    if (!isDragging || isAnimating) return;

    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;

    cubeRotation.y = deltaX * 0.005;
    cubeRotation.x = deltaY * 0.005;

    previousMousePosition = {
        x: e.clientX,
        y: e.clientY
    };
}

function onMouseUp() {
    isDragging = false;
}

function onTouchStart(e) {
    if (isAnimating) return;
    e.preventDefault();
    isDragging = true;
    previousMousePosition = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
    };
}

function onTouchMove(e) {
    if (!isDragging || isAnimating) return;
    e.preventDefault();

    const deltaX = e.touches[0].clientX - previousMousePosition.x;
    const deltaY = e.touches[0].clientY - previousMousePosition.y;

    cubeRotation.y = deltaX * 0.005;
    cubeRotation.x = deltaY * 0.005;

    previousMousePosition = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
    };
}

function onTouchEnd() {
    isDragging = false;
}

// ===== Keyboard Controls =====
function onKeyDown(e) {
    if (isAnimating) return;

    const key = e.key.toUpperCase();
    const shiftKey = e.shiftKey;
    const direction = shiftKey ? 'counterclockwise' : 'clockwise';

    switch(key) {
        case 'R':
            rotateFace('R', direction);
            break;
        case 'L':
            rotateFace('L', direction);
            break;
        case 'U':
            rotateFace('U', direction);
            break;
        case 'D':
            rotateFace('D', direction);
            break;
        case 'F':
            rotateFace('F', direction);
            break;
        case 'B':
            rotateFace('B', direction);
            break;
    }
}

// ===== Responsive Panel for Mobile =====
function initMobilePanel() {
    const panel = document.querySelector('.control-panel');
    const canvas = document.getElementById('cube-canvas');

    canvas.addEventListener('dblclick', () => {
        if (window.innerWidth <= 1024) {
            panel.classList.toggle('open');
        }
    });
}

// Initialize mobile panel
initMobilePanel();

// ===== Save Cube State to LocalStorage =====
function saveCubeState() {
    const state = {
        cubies: cubies.map(cubie => ({
            position: cubie.position,
            rotation: cubie.rotation
        })),
        moveHistory: moveHistory
    };
    localStorage.setItem('rubiksCubeState', JSON.stringify(state));
}

// ===== Load Cube State from LocalStorage =====
function loadCubeState() {
    const savedState = localStorage.getItem('rubiksCubeState');
    if (savedState) {
        const state = JSON.parse(savedState);
        // Restore state logic here
    }
}

// Auto-save state on window unload
window.addEventListener('beforeunload', saveCubeState);

// Load saved state on init
loadCubeState();
