const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const startScreen = document.getElementById("startScreen");
const endScreen = document.getElementById("endScreen");
const endTitle = document.getElementById("endTitle");
const endText = document.getElementById("endText");

const ASSETS = {
  hero: "assets/sprites/door-man.png",
  kick: "assets/sprites/door-kick.png",
  shooter: "assets/sprites/bad-shooter.png",
  enemies: [
    "assets/sprites/bad-normal.png",
    "assets/sprites/bad-punch.png",
    "assets/sprites/bad-walk.png",
    "assets/sprites/bad-repeat.png",
  ],
};

const MAX_HEARTS = 5;
const images = {};
const keys = new Set();
const controls = {
  left: false,
  right: false,
  jump: false,
  attack: false,
};

let dpr = 1;
let width = 0;
let height = 0;
let groundY = 0;
let state = "start";
let lastTime = 0;
let spawnTimer = 0;
let defeated = 0;
let bossSpawned = false;
let particles = [];
let enemies = [];
let bullets = [];

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
  attackTimer: 0,
  hurtTimer: 0,
};

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = src;
  });
}

async function loadAssets() {
  images.hero = await loadImage(ASSETS.hero);
  images.kick = await loadImage(ASSETS.kick);
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
}

function resetGame() {
  hero.x = Math.min(140, width * 0.18);
  hero.y = groundY - hero.h;
  hero.vx = 0;
  hero.vy = 0;
  hero.hearts = MAX_HEARTS;
  hero.facing = 1;
  hero.attackTimer = 0;
  hero.hurtTimer = 0;
  enemies = [];
  bullets = [];
  particles = [];
  defeated = 0;
  bossSpawned = false;
  spawnTimer = 0.8;
  state = "playing";
  startScreen.classList.add("hidden");
  endScreen.classList.add("hidden");
}

function showEnd(won) {
  state = "end";
  endTitle.textContent = won ? "Door Man Wins!" : "Try Again";
  endText.textContent = won ? "The boss has been defeated." : "The bad guys got Door Man.";
  endScreen.classList.remove("hidden");
}

function spawnEnemy(isBoss = false) {
  const size = isBoss ? 1.65 : 1;
  const side = Math.random() < 0.5 ? -1 : 1;
  const shooter = !isBoss && defeated >= 2 && Math.random() < 0.35;
  const enemy = {
    img: shooter ? images.shooter : images.enemies[Math.floor(Math.random() * images.enemies.length)],
    x: side < 0 ? -120 : width + 120,
    y: groundY - 124 * size,
    w: (shooter ? 134 : 92) * size,
    h: 124 * size,
    vx: side < 0 ? 62 + defeated * 2 : -62 - defeated * 2,
    hp: isBoss ? 9 : 2,
    maxHp: isBoss ? 9 : 2,
    boss: isBoss,
    shooter,
    hitTimer: 0,
    attackCooldown: 0,
    shootTimer: shooter ? 1.1 : 0,
  };
  enemies.push(enemy);
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function attackBox() {
  return {
    x: hero.facing > 0 ? hero.x + hero.w - 4 : hero.x - 58,
    y: hero.y + 18,
    w: 62,
    h: 52,
  };
}

function burst(x, y, color = "#171511") {
  for (let i = 0; i < 10; i += 1) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 220,
      vy: (Math.random() - 0.8) * 190,
      life: 0.45 + Math.random() * 0.25,
      color,
    });
  }
}

function damageHero(sourceX) {
  if (hero.hurtTimer > 0) return;
  hero.hearts -= 1;
  hero.hurtTimer = 1.35;
  const pushDirection = sourceX < hero.x ? 1 : -1;
  hero.x += pushDirection * 36;
  burst(hero.x + hero.w / 2, hero.y + 35, "#df3e3e");
  if (hero.hearts <= 0) showEnd(false);
}

function shootBullet(enemy) {
  const direction = enemy.x + enemy.w / 2 < hero.x + hero.w / 2 ? 1 : -1;
  bullets.push({
    x: enemy.x + (direction > 0 ? enemy.w - 18 : 18),
    y: enemy.y + enemy.h * 0.42,
    w: 28,
    h: 10,
    vx: direction * 360,
    life: 2.2,
  });
}

function update(dt) {
  if (state !== "playing") return;

  const left = controls.left || keys.has("ArrowLeft") || keys.has("a");
  const right = controls.right || keys.has("ArrowRight") || keys.has("d");
  const jump = controls.jump || keys.has("ArrowUp") || keys.has("w") || keys.has(" ");
  const attack = controls.attack || keys.has("Enter") || keys.has("j");

  hero.vx = 0;
  if (left) {
    hero.vx = -230;
    hero.facing = -1;
  }
  if (right) {
    hero.vx = 230;
    hero.facing = 1;
  }
  if (jump && hero.grounded) {
    hero.vy = -760;
    hero.grounded = false;
  }
  if (attack && hero.attackTimer <= 0) {
    hero.attackTimer = 0.28;
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

  spawnTimer -= dt;
  if (!bossSpawned && defeated >= 7) {
    bossSpawned = true;
    spawnEnemy(true);
  } else if (!bossSpawned && spawnTimer <= 0 && enemies.length < 3) {
    spawnEnemy(false);
    spawnTimer = 1.4 + Math.random() * 1.2;
  }

  const hitBox = hero.attackTimer > 0 ? attackBox() : null;
  enemies.forEach((enemy) => {
    const towardHero = Math.sign(hero.x - enemy.x) || 1;
    const distance = Math.abs(hero.x - enemy.x);
    const speed = enemy.boss ? 42 : 58 + defeated * 2;
    enemy.vx = enemy.shooter && distance < 360 ? 0 : towardHero * speed;
    enemy.x += enemy.vx * dt;
    enemy.hitTimer = Math.max(0, enemy.hitTimer - dt);
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
    enemy.shootTimer = Math.max(0, enemy.shootTimer - dt);

    if (enemy.shooter && enemy.shootTimer <= 0) {
      shootBullet(enemy);
      burst(enemy.x + enemy.w / 2, enemy.y + enemy.h * 0.42, "#171511");
      enemy.shootTimer = 3;
    }

    if (hitBox && rectsOverlap(hitBox, enemy) && enemy.hitTimer <= 0) {
      enemy.hp -= 1;
      enemy.hitTimer = 0.22;
      enemy.x += hero.facing * 26;
      burst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, enemy.boss ? "#df3e3e" : "#171511");
    }

    if (rectsOverlap(hero, enemy) && hero.hurtTimer <= 0 && enemy.attackCooldown <= 0) {
      enemy.attackCooldown = enemy.boss ? 1.15 : 1.45;
      damageHero(enemy.x + enemy.w / 2);
    }
  });

  bullets.forEach((bullet) => {
    bullet.x += bullet.vx * dt;
    bullet.life -= dt;
    if (rectsOverlap(hero, bullet)) {
      bullet.life = 0;
      damageHero(bullet.x);
    }
  });
  bullets = bullets.filter((bullet) => bullet.life > 0 && bullet.x > -80 && bullet.x < width + 80);

  enemies = enemies.filter((enemy) => {
    if (enemy.hp > 0) return true;
    defeated += enemy.boss ? 0 : 1;
    burst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, "#ffd35a");
    if (enemy.boss) showEnd(true);
    return false;
  });

  particles.forEach((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 520 * dt;
    p.life -= dt;
  });
  particles = particles.filter((p) => p.life > 0);
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, "#8bd3ff");
  sky.addColorStop(1, "#d7f5ff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#fff8d4";
  ctx.beginPath();
  ctx.arc(width - 90, 78, 42, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#72c866";
  ctx.fillRect(0, groundY, width, height - groundY);
  ctx.fillStyle = "#4f9d4d";
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
  const img = attacking ? images.kick : images.hero;
  const scale = attacking ? 1.18 : 1;
  const drawW = hero.w * scale;
  const drawH = hero.h * scale;
  const drawX = hero.x - (drawW - hero.w) / 2;
  const drawY = hero.y - (drawH - hero.h);
  const alpha = hero.hurtTimer > 0 && Math.floor(hero.hurtTimer * 14) % 2 === 0 ? 0.35 : 1;
  drawImageFlipped(img, drawX, drawY, drawW, drawH, hero.facing < 0, alpha);

  if (attacking) {
    const box = attackBox();
    ctx.strokeStyle = "#ffd35a";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(box.x + box.w / 2, box.y + box.h / 2, 34, 0.2, Math.PI * 1.8);
    ctx.stroke();
  }
}

function drawEnemy(enemy) {
  const flipped = enemy.x > hero.x;
  if (enemy.boss) {
    ctx.fillStyle = "rgba(223, 62, 62, 0.2)";
    ctx.beginPath();
    ctx.arc(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, enemy.w * 0.75, 0, Math.PI * 2);
    ctx.fill();
  }
  drawImageFlipped(enemy.img, enemy.x, enemy.y, enemy.w, enemy.h, flipped, enemy.hitTimer > 0 ? 0.55 : 1);
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
    ctx.fillStyle = "#171511";
    ctx.strokeStyle = "#fff8d4";
    ctx.lineWidth = 2;
    roundRect(bullet.x, bullet.y, bullet.w, bullet.h, 5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });
}

function drawHud() {
  ctx.save();
  ctx.fillStyle = "rgba(245, 239, 220, 0.82)";
  ctx.strokeStyle = "#171511";
  ctx.lineWidth = 4;
  roundRect(14, 14, 172, 62, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#171511";
  ctx.font = "900 24px Trebuchet MS, sans-serif";
  ctx.fillText(`Bad guys: ${defeated}/7`, 30, 53);

  const heartPanelWidth = 270;
  const heartPanelX = Math.max(14, width - heartPanelWidth - 14);
  roundRect(heartPanelX, 14, heartPanelWidth, 62, 8);
  ctx.fill();
  ctx.stroke();

  for (let i = 0; i < MAX_HEARTS; i += 1) {
    drawHeart(heartPanelX + 36 + i * 48, 45, i < hero.hearts ? "#df3e3e" : "#fffdf2");
  }

  if (bossSpawned) {
    ctx.fillStyle = "#df3e3e";
    ctx.font = "900 32px Trebuchet MS, sans-serif";
    ctx.fillText("BOSS FIGHT!", Math.max(18, width / 2 - 92), 52);
  }
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
    if (["ArrowLeft", "ArrowRight", "ArrowUp", " ", "Enter"].includes(event.key)) {
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
