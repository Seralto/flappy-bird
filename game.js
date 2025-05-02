// Canvas setup
// Get the canvas element and its drawing context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game constants
// These values set the size, physics, and layout of the game
const WIDTH = 288;           // Canvas width
const HEIGHT = 512;          // Canvas height
const GROUND_HEIGHT = 112;   // Height of the ground/base
const GRAVITY = 0.25;        // Gravity affecting the bird
const JUMP = -4.5;           // Bird jump velocity
const PIPE_GAP = 100;        // Vertical gap between pipes
const PIPE_DISTANCE = 140;   // Horizontal distance between pipes
const PIPE_WIDTH = 52;       // Pipe sprite width
const PIPE_HEIGHT = 320;     // Pipe sprite height
const BIRD_WIDTH = 34;       // Bird sprite width
const BIRD_HEIGHT = 24;      // Bird sprite height
const BASE_Y = HEIGHT - GROUND_HEIGHT; // Y position of the ground

// Asset loading
// Sprite and audio asset file paths
// These objects map logical names to asset file locations
const spriteNames = {
  background: 'sprites/background-day.png',
  base: 'sprites/base.png',
  bird: [
    'sprites/yellowbird-upflap.png',
    'sprites/yellowbird-midflap.png',
    'sprites/yellowbird-downflap.png',
  ],
  pipeTop: 'sprites/pipe-green.png',
  pipeBottom: 'sprites/pipe-green.png',
  message: 'sprites/message.png',
  gameover: 'sprites/gameover.png',
  numbers: [
    'sprites/0.png','sprites/1.png','sprites/2.png','sprites/3.png','sprites/4.png',
    'sprites/5.png','sprites/6.png','sprites/7.png','sprites/8.png','sprites/9.png'
  ]
};
const audioNames = {
  die: 'audio/die.wav',     // Bird death sound
  hit: 'audio/hit.wav',     // Collision sound
  point: 'audio/point.wav', // Score sound
  swoosh: 'audio/swoosh.wav', // Start/restart sound
  wing: 'audio/wing.wav',   // Bird flap sound
};

// These objects will hold loaded Image and Audio objects for use in the game
const sprites = {};
const audios = {};

// Loads all sprites and audio assets asynchronously
// Calls the callback when everything is loaded
function loadAssets(callback) {
  let loaded = 0;
  // Total number of assets to load
  const total = Object.keys(spriteNames).length + Object.keys(audioNames).length;

  // Load sprites
  for (const key in spriteNames) {
    if (Array.isArray(spriteNames[key])) {
      // If the asset is an array (e.g. animation frames), load each one
      sprites[key] = [];
      spriteNames[key].forEach((src, i) => {
        const img = new Image();
        img.src = src;
        img.onload = () => { loaded++; if (loaded === total) callback(); };
        sprites[key][i] = img;
      });
    } else {
      // Otherwise, load the single image
      const img = new Image();
      img.src = spriteNames[key];
      img.onload = () => { loaded++; if (loaded === total) callback(); };
      sprites[key] = img;
    }
  }
  // Load audio files
  for (const key in audioNames) {
    const audio = new Audio(audioNames[key]);
    audio.oncanplaythrough = () => { loaded++; if (loaded === total) callback(); };
    audios[key] = audio;
  }
}

// Game state constants
// Splash: waiting to start, Game: playing, Over: game ended
const STATE = { Splash: 0, Game: 1, Over: 2 };
let gameState = STATE.Splash; // Current game state
let score = 0;                // Current score

let pipes = [];               // Array of pipe objects
let bird, baseX, frame, pipeSpawnTimer; // Game variables

// Resets all game variables to start a new game or return to splash
function resetGame() {
  score = 0;
  pipes = [];
  bird = {
    x: 60,            // Bird's horizontal position
    y: HEIGHT/2,      // Bird's vertical position
    vy: 0,            // Bird's vertical velocity
    frame: 0,         // Animation frame
    rot: 0,           // Rotation angle
    radius: 12        // Used for collision detection
  };
  baseX = 0;          // Ground/base X offset
  frame = 0;          // Animation frame counter
  pipeSpawnTimer = 0; // Timer for spawning pipes
}

// Adds a new pipe pair to the pipes array at a random vertical position
function spawnPipe() {
  const topY = Math.floor(Math.random() * (HEIGHT - GROUND_HEIGHT - PIPE_GAP - 80)) + 40;
  pipes.push({
    x: WIDTH,         // Start at the right edge
    top: topY,        // Y position of the top of the gap
    bottom: topY + PIPE_GAP // Y position of the bottom of the gap
  });
}

// Draws the background image
function drawBackground() {
  ctx.drawImage(sprites.background, 0, 0);
}

// Draws the scrolling ground/base
function drawBase() {
  ctx.drawImage(sprites.base, baseX, BASE_Y);
  ctx.drawImage(sprites.base, baseX + WIDTH, BASE_Y);
}

// Draws the bird with rotation and animation
function drawBird() {
  const birdSprite = sprites.bird[Math.floor(bird.frame/5)%3];
  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(bird.rot);
  ctx.drawImage(birdSprite, -BIRD_WIDTH/2, -BIRD_HEIGHT/2);
  ctx.restore();
}

// Draws all pipes (upper is flipped vertically)
function drawPipes() {
  pipes.forEach(pipe => {
    // Draw upper pipe (flipped vertically)
    ctx.save();
    ctx.translate(pipe.x + PIPE_WIDTH / 2, pipe.top - PIPE_HEIGHT + PIPE_HEIGHT / 2);
    ctx.scale(1, -1);
    ctx.drawImage(
      sprites.pipeTop,
      -PIPE_WIDTH / 2,
      -PIPE_HEIGHT / 2,
      PIPE_WIDTH,
      PIPE_HEIGHT
    );
    ctx.restore();

    // Draw lower pipe (normal)
    ctx.drawImage(
      sprites.pipeBottom,
      pipe.x,
      pipe.bottom,
      PIPE_WIDTH,
      PIPE_HEIGHT
    );
  });
}

// Draws the current score centered at the top
function drawScore() {
  const scoreStr = score.toString();
  let width = 0;
  for (let i = 0; i < scoreStr.length; i++) {
    width += sprites.numbers[+scoreStr[i]].width;
  }
  let x = (WIDTH - width)/2;
  for (let i = 0; i < scoreStr.length; i++) {
    ctx.drawImage(sprites.numbers[+scoreStr[i]], x, 50);
    x += sprites.numbers[+scoreStr[i]].width;
  }
}

// Draws the splash/start message
function drawMessage() {
  ctx.drawImage(sprites.message, (WIDTH-sprites.message.width)/2, 80);
}

// Draws the game over message
function drawGameOver() {
  ctx.drawImage(sprites.gameover, (WIDTH-sprites.gameover.width)/2, 150);
}

// Plays a sound effect by name
function playAudio(name) {
  if (audios[name]) {
    audios[name].currentTime = 0;
    audios[name].play();
  }
}

// Updates all game logic (bird, pipes, collisions, score)
function update() {
  frame++;
  if (gameState === STATE.Game) {
    // Bird physics: apply gravity and update position
    bird.vy += GRAVITY;
    bird.y += bird.vy;
    // Set animation frame based on velocity
    if (bird.vy >= JUMP) bird.frame = 1; // Downflap
    else if (bird.vy < 0) bird.frame = 0; // Upflap
    else bird.frame = 2; // Midflap
    // Rotate bird for visual effect
    bird.rot = Math.min(Math.PI/4, bird.vy/10);

    // Pipes logic
    pipeSpawnTimer++;
    if (pipeSpawnTimer > PIPE_DISTANCE) {
      spawnPipe();
      pipeSpawnTimer = 0;
    }
    pipes.forEach(pipe => { pipe.x -= 2; }); // Move pipes left
    // Remove pipes that have gone off screen
    if (pipes.length && pipes[0].x < -PIPE_WIDTH) pipes.shift();

    // Collision detection
    pipes.forEach(pipe => {
      // Check if bird is within pipe X range
      if (bird.x + bird.radius > pipe.x && bird.x - bird.radius < pipe.x + PIPE_WIDTH) {
        // Check collision with upper or lower pipe
        if (bird.y - bird.radius < pipe.top || bird.y + bird.radius > pipe.bottom) {
          gameState = STATE.Over;
          playAudio('hit');
          setTimeout(() => playAudio('die'), 300);
        }
      }
      // Score logic: if bird passes a pipe
      if (!pipe.passed && bird.x > pipe.x + PIPE_WIDTH) {
        score++;
        pipe.passed = true;
        playAudio('point');
      }
    });
    // Collision with ground
    if (bird.y + bird.radius > BASE_Y) {
      bird.y = BASE_Y - bird.radius;
      gameState = STATE.Over;
      playAudio('hit');
      setTimeout(() => playAudio('die'), 300);
    }
  }
  
  // Move base/ground to create scrolling effect
  baseX = (baseX - 2) % WIDTH;
}

// Renders all game elements in the correct order
function render() {
  drawBackground();
  drawPipes();
  drawBase();
  drawBird();
  if (gameState === STATE.Splash) drawMessage();
  if (gameState === STATE.Game || gameState === STATE.Over) drawScore();
  if (gameState === STATE.Over) drawGameOver();
}

// Main game loop: updates logic and renders, then requests next frame
function loop() {
  update();
  render();
  requestAnimationFrame(loop);
}

// Handles user input for flapping and starting/restarting the game
function flap() {
  if (gameState === STATE.Splash) {
    resetGame();              // Start a new game
    gameState = STATE.Game;
    bird.vy = JUMP;           // Make the bird flap immediately
    playAudio('wing');
  } else if (gameState === STATE.Game) {
    bird.vy = JUMP;           // Flap (jump)
    playAudio('wing');
  } else if (gameState === STATE.Over) {
    resetGame();              // Return to splash screen
    gameState = STATE.Splash;
    playAudio('swoosh');
  }
}

// Listen for user input: spacebar, mouse click, or touch to flap
// These controls work on both desktop and mobile
// Spacebar
document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.key === ' ') flap();
});
// Mouse click
document.addEventListener('mousedown', flap);

// Start the game when assets are loaded
loadAssets(() => {
  resetGame();
  loop();
});
