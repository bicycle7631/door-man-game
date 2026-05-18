const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const startScreen = document.getElementById("startScreen");
const endScreen = document.getElementById("endScreen");
const endTitle = document.getElementById("endTitle");
const endText = document.getElementById("endText");

const ASSETS = {
  hero: "assets/sprites/door-man.png",
  shooter: "assets/sprites/bad-shooter.png",
  enemies: [
    "assets/sprites/bad-normal.png",
    "assets/sprites/bad-punch.png",
    "assets/sprites/bad-walk.png",
    "assets/sprites/bad-repeat.png",
  ],
};

const MAX_HEARTS = 5;
const LEVELS = [
  {
    name: "Level 1: Front Yard",
    goal: "Smack 5 bad guys",
    target: 5,
    maxEnemies: 2,
    spawnMin: 1.1,
    spawnMax: 1.9,
    shooterAfter: 99,
    shooterChance: 0,
    enemySpeed: 42,
  },
  {
    name: "Level 2: Key Run",
    goal: "Find 3 keys, then smack 4 bad guys",
    target: 4,
    keyTarget: 3,
    maxEnemies: 3,
    spawnMin: 1.0,
    spawnMax: 1.8,
    shooterAfter: 0,
    shooterChance: 0.45,
    enemySpeed: 46,
  },
  {
    name: "Level 3: Windy Hall",
    goal: "Watch the wind and survive 6 bad guys",
    target: 6,
    maxEnemies: 3,
    spawnMin: 0.9,
    spawnMax: 1.5,
    shooterAfter: 1,
    shooterChance: 0.35,
    enemySpeed: 50,
    gust: true,
    hazards: true,
    pickups: true,
  },
  {
    name: "Level 4: Boss Door",
    goal: "Beat the boss",
    target: 0,
    maxEnemies: 2,
    spawnMin: 1.6,
    spawnMax: 2.4,
    shooterAfter: 0,
    shooterChance: 0.25,
    enemySpeed: 48,
    boss: true,
    bossAfter: 2,
    hazards: true,
  },
];

const images = {};
const keys = new Set();
const controls = {
  left: false,
  right: false,
  jump: false,
  duck: false,
  attack: false,
};

let dpr = 1;
let width = 0;
let height = 0;
let groundY = 0;
let state = "start";
let lastTime = 0;
let currentLevelIndex = 0;
let defeated = 0;
let collectedKeys = 0;
let spawnTimer = 0;
let keyTimer = 0;
let pickupTimer = 0;
let levelBannerTimer = 0;
let levelCompleteTimer = 0;
let bossSpawned = false;
let bossDefeated = false;
let gustPhase = 1;
let gustTimer = 0;
let particles = [];
let enemies = [];
let bullets = [];
let levelKeys = [];
let pickups = [];
let hazards = [];

const hero = {
  x: 120,
  y: 0,
  w: 112,
  h: 124,
  vx: 0,
  vy: 0,
  hearts: MAX_HEARTS,
  facing: 1,
  grounded: false,
  ducking: false,
  attackTimer: 0,
  hurtTimer: 0,
};

function level() {
  return LEVELS[currentLevelIndex];
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = src;
  });
}

async function loadAssets() {
  images.hero = await loadImage(ASSETS.hero);
  images.shooter = await loadImage(ASSETS.shooter);
  images.enemies = await Promise.all(ASSETS.enemies.map(loadImage));
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  groundY = Math.max(260, height * 0.72);
  hero.y = Math.min(hero.y || groundY - hero.h, groundY - hero.h);
  buildHazards();
}

function resetGame() {
  hero.hearts = MAX_HEARTS;
  startLevel(0);
  state = "playing";
  startScreen.classList.add("hidden");
  endScreen.classList.add("hidden");
}

function startLevel(index) {
  currentLevelIndex = index;
  defeated = 0;
  collectedKeys = 0;
  enemies = [];
  bullets = [];
  particles = [];
  levelKeys = [];
  pickups = [];
  bossSpawned = false;
  bossDefeated = false;
  spawnTimer = 0.8;
  keyTimer = 0.6;
  pickupTimer = 4.5;
  levelBannerTimer = 2.2;
  levelCompleteTimer = 0;
  gustPhase = 1;
  gustTimer = 2.4;
  hero.x = Math.min(140, width * 0.18);
  hero.y = groundY - hero.h;
  hero.vx = 0;
  hero.vy = 0;
  hero.facing = 1;
  hero.ducking = false;
  hero.attackTimer = 0;
  hero.hurtTimer = 0;
  buildHazards();
}

function buildHazards() {
  hazards = [];
  if (!level()?.hazards || !width) return;
  const count = currentLevelIndex === 3 ? 3 : 2;
  for (let i = 0; i < count; i += 1) {
    hazards.push({
      x: width * (0.36 + i * 0.18),
      y: groundY - 12,
      w: 54,
      h: 16,
      pulse: Math.random() * Math.PI,
    });
  }
}

function showEnd(won) {
  state = "end";
  endTitle.textContent = won ? "Door Man Wins!" : "Try Again";
  endText.textContent = won ? "Door Man cleared every level." : "The bad guys got Door Man.";
  endScreen.classList.remove("hidden");
}

function levelIsComplete() {
  const cfg = level();
  const keysDone = !cfg.keyTarget || collectedKeys >= cfg.keyTarget;
  const badGuysDone = defeated >= cfg.target;
  const bossDone = !cfg.boss || bossDefeated;
  return keysDone && badGuysDone && bossDone;
}

function completeLevel() {
  if (levelCompleteTimer > 0) return;
  levelCompleteTimer = 2.1;
  enemies = [];
  bullets = [];
  pickups = [];
  burst(hero.x + hero.w / 2, hero.y + 30, "#ffd35a", 18);
}

function advanceLevel() {
  if (currentLevelIndex >= LEVELS.length - 1) {
    showEnd(true);
  } else {
    startLevel(currentLevelIndex + 1);
  }
}

function spawnEnemy(isBoss = false) {
  const cfg = level();
  const side = Math.random() < 0.5 ? -1 : 1;
  const shooter = !isBoss && defeated >= cfg.shooterAfter && Math.random() < cfg.shooterChance;
  const size = isBoss ? 1.72 : 1;
  const enemy = {
    img: shooter ? images.shooter : images.enemies[Math.floor(Math.random() * images.enemies.length)],
    x: side < 0 ? -130 : width + 130,
    y: groundY - 124 * size,
    w: (shooter ? 134 : 92) * size,
    h: 124 * size,
    hp: isBoss ? 14 : 2,
    maxHp: isBoss ? 14 : 2,
    boss: isBoss,
    shooter,
    facing: side < 0 ? 1 : -1,
    hitTimer: 0,
    attackCooldown: 0,
    shootTimer: shooter || isBoss ? 1.0 : 0,
    dashTimer: isBoss ? 2.2 : 0,
  };
  enemies.push(enemy);
}

function spawnKey() {
  if (levelKeys.length >= 2) return;
  levelKeys.push({
    x: 130 + Math.random() * Math.max(120, width - 280),
    y: groundY - 135 - Math.random() * 90,
    w: 34,
    h: 34,
    bob: Math.random() * Math.PI * 2,
  });
}

function spawnPickup() {
  if (hero.hearts >= MAX_HEARTS || pickups.length > 0) return;
  pickups.push({
    x: 160 + Math.random() * Math.max(120, width - 320),
    y: groundY - 74,
    w: 34,
    h: 34,
    kind: "heart",
  });
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function heroHitBox() {
  if (!hero.ducking) return hero;
  const duckHeight = hero.h * 0.52;
  return {
    x: hero.x + hero.w * 0.08,
    y: hero.y + hero.h - duckHeight,
    w: hero.w * 0.84,
    h: duckHeight,
  };
}

function attackBox() {
  return {
    x: hero.facing > 0 ? hero.x + hero.w - 12 : hero.x - 92,
    y: hero.y + 22,
    w: 104,
    h: 70,
  };
}

function burst(x, y, color = "#171511", count = 10) {
  for (let i = 0; i < count; i += 1) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 240,
      vy: (Math.random() - 0.85) * 210,
      life: 0.45 + Math.random() * 0.3,
      color,
    });
  }
}

function damageHero(sourceX) {
  if (hero.hurtTimer > 0 || levelCompleteTimer > 0) return;
  hero.hearts -= 1;
  hero.hurtTimer = 1.35;
  const pushDirection = sourceX < hero.x ? 1 : -1;
  hero.x += pushDirection * 36;
  burst(hero.x + hero.w / 2, hero.y + 35, "#df3e3e");
  if (hero.hearts <= 0) showEnd(false);
}

function shootBullet(enemy) {
  const direction = enemy.facing;
  const bossShot = enemy.boss;
  const highShot = bossShot ? Math.random() < 0.52 : Math.random() < 0.45;
  bullets.push({
    x: enemy.x + (direction > 0 ? enemy.w - 18 : 18),
    y: enemy.y + enemy.h * (highShot ? 0.34 : 0.64),
    w: bossShot ? 38 : 28,
    h: bossShot ? 14 : 10,
    vx: direction * (bossShot ? 440 : 360),
    life: 2.4,
    boss: bossShot,
    high: highShot,
  });
}

function update(dt) {
  if (state !== "playing") return;

  if (levelCompleteTimer > 0) {
    levelCompleteTimer -= dt;
    updateHero(dt);
    updateParticles(dt);
    if (levelCompleteTimer <= 0) advanceLevel();
    return;
  }

  updateHero(dt);
  updateLevelTimers(dt);
  updateEnemies(dt);
  updateBullets(dt);
  updateCollectibles(dt);
  updateParticles(dt);

  if (levelIsComplete()) completeLevel();
}

function updateHero(dt) {
  const left = controls.left || keys.has("ArrowLeft") || keys.has("a");
  const right = controls.right || keys.has("ArrowRight") || keys.has("d");
  const jump = controls.jump || keys.has("ArrowUp") || keys.has("w") || keys.has(" ");
  const duck = controls.duck || keys.has("ArrowDown") || keys.has("s");
  const attack = controls.attack || keys.has("Shift") || keys.has("Enter") || keys.has("j");

  hero.ducking = duck && hero.grounded && hero.attackTimer <= 0;
  hero.vx = 0;
  if (left) {
    hero.vx = hero.ducking ? -115 : -230;
    hero.facing = -1;
  }
  if (right) {
    hero.vx = hero.ducking ? 115 : 230;
    hero.facing = 1;
  }
  if (level().gust && hero.grounded && !hero.ducking) {
    hero.vx += gustPhase * 45;
  }
  if (jump && hero.grounded && !hero.ducking) {
    hero.vy = -760;
    hero.grounded = false;
  }
  if (attack && hero.attackTimer <= 0 && !hero.ducking) {
    hero.attackTimer = 0.36;
  }

  hero.x += hero.vx * dt;
  hero.vy += 1220 * dt;
  hero.y += hero.vy * dt;
  if (hero.y + hero.h >= groundY) {
    hero.y = groundY - hero.h;
    hero.vy = 0;
    hero.grounded = true;
  }
  hero.x = Math.max(10, Math.min(width - hero.w - 10, hero.x));
  hero.attackTimer = Math.max(0, hero.attackTimer - dt);
  hero.hurtTimer = Math.max(0, hero.hurtTimer - dt);
}

function updateLevelTimers(dt) {
  levelBannerTimer = Math.max(0, levelBannerTimer - dt);
  spawnTimer -= dt;
  keyTimer -= dt;
  pickupTimer -= dt;

  if (level().gust) {
    gustTimer -= dt;
    if (gustTimer <= 0) {
      gustPhase *= -1;
      gustTimer = 2.6;
      burst(width / 2, groundY - 80, "#fff8d4", 8);
    }
  }

  if (level().keyTarget && collectedKeys < level().keyTarget && keyTimer <= 0) {
    spawnKey();
    keyTimer = 1.7;
  }
  if (level().pickups && pickupTimer <= 0) {
    spawnPickup();
    pickupTimer = 7.5;
  }
  if (level().boss && !bossSpawned && defeated >= level().bossAfter) {
    bossSpawned = true;
    spawnEnemy(true);
  }
  if (spawnTimer <= 0 && enemies.length < level().maxEnemies) {
    if (!level().boss || !bossSpawned || Math.random() < 0.45) spawnEnemy(false);
    spawnTimer = level().spawnMin + Math.random() * (level().spawnMax - level().spawnMin);
  }
}

function updateEnemies(dt) {
  const hitBox = hero.attackTimer > 0 ? attackBox() : null;
  const heroBox = heroHitBox();
  enemies.forEach((enemy) => {
    const towardHero = Math.sign(hero.x - enemy.x) || 1;
    const distance = Math.abs(hero.x - enemy.x);
    enemy.facing = towardHero;
    const speed = enemy.boss ? 56 : level().enemySpeed + defeated * 2;
    const holdingAim = enemy.shooter && distance < 360;
    enemy.vx = holdingAim ? 0 : towardHero * speed;

    if (enemy.boss) {
      enemy.dashTimer = Math.max(0, enemy.dashTimer - dt);
      if (enemy.dashTimer <= 0) {
        enemy.vx = towardHero * 255;
        enemy.dashTimer = 2.65;
        burst(enemy.x + enemy.w / 2, enemy.y + enemy.h, "#df3e3e");
      }
    }

    enemy.x += enemy.vx * dt;
    enemy.hitTimer = Math.max(0, enemy.hitTimer - dt);
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
    enemy.shootTimer = Math.max(0, enemy.shootTimer - dt);

    if ((enemy.shooter || enemy.boss) && enemy.shootTimer <= 0) {
      shootBullet(enemy);
      burst(enemy.x + enemy.w / 2, enemy.y + enemy.h * 0.42, "#171511");
      enemy.shootTimer = enemy.boss ? 1.65 : 3;
    }

    if (hitBox && rectsOverlap(hitBox, enemy) && enemy.hitTimer <= 0) {
      enemy.hp -= enemy.boss ? 1 : 2;
      enemy.hitTimer = 0.22;
      enemy.x += hero.facing * (enemy.boss ? 18 : 42);
      burst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, enemy.boss ? "#df3e3e" : "#171511");
    }

    if (rectsOverlap(heroBox, enemy) && hero.hurtTimer <= 0 && enemy.attackCooldown <= 0) {
      enemy.attackCooldown = enemy.boss ? 1.2 : 1.75;
      damageHero(enemy.x + enemy.w / 2);
    }
  });

  enemies = enemies.filter((enemy) => {
    if (enemy.hp > 0) return true;
    burst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, "#ffd35a");
    if (enemy.boss) {
      bossDefeated = true;
    } else {
      defeated += 1;
    }
    return false;
  });
}

function updateBullets(dt) {
  const hitBox = hero.attackTimer > 0 ? attackBox() : null;
  const heroBox = heroHitBox();
  bullets.forEach((bullet) => {
    bullet.x += bullet.vx * dt;
    bullet.life -= dt;
    if (hitBox && rectsOverlap(hitBox, bullet)) {
      bullet.life = 0;
      burst(bullet.x + bullet.w / 2, bullet.y + bullet.h / 2, "#ffd35a");
      return;
    }
    if (rectsOverlap(heroBox, bullet)) {
      bullet.life = 0;
      damageHero(bullet.x);
    }
  });
  bullets = bullets.filter((bullet) => bullet.life > 0 && bullet.x > -80 && bullet.x < width + 80);
}

function updateCollectibles(dt) {
  const heroBox = heroHitBox();
  levelKeys.forEach((item) => {
    item.bob += dt * 4;
    if (rectsOverlap(heroBox, item)) {
      item.collected = true;
      collectedKeys += 1;
      burst(item.x + item.w / 2, item.y + item.h / 2, "#ffd35a", 12);
    }
  });
  levelKeys = levelKeys.filter((item) => !item.collected);

  pickups.forEach((item) => {
    if (rectsOverlap(heroBox, item)) {
      item.collected = true;
      hero.hearts = Math.min(MAX_HEARTS, hero.hearts + 1);
      burst(item.x + item.w / 2, item.y + item.h / 2, "#df3e3e", 12);
    }
  });
  pickups = pickups.filter((item) => !item.collected);

  hazards.forEach((hazard) => {
    hazard.pulse += dt * 5;
    if (rectsOverlap(heroBox, hazard)) damageHero(hazard.x + hazard.w / 2);
  });
}

function updateParticles(dt) {
  particles.forEach((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 520 * dt;
    p.life -= dt;
  });
  particles = particles.filter((p) => p.life > 0);
}

function drawBackground() {
  const cfg = level();
  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, cfg.gust ? "#95c8ff" : "#8bd3ff");
  sky.addColorStop(1, cfg.boss ? "#f6d0c8" : "#d7f5ff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#fff8d4";
  ctx.beginPath();
  ctx.arc(width - 90, 78, 42, 0, Math.PI * 2);
  ctx.fill();

  if (cfg.gust) {
    ctx.strokeStyle = "rgba(255, 253, 242, 0.85)";
    ctx.lineWidth = 4;
    for (let y = 120; y < groundY - 40; y += 56) {
      ctx.beginPath();
      ctx.moveTo(gustPhase > 0 ? 30 : width - 30, y);
      ctx.lineTo(gustPhase > 0 ? 120 : width - 120, y - 16);
      ctx.lineTo(gustPhase > 0 ? 210 : width - 210, y);
      ctx.stroke();
    }
  }

  ctx.fillStyle = cfg.boss ? "#84655a" : "#72c866";
  ctx.fillRect(0, groundY, width, height - groundY);
  ctx.fillStyle = cfg.boss ? "#5c443d" : "#4f9d4d";
  for (let x = -40; x < width + 40; x += 70) {
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x + 36, groundY - 22);
    ctx.lineTo(x + 72, groundY);
    ctx.fill();
  }

  ctx.strokeStyle = "#171511";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, groundY + 2);
  ctx.lineTo(width, groundY + 2);
  ctx.stroke();
}

function drawImageFlipped(img, x, y, w, h, flipped, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (flipped) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, w, h);
  } else {
    ctx.drawImage(img, x, y, w, h);
  }
  ctx.restore();
}

function drawHero() {
  const attacking = hero.attackTimer > 0;
  const drawW = hero.w * (attacking ? 1.08 : 1);
  const drawH = hero.h * (attacking ? 1.08 : 1) * (hero.ducking ? 0.58 : 1);
  const drawX = hero.x - (drawW - hero.w) / 2;
  const drawY = hero.y + hero.h - drawH;
  const alpha = hero.hurtTimer > 0 && Math.floor(hero.hurtTimer * 14) % 2 === 0 ? 0.35 : 1;
  drawImageFlipped(images.hero, drawX, drawY, drawW, drawH, hero.facing < 0, alpha);
  if (attacking) drawDoorSmack();
}

function drawDoorSmack() {
  const box = attackBox();
  const hingeX = hero.facing > 0 ? hero.x + hero.w * 0.72 : hero.x + hero.w * 0.28;
  const hingeY = hero.y + 26;
  const doorW = box.w * 0.75;
  const doorH = box.h;
  const swing = 0.35 + hero.attackTimer * 2.2;
  ctx.save();
  ctx.translate(hingeX, hingeY);
  ctx.scale(hero.facing, 1);
  ctx.rotate(-swing);
  ctx.fillStyle = "rgba(255, 211, 90, 0.45)";
  ctx.strokeStyle = "#171511";
  ctx.lineWidth = 5;
  roundRect(0, 0, doorW, doorH, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#171511";
  ctx.beginPath();
  ctx.arc(doorW - 16, doorH * 0.48, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "#ffd35a";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(box.x + box.w / 2, box.y + box.h / 2, 48, 0.1, Math.PI * 1.9);
  ctx.stroke();
}

function drawEnemy(enemy) {
  if (enemy.boss) {
    ctx.fillStyle = "rgba(223, 62, 62, 0.2)";
    ctx.beginPath();
    ctx.arc(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, enemy.w * 0.75, 0, Math.PI * 2);
    ctx.fill();
  }
  drawImageFlipped(enemy.img, enemy.x, enemy.y, enemy.w, enemy.h, enemy.facing > 0, enemy.hitTimer > 0 ? 0.55 : 1);
  if (enemy.boss) {
    ctx.fillStyle = "#171511";
    ctx.fillRect(enemy.x, enemy.y - 20, enemy.w, 10);
    ctx.fillStyle = "#df3e3e";
    ctx.fillRect(enemy.x, enemy.y - 20, enemy.w * (enemy.hp / enemy.maxHp), 10);
    ctx.strokeStyle = "#171511";
    ctx.lineWidth = 3;
    ctx.strokeRect(enemy.x, enemy.y - 20, enemy.w, 10);
  }
}

function drawBullets() {
  bullets.forEach((bullet) => {
    ctx.save();
    ctx.fillStyle = bullet.boss ? "#df3e3e" : "#171511";
    ctx.strokeStyle = "#fff8d4";
    ctx.lineWidth = 2;
    roundRect(bullet.x, bullet.y, bullet.w, bullet.h, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff8d4";
    ctx.font = "900 10px Trebuchet MS, sans-serif";
    ctx.fillText(bullet.high ? "HI" : "LO", bullet.x + 5, bullet.y - 4);
    ctx.restore();
  });
}

function drawCollectibles() {
  levelKeys.forEach((key) => {
    const y = key.y + Math.sin(key.bob) * 8;
    ctx.save();
    ctx.strokeStyle = "#171511";
    ctx.fillStyle = "#ffd35a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(key.x + 11, y + 13, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(key.x + 20, y + 13);
    ctx.lineTo(key.x + 36, y + 13);
    ctx.lineTo(key.x + 36, y + 22);
    ctx.moveTo(key.x + 29, y + 13);
    ctx.lineTo(key.x + 29, y + 20);
    ctx.stroke();
    ctx.restore();
  });

  pickups.forEach((item) => drawHeart(item.x + 17, item.y + 18, "#df3e3e"));

  hazards.forEach((hazard) => {
    ctx.save();
    ctx.fillStyle = Math.sin(hazard.pulse) > 0 ? "#171511" : "#df3e3e";
    for (let x = hazard.x; x < hazard.x + hazard.w; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, hazard.y + hazard.h);
      ctx.lineTo(x + 9, hazard.y);
      ctx.lineTo(x + 18, hazard.y + hazard.h);
      ctx.fill();
    }
    ctx.restore();
  });
}

function drawHud() {
  ctx.save();
  ctx.fillStyle = "rgba(245, 239, 220, 0.86)";
  ctx.strokeStyle = "#171511";
  ctx.lineWidth = 4;
  roundRect(14, 14, 292, 72, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#171511";
  ctx.font = "900 19px Trebuchet MS, sans-serif";
  ctx.fillText(level().name, 28, 39);
  ctx.font = "800 16px Trebuchet MS, sans-serif";
  const keyText = level().keyTarget ? ` | Keys: ${collectedKeys}/${level().keyTarget}` : "";
  ctx.fillText(`Bad guys: ${defeated}/${level().target}${keyText}`, 28, 66);

  const heartPanelWidth = 270;
  const heartPanelX = Math.max(14, width - heartPanelWidth - 14);
  roundRect(heartPanelX, 14, heartPanelWidth, 62, 8);
  ctx.fill();
  ctx.stroke();
  for (let i = 0; i < MAX_HEARTS; i += 1) {
    drawHeart(heartPanelX + 36 + i * 48, 45, i < hero.hearts ? "#df3e3e" : "#fffdf2");
  }

  if (level().gust) {
    ctx.fillStyle = "#171511";
    ctx.font = "900 22px Trebuchet MS, sans-serif";
    ctx.fillText(gustPhase > 0 ? "WIND ->" : "<- WIND", Math.max(18, width / 2 - 58), 54);
  }
  if (levelCompleteTimer > 0) drawCenterBanner("Level Clear!", level().goal);
  if (levelBannerTimer > 0) drawCenterBanner(level().name, level().goal);
  ctx.restore();
}

function drawCenterBanner(title, subtitle) {
  const panelW = Math.min(520, width - 36);
  const panelX = (width - panelW) / 2;
  const panelY = Math.max(104, height * 0.18);
  ctx.save();
  ctx.fillStyle = "rgba(245, 239, 220, 0.92)";
  ctx.strokeStyle = "#171511";
  ctx.lineWidth = 5;
  roundRect(panelX, panelY, panelW, 102, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#171511";
  ctx.textAlign = "center";
  ctx.font = "900 34px Trebuchet MS, sans-serif";
  ctx.fillText(title, width / 2, panelY + 43);
  ctx.font = "800 20px Trebuchet MS, sans-serif";
  ctx.fillText(subtitle, width / 2, panelY + 75);
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
}

function drawHeart(x, y, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.strokeStyle = "#171511";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 13);
  ctx.bezierCurveTo(-26, -8, -4, -24, 0, -10);
  ctx.bezierCurveTo(4, -24, 26, -8, 0, 13);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawParticles() {
  particles.forEach((p) => {
    ctx.globalAlpha = Math.max(0, p.life * 2);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function render() {
  drawBackground();
  drawCollectibles();
  enemies.forEach(drawEnemy);
  drawBullets();
  drawHero();
  drawParticles();
  drawHud();
}

function loop(time) {
  const dt = Math.min(0.033, (time - lastTime) / 1000 || 0);
  lastTime = time;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function bindControls() {
  window.addEventListener("keydown", (event) => {
    keys.add(event.key);
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Enter", "Shift"].includes(event.key)) {
      event.preventDefault();
    }
  });
  window.addEventListener("keyup", (event) => keys.delete(event.key));

  document.querySelectorAll("[data-control]").forEach((button) => {
    const name = button.dataset.control;
    const set = (value) => {
      controls[name] = value;
      button.classList.toggle("pressed", value);
    };
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      set(true);
    });
    button.addEventListener("pointerup", () => set(false));
    button.addEventListener("pointercancel", () => set(false));
    button.addEventListener("pointerleave", () => set(false));
  });

  document.getElementById("startButton").addEventListener("click", resetGame);
  document.getElementById("restartButton").addEventListener("click", resetGame);
}

window.addEventListener("resize", resize);
loadAssets().then(() => {
  resize();
  bindControls();
  requestAnimationFrame(loop);
});
