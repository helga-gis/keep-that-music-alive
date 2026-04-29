let video;
let handpose, bodyPose, faceMesh;
let hands = [], bodies = [], faces = [];
let zones = [];
let biteSound, appleImg, pearImg;
const FRUIT_TYPES = ['apple', 'pear'];
const PROMPTS = ['Left Hand', 'Right Hand', 'Nose', 'Left Shoulder', 'Right Shoulder', 'Mouth', 'Left Ear', 'Right Ear'];
let activePrompt = null;
const PROMPT_TIMEOUT = 5000; // 5 sec
let promptStartTime = 0;
const PROMPT_COOLDOWN = 2500; // 2.5
let promptCooldownStart = 0;
let promptOnCooldown = false;

//visuals
let bubbles = [];
let lastGlideTime = 0;
const GLIDE_COOLDOWN = 500; // 0.5 sec

let confettis = [];
let eater, snakeTarget;

let holding = false;

// sound effect
let glideOsc, kickOsc, snareNoise;

let extraLives = 3;
const MAX_LIVES = 5;
let promptScore = 0;  // body prompt completions
let fruitScore = 0;   // fruits eaten
let gameState = 'start'; // 'start', 'playing', 'gameover'
let gameoverTime = 0; // for reset, restart 

class Bubble {
  constructor(x, y) {
    this.x = x + random(-30, 30);
    this.y = y;
    this.r = random(8, 24);
    this.vx = random(-1, 1);
    this.vy = random(-2, -4);
    this.alpha = 200;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= 3;
  }
  draw() {
    push();
    noFill();
    stroke(200, 230, 255, this.alpha);
    strokeWeight(1.5);
    circle(this.x, this.y, this.r * 2);
    pop();
  }
  isDead() { return this.alpha <= 0; }
}

class Confetti {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = random(4, 12);
    this.speedX = random(-3, 3);
    this.speedY = random(-4, -1);
    this.c = color(random(255), random(255), random(255));
  }
  update() {
    this.x += this.speedX;
    this.speedX *= 0.99;
    this.y += this.speedY;
    this.speedY += 0.15;
  }
  draw() {
    push();
    fill(this.c);
    noStroke();
    circle(this.x, this.y, this.size);
    pop();
  }
  isDead() { return this.y > height; }
}

// Audio — one oscillator per zone
let oscillators = [];
const OSC_TYPES = ['sine', 'triangle', 'square', 'sawtooth'];

// Pentatonic scale: C D E G A 
const PENTA = [0, 2, 4, 7, 9];
const ROOT  = 60; // C4

// 4 zones
let ZONE_OCTAVES = [0, -12, 12, -12]; // sine C4, triangle C3, square C5, sawtooth C3
const ZONE_COLORS  = [
  [200, 160, 255],  // sine: purple
  [160, 210, 255],  // triangle: blue
  [255, 210, 140],  // square: amber
  [140, 255, 180],  // sawtooth: green
];
// Fixed patterns pantatonic
const ZONE_PATTERNS = [
  [0, 2, 4, 2, 4, 7, 4, 2],  // sine
  [7, 4, 9, 7, 4, 2, 0, 2],  // triangle
  [7, 0, 7, 4, 2, 9, 7, 0],  // square
  [0, 0, 0, 7, 0, 0, 0, 7],  // sawtooth
];

// Note sequences & playback state
let noteSeqs   = [[], [], [], []];
let pendingSeq = [null, null, null, null]; // for Magenta results
let noteIdx    = [0, 0, 0, 0];
let noteTimer  = 0;
const BEAT     = 20;  // frames per note


// Magenta MusicRNN
let musicRNN;
let magentaReady = false;



////////////////////////////////////////////////
class SnakeTarget {
  constructor() {
    this.x = random(width);
    this.y = random(height);
    this.r = 18;
    this.pulse = 0;
    this.type = random(FRUIT_TYPES);
  }
  update() {
    this.pulse = (this.pulse + 0.08) % TWO_PI;  //glowing
  }
  draw() {
    let glowR = this.r + sin(this.pulse) * 5;   //outer
    noStroke();
    for (let i = 3; i > 0; i--) {
      fill(255, 220, 80, 30 * i);
      circle(this.x, this.y, (glowR + i * 8) * 2);
    }

    fill(255, 220, 80, 220);    //circle
    circle(this.x, this.y, glowR * 2);

    let img;  //image
    if (this.type === 'apple') {
      img = appleImg;
    } else {
      img = pearImg;
    }

    let imgSize = this.r * 2.2;
    imageMode(CENTER);
    image(img, this.x, this.y, imgSize, imgSize);

    imageMode(CORNER);
  }
  relocate() {
    this.x = random(50, width - 50);
    this.y = random(50, height - 50);
    this.type = random(FRUIT_TYPES);
  }
}

class Eater {
  constructor() {
    this.x = width / 2;
    this.y = height / 2;
    this.speed = 3;
    this.dia = 60;
    this.direction = "RIGHT";
  }
  update() {
    if (this.direction === "RIGHT")      this.x += this.speed;
    else if (this.direction === "DOWN")  this.y += this.speed;
    else if (this.direction === "LEFT")  this.x -= this.speed;
    else if (this.direction === "UP")    this.y -= this.speed;

    this.x = (this.x + width) % width;
    this.y = (this.y + height) % height;
  }

  turnRight(){
    if(this.direction == "RIGHT"){
      this.direction = "DOWN";
    } else if(this.direction == "DOWN"){
      this.direction = "LEFT";
    } else if(this.direction == "LEFT"){
      this.direction = "UP";
    } else if(this.direction == "UP"){
      this.direction = "RIGHT";
    }
  }

  draw() {
    let ox = holding ? random(-5, 5) : 0;
    let oy = holding ? random(-5, 5) : 0;
    fill(100, 220, 255, 220);
    noStroke();
    circle(this.x + ox, this.y + oy, this.dia);
    textAlign(CENTER, CENTER);
    textSize(32);
    text("🐍", this.x + ox, this.y + oy);
  }
  checkEat(target) {
    let d = dist(this.x, this.y, target.x, target.y);
    if (d < this.dia / 2 + target.r) {
      fruitScore++;
      let oldX = target.x;
      let oldY = target.y;  //restore oldX,Y
      target.relocate();
      if (biteSound) biteSound.play();
        for (let i = 0; i < 40; i++) confettis.push(new Confetti(oldX, oldY));  //confetti old xy
          if (extraLives < MAX_LIVES) extraLives++;
    }
  }
}

////////////////////////////////////////////////
function preload() {
  //ml5.js
  handpose = ml5.handPose({ flipped: true });   //flipped: mirror
  bodyPose = ml5.bodyPose('MoveNet', { flipped: true });
  faceMesh = ml5.faceMesh({ maxFaces: 1, flipped: true });

  biteSound = loadSound('assets/bite.mp3');
  appleImg  = loadImage('assets/apple.png');
  pearImg   = loadImage('assets/pear.png');
}

////////////////////////////////////////////////
function setup() {
  let canvas = createCanvas(800, 500);
  canvas.parent("p5-canvas-container");
  canvas.mousePressed(userStartAudio);

  video = createCapture(VIDEO, { flipped: true });
  video.size(800, 500);
  video.hide();

  handpose.detectStart(video, results => { hands = results; });
  bodyPose.detectStart(video, r => { bodies = r; });
  faceMesh.detectStart(video, r => { faces = r; });

  // zones
  zones = [
    { name: "sine",     x: 0,       y: height/2, w: width/2, h: height/2, life: 100 },
    { name: "triangle", x: width/2, y: height/2, w: width/2, h: height/2, life: 100 },
    { name: "square", x: 0,       y: 0,        w: width/2, h: height/2, life: 100 },
    { name: "sawtooth", x: width/2, y: 0,        w: width/2, h: height/2, life: 100 },
  ];

  // oscillators
  for (let i = 0; i < 4; i++) {
    let osc = new p5.Oscillator(OSC_TYPES[i]);
    osc.start();
    osc.amp(0);
    oscillators.push(osc);
    noteSeqs[i] = patternSeq(i);
  }

  // sound effects  mouth  confetti  bite
  glideOsc   = new p5.Oscillator('sine');  glideOsc.start();   glideOsc.amp(0);
  kickOsc    = new p5.Oscillator('sine');  kickOsc.start();    kickOsc.amp(0);
  snareNoise = new p5.Noise('white');      snareNoise.start(); snareNoise.amp(0);

  eater = new Eater();
  snakeTarget = new SnakeTarget();

  if (random() < 0.5) {
    ZONE_OCTAVES[0] = 0;
  } else {
    ZONE_OCTAVES[0] = -12;
  }

  initMagenta();
}

////////////////////////////////////////////////
function draw() {
  background(15);
  image(video, 0, 0, width, height);

  if (gameState === 'start') {
    drawStartScreen();
    return;
  }

  if (gameState === 'gameover') {
    drawGameOver();
    return;
  }

  // playing
  updateZones();
  tickMusic();
  drawZones();
  updatePrompt();
  drawHands();
  drawBodyPoints();
  handleSnakeControl();
  snakeTarget.update();
  snakeTarget.draw();
  eater.update();
  eater.draw();
  eater.checkEat(snakeTarget);

  for (let i = 0; i < confettis.length; i++) {
    let c = confettis[i];
    c.update();
    c.draw();
  }
  
  //delete
  let newConfettis = [];
  for (let i = 0; i < confettis.length; i++) {
    if (!confettis[i].isDead()) {
      newConfettis.push(confettis[i]);
    }
  }
  confettis = newConfettis;

  updateBubbles();
  drawMouthPoint();
  drawStatus();

  // if game over, all zone 0
  if (zones.every(z => z.life <= 0)) {
    if (extraLives > 0) {
      extraLives--;
      // alive again
      let idx = floor(Math.random() * 4);
      zones[idx].life = 80;
      // visual effects
      for (let i = 0; i < 20; i++) confettis.push(new Confetti(zones[idx].x + zones[idx].w / 2, zones[idx].y + zones[idx].h / 2));
    } else {
      // turn off all sound
      for (let i = 0; i < oscillators.length; i++) {
        oscillators[i].amp(0, 0.5);   // amp(target volume, fade time in seconds)
        // fade all oscillators to silence over 0.5 seconds
      }

      gameState = 'gameover';
      gameoverTime = millis();
    }
  }
}

////////////////////////////////////////////////
function updateZones() {
  for (let i = 0; i < zones.length; i++) {
    let z = zones[i];
    let active = false;   // assume no hand inside

    // check all detected hands
    for (let j = 0; j < hands.length; j++) {
      let hand = hands[j];
      
      let pts = [];   // key points: wrist + palm only

      if (hand.keypoints[0]) {
        pts.push(hand.keypoints[0]); // wrist
      }
      if (hand.keypoints[9]) {
        pts.push(hand.keypoints[9]); // palm center
      }

      // check each point
      for (let k = 0; k < pts.length; k++) {
        let kp = pts[k];

        // point inside zone bounds
        if (
          kp.x > z.x && kp.x < z.x + z.w &&
          kp.y > z.y && kp.y < z.y + z.h
        ) {
          active = true; // zone activated
        }
      }
    }

    // update life value
    if (active) {
      z.life += 2;      // grow when hand present
    } else {
      z.life -= 0.15;   // decay when no
    }

    // clamp life range
    if (z.life > 100) {
      z.life = 100;     // max cap
    }
    if (z.life < 0) {
      z.life = 0;       // min cap
    }
  }
}

////////////////////////////////////////////////
function tickMusic() {
  // Volume tracks life continuously
  for (let i = 0; i < 4; i++) {
    let vol = map(zones[i].life, 0, 100, 0, 0.28);
    oscillators[i].amp(vol, 0.08);
  }

  // Advance note every BEAT frames
  noteTimer++;
  if (noteTimer < BEAT) return;
  noteTimer = 0;

  for (let i = 0; i < 4; i++) {
    if (zones[i].life <= 0 || noteSeqs[i].length === 0) continue;

    let midi = noteSeqs[i][noteIdx[i] % noteSeqs[i].length];
    oscillators[i].freq(mtof(midi), 0.04);
    noteIdx[i]++;

    // End of sequence
    // pending Magenta result or vary pattern
    if (noteIdx[i] >= noteSeqs[i].length) {
      noteIdx[i] = 0;
      if (pendingSeq[i]) {
        noteSeqs[i] = pendingSeq[i];
        pendingSeq[i] = null;
      } else if (!magentaReady) {
        noteSeqs[i] = patternSeq(i);
      }
      // queue next Magenta when ready
      if (magentaReady) generateMagentaSeq(i);
    }
  }
}

////////////////////////////////////////////////
function drawZones() {
  for (let i = 0; i < zones.length; i++) {
    let z = zones[i];
    let c = ZONE_COLORS[i];
    let a = map(z.life, 0, 100, 10, 70);

    push();

    // fill
    fill(c[0], c[1], c[2], a);
    stroke(c[0], c[1], c[2], 200);
    strokeWeight(2);
    rect(z.x, z.y, z.w, z.h);

    // life bar background
    fill(0, 100);
    rect(z.x + 20, z.y + 14, z.w - 40, 10, 5);

    // life bar fill 
    let barW = map(z.life, 0, 100, 0, z.w - 40);
    fill(lerpColor(color(255, 50, 50), color(c[0], c[1], c[2]), z.life / 100));
    rect(z.x + 20, z.y + 14, barW, 10, 5);

    // silent 
    if (z.life === 0) {
      fill(0, 160);
      rect(z.x, z.y, z.w, z.h);
      fill(c[0], c[1], c[2], 200);
      noStroke();
      textSize(20);
      textAlign(CENTER, CENTER);
      text("SILENT", z.x + z.w / 2, z.y + z.h / 2 - 20);
    }

    pop();
  }
}

////////////////////////////////////////////////
function drawHands() {
  for (let hand of hands) {
    for (let kp of hand.keypoints) {
      push();
      fill(80, 220, 100, 200);
      noStroke();
      circle(kp.x, kp.y, 7);
      pop();
    }
    // wrist ring
    if (hand.keypoints[0]) {
      push();
      noFill();
      stroke(80, 220, 100, 180);
      strokeWeight(2);
      circle(hand.keypoints[0].x, hand.keypoints[0].y, 34);
      pop();
    }
  }
}

////////////////////////////////////////////////
function drawBodyPoints() {
  for (let pose of bodies) {
    let pts = ['nose', 'left_shoulder', 'right_shoulder', 'left_ear', 'right_ear'];
    for (let name of pts) {
      let kp = pose[name];
      if (kp && kp.confidence > 0.3) {
        fill(255, 255, 255, 200);
        noStroke();
        circle(kp.x, kp.y, 7);
      }
    }
  }
}

////////////////////////////////////////////////
function drawMouthPoint() {
  for (let face of faces) {
    let upper = face.keypoints[13]; // upper lip
    let lower = face.keypoints[14]; // lower lip
    if (upper && lower) {
      let mx = (upper.x + lower.x) / 2;
      let my = (upper.y + lower.y) / 2;
      fill(255, 150, 200, 200);
      noStroke();
      circle(mx, my, 7);
    }
  }
}

////////////////////////////////////////////////
// fist
function isFistHand(hand) {
  let wrist  = hand.keypoints[0];
  let midMCP = hand.keypoints[9]; // mid finger root
  if (!wrist || !midMCP) return false;
  let ref = dist(wrist.x, wrist.y, midMCP.x, midMCP.y);
  return [8, 12, 16, 20].every(i => {
    let tip = hand.keypoints[i];
    return tip && dist(tip.x, tip.y, wrist.x, wrist.y) < ref * 1.2;
  });
}

// which hand is handedness
function getHandByHandedness(side) {
  for (let i = 0; i < hands.length; i++) {
    let h = hands[i];
    if (h.handedness) {
      let handSide = h.handedness.toLowerCase();
      let targetSide = side.toLowerCase();
      if (handSide === targetSide) {
        return h;
      }
    }
  }
  return null;
}


////////////////////////////////////////////////
function handleSnakeControl() {
  if (hands.length === 0) { holding = false; return; }

  let fist = false;
  for (let hand of hands) {
    if (isFistHand(hand)) { fist = true; break; }
  }

  if (fist && !holding) eater.turnRight();
  holding = fist;
}

////////////////////////////////////////////////
function updateBubbles() {
  // open mouth
  for (let face of faces) {
    let upper = face.keypoints[13];
    let lower = face.keypoints[14];
    let nose  = face.keypoints[1];
    if (upper && lower && nose) {
      let mouthOpen = lower.y - upper.y;
      if (mouthOpen > 18) {
        // bubble
        let n = floor(random(1, 3));
        for (let i = 0; i < n; i++) {
          bubbles.push(new Bubble(nose.x, nose.y - 10));
        }
        // glide
        if (millis() - lastGlideTime > GLIDE_COOLDOWN) {
          playMouthGlide();
          lastGlideTime = millis();
        }
        // snake speeds up
        eater.speed = map(mouthOpen, 18, 60, 3, 8);
      } else {
        // a tempo
        eater.speed = 3;
      }
    }
  }

  // bubbles
  for (let b of bubbles) {
    b.update();
    b.draw();
  }
  // clear bubbles
  bubbles = bubbles.filter(b => !b.isDead());
}



////////////////////////////////////////////////
function playMouthGlide() {
  glideOsc.freq(200);
  glideOsc.amp(0.2);
  glideOsc.freq(600, 0.3);
  glideOsc.amp(0, 0.35);
}

////////////////////////////////////////////////
function getPromptKeypoint(text) {
  if (text === 'Left Hand')  return getHandByHandedness('left')?.keypoints[0];
  if (text === 'Right Hand') return getHandByHandedness('right')?.keypoints[0];
  if (text === 'Nose')           return bodies[0]?.nose;
  if (text === 'Left Shoulder')  return bodies[0]?.left_shoulder;
  if (text === 'Right Shoulder') return bodies[0]?.right_shoulder;
  if (text === 'Mouth') {
    let upper = faces[0]?.keypoints[13];
    let lower = faces[0]?.keypoints[14];
    if (upper && lower) return { x: (upper.x + lower.x) / 2, y: (upper.y + lower.y) / 2 };
  }
  if (text === 'Left Ear')  return bodies[0]?.left_ear;
  if (text === 'Right Ear') return bodies[0]?.right_ear;
  return null;
}

////////////////////////////////////////////////
function updatePrompt() {
  // cooldown
  if (promptOnCooldown) {
    if (millis() - promptCooldownStart >= PROMPT_COOLDOWN) {
      promptOnCooldown = false;
    } else {
      return;
    }
  }

  // if no prompt, generate a new one
  if (activePrompt === null) {
    let zoneIdx = floor(Math.random() * 4);
    //leave the dead zone
    let attempts = 0;
    while (zones[zoneIdx].life <= 0 && attempts < 8) {
      zoneIdx = floor(Math.random() * 4);
      attempts++;
    }
    if (zones[zoneIdx].life <= 0) return; // all zone dead
    let text = PROMPTS[floor(Math.random() * PROMPTS.length)];
    activePrompt = { text, zoneIdx };
    promptStartTime = millis();
  }

  let z = zones[activePrompt.zoneIdx];
  let elapsed = millis() - promptStartTime;
  let timeLeft = max(0, PROMPT_TIMEOUT - elapsed);
  let progress = timeLeft / PROMPT_TIMEOUT; // 1-0
  let urgency = elapsed / PROMPT_TIMEOUT;   // 0-1, bigger more tension

  // zone visual alarm
  if (urgency > 0.6) {
    let pulse = sin(millis() * 0.015) * 0.5 + 0.5;
    let flashAlpha = map(urgency, 0.6, 1.0, 0, 180) * pulse;
    push();
    noFill();
    stroke(255, 60, 60, flashAlpha);
    strokeWeight(map(urgency, 0.6, 1.0, 2, 8));
    rect(z.x, z.y, z.w, z.h);
    pop();

    push();
    fill(255, 40, 40, map(urgency, 0.6, 1.0, 0, 40) * pulse);
    noStroke();
    rect(z.x, z.y, z.w, z.h);
    pop();
  }

  // countdown bar
  push();
  fill(200, 50, 50, 180);
  noStroke();
  rect(z.x, z.y, z.w * progress, 6);
  pop();

  // text
  push();
  noStroke();
  fill(57, 255, 20, 220);
  textSize(22);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  text(activePrompt.text, z.x + z.w / 2, z.y + z.h / 2 + 20);
  textStyle(NORMAL);
  pop();

  // time passed, zone died
  if (elapsed > PROMPT_TIMEOUT) {
    if (extraLives > 0) {
      extraLives--;
      // visual effects
      zones[activePrompt.zoneIdx].life = max(zones[activePrompt.zoneIdx].life - 20, 0);
    } else {
      zones[activePrompt.zoneIdx].life = 0;
    }
    activePrompt = null;
    return;
  }

  
  let kp = getPromptKeypoint(activePrompt.text);
  if (kp && kp.x > z.x && kp.x < z.x + z.w && kp.y > z.y && kp.y < z.y + z.h) {
    promptScore++;
    playDrum();
    for (let i = 0; i < 30; i++) confettis.push(new Confetti(z.x + z.w / 2, z.y + z.h / 2));
    activePrompt = null;
    promptOnCooldown = true;
    promptCooldownStart = millis();
  }
}

////////////////////////////////////////////////
function playDrum() {
  // kick
  kickOsc.freq(150);
  kickOsc.amp(0.5);
  kickOsc.freq(60, 0.1);
  kickOsc.amp(0, 0.15);
  // snare
  snareNoise.amp(0.3);
  snareNoise.amp(0, 0.1);
}

////////////////////////////////////////////////
function drawStartScreen() {
  fill(0, 180);
  noStroke();
  rect(0, 0, width, height);

  fill(57, 255, 20);
  textAlign(CENTER, CENTER);
  textSize(42);
  textStyle(BOLD);
  text('🎵 Music Zone', width / 2, height / 2 - 60);
  textStyle(NORMAL);
  textSize(20);
  text('Make a fist or open your mouth to start!', width / 2, height / 2 + 10);
  textSize(14);
  fill(257, 255, 20, 200);
 

  let mouthOpen = false;
  for (let face of faces) {
    let upper = face.keypoints[13];
    let lower = face.keypoints[14];
    if (upper && lower && lower.y - upper.y > 18) mouthOpen = true;
  }
  let fist = hands.some(h => isFistHand(h));
  if (mouthOpen || fist) startGame();
}

////////////////////////////////////////////////
function drawGameOver() {
  fill(0, 200);
  noStroke();
  rect(0, 0, width, height);

  fill(255, 80, 80);
  textAlign(CENTER, CENTER);
  textSize(48);
  textStyle(BOLD);
  text('GAME OVER', width / 2, height / 2 - 50);
  textStyle(NORMAL);
  fill(255);
  textSize(22);
  text('You killed the music! 🎵💀', width / 2, height / 2 + 10);
  textSize(16);
  fill(255, 200);
  text('Make a fist or open your mouth to restart', width / 2, height / 2 + 55);

  push();
  textSize(18);
  noStroke();
  fill(57, 255, 20, 200);
  textAlign(LEFT, BOTTOM);
  text("✓ " + promptScore, 10, height - 14);
  fill(255, 220, 80, 200);
  textAlign(RIGHT, BOTTOM);
  text("🍎🍐 " + fruitScore, width - 10, height - 14);
  pop();

  // 2 sec, restart
  if (millis() - gameoverTime < 2000) return;

  let mouthOpen = false;
  for (let face of faces) {
    let upper = face.keypoints[13];
    let lower = face.keypoints[14];
    if (upper && lower && lower.y - upper.y > 18) mouthOpen = true;
  }
  let fist = hands.some(h => isFistHand(h));
  if (mouthOpen || fist) startGame();
}

////////////////////////////////////////////////
function startGame() {
  gameState = 'playing';
  for (let z of zones) z.life = 100;
  for (let i = 0; i < 4; i++) noteIdx[i] = 0;
  activePrompt = null;
  bubbles = [];
  confettis = [];
  eater.x = width / 2;
  eater.y = height / 2;
  eater.direction = 'RIGHT';
  eater.speed = 3;
  extraLives = 3;
  promptOnCooldown = false;
  promptScore = 0;
  fruitScore = 0;
}

////////////////////////////////////////////////
function drawStatus() {
  push();
  fill(255, 160);
  noStroke();
  textSize(11);
  textAlign(LEFT, TOP);
  //text(magentaReady ? "Magenta RNN ready" : "loading Magenta...", 8, 8);
  pop();

  // extra lives
  push();
  textAlign(CENTER, BOTTOM);
  textSize(13);
  fill(255, 220, 80);
  noStroke();
  fill(255, 220, 80);
  text("Lives", width / 2, height - 30);
  for (let i = 0; i < MAX_LIVES; i++) {
    if (i < extraLives) fill(255, 220, 80);
    else fill(100, 100, 100, 120);
    noStroke();
    circle(width / 2 - (MAX_LIVES - 1) * 14 + i * 28, height - 12, 16);
  }
  pop();

  // scores
  push();
  textSize(18);
  noStroke();
  fill(57, 255, 20, 200);
  textAlign(LEFT, BOTTOM);
  text("✓ " + promptScore, 10, height - 14);
  fill(255, 220, 80, 200);
  textAlign(RIGHT, BOTTOM);
  text("🍎🍐 " + fruitScore, width - 10, height - 14);
  pop();
}

////////////////////////////////////////////////
// Magenta MusicRNN
async function initMagenta() {
  try {
    musicRNN = new mm.MusicRNN(
      "https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn"
    );
    await musicRNN.initialize();
    magentaReady = true;
    console.log("Magenta ready");
    for (let i = 0; i < 4; i++) await generateMagentaSeq(i);
    console.log("Initial sequences generated");
  } catch (e) {
    console.error("Magenta failed:", e);
  }
}

async function generateMagentaSeq(i) {
  let oct = ZONE_OCTAVES[i];  // get octave offset for the zone 

  // build a 4-note seed from the zone's pattern for better musical context
  // convert them into Magenta's expected format
  let seedNotes = ZONE_PATTERNS[i].slice(0, 4).map((semitone, step) => ({
    pitch: ROOT + semitone + oct,   // MIDI pitch: ROOT (C4=60) + interval + octave offset
    quantizedStartStep: step,   // when note start
    quantizedEndStep: step + 1,   // when end
  }));

  //wrap seed notes for Magenta 
  const seedSeq = {
    notes: seedNotes,
    totalQuantizedSteps: 4,
    quantizationInfo: { stepsPerQuarter: 4 },
  };

    // randomly decide how many notes to generate (6–16)
    // so the melody length varies each time and feels less repetitive
  let genLen = Math.floor(random(6, 17)); // 6–16 steps, varies per call

  try {
    // ask Magenta MusicRNN to continue the melody from the seed
    // Temperature higher :more random/adventurous, lower: more conservative?
    // Each zone gets a slightly different temperature (i * 0.15) to give each voice its own character...
    let result = await musicRNN.continueSequence(seedSeq, genLen, currentTemp + i * 0.15);
    if (tempDecay > 0) {
      tempDecay--;
      if (tempDecay === 0) currentTemp = 1.1;
    }
    // Snap every generated note back to the pentatonic scale.
    let snapped = result.notes.map(n => snapToPentatonic(n.pitch, oct));

    // Store result in the pending queue (instead of replacing immediately)
    // New sequence will start once the current pattern finishes playing
    // avoiding any abrupt jumps in the middle of music
    if (snapped.length > 0) pendingSeq[i] = snapped;
  } catch (e) {
    // If Magenta fails (e.g. network error or model not loaded),
    // silently skip, tickMusic() will fall back to the fixed pattern instead
  }
}

////////////////////////////////////////////////
function patternSeq(zoneIdx) {

  // get octave offset for this zone
  let oct = ZONE_OCTAVES[zoneIdx];

  let pattern = [...ZONE_PATTERNS[zoneIdx]];    // copy base patterns, avoid modifying originals

  // pick random starting point
  let rotateBy = floor(random(pattern.length));

  // rotate pattern 
  // change where loop begins
  pattern = [...pattern.slice(rotateBy), ...pattern.slice(0, rotateBy)];

  let result = [];  // final note sequence

  for (let i = 0; i < pattern.length; i++) {

    let semitone = pattern[i];     // current note

    // 50% chance variation
    if (random() < 0.50) {

      // find the idx of note in penta scale
      let idx = PENTA.indexOf(semitone);
      
      // if not found, randomly assgin
      if (idx === -1) {
        idx = floor(random(PENTA.length));
      }

      let dir;    //  direction
      if (random() < 0.5) {
        dir = 1;   // up
      } else {
        dir = -1;  // down
      }

      idx = constrain(idx + dir, 0, PENTA.length - 1);      // stay inside penta range

      semitone = PENTA[idx];      // get new note from penta
    }

    // convert to MIDI (root + scale + octave)
    result.push(ROOT + semitone + oct);

    // 25% chance: repeat note 
    // double the note length
    // "fake" rhythmic variations..?
    if (random() < 0.25) {
      result.push(ROOT + semitone + oct);
    }
  }
  return result;
}

//for magenta generated notes
//make it pantatonic to sound good
function snapToPentatonic(midi, octaveOffset) {
  let semitone = midi % 12;
  let best = PENTA[0], bestDist = 12;
  for (let p of PENTA) {
    let d = Math.abs(p - semitone);
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return Math.floor(midi / 12) * 12 + best;
}

function mtof(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
