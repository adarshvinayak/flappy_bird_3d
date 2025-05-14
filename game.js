// Game constants
//const GRAVITY = -0.1;
//const FLAP_FORCE = -5;
const PIPE_WIDTH = 100;
const PIPE_HEIGHT = 1;
const BIRD_SIZE = 20;

const CLOUD_COUNT = 4;
const BASE_PIPE_SPAWN_INTERVAL = 1500;
 
const MAX_PIPE_SPEED_INCREASE = 8;

// Mobile detection
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
console.log(isMobile)

let GRAVITY = isMobile ? -1 : -0.1;
let FLAP_FORCE = isMobile ? -15 : -5;

// Mutable game settings
let frameCount = 0;
let PIPE_SPEED = isMobile ? MOBILE_PIPE_SPEED : 2;
let PIPE_GAP = isMobile ? MOBILE_PIPE_GAP : 200;
let currentGraphicsLevel = 'high';  // Default to high graphics
let musicEnabled = true;  // Default to music enabled

// Difficulty settings
const DIFFICULTY_SETTINGS = {
    'easy': { 
        pipeGap: isMobile ? MOBILE_PIPE_GAP : 230, 
        pipeSpeed: isMobile ? MOBILE_PIPE_SPEED : 2 
    },
    'hard': { 
        pipeGap: isMobile ? MOBILE_PIPE_GAP * 0.75 : 170, 
        pipeSpeed: isMobile ? MOBILE_PIPE_SPEED * 2 : 4.5 
    }
};

let SCENE_WIDTH = isMobile ? 1920 : 1920;
let SCENE_HEIGHT = isMobile ? 1080 : 1080;

// Game state
let score = 0;
let maxScore = 0;
let gameOver = false;
let gameStarted = false;
let bird;
let pipes = [];
let clouds = [];
let velocity = 0;
let lastPipeSpawn = 0;
let scene, camera, renderer;
let scoreDisplay, gameOverScreen, finalScoreDisplay;
let mainMenuScreen;
let background;
let backgroundTexture;
let currentDifficulty = 'easy';
let pipeTexture;
let centuryImage;
let centurySound;
let centuryImageMesh;
let centuryImageShown = false;

// Audio elements
let backgroundMusic;
let menuMusic;
let pointSound;
let selectSound;
let deadSound;

// Add these imports at the top
import { logScore, getLeaderboard } from './supabase.js'

// Initialize audio
function initAudio() {
    // Background music
    backgroundMusic = new Audio('assets/muxic.mp3');
    backgroundMusic.loop = true;
    backgroundMusic.volume = 0.3;

    // Menu music
    menuMusic = new Audio('assets/menumuxic.mp3');
    menuMusic.loop = true;
    menuMusic.volume = 0.7;

    // Sound effects
    pointSound = new Audio('assets/point.mp3');
    pointSound.volume = 0.4;
    
    selectSound = new Audio('assets/select.mp3');
    selectSound.volume = 0.3;
    
    deadSound = new Audio('assets/dead.mp3');
    deadSound.volume = 0.1;

    // Century sound
    centurySound = new Audio('assets/100.mp3');
    centurySound.volume = 1;
}

// Add test function for database operations
async function testDatabaseConnection() {
    try {
        console.log('Testing database connection...');
        
        // Test writing to database
        console.log('Testing database write...');
        const testScore = {
            name: 'Test Player',
            score: 999,
            created_at: new Date().toISOString()
        };

        // Test Easy scores table
        const { data: easyData, error: easyError } = await supabase
            .from('Scores - Easy')
            .insert([testScore])
            .select();

        if (easyError) {
            console.error('Error writing to Easy scores:', easyError);
            return false;
        }
        console.log('Successfully wrote to Easy scores:', easyData);

        // Test Hard scores table
        const { data: hardData, error: hardError } = await supabase
            .from('Scores - Hard')
            .insert([testScore])
            .select();

        if (hardError) {
            console.error('Error writing to Hard scores:', hardError);
            return false;
        }
        console.log('Successfully wrote to Hard scores:', hardData);

        // Test reading from database
        console.log('Testing database read...');
        const { data: easyScores, error: easyReadError } = await supabase
            .from('Scores - Easy')
            .select('*')
            .order('score', { ascending: false })
            .limit(5);

        if (easyReadError) {
            console.error('Error reading Easy scores:', easyReadError);
            return false;
        }
        console.log('Successfully read Easy scores:', easyScores);

        const { data: hardScores, error: hardReadError } = await supabase
            .from('Scores - Hard')
            .select('*')
            .order('score', { ascending: false })
            .limit(5);

        if (hardReadError) {
            console.error('Error reading Hard scores:', hardReadError);
            return false;
        }
        console.log('Successfully read Hard scores:', hardScores);

        return true;
    } catch (error) {
        console.error('Database test failed:', error);
        return false;
    }
}



// Initialize the game
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);

    // Test database connection
    testDatabaseConnection().then(success => {
        if (success) {
            console.log('Database connection test passed!');
        } else {
            console.error('Database connection test failed!');
        }
    });

    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 500;

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game-container').appendChild(renderer.domElement);

    // Load textures
    const textureLoader = new THREE.TextureLoader();
    
    // Load background texture
    textureLoader.load('assets/background.png', (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(3, 1);

        const bgGeometry = new THREE.PlaneGeometry(100, 75);
        const bgMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.BackSide,
            depthWrite: false
        });

        background = new THREE.Mesh(bgGeometry, bgMaterial);
        background.position.z = -50;
        scene.add(background);
        backgroundTexture = texture;
    });
    
    // Load bird texture
    textureLoader.load('assets/birdy.png', (texture) => {
        const birdGeometry = new THREE.PlaneGeometry(BIRD_SIZE * 3, BIRD_SIZE * 2);
        const birdMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true
        });
        bird = new THREE.Mesh(birdGeometry, birdMaterial);
        bird.position.set(-200, 0, 0);
        scene.add(bird);
    });

    // Load pipe texture
    textureLoader.load('assets/brick.jpg', (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 4); // Adjust these values to control texture tiling
        pipeTexture = texture;
    });

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 1, 1);
    scene.add(directionalLight);

    // Get DOM elements
    scoreDisplay = document.getElementById('score-display');
    gameOverScreen = document.getElementById('game-over');
    finalScoreDisplay = document.getElementById('final-score');
    mainMenuScreen = document.getElementById('main-menu');

    // Add event listeners
    document.addEventListener('keydown', handleKeyPress);
    document.addEventListener('click', handleClick);
    
    // Button event listeners
    document.getElementById('restart').onclick = restartGame;
    document.getElementById('main-menu-btn').onclick = showMainMenu;
    document.getElementById('start-game').onclick = startGame;
    
    // Difficulty toggle
    const difficultyButtons = document.querySelectorAll('.difficulty-toggle button');
    difficultyButtons.forEach(button => {
        button.onclick = () => {
            difficultyButtons.forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            setDifficulty(button.id);
        };
    });

    // Graphics toggle
    const graphicsButtons = document.querySelectorAll('.graphics-toggle button');
    graphicsButtons.forEach(button => {
        button.onclick = () => {
            graphicsButtons.forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            setGraphicsLevel(button.id.replace('-graphics', ''));
        };
    });

    // Music toggle 
    const musicButtons = document.querySelectorAll('.sound-toggle button');
    musicButtons.forEach(button => {
        button.onclick = () => {
            musicButtons.forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            toggleMusic(button.id === 'music-on');
        };
    });

    // Initialize audio
    initAudio();
    addButtonSounds();

    // Load preferences from localStorage if available
    const savedGraphicsLevel = localStorage.getItem('graphicsLevel');
    const savedMusicEnabled = localStorage.getItem('musicEnabled');

    if (savedGraphicsLevel) {
        currentGraphicsLevel = savedGraphicsLevel;
        graphicsButtons.forEach(btn => btn.classList.remove('selected'));
        document.getElementById(`${savedGraphicsLevel}-graphics`).classList.add('selected');
        // Apply the graphics settings immediately
        setGraphicsLevel(savedGraphicsLevel);
    } else {
        // Set high graphics as default for first-time users
        setGraphicsLevel('high');
    }


    // Show main menu initially
    showMainMenu();

    // Start animation loop
    animate();

    // Add new event listeners
    document.getElementById('log-score').onclick = handleLogScore;
    document.getElementById('show-leaderboard').onclick = showLeaderboard;
    document.getElementById('view-leaderboard').onclick = showLeaderboard;
    document.getElementById('close-leaderboard').onclick = () => {
        document.getElementById('leaderboard').style.display = 'none';
    };
}

function optimizeForMobile() {
    if (isMobile) {
        // Lower the renderer pixel ratio for better performance
        renderer.setPixelRatio(Math.min(1.0, devicePixelRatio * 0.7));
        
        // Set to lower graphics by default on mobile
        if (!localStorage.getItem('graphicsLevel')) {
            setGraphicsLevel('high');
            document.querySelectorAll('.graphics-toggle button').forEach(btn => {
                btn.classList.remove('selected');
            });
            document.getElementById('high-graphics').classList.add('selected');
        }
    }
}

const PIPE_SPAWN_INTERVAL = isMobile ? 2500 : BASE_PIPE_SPAWN_INTERVAL;

function adjustForDeviceSize() {
    // Calculate appropriate scale based on device width/height
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspectRatio = width / height;
    
    // Adjust camera based on device
    if (isMobile) {
        // Adjust field of view for mobile
        camera.fov = 100; // Wider field of view on mobile
        camera.updateProjectionMatrix();
        
        // Adjust bird position for better visibility
        if (bird) {
            bird.position.x = -150; // Move bird more to the left on mobile
        }
    }
    
    // Adjust scale based on device pixel ratio
    MOBILE_SCALE = isMobile ? Math.min(0.8, 1 / devicePixelRatio) : 1;
    
    // Adjust pipe gap based on screen size
    if (width < 600) {
        PIPE_GAP = DIFFICULTY_SETTINGS[currentDifficulty].pipeGap * 1.2;
    }
}




// Set difficulty
function setDifficulty(difficulty) {
    currentDifficulty = difficulty;
    PIPE_GAP = DIFFICULTY_SETTINGS[difficulty].pipeGap;
    PIPE_SPEED = DIFFICULTY_SETTINGS[difficulty].pipeSpeed;
}

function setGraphicsLevel(level) {
    currentGraphicsLevel = level;
    
    // Update graphics settings based on level
    if (level === 'low') {
        // Completely remove clouds if they exist
        if (clouds) {
            clouds.forEach(cloud => {
                scene.remove(cloud);
            });
            clouds = [];
        }
        
        // Update lighting
        scene.children.forEach(child => {
            if (child.type === 'AmbientLight' || child.type === 'DirectionalLight') {
                child.visible = false;
            }
        });
        
        // Update pipes to use simple materials instead of textures
        pipes.forEach(pipe => {
            if (pipe.top && pipe.top.material) {
                pipe.top.material = new THREE.MeshBasicMaterial({color: 0x8B4513});
            }
            if (pipe.bottom && pipe.bottom.material) {
                pipe.bottom.material = new THREE.MeshBasicMaterial({color: 0x8B4513});
            }
        });
    } 
    
    else if (level === 'high') {
        // Create clouds if they don't exist
        if (clouds.length === 0 && gameStarted) {
            createClouds();
        }
        
        // Update lighting
        scene.children.forEach(child => {
            if (child.type === 'AmbientLight' || child.type === 'DirectionalLight') {
                child.visible = true;
            }
        });
    }
    
    // Save preference to localStorage
    localStorage.setItem('graphicsLevel', level);
}

function toggleMusic(enable) {
    musicEnabled = enable;
    
    // Immediately control all audio elements
    if (enable) {
        // Resume playing appropriate music based on game state
        if (gameStarted && !gameOver) {
            backgroundMusic.play();
        } else if (!gameStarted) {
            menuMusic.play();
        }
        
        // Unmute all sound effects
        pointSound.muted = false;
        selectSound.muted = false;
        deadSound.muted = false;
        if (centurySound) centurySound.muted = false;
    } else {
        // Pause ALL audio when disabled
        backgroundMusic.pause();
        menuMusic.pause();
        
        // Mute all sound effects
        pointSound.muted = true;
        selectSound.muted = true;
        deadSound.muted = true;
        if (centurySound) centurySound.muted = true;
    }
    
    // Save preference to localStorage
    localStorage.setItem('musicEnabled', enable.toString());
}


// Start game
function startGame() {
    mainMenuScreen.style.display = 'none';
    scoreDisplay.style.display = 'block';
    gameStarted = true;
    gameOver = false;
    if (currentGraphicsLevel !== 'low') {
        createClouds();
    }
    resetGame();
    // Stop menu music and start gameplay music
    menuMusic.pause();
    menuMusic.currentTime = 0;
    backgroundMusic.currentTime = 0;
    backgroundMusic.play();
}

// Show main menu
function showMainMenu() {
    gameOverScreen.style.display = 'none';
    mainMenuScreen.style.display = 'block';
    gameStarted = false;
    resetGame();
    // Stop gameplay music and start menu music
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;
    menuMusic.currentTime = 0;
    menuMusic.play();
}

function playBackgroundMusic() {
    if (musicEnabled) {
        backgroundMusic.currentTime = 0;
        backgroundMusic.play();
    }
}

function playMenuMusic() {
    if (musicEnabled) {
        menuMusic.currentTime = 0;
        menuMusic.play();
    }
}

// Reset game state
function resetGame() {
    score = 0;
    gameOver = false;
    velocity = 0;
    scoreDisplay.textContent = `Score: 0 | Max: ${maxScore}`;
    
    // Reset pipe speed to initial difficulty setting
    PIPE_SPEED = DIFFICULTY_SETTINGS[currentDifficulty].pipeSpeed;
    
    if (bird) {
        bird.position.set(-200, 0, 0);
    }
    
    pipes.forEach(pipe => {
        scene.remove(pipe.top);
        scene.remove(pipe.bottom);
    });
    pipes = [];
    
    createBackground();
}

// Restart game
function restartGame() {
    resetGame();
    gameOverScreen.style.display = 'none';
    gameStarted = true;
    // Restart gameplay music
    playBackgroundMusic();
}

// Create background
function createBackground() {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load('assets/background.png', (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(3, 1);
        
        const bgGeometry = new THREE.PlaneGeometry(SCENE_WIDTH * 2, SCENE_HEIGHT);
        const bgMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.FrontSide,
            depthWrite: false
        });
        
        background = new THREE.Mesh(bgGeometry, bgMaterial);
        background.position.z = -100;
        scene.add(background);
    });
}

// Create clouds
function createClouds() {
    // Remove existing clouds
    clouds.forEach(cloud => {
        scene.remove(cloud);
    });
    clouds = [];

    for (let i = 0; i < CLOUD_COUNT; i++) {
        const cloudGeometry = new THREE.SphereGeometry(30, 16, 16);
        const cloudMaterial = new THREE.MeshPhongMaterial({
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0.9,
            shininess: 0
        });
        
        const cloud = new THREE.Group();
        
        // Create multiple spheres to make cloud shape
        const cloudParts = [
            { x: 0, y: 0, scale: 1 },
            { x: -20, y: 10, scale: 0.7 },
            { x: 20, y: 10, scale: 0.7 },
            { x: -40, y: 0, scale: 0.5 },
            { x: 40, y: 0, scale: 0.5 }
        ];
        
        cloudParts.forEach(part => {
            const cloudPart = new THREE.Mesh(cloudGeometry, cloudMaterial);
            cloudPart.position.set(part.x, part.y, 0);
            cloudPart.scale.set(part.scale, part.scale, part.scale);
            cloud.add(cloudPart);
        });
        
        cloud.position.set(
            Math.random() * SCENE_WIDTH - SCENE_WIDTH/2,
            Math.random() * SCENE_HEIGHT - SCENE_HEIGHT/4,
            -50
        );
        
        const scale = 0.5 + Math.random() * 0.5;
        cloud.scale.set(scale, scale, scale);
        
        scene.add(cloud);
        clouds.push(cloud);
    }
}

// Handle spacebar press
function handleKeyPress(event) {
    if (event.code === 'Space') {
        if (gameStarted && !gameOver) {
            flap();
        } else if (gameOver) {
            // Restart game when spacebar is pressed on game over screen
            restartGame();
        }
    }
}

// Handle mouse click
function handleClick(event) {
    if (gameStarted && !gameOver) {
        // Only flap if clicking on the game area (not on UI elements)
        const target = event.target;
        if (target === renderer.domElement) {
            flap();
        }
    }
}

// Make the bird flap
function flap() {
    velocity = -FLAP_FORCE;
}

// Create a new pipe
function createPipe() {
    // Calculate a gap position that's not too close to the edges
    const safeMargin = 250; // Safety margin from edges
    const availableHeight = SCENE_HEIGHT - PIPE_GAP - (2 * safeMargin);
    const gapPosition = (Math.random() * availableHeight) - (SCENE_HEIGHT/2 - PIPE_GAP/2 - safeMargin);
    
    let pipeMaterial;
    
    if (currentGraphicsLevel === 'low') {
        pipeMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x008000
        });
    } else {
        pipeMaterial = new THREE.MeshPhongMaterial({ 
            map: pipeTexture,
            shininess: currentGraphicsLevel === 'high' ? 30 : 5,
            specular: currentGraphicsLevel === 'high' ? 0x000000 : 0x000000
        });
    }
    
    // Create cylinder geometry for pipes
    const pipeRadius = PIPE_WIDTH / 2;
    const pipeSegments = currentGraphicsLevel === 'low' ? 8 : 16;
    const pipeGeometry = new THREE.CylinderGeometry(pipeRadius, pipeRadius, SCENE_HEIGHT, pipeSegments);
    
    // Top pipe
    const topPipe = new THREE.Mesh(pipeGeometry, pipeMaterial);
    topPipe.position.set(SCENE_WIDTH/2, gapPosition + PIPE_GAP/2 + SCENE_HEIGHT/2, 0);
    scene.add(topPipe);
    
    // Bottom pipe
    const bottomPipe = new THREE.Mesh(pipeGeometry, pipeMaterial);
    bottomPipe.position.set(SCENE_WIDTH/2, gapPosition - PIPE_GAP/2 - SCENE_HEIGHT/2, 0);
    scene.add(bottomPipe);
    
    pipes.push({ top: topPipe, bottom: bottomPipe, passed: false });
}

// Check for collisions
function checkCollision() {
    if (!bird) return false;
    
    // Create a slightly smaller bird collision box for better gameplay feel
    const birdBox = new THREE.Box3().setFromObject(bird);
    // Shrink bird collision box slightly for better gameplay feel
    birdBox.min.x += BIRD_SIZE * 0.3;
    birdBox.min.y += BIRD_SIZE * 0.3;
    birdBox.max.x -= BIRD_SIZE * 0.3;
    birdBox.max.y -= BIRD_SIZE * 0.3;
    
    // Check ground and ceiling collisions
    if (bird.position.y > SCENE_HEIGHT/2.8 - BIRD_SIZE || 
        bird.position.y < -SCENE_HEIGHT/2.8 + BIRD_SIZE) {
        return true;
    }
    
    // Check pipe collisions
    for (let pipe of pipes) {
        // Create collision boxes that match the pipe dimensions
        const topBox = new THREE.Box3().setFromObject(pipe.top);
        const bottomBox = new THREE.Box3().setFromObject(pipe.bottom);
        
        // Use a small margin to make collision more forgiving (optional)
        const margin = 5;
        
        // Adjust top pipe collision box - just a slight margin for better gameplay
        topBox.min.x += margin;
        topBox.max.x -= margin;
        
        // Adjust bottom pipe collision box - just a slight margin for better gameplay
        bottomBox.min.x += margin;
        bottomBox.max.x -= margin;
        
        // Use these boxes for collision detection
        if (birdBox.intersectsBox(topBox) || birdBox.intersectsBox(bottomBox)) {
            return true;
        }
    }
    
    return false;
}

// Add this function to handle speed increases
function increasePipeSpeed() {
    // Calculate how much we can increase the speed
    const currentSpeed = PIPE_SPEED;
    const baseSpeed = DIFFICULTY_SETTINGS[currentDifficulty].pipeSpeed;
    const maxAllowedSpeed = baseSpeed + MAX_PIPE_SPEED_INCREASE;
    
    // Only increase if we haven't hit the maximum
    if (currentSpeed < maxAllowedSpeed) {
        PIPE_SPEED += 0.5;
        console.log(`Pipe speed increased to: ${PIPE_SPEED}`);
    }
}

// Modify the updateScore function
function updateScore() {
    for (let pipe of pipes) {
        if (!pipe.passed && pipe.top.position.x < bird.position.x) {
            pipe.passed = true;
            score++;
            if (score > maxScore) {
                maxScore = score;
            }
            scoreDisplay.textContent = `Score: ${score} | Max: ${maxScore}`;
            // Play point sound
            if (!pointSound.muted) {
                pointSound.currentTime = 0;
                pointSound.play();
            }
            // Check if score is a multiple of 5
            if (score % 5 === 0) {
                increasePipeSpeed();
            }

            // Check if score is 10 and century image hasn't been shown yet
            if (score === 100 && !centuryImageShown) {
                showCenturyImage();
            }
        }
    }
}

// Game over
function endGame() {
    gameOver = true;
    // Play death sound
    deadSound.currentTime = 0;
    deadSound.play();
    backgroundMusic.pause();
    
    // Freeze bird momentarily
    const dropStartPosition = bird.position.y;
    
    gameOverTimeout = setTimeout(() => {
        // Animate bird dropping
        function dropBird() {
            bird.position.y -= 10; // Drop speed
            
            // Check if bird has reached bottom
            if (bird.position.y <= -SCENE_HEIGHT/1.5) {
                cancelAnimationFrame(dropAnimation);
                gameOverScreen.style.display = 'block';
                finalScoreDisplay.textContent = `Your Score: ${score}`;
            } else {
                dropAnimation = requestAnimationFrame(dropBird);
            }
        }
        
        let dropAnimation = requestAnimationFrame(dropBird);
    }, 100);
}

// Add click sound to all buttons
function addButtonSounds() {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            if (!selectSound.muted) {
                selectSound.currentTime = 0;
                selectSound.play();
            }
        });
    });
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Skip frames on mobile for better performance
    if (isMobile) {
        // Only process every other frame on mobile
        if (frameCount % 2 !== 0) {
            frameCount++;
            renderer.render(scene, camera);
            return;
        }
        frameCount++;
    }
    
    if (gameStarted && !gameOver) {
        // Update bird
        velocity += GRAVITY;
        bird.position.y += velocity;
        bird.rotation.z = Math.min(Math.max(velocity * 0.1, -Math.PI/4), Math.PI/4);
        
        // Scroll background
        if (backgroundTexture) {
            backgroundTexture.offset.x -= 0.0015;
        }
        
        // Move century image if it exists
        if (centuryImageMesh) {
            centuryImageMesh.position.x -= PIPE_SPEED * 1.5;
            if (centuryImageMesh.position.x < -SCENE_WIDTH/2 - 300) {
                scene.remove(centuryImageMesh);
                centuryImageMesh = null;
            }
        }
        
        // Only move clouds if not in low graphics mode
        if (currentGraphicsLevel !== 'low') {
            clouds.forEach(cloud => {
                cloud.position.x -= PIPE_SPEED * 0.2;
                if (cloud.position.x <= -SCENE_WIDTH/2 - 100) {
                    cloud.position.x = SCENE_WIDTH/2 + 100;
                    cloud.position.y = Math.random() * SCENE_HEIGHT - SCENE_HEIGHT/4;
                }
            });
        }
        
        // Spawn and update pipes
        const now = Date.now();
        if (now - lastPipeSpawn > PIPE_SPAWN_INTERVAL) {
            createPipe();
            lastPipeSpawn = now;
        }
        
        for (let i = pipes.length - 1; i >= 0; i--) {
            const pipe = pipes[i];
            pipe.top.position.x -= PIPE_SPEED;
            pipe.bottom.position.x -= PIPE_SPEED;
            
            if (pipe.top.position.x < -SCENE_WIDTH/2 - PIPE_WIDTH) {
                scene.remove(pipe.top);
                scene.remove(pipe.bottom);
                pipes.splice(i, 1);
            }
        }
        
        if (checkCollision()) {
            endGame();
        }
        
        updateScore();
    }
    
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Add these functions to handle leaderboard and score logging
async function showLeaderboard() {
    const leaderboard = document.getElementById('leaderboard');
    const easyTable = document.getElementById('easy-leaderboard').querySelector('tbody');
    const hardTable = document.getElementById('hard-leaderboard').querySelector('tbody');
    
    // Clear existing data
    easyTable.innerHTML = '';
    hardTable.innerHTML = '';
    
    // Get leaderboard data
    const data = await getLeaderboard();
    
    // Populate easy scores
    data.easy.forEach((score, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${score.name}</td>
            <td>${score.score}</td>
            <td>${new Date(score.created_at).toLocaleDateString()}</td>
        `;
        easyTable.appendChild(row);
    });
    
    // Populate hard scores
    data.hard.forEach((score, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${score.name}</td>
            <td>${score.score}</td>
            <td>${new Date(score.created_at).toLocaleDateString()}</td>
        `;
        hardTable.appendChild(row);
    });
    
    leaderboard.style.display = 'block';
}

async function handleLogScore() {
    const nameInput = document.getElementById('player-name');
    const name = nameInput.value.trim();
    
    const success = await logScore(currentDifficulty, name, score);
    if (success) {
        alert('Score logged successfully!');
        nameInput.value = '';
    } else {
        alert('Failed to log score. Please try again.');
    }
}

// Add new function to show century image
function showCenturyImage() {
    centuryImageShown = true;
    // Play century sound
    if (centurySound && !centurySound.muted) {
        centurySound.currentTime = 0;
        centurySound.play();
        console.log("Century sound played");
    } else {
        console.log("Century sound not available");
    }
    
    // Load and create century image
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load('100x.jpeg', (texture) => {
        const imageGeometry = new THREE.PlaneGeometry(300, 250);
        const imageMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        centuryImageMesh = new THREE.Mesh(imageGeometry, imageMaterial);
        centuryImageMesh.position.set(SCENE_WIDTH/2, 0, -40);
        scene.add(centuryImageMesh);
    });
}

// Start the game
init();
