(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const $ = (id) => document.getElementById(id);
  const screens = [...document.querySelectorAll('.screen')];
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (min, max) => Math.random() * (max - min) + min;
  const pick = (array) => array[Math.floor(Math.random() * array.length)];
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const SAVE_KEY = 'autoRogueFronteirasSaveV1';
  const defaultSave = {
    crystals: 0,
    bestScore: 0,
    wins: 0,
    unlockedCharacters: ['ranger'],
    unlockedWeapons: ['blaster'],
    unlockedWorlds: ['lava', 'snow', 'desert'],
    upgrades: { vitality: 0, damage: 0, agility: 0, fortune: 0, shield: 0, recovery: 0 },
    settings: { volume: 0.45, particles: true, shake: true }
  };

  function loadSave() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      return parsed ? {
        ...structuredClone(defaultSave),
        ...parsed,
        upgrades: { ...defaultSave.upgrades, ...(parsed.upgrades || {}) },
        settings: { ...defaultSave.settings, ...(parsed.settings || {}) }
      } : structuredClone(defaultSave);
    } catch {
      return structuredClone(defaultSave);
    }
  }

  let save = loadSave();
  const saveGame = () => localStorage.setItem(SAVE_KEY, JSON.stringify(save));

  const CHARACTERS = {
    ranger: {
      id: 'ranger', name: 'Vega', icon: '🧭', cost: 0,
      description: 'Equilibrada, ágil e especialista em reposicionamento.',
      maxHp: 110, speed: 330, jump: 780, damage: 1, attackSpeed: 1,
      special: 'Esquiva reduz brevemente o tempo entre disparos.'
    },
    titan: {
      id: 'titan', name: 'Brutus', icon: '🛡️', cost: 400,
      description: 'Muita vida e proteção, mas movimentação mais pesada.',
      maxHp: 165, speed: 270, jump: 730, damage: 1.12, attackSpeed: 0.88,
      special: 'Recebe um escudo ao entrar em cada sala.'
    },
    nova: {
      id: 'nova', name: 'Nyx', icon: '⚡', cost: 650,
      description: 'Canhão de vidro veloz com grande potencial crítico.',
      maxHp: 82, speed: 370, jump: 820, damage: 1.18, attackSpeed: 1.15,
      special: 'Críticos reduzem o tempo de recarga da esquiva.'
    }
  };

  const WEAPONS = {
    blaster: {
      id: 'blaster', name: 'Carabina Prisma', icon: '🔫', cost: 0,
      description: 'Tiros precisos e confiáveis em média distância.',
      damage: 15, cooldown: 0.34, range: 640, projectileSpeed: 820, pellets: 1, spread: 0, pierce: 0
    },
    scatter: {
      id: 'scatter', name: 'Dispersor Ígneo', icon: '💥', cost: 350,
      description: 'Vários projéteis de curto alcance. Excelente de perto.',
      damage: 8, cooldown: 0.62, range: 430, projectileSpeed: 720, pellets: 5, spread: 0.22, pierce: 0
    },
    rail: {
      id: 'rail', name: 'Arco de Trilho', icon: '🏹', cost: 500,
      description: 'Disparos lentos, fortes e naturalmente perfurantes.',
      damage: 34, cooldown: 0.82, range: 820, projectileSpeed: 1050, pellets: 1, spread: 0, pierce: 2
    }
  };

  const WORLDS = {
    lava: {
      id: 'lava', name: 'Forja Vulcânica', icon: '🌋',
      description: 'Magma, jatos de fogo e criaturas explosivas.',
      skyA: '#2a0c13', skyB: '#090711', fog: '#ff5a26', platform: '#4f2930', edge: '#ff884a',
      enemies: ['chaser', 'flyer', 'shooter', 'bomber'], boss: 'Coração da Caldeira'
    },
    snow: {
      id: 'snow', name: 'Picos do Silêncio', icon: '❄️',
      description: 'Gelo escorregadio, nevasca e ataques congelantes.',
      skyA: '#173451', skyB: '#07121f', fog: '#bfeaff', platform: '#6f91aa', edge: '#e4f7ff',
      enemies: ['chaser', 'flyer', 'shooter', 'jumper'], boss: 'Rei da Geada'
    },
    desert: {
      id: 'desert', name: 'Ruínas de Akar', icon: '🏜️',
      description: 'Areia, ruínas móveis e inimigos subterrâneos.',
      skyA: '#6c351d', skyB: '#1d1220', fog: '#ffd27b', platform: '#8c6846', edge: '#f4c66e',
      enemies: ['chaser', 'shooter', 'burrower', 'jumper'], boss: 'Guardião do Eclipse'
    }
  };

  const PERMANENT_UPGRADES = {
    vitality: { name: 'Constituição', icon: '❤️', description: '+8 de vida máxima por nível.', max: 8, baseCost: 90 },
    damage: { name: 'Calibração', icon: '🎯', description: '+4% de dano por nível.', max: 8, baseCost: 110 },
    agility: { name: 'Servomotores', icon: '👟', description: '+3% de velocidade por nível.', max: 6, baseCost: 120 },
    fortune: { name: 'Extrator', icon: '💎', description: '+8% de cristais mantidos por nível.', max: 6, baseCost: 130 },
    shield: { name: 'Barreira Inicial', icon: '🛡️', description: '+10 de escudo no início da partida.', max: 5, baseCost: 150 },
    recovery: { name: 'Nanorreparo', icon: '➕', description: 'Recupera 2 de vida ao limpar uma sala.', max: 6, baseCost: 140 }
  };

  const BONUS_POOL = [
    { id: 'damage', name: 'Núcleo de Potência', icon: '⚔️', desc: '+25% de dano.', tags: ['Dano'], weight: 10, apply: p => p.damageMul *= 1.25 },
    { id: 'attackSpeed', name: 'Sobrecarga de Cadência', icon: '⚡', desc: '+22% de velocidade de ataque.', tags: ['Velocidade'], weight: 10, apply: p => p.attackSpeedMul *= 1.22 },
    { id: 'maxHp', name: 'Células Reforçadas', icon: '❤️', desc: '+30 de vida máxima e cura 30.', tags: ['Defesa'], weight: 9, apply: p => { p.maxHp += 30; p.hp = Math.min(p.maxHp, p.hp + 30); } },
    { id: 'heal', name: 'Kit de Emergência', icon: '➕', desc: 'Recupera 45% da vida máxima.', tags: ['Cura'], weight: 8, apply: p => p.hp = Math.min(p.maxHp, p.hp + p.maxHp * .45) },
    { id: 'shield', name: 'Barreira Reativa', icon: '🛡️', desc: '+45 de escudo permanente nesta partida.', tags: ['Defesa'], weight: 8, apply: p => { p.maxShield += 45; p.shield += 45; } },
    { id: 'ricochet', name: 'Trajetória Vetorial', icon: '↗️', desc: 'Projéteis ricocheteiam em outro inimigo.', tags: ['Projétil', 'Sinergia'], weight: 7, apply: p => p.ricochet += 1 },
    { id: 'explosive', name: 'Carga Instável', icon: '💥', desc: 'Impactos causam 45% do dano em área.', tags: ['Explosão', 'Área'], weight: 7, apply: p => { p.explosionRadius += 48; p.explosionMul += .45; } },
    { id: 'poison', name: 'Toxina Sintética', icon: '☠️', desc: 'Tiros aplicam veneno acumulável.', tags: ['Veneno', 'Dano contínuo'], weight: 7, apply: p => p.poisonStacks += 1 },
    { id: 'freeze', name: 'Munição Criônica', icon: '❄️', desc: 'Tiros reduzem a velocidade dos inimigos.', tags: ['Gelo', 'Controle'], weight: 7, apply: p => p.freezePower += .18 },
    { id: 'pierce', name: 'Perfurador Magnético', icon: '🪛', desc: 'Projéteis atravessam +2 inimigos.', tags: ['Projétil'], weight: 7, apply: p => p.pierce += 2 },
    { id: 'multishot', name: 'Divisor de Feixe', icon: '🔱', desc: '+2 projéteis com pequena dispersão.', tags: ['Projétil', 'Velocidade'], weight: 6, apply: p => { p.extraProjectiles += 2; p.spread += .11; } },
    { id: 'crit', name: 'Mira Neural', icon: '🎯', desc: '+14% de chance crítica. Críticos causam 2x.', tags: ['Crítico'], weight: 8, apply: p => p.critChance += .14 },
    { id: 'execute', name: 'Protocolo Executor', icon: '🗡️', desc: '+50% de dano contra inimigos abaixo de 35% de vida.', tags: ['Dano'], weight: 6, apply: p => p.executeMul += .5 },
    { id: 'drone', name: 'Drone Sentinela', icon: '🛸', desc: 'Invoca um drone que dispara automaticamente.', tags: ['Companheiro'], weight: 5, apply: p => p.drones += 1 },
    { id: 'onKillHeal', name: 'Sifão Vital', icon: '🩸', desc: 'Eliminações recuperam 2 de vida.', tags: ['Cura', 'Eliminação'], weight: 6, apply: p => p.healOnKill += 2 },
    { id: 'doubleJump', name: 'Propulsor Aéreo', icon: '🪽', desc: 'Concede salto duplo.', tags: ['Movimento'], weight: 6, unique: true, apply: p => p.maxJumps = Math.max(p.maxJumps, 2) },
    { id: 'dash', name: 'Fase Cinética', icon: '💨', desc: '-30% de recarga da esquiva.', tags: ['Movimento'], weight: 6, apply: p => p.dashCooldown *= .7 },
    { id: 'speed', name: 'Aceleradores', icon: '👟', desc: '+18% de velocidade de movimento.', tags: ['Movimento'], weight: 7, apply: p => p.moveSpeedMul *= 1.18 },
    { id: 'chainExplosion', name: 'Reação em Cadeia', icon: '🔥', desc: 'Inimigos explodem ao morrer. Combina com explosão.', tags: ['Explosão', 'Eliminação'], weight: 5, apply: p => p.deathExplosion += 1 },
    { id: 'toxicBurst', name: 'Surto Tóxico', icon: '🧪', desc: 'Inimigos envenenados espalham toxina ao morrer.', tags: ['Veneno', 'Eliminação'], weight: 5, apply: p => p.toxicBurst += 1 }
  ];

  let selectedCharacter = 'ranger';
  let selectedWeapon = 'blaster';
  let selectedWorld = 'lava';
  let gameState = 'menu';
  let lastTime = performance.now();
  let run = null;
  let camera = { x: 0, y: 0, shake: 0 };
  let keys = new Set();
  let particles = [];
  let projectiles = [];
  let enemyProjectiles = [];
  let enemies = [];
  let hazards = [];
  let damageTexts = [];
  let platforms = [];
  let roomDecor = [];
  let audioCtx = null;
  let toastTimer = null;

  function showScreen(id) {
    screens.forEach(s => s.classList.toggle('active', s.id === id));
  }

  function hideScreens() {
    screens.forEach(s => s.classList.remove('active'));
  }

  function toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }

  function beep(type = 'shot', volume = .12) {
    if (!save.settings.volume) return;
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const now = audioCtx.currentTime;
      const map = {
        shot: [420, 180, .06, 'square'],
        hit: [180, 90, .09, 'sawtooth'],
        jump: [250, 480, .12, 'sine'],
        dash: [120, 70, .09, 'triangle'],
        select: [380, 620, .12, 'sine'],
        boss: [85, 45, .35, 'sawtooth'],
        win: [380, 760, .42, 'triangle']
      };
      const [f1, f2, dur, wave] = map[type] || map.shot;
      osc.type = wave;
      osc.frequency.setValueAtTime(f1, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, f2), now + dur);
      gain.gain.setValueAtTime(volume * save.settings.volume, now);
      gain.gain.exponentialRampToValueAtTime(.0001, now + dur);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + dur);
    } catch { /* áudio opcional */ }
  }

  class Player {
    constructor(character, weapon) {
      const vitality = save.upgrades.vitality;
      const permDamage = save.upgrades.damage;
      const permAgility = save.upgrades.agility;
      this.x = 110; this.y = 500; this.w = 42; this.h = 58;
      this.vx = 0; this.vy = 0;
      this.character = character;
      this.weapon = weapon;
      this.maxHp = character.maxHp + vitality * 8;
      this.hp = this.maxHp;
      this.maxShield = save.upgrades.shield * 10;
      this.shield = this.maxShield;
      this.baseSpeed = character.speed * (1 + permAgility * .03);
      this.jumpForce = character.jump;
      this.damageMul = character.damage * (1 + permDamage * .04);
      this.attackSpeedMul = character.attackSpeed;
      this.moveSpeedMul = 1;
      this.grounded = false;
      this.facing = 1;
      this.jumpCount = 0;
      this.maxJumps = 1;
      this.fireTimer = 0;
      this.dashTimer = 0;
      this.dashCooldown = 1.15;
      this.dashDuration = 0;
      this.invuln = 0;
      this.hitFlash = 0;
      this.ricochet = 0;
      this.explosionRadius = 0;
      this.explosionMul = 0;
      this.poisonStacks = 0;
      this.freezePower = 0;
      this.pierce = weapon.pierce;
      this.extraProjectiles = 0;
      this.spread = weapon.spread;
      this.critChance = .05;
      this.critMul = 2;
      this.executeMul = 0;
      this.drones = 0;
      this.healOnKill = 0;
      this.deathExplosion = 0;
      this.toxicBurst = 0;
      this.damageTaken = 0;
      this.kills = 0;
      this.lastTarget = null;
    }

    get center() { return { x: this.x + this.w / 2, y: this.y + this.h / 2 }; }

    update(dt) {
      this.fireTimer -= dt;
      this.dashTimer -= dt;
      this.invuln -= dt;
      this.hitFlash -= dt;

      if (this.dashDuration > 0) {
        this.dashDuration -= dt;
        this.vx = this.facing * 850;
        this.vy *= .86;
      } else {
        const left = keys.has('ArrowLeft') || keys.has('KeyA');
        const right = keys.has('ArrowRight') || keys.has('KeyD');
        const input = (right ? 1 : 0) - (left ? 1 : 0);
        const target = input * this.baseSpeed * this.moveSpeedMul;
        this.vx = lerp(this.vx, target, 1 - Math.pow(.0001, dt));
        if (!input) this.vx *= Math.pow(.001, dt);
        if (input) this.facing = input;
      }

      this.vy += 1650 * dt;
      this.x += this.vx * dt;
      this.resolveX();
      this.y += this.vy * dt;
      this.grounded = false;
      this.resolveY();

      this.x = clamp(this.x, 20, W - this.w - 20);
      if (this.y > H + 120) this.takeDamage(24, this.x, this.y, true);

      const target = chooseTarget(this);
      this.lastTarget = target;
      if (target && this.fireTimer <= 0 && gameState === 'playing') this.fire(target);

      updateDrones(this, dt);
    }

    resolveX() {
      for (const p of platforms) {
        if (!rectsOverlap(this, p)) continue;
        if (this.vx > 0) this.x = p.x - this.w;
        else if (this.vx < 0) this.x = p.x + p.w;
        this.vx = 0;
      }
    }

    resolveY() {
      for (const p of platforms) {
        if (!rectsOverlap(this, p)) continue;
        if (this.vy > 0 && this.y + this.h - this.vy * .016 <= p.y + 8) {
          this.y = p.y - this.h;
          this.vy = 0;
          this.grounded = true;
          this.jumpCount = 0;
        } else if (this.vy < 0) {
          this.y = p.y + p.h;
          this.vy = 0;
        }
      }
    }

    jump() {
      if (this.grounded || this.jumpCount < this.maxJumps) {
        this.vy = -this.jumpForce;
        this.grounded = false;
        this.jumpCount++;
        spawnBurst(this.x + this.w / 2, this.y + this.h, '#b8fff2', 8, 130);
        beep('jump', .09);
      }
    }

    dash() {
      if (this.dashTimer > 0 || this.dashDuration > 0) return;
      this.dashTimer = this.dashCooldown;
      this.dashDuration = .18;
      this.invuln = .25;
      if (this.character.id === 'ranger') this.fireTimer -= .22;
      spawnBurst(this.x + this.w / 2, this.y + this.h / 2, '#6fffe2', 18, 260);
      beep('dash', .14);
    }

    fire(target) {
      const source = this.center;
      const aim = { x: target.x + target.w / 2, y: target.y + target.h / 2 };
      const baseAngle = Math.atan2(aim.y - source.y, aim.x - source.x);
      const total = this.weapon.pellets + this.extraProjectiles;
      for (let i = 0; i < total; i++) {
        const offset = total === 1 ? 0 : (i - (total - 1) / 2) * this.spread;
        const angle = baseAngle + offset;
        projectiles.push(new Projectile(
          source.x, source.y,
          Math.cos(angle) * this.weapon.projectileSpeed,
          Math.sin(angle) * this.weapon.projectileSpeed,
          this.weapon.damage * this.damageMul,
          this.weapon.range / this.weapon.projectileSpeed,
          this
        ));
      }
      this.fireTimer = this.weapon.cooldown / this.attackSpeedMul;
      this.facing = Math.cos(baseAngle) >= 0 ? 1 : -1;
      spawnBurst(source.x + this.facing * 12, source.y, '#8ffff0', 4, 80);
      beep('shot', .055);
    }

    takeDamage(amount, sx, sy, forceRespawn = false) {
      if (this.invuln > 0) return;
      let remaining = amount;
      if (this.shield > 0) {
        const absorbed = Math.min(this.shield, remaining);
        this.shield -= absorbed;
        remaining -= absorbed;
      }
      this.hp -= remaining;
      this.damageTaken += amount;
      this.invuln = .7;
      this.hitFlash = .18;
      this.vx = this.x + this.w / 2 < sx ? -310 : 310;
      this.vy = -280;
      damageTexts.push({ x: this.x + this.w / 2, y: this.y, text: `-${Math.round(amount)}`, color: '#ff6878', life: .8 });
      camera.shake = Math.max(camera.shake, 9);
      spawnBurst(this.x + this.w / 2, this.y + this.h / 2, '#ff6172', 16, 220);
      beep('hit', .15);
      if (forceRespawn && this.hp > 0) { this.x = 110; this.y = 450; this.vx = 0; this.vy = 0; }
      if (this.hp <= 0) endRun(false);
    }

    draw() {
      const c = this.center;
      ctx.save();
      if (this.invuln > 0 && Math.floor(this.invuln * 14) % 2 === 0) ctx.globalAlpha = .4;
      ctx.translate(c.x, c.y);
      ctx.scale(this.facing, 1);
      if (this.hitFlash > 0) ctx.filter = 'brightness(2.2)';

      const suit = this.character.id === 'titan' ? '#f7c85b' : this.character.id === 'nova' ? '#b783ff' : '#61efcf';
      const trim = this.character.id === 'titan' ? '#7a5420' : this.character.id === 'nova' ? '#44306d' : '#126b64';
      ctx.fillStyle = 'rgba(0,0,0,.22)';
      ctx.beginPath(); ctx.ellipse(0, 33, 24, 7, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = trim;
      roundRect(ctx, -16, -9, 32, 35, 9, true);
      ctx.fillStyle = suit;
      roundRect(ctx, -18, -27, 36, 39, 12, true);
      ctx.fillStyle = '#0f1b2e';
      roundRect(ctx, -15, -23, 30, 18, 8, true);
      ctx.fillStyle = '#d9ffff';
      roundRect(ctx, 1, -18, 12, 5, 3, true);
      ctx.fillStyle = '#24344d';
      roundRect(ctx, -17, -6, 9, 24, 4, true);
      roundRect(ctx, 8, -6, 9, 24, 4, true);
      ctx.fillStyle = '#1b2c44';
      roundRect(ctx, -14, 18, 10, 18, 4, true);
      roundRect(ctx, 4, 18, 10, 18, 4, true);
      ctx.fillStyle = '#e8f4ff';
      roundRect(ctx, 12, -5, 30, 8, 4, true);
      ctx.fillStyle = '#6fffe2';
      ctx.fillRect(34, -3, 5, 4);
      ctx.restore();

      if (this.lastTarget) {
        ctx.strokeStyle = 'rgba(98,255,222,.35)';
        ctx.setLineDash([5, 8]);
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(this.lastTarget.x + this.lastTarget.w/2, this.lastTarget.y + this.lastTarget.h/2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  class Enemy {
    constructor(type, x, y, elite = false, boss = false) {
      this.type = type; this.x = x; this.y = y;
      this.w = boss ? 110 : type === 'flyer' ? 42 : 48;
      this.h = boss ? 118 : 48;
      this.vx = 0; this.vy = 0;
      this.elite = elite; this.boss = boss;
      this.maxHp = boss ? 1150 + run.room * 160 : (type === 'chaser' ? 64 : type === 'bomber' ? 48 : 76) * (elite ? 2.25 : 1) * (1 + run.room * .16);
      this.hp = this.maxHp;
      this.speed = boss ? 105 : (type === 'flyer' ? 125 : type === 'chaser' ? 140 : 90) * (elite ? 1.12 : 1);
      this.damage = (boss ? 20 : 10 + run.room * 1.2) * (elite ? 1.35 : 1);
      this.attackTimer = rand(.2, 1.3);
      this.specialTimer = rand(1.4, 2.8);
      this.hitFlash = 0;
      this.grounded = false;
      this.dead = false;
      this.poison = 0;
      this.poisonTimer = 0;
      this.slow = 0;
      this.phase = 1;
      this.telegraph = 0;
      this.hidden = type === 'burrower';
      this.visibleTimer = this.hidden ? rand(.8, 1.6) : 0;
      this.lastHitBy = null;
    }

    get center() { return { x: this.x + this.w / 2, y: this.y + this.h / 2 }; }

    update(dt) {
      if (this.dead) return;
      this.attackTimer -= dt;
      this.specialTimer -= dt;
      this.hitFlash -= dt;
      this.poisonTimer -= dt;
      this.slow = Math.max(0, this.slow - dt * .1);

      if (this.poison > 0 && this.poisonTimer <= 0) {
        this.poisonTimer = .55;
        this.takeDamage(this.poison * 2.2, null, false, '#9cff66');
      }

      if (this.boss) {
        this.updateBoss(dt);
        return;
      }

      if (this.type === 'burrower') {
        this.visibleTimer -= dt;
        if (this.visibleTimer <= 0) {
          this.hidden = !this.hidden;
          this.visibleTimer = this.hidden ? rand(1.1, 1.8) : rand(1.8, 2.8);
          if (!this.hidden) { this.x = clamp(run.player.x + rand(-300, 300), 80, W - 130); spawnBurst(this.x, this.y + this.h, '#f4c66e', 20, 190); }
        }
        if (this.hidden) return;
      }

      const p = run.player;
      const slowMul = 1 - clamp(this.slow, 0, .65);
      const dx = (p.x + p.w/2) - (this.x + this.w/2);
      const dy = (p.y + p.h/2) - (this.y + this.h/2);

      if (this.type === 'flyer') {
        this.vx = Math.sign(dx) * this.speed * slowMul;
        this.vy = clamp(dy * 1.8, -this.speed, this.speed) * slowMul;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
      } else {
        if (this.type === 'shooter') {
          const desired = Math.abs(dx) < 320 ? -Math.sign(dx) : Math.abs(dx) > 500 ? Math.sign(dx) : 0;
          this.vx = lerp(this.vx, desired * this.speed * slowMul, .08);
          if (this.attackTimer <= 0 && lineOfSight(this.center, p.center)) {
            this.attackTimer = this.elite ? 1.0 : 1.5;
            fireEnemyProjectile(this.center, p.center, this.damage, this.elite ? 430 : 360);
          }
        } else if (this.type === 'jumper') {
          this.vx = lerp(this.vx, Math.sign(dx) * this.speed * slowMul, .05);
          if (this.grounded && this.specialTimer <= 0) { this.vy = -620; this.specialTimer = rand(1.5, 2.5); }
        } else if (this.type === 'bomber') {
          this.vx = lerp(this.vx, Math.sign(dx) * this.speed * 1.25 * slowMul, .09);
          if (Math.abs(dx) < 65 && Math.abs(dy) < 80) this.explode();
        } else {
          this.vx = lerp(this.vx, Math.sign(dx) * this.speed * slowMul, .08);
        }

        this.vy += 1500 * dt;
        this.x += this.vx * dt;
        this.resolveX();
        this.y += this.vy * dt;
        this.grounded = false;
        this.resolveY();
      }

      if (rectsOverlap(this, p)) p.takeDamage(this.damage, this.x + this.w/2, this.y + this.h/2);
      if (this.y > H + 100) { this.y = 100; this.x = rand(700, 1120); }
    }

    updateBoss(dt) {
      const p = run.player;
      const hpRatio = this.hp / this.maxHp;
      this.phase = hpRatio < .35 ? 3 : hpRatio < .68 ? 2 : 1;
      const dx = p.x - this.x;
      this.vx = lerp(this.vx, Math.sign(dx) * this.speed * (this.phase === 3 ? 1.35 : 1), .035);
      this.vy += 1500 * dt;
      this.x += this.vx * dt;
      this.resolveX();
      this.y += this.vy * dt;
      this.grounded = false;
      this.resolveY();
      this.x = clamp(this.x, 80, W - this.w - 80);

      if (this.specialTimer <= 0 && this.telegraph <= 0) {
        this.telegraph = this.phase === 3 ? .55 : .8;
        this.specialTimer = this.phase === 1 ? 2.8 : this.phase === 2 ? 2.2 : 1.65;
      }
      if (this.telegraph > 0) {
        this.telegraph -= dt;
        if (this.telegraph <= 0) this.bossAttack();
      }

      if (this.attackTimer <= 0) {
        this.attackTimer = this.phase === 3 ? 1.0 : 1.45;
        fireEnemyProjectile(this.center, p.center, this.damage, this.phase === 3 ? 500 : 410, this.phase);
      }

      if (rectsOverlap(this, p)) p.takeDamage(this.damage * 1.15, this.x, this.y);
    }

    bossAttack() {
      const world = run.world.id;
      if (world === 'lava') {
        for (let i = 0; i < 5 + this.phase * 2; i++) {
          const x = 120 + i * ((W - 240) / (4 + this.phase * 2));
          hazards.push({ type: 'firePillar', x, y: H - 160, w: 42, h: 120, timer: .85, active: .55, damage: this.damage * 1.2 });
        }
      } else if (world === 'snow') {
        for (let i = 0; i < 7 + this.phase; i++) {
          enemyProjectiles.push({ x: rand(40, W - 40), y: -20, vx: rand(-50, 50), vy: rand(300, 500), r: 10 + this.phase * 2, damage: this.damage, life: 3, color: '#c9f4ff', ice: true });
        }
      } else {
        for (let i = 0; i < 3 + this.phase; i++) {
          const x = clamp(run.player.x + rand(-260, 260), 50, W - 80);
          hazards.push({ type: 'sandSpike', x, y: H - 110, w: 50, h: 80, timer: .75, active: .35, damage: this.damage * 1.3 });
        }
      }
      camera.shake = 12;
      beep('boss', .18);
    }

    resolveX() {
      for (const p of platforms) {
        if (!rectsOverlap(this, p)) continue;
        if (this.vx > 0) this.x = p.x - this.w;
        else if (this.vx < 0) this.x = p.x + p.w;
        this.vx *= -.15;
      }
    }

    resolveY() {
      for (const p of platforms) {
        if (!rectsOverlap(this, p)) continue;
        if (this.vy > 0) { this.y = p.y - this.h; this.vy = 0; this.grounded = true; }
        else { this.y = p.y + p.h; this.vy = 0; }
      }
    }

    takeDamage(amount, projectile, critical = false, color = null) {
      if (this.dead || this.hidden) return;
      this.hp -= amount;
      this.hitFlash = .12;
      this.lastHitBy = projectile;
      damageTexts.push({ x: this.x + this.w/2, y: this.y, text: `${critical ? 'CRIT ' : ''}${Math.round(amount)}`, color: color || (critical ? '#ffdc6b' : '#ffffff'), life: .65 });
      spawnBurst(this.x + this.w/2, this.y + this.h/2, color || '#ffffff', critical ? 10 : 5, critical ? 170 : 90);
      if (this.hp <= 0) this.die();
    }

    explode() {
      if (this.dead) return;
      const c = this.center;
      areaDamage(c.x, c.y, 105, this.damage * 1.5, false, null);
      if (dist(c, run.player.center) < 110) run.player.takeDamage(this.damage * 1.5, c.x, c.y);
      spawnBurst(c.x, c.y, '#ff7a3c', 30, 280);
      this.dead = true;
      this.hp = 0;
      if (enemies.length && enemies.every(e => e.dead)) clearEnemyAttacks();
    }

    die() {
      if (this.dead) return;
      this.dead = true;
      run.player.kills++;
      run.coins += this.boss ? 180 : this.elite ? 22 : 8;
      run.score += this.boss ? 2500 : this.elite ? 240 : 85;
      run.player.hp = Math.min(run.player.maxHp, run.player.hp + run.player.healOnKill);
      const c = this.center;
      spawnBurst(c.x, c.y, this.boss ? '#ffd15a' : run.world.fog, this.boss ? 70 : 18, this.boss ? 420 : 210);
      if (run.player.deathExplosion) areaDamage(c.x, c.y, 80 + run.player.deathExplosion * 15, 18 * run.player.deathExplosion * run.player.damageMul, true, this);
      if (run.player.toxicBurst && this.poison > 0) {
        enemies.forEach(e => { if (!e.dead && e !== this && dist(e.center, c) < 150) e.poison += run.player.toxicBurst; });
      }
      if (enemies.length && enemies.every(e => e.dead)) clearEnemyAttacks();
      if (this.boss) {
        beep('win', .22);
        setTimeout(() => endRun(true), 900);
      }
    }

    draw() {
      if (this.hidden) {
        ctx.fillStyle = 'rgba(244,198,110,.3)';
        ctx.beginPath(); ctx.ellipse(this.x + this.w/2, this.y + this.h, this.w*.7, 9, 0, 0, Math.PI*2); ctx.fill();
        return;
      }
      const c = this.center;
      ctx.save();
      ctx.translate(c.x, c.y);
      if (this.hitFlash > 0) ctx.filter = 'brightness(2.5)';
      const color = this.boss ? '#ffba55' : this.elite ? '#d27cff' : this.type === 'flyer' ? '#ff8e6d' : this.type === 'shooter' ? '#70b7ff' : this.type === 'bomber' ? '#ff596d' : '#f1f5f9';
      ctx.fillStyle = 'rgba(0,0,0,.24)';
      ctx.beginPath(); ctx.ellipse(0, this.h*.45, this.w*.45, 7, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = color;
      if (this.type === 'flyer') {
        ctx.beginPath(); ctx.moveTo(-25, 4); ctx.quadraticCurveTo(-8, -28, 0, -5); ctx.quadraticCurveTo(8, -28, 25, 4); ctx.lineTo(0, 20); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#351927';
        ctx.beginPath(); ctx.arc(0, 1, 13, 0, Math.PI*2); ctx.fill();
      } else {
        roundRect(ctx, -this.w/2, -this.h/2, this.w, this.h, this.boss ? 22 : 10, true);
        ctx.fillStyle = this.type === 'bomber' ? '#641f2c' : this.type === 'shooter' ? '#183b61' : '#26344b';
        roundRect(ctx, -this.w*.38, -this.h*.38, this.w*.76, this.h*.2, 8, true);
        if (this.type === 'jumper') {
          ctx.fillStyle = '#93ffd7';
          roundRect(ctx, -this.w*.38, this.h*.28, 12, 16, 5, true);
          roundRect(ctx, this.w*.13, this.h*.28, 12, 16, 5, true);
        }
      }
      ctx.fillStyle = '#142033';
      roundRect(ctx, -this.w*.28, -this.h*.18, this.w*.56, this.h*.28, 5, true);
      ctx.fillStyle = '#ffef9a';
      ctx.fillRect(this.w*.06, -this.h*.1, this.w*.14, 4);
      ctx.fillStyle = '#ff6b78';
      ctx.fillRect(-this.w*.2, -this.h*.1, this.w*.14, 4);
      if (this.type === 'shooter') {
        ctx.fillStyle = '#dbeafe';
        roundRect(ctx, this.w*.18, -2, this.w*.42, 8, 4, true);
      }
      if (this.telegraph > 0) {
        ctx.strokeStyle = '#ff495b'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, 0, this.w*.75 + (1-this.telegraph)*20, 0, Math.PI*2); ctx.stroke();
      }
      ctx.restore();

      if (!this.boss) {
        const ratio = clamp(this.hp / this.maxHp, 0, 1);
        ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(this.x, this.y - 10, this.w, 5);
        ctx.fillStyle = this.elite ? '#ce75ff' : '#ff6e78'; ctx.fillRect(this.x, this.y - 10, this.w * ratio, 5);
      }
      if (this.poison > 0) { ctx.fillStyle = '#9cff66'; ctx.fillText('☠', this.x - 3, this.y + 10); }
      if (this.slow > 0) { ctx.fillStyle = '#bcefff'; ctx.fillText('❄', this.x + this.w - 8, this.y + 10); }
    }
  }

  class Projectile {
    constructor(x, y, vx, vy, damage, life, owner) {
      this.x = x; this.y = y; this.vx = vx; this.vy = vy;
      this.damage = damage; this.life = life; this.owner = owner;
      this.r = 5; this.dead = false; this.hit = new Set();
      this.pierce = owner.pierce; this.ricochet = owner.ricochet;
    }
    update(dt) {
      this.life -= dt;
      if (this.life <= 0) this.dead = true;
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.x < -20 || this.x > W + 20 || this.y < -20 || this.y > H + 20) this.dead = true;
      for (const p of platforms) {
        if (pointInRect(this.x, this.y, p)) { this.dead = true; spawnBurst(this.x, this.y, '#c7fff4', 4, 70); return; }
      }
      for (const e of enemies) {
        if (e.dead || e.hidden || this.hit.has(e)) continue;
        if (circleRect(this, e)) { this.hitEnemy(e); if (this.dead) return; }
      }
    }
    hitEnemy(e) {
      this.hit.add(e);
      let amount = this.damage;
      if (e.hp / e.maxHp < .35) amount *= 1 + this.owner.executeMul;
      const critical = Math.random() < this.owner.critChance;
      if (critical) amount *= this.owner.critMul;
      e.takeDamage(amount, this, critical);
      if (this.owner.poisonStacks) e.poison += this.owner.poisonStacks;
      if (this.owner.freezePower) e.slow = clamp(e.slow + this.owner.freezePower, 0, .72);
      if (this.owner.explosionRadius) areaDamage(this.x, this.y, this.owner.explosionRadius, amount * this.owner.explosionMul, true, e);
      if (critical && this.owner.character.id === 'nova') this.owner.dashTimer = Math.max(0, this.owner.dashTimer - .25);
      if (this.pierce > 0) { this.pierce--; return; }
      if (this.ricochet > 0) {
        const next = enemies.filter(n => !n.dead && !n.hidden && !this.hit.has(n) && dist(n.center, this) < 260).sort((a,b) => dist(a.center,this)-dist(b.center,this))[0];
        if (next) {
          const a = Math.atan2(next.center.y-this.y, next.center.x-this.x);
          const s = Math.hypot(this.vx, this.vy);
          this.vx = Math.cos(a)*s; this.vy = Math.sin(a)*s; this.ricochet--; return;
        }
      }
      this.dead = true;
    }
    draw() {
      ctx.fillStyle = '#9effeb';
      ctx.shadowColor = '#6fffe4'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function rectsOverlap(a, b) { return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }
  function pointInRect(x, y, r) { return x >= r.x && x <= r.x+r.w && y >= r.y && y <= r.y+r.h; }
  function circleRect(c, r) {
    const x = clamp(c.x, r.x, r.x+r.w), y = clamp(c.y, r.y, r.y+r.h);
    return (c.x-x)**2 + (c.y-y)**2 < c.r**2;
  }
  function segmentIntersectsRect(a, b, r) {
    const steps = Math.ceil(Math.hypot(b.x-a.x, b.y-a.y) / 18);
    for (let i=1; i<steps; i++) {
      const t=i/steps, x=lerp(a.x,b.x,t), y=lerp(a.y,b.y,t);
      if (pointInRect(x,y,r)) return true;
    }
    return false;
  }
  function lineOfSight(a, b) { return !platforms.some(p => segmentIntersectsRect(a, b, p)); }

  function chooseTarget(player) {
    const source = player.center;
    return enemies
      .filter(e => !e.dead && !e.hidden && dist(source, e.center) <= player.weapon.range && lineOfSight(source, e.center))
      .map(e => {
        const d = dist(source, e.center);
        const danger = e.boss ? 260 : e.elite ? 130 : e.type === 'bomber' ? 90 : e.type === 'shooter' ? 55 : 0;
        const facingBonus = Math.sign(e.center.x-source.x) === player.facing ? 28 : 0;
        return { e, score: d - danger - facingBonus };
      })
      .sort((a,b) => a.score-b.score)[0]?.e || null;
  }

  function areaDamage(x, y, radius, damage, affectsEnemies, excluded) {
    spawnBurst(x, y, '#ffb04a', 16, radius * 2.4);
    if (affectsEnemies) {
      enemies.forEach(e => { if (!e.dead && e !== excluded && dist(e.center,{x,y}) < radius) e.takeDamage(damage, null, false, '#ffb04a'); });
    }
  }

  function clearEnemyAttacks() {
    enemyProjectiles = [];
    hazards = hazards.filter(h => h.type !== 'firePillar' && h.type !== 'sandSpike');
  }

  function fireEnemyProjectile(from, to, damage, speed, spreadCount = 1) {
    const base = Math.atan2(to.y-from.y, to.x-from.x);
    for (let i=0; i<spreadCount; i++) {
      const offset = spreadCount===1 ? 0 : (i-(spreadCount-1)/2)*.16;
      enemyProjectiles.push({ x:from.x, y:from.y, vx:Math.cos(base+offset)*speed, vy:Math.sin(base+offset)*speed, r:7, damage, life:3, color:'#ff6478' });
    }
  }

  function updateEnemyProjectiles(dt) {
    for (const p of enemyProjectiles) {
      p.life -= dt; p.x += p.vx*dt; p.y += p.vy*dt;
      if (circleRect(p, run.player)) { run.player.takeDamage(p.damage, p.x,p.y); p.life=0; if (p.ice) run.player.vx *= .45; }
      if (platforms.some(r => pointInRect(p.x,p.y,r))) p.life=0;
    }
    enemyProjectiles = enemyProjectiles.filter(p=>p.life>0 && p.x>-40&&p.x<W+40&&p.y>-60&&p.y<H+60);
  }

  const droneTimers = new Map();
  function updateDrones(player, dt) {
    for (let i=0;i<player.drones;i++) {
      const timer = (droneTimers.get(i) || 0) - dt;
      if (timer <= 0) {
        const target = chooseTarget(player);
        if (target) {
          const angle = performance.now()/700 + i*Math.PI*2/Math.max(1,player.drones);
          const source = {x:player.center.x+Math.cos(angle)*52,y:player.center.y-25+Math.sin(angle)*22};
          const a = Math.atan2(target.center.y-source.y,target.center.x-source.x);
          projectiles.push(new Projectile(source.x,source.y,Math.cos(a)*720,Math.sin(a)*720,8*player.damageMul,1.2,player));
          droneTimers.set(i,.75);
        } else droneTimers.set(i,.1);
      } else droneTimers.set(i,timer);
    }
  }

  function spawnBurst(x,y,color,count=10,speed=120) {
    if (!save.settings.particles) return;
    for (let i=0;i<count;i++) {
      const a=rand(0,Math.PI*2), s=rand(speed*.25,speed);
      particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.25,.75),maxLife:.75,color,size:rand(2,6)});
    }
  }

  function generateRoom(roomIndex, bossRoom) {
    platforms = [{x:0,y:H-70,w:W,h:90}];
    hazards = [];
    roomDecor = [];
    const layouts = [
      [{x:190,y:520,w:190,h:24},{x:465,y:430,w:210,h:24},{x:790,y:520,w:190,h:24},{x:1010,y:370,w:170,h:24}],
      [{x:130,y:430,w:210,h:24},{x:430,y:540,w:180,h:24},{x:700,y:390,w:220,h:24},{x:1030,y:500,w:170,h:24}],
      [{x:170,y:530,w:150,h:24},{x:390,y:410,w:220,h:24},{x:700,y:540,w:180,h:24},{x:940,y:370,w:220,h:24}],
      [{x:120,y:500,w:230,h:24},{x:470,y:360,w:200,h:24},{x:800,y:480,w:270,h:24}]
    ];
    const layout = bossRoom ? [{x:180,y:470,w:180,h:24},{x:920,y:470,w:180,h:24}] : layouts[roomIndex % layouts.length];
    platforms.push(...layout);

    for (let i=0;i<18;i++) roomDecor.push({x:rand(0,W),y:rand(30,H-80),size:rand(3,13),phase:rand(0,10)});

    if (!bossRoom) {
      if (run.world.id==='lava') hazards.push({type:'lavaPool',x:560,y:H-83,w:150,h:18,damage:13});
      if (run.world.id==='snow') hazards.push({type:'iceFloor',x:340,y:H-75,w:220,h:12,damage:0});
      if (run.world.id==='desert') hazards.push({type:'quicksand',x:610,y:H-78,w:200,h:18,damage:5});
    }
  }

  function spawnRoomEnemies() {
    enemies = []; projectiles = []; enemyProjectiles = [];
    const bossRoom = run.room === run.totalRooms - 1;
    generateRoom(run.room, bossRoom);
    run.player.x=90; run.player.y=470; run.player.vx=0; run.player.vy=0;
    if (run.player.character.id === 'titan') run.player.shield = Math.min(run.player.maxShield+25, run.player.shield+25);

    if (bossRoom) {
      enemies.push(new Enemy('boss', 990, 400, false, true));
      $('bossHud').classList.remove('hidden');
      $('bossName').textContent = run.world.boss.toUpperCase();
      beep('boss', .12);
    } else {
      $('bossHud').classList.add('hidden');
      const count = 4 + run.room * 2;
      for (let i=0;i<count;i++) {
        const type = pick(run.world.enemies);
        const eliteChance = run.room >= 2 ? .12 + run.room*.04 : 0;
        const elite = Math.random() < eliteChance;
        const x = rand(560, 1160), y = type==='flyer'?rand(160,430):rand(100,300);
        enemies.push(new Enemy(type,x,y,elite));
      }
    }
    updateRoomProgress();
    toast(bossRoom ? 'CHEFE DA FRONTEIRA' : `SALA ${run.room+1}: PORTAS BLOQUEADAS`);
  }

  function beginRun() {
    const character = CHARACTERS[selectedCharacter];
    const weapon = WEAPONS[selectedWeapon];
    const world = WORLDS[selectedWorld];
    run = {
      player: new Player(character,weapon), world,
      room:0,totalRooms:8,roomsCleared:0,coins:0,score:0,bonuses:[],roomClearTimer:0,awaitingDoor:false,
      startedAt:performance.now(), ended:false
    };
    camera={x:0,y:0,shake:0}; particles=[]; damageTexts=[]; droneTimers.clear();
    gameState='playing'; hideScreens();
    $('hud').classList.remove('hidden'); $('buildPanel').classList.remove('hidden'); $('touchControls').classList.remove('hidden');
    updateBuildPanel(); spawnRoomEnemies(); updateHud();
  }

  function roomCleared() {
    if (run.roomClearTimer > 0 || run.ended) return;
    clearEnemyAttacks();
    run.roomClearTimer = 1.1;
    run.roomsCleared++;
    run.score += 350 + run.room*120;
    run.player.hp = Math.min(run.player.maxHp, run.player.hp + save.upgrades.recovery*2);
    toast('SALA LIMPA');
  }

  function presentBonuses() {
    gameState='bonus';
    const choices=[];
    const available = BONUS_POOL.filter(isBonusAvailable);
    while(choices.length<3 && available.length) {
      const weighted=[];
      available.forEach(b=>{for(let i=0;i<b.weight;i++) weighted.push(b);});
      const choice=pick(weighted);
      if(!choices.includes(choice)) choices.push(choice);
    }
    $('bonusChoices').innerHTML='';
    choices.forEach(b=>{
      const card=document.createElement('button'); card.className='bonus-card';
      card.innerHTML=`<div class="icon">${b.icon}</div><h4>${b.name}</h4><p>${b.desc}</p><span class="rarity">APRIMORAMENTO</span><div class="synergy">${b.tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div>`;
      card.onclick=()=>chooseBonus(b);
      $('bonusChoices').appendChild(card);
    });
    showScreen('bonusScreen'); beep('select',.09);
  }

  function chooseBonus(bonus) {
    if (!isBonusAvailable(bonus)) return;
    bonus.apply(run.player); run.bonuses.push(bonus);
    updateBuildPanel(); hideScreens(); gameState='playing';
    run.roomClearTimer=0; run.awaitingDoor=true;
    toast('PORTA ABERTA À DIREITA');
    beep('select',.12);
  }

  function isBonusAvailable(bonus) {
    if (!bonus.unique) return true;
    if (run.bonuses.some(x => x.id === bonus.id)) return false;
    if (bonus.id === 'doubleJump' && run.player.maxJumps >= 2) return false;
    return true;
  }

  function endRun(victory) {
    if (!run || run.ended) return;
    run.ended=true; gameState='result';
    const baseRate = victory ? .55 : .28;
    const crystalGain = Math.floor(run.coins * baseRate * (1 + save.upgrades.fortune*.08) + run.roomsCleared*8 + (victory?80:0));
    save.crystals += crystalGain;
    save.bestScore = Math.max(save.bestScore, Math.floor(run.score));
    if (victory) save.wins++;
    saveGame();
    $('hud').classList.add('hidden'); $('buildPanel').classList.add('hidden'); $('touchControls').classList.add('hidden');
    $('resultEyebrow').textContent=victory?'FRONTEIRA CONQUISTADA':'EXPEDIÇÃO ENCERRADA';
    $('resultTitle').textContent=victory?'Chefe derrotado!':'Você foi derrotado';
    $('resultSummary').textContent=victory?`A ${run.world.name} foi estabilizada. Sua construção ficará registrada.`:'Parte dos recursos foi recuperada pelo Núcleo da Fronteira.';
    $('resultScore').textContent=Math.floor(run.score);
    $('resultCoins').textContent=run.coins;
    $('resultCrystals').textContent=crystalGain;
    $('resultRooms').textContent=`${run.roomsCleared}/${run.totalRooms}`;
    $('resultBonuses').innerHTML=run.bonuses.length?run.bonuses.map(b=>`<span class="tag">${b.icon} ${b.name}</span>`).join(''):'<span class="tag">Nenhum bônus adquirido</span>';
    showScreen('resultScreen'); updateMenuStats();
  }

  function updateHazards(dt) {
    for(const h of hazards) {
      if(h.timer!=null) h.timer-=dt;
      if(h.active!=null && h.timer<=0) h.active-=dt;
      if(h.type==='lavaPool' && rectsOverlap(run.player,h)) run.player.takeDamage(h.damage,h.x+h.w/2,h.y);
      if(h.type==='quicksand' && rectsOverlap(run.player,h)) {run.player.vx*=.9; if(Math.random()<dt*.8) run.player.takeDamage(h.damage,h.x+h.w/2,h.y);}
      if(h.type==='iceFloor' && rectsOverlap(run.player,h)) run.player.vx*=1.018;
      if((h.type==='firePillar'||h.type==='sandSpike') && h.timer<=0 && h.active>0 && rectsOverlap(run.player,h)) run.player.takeDamage(h.damage,h.x+h.w/2,h.y);
    }
    hazards=hazards.filter(h=>h.active==null||h.active>0);
  }

  function update(dt) {
    if(gameState!=='playing'||!run||run.ended) return;
    run.player.update(dt);
    enemies.forEach(e=>e.update(dt));
    projectiles.forEach(p=>p.update(dt));
    projectiles=projectiles.filter(p=>!p.dead);
    updateEnemyProjectiles(dt); updateHazards(dt);
    particles.forEach(p=>{p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=180*dt;p.vx*=Math.pow(.12,dt);});
    particles=particles.filter(p=>p.life>0);
    damageTexts.forEach(t=>{t.life-=dt;t.y-=36*dt;}); damageTexts=damageTexts.filter(t=>t.life>0);

    if(enemies.length && enemies.every(e=>e.dead) && run.room < run.totalRooms-1 && !run.awaitingDoor) roomCleared();
    if(run.roomClearTimer>0) {run.roomClearTimer-=dt;if(run.roomClearTimer<=0) presentBonuses();}
    if(run.awaitingDoor && playerAtExitDoor()) advanceRoom();
    camera.x=lerp(camera.x,0,.08); camera.y=lerp(camera.y,0,.08); camera.shake*=Math.pow(.03,dt);
    updateHud();
  }

  function drawBackground() {
    const world=run?.world||WORLDS.lava;
    const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,world.skyA);g.addColorStop(1,world.skyB);
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    const time=performance.now()/1000;
    for(const d of roomDecor) {
      const pulse=.45+.3*Math.sin(time+d.phase);
      ctx.globalAlpha=pulse;
      ctx.fillStyle=world.fog;
      ctx.beginPath();ctx.arc(d.x,d.y+Math.sin(time*.45+d.phase)*8,d.size,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
    ctx.fillStyle='rgba(0,0,0,.18)';
    for(let i=0;i<8;i++){ctx.beginPath();ctx.moveTo(i*190,H-70);ctx.lineTo(i*190+90,210+Math.sin(i)*90);ctx.lineTo(i*190+230,H-70);ctx.fill();}
  }

  function drawPlatforms() {
    const world=run.world;
    platforms.forEach(p=>{
      ctx.fillStyle=world.platform;roundRect(ctx,p.x,p.y,p.w,p.h,6,true);
      ctx.fillStyle=world.edge;ctx.globalAlpha=.8;ctx.fillRect(p.x+5,p.y,p.w-10,4);ctx.globalAlpha=1;
    });
  }

  function exitDoorRect() { return {x:W-46,y:H-190,w:38,h:120}; }

  function playerAtExitDoor() {
    return run?.awaitingDoor && rectsOverlap(run.player, exitDoorRect());
  }

  function advanceRoom() {
    run.awaitingDoor=false;
    run.room++;
    spawnRoomEnemies();
  }

  function drawDoors(){
    const blocked = enemies.some(e=>!e.dead) || run.roomClearTimer>0;
    const doors=[{x:8,y:H-190,w:38,h:120,exit:false},{...exitDoorRect(),exit:true}];
    for(const d of doors){
      const locked = blocked || !d.exit || !run.awaitingDoor;
      ctx.fillStyle=locked?'#421d2b':'#164b43';
      roundRect(ctx,d.x,d.y,d.w,d.h,7,true);
      ctx.strokeStyle=locked?'#ff6b78':'#67f3d4';ctx.lineWidth=3;roundRect(ctx,d.x,d.y,d.w,d.h,7,false,true);
      ctx.fillStyle=locked?'#ffbd69':'#79ffe2';ctx.font='700 20px system-ui';ctx.textAlign='center';ctx.fillText(locked?'🔒':'➜',d.x+d.w/2,d.y+67);ctx.textAlign='left';
    }
  }

  function drawHazards() {
    for(const h of hazards) {
      if(h.type==='lavaPool'){ctx.fillStyle='#ff5428';ctx.shadowColor='#ff5b27';ctx.shadowBlur=18;ctx.fillRect(h.x,h.y,h.w,h.h);ctx.shadowBlur=0;}
      if(h.type==='iceFloor'){ctx.fillStyle='rgba(190,239,255,.65)';ctx.fillRect(h.x,h.y,h.w,h.h);}
      if(h.type==='quicksand'){ctx.fillStyle='#d7a14e';ctx.fillRect(h.x,h.y,h.w,h.h);}
      if(h.type==='firePillar'||h.type==='sandSpike'){
        if(h.timer>0){ctx.fillStyle='rgba(255,80,70,.2)';ctx.strokeStyle='#ff5f64';ctx.lineWidth=3;ctx.fillRect(h.x,h.y,h.w,h.h);ctx.strokeRect(h.x,h.y,h.w,h.h);}
        else {ctx.fillStyle=h.type==='firePillar'?'#ff6a30':'#e9c270';ctx.beginPath();ctx.moveTo(h.x,h.y+h.h);ctx.lineTo(h.x+h.w/2,h.y);ctx.lineTo(h.x+h.w,h.y+h.h);ctx.fill();}
      }
    }
  }

  function draw() {
    ctx.clearRect(0,0,W,H);
    if(!run){
      const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'#0a1428');g.addColorStop(1,'#1e1032');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
      drawMenuBackdrop();return;
    }
    ctx.save();
    const sx=save.settings.shake?rand(-camera.shake,camera.shake):0;
    const sy=save.settings.shake?rand(-camera.shake,camera.shake):0;
    ctx.translate(sx,sy);
    drawBackground();drawPlatforms();drawDoors();drawHazards();
    enemies.forEach(e=>e.draw());
    enemyProjectiles.forEach(p=>{ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=12;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;});
    projectiles.forEach(p=>p.draw());
    run.player.draw();
    drawDrones(run.player);
    particles.forEach(p=>{ctx.globalAlpha=clamp(p.life/p.maxLife,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);});ctx.globalAlpha=1;
    damageTexts.forEach(t=>{ctx.globalAlpha=clamp(t.life/.3,0,1);ctx.fillStyle=t.color;ctx.font='800 16px system-ui';ctx.textAlign='center';ctx.fillText(t.text,t.x,t.y);});ctx.globalAlpha=1;ctx.textAlign='left';
    ctx.restore();
  }

  function drawMenuBackdrop(){
    const t=performance.now()/1000;
    for(let i=0;i<35;i++){
      const x=(i*173+t*12*(i%3+1))%W,y=(i*97+Math.sin(t+i)*20)%H;
      ctx.fillStyle=i%2?'rgba(89,240,208,.18)':'rgba(139,92,246,.16)';ctx.beginPath();ctx.arc(x,y,2+i%4,0,Math.PI*2);ctx.fill();
    }
  }

  function drawDrones(player){
    const t=performance.now()/700;
    for(let i=0;i<player.drones;i++){
      const a=t+i*Math.PI*2/player.drones,x=player.center.x+Math.cos(a)*52,y=player.center.y-25+Math.sin(a)*22;
      ctx.fillStyle='#f3dc73';ctx.beginPath();ctx.moveTo(x,y-8);ctx.lineTo(x+10,y);ctx.lineTo(x,y+8);ctx.lineTo(x-10,y);ctx.closePath();ctx.fill();
    }
  }

  function updateHud(){
    if(!run)return;
    const p=run.player;
    $('hpFill').style.width=`${clamp(p.hp/p.maxHp*100,0,100)}%`;
    $('hpText').textContent=`${Math.ceil(Math.max(0,p.hp))} / ${p.maxHp}`;
    $('shieldFill').style.width=`${p.maxShield?clamp(p.shield/p.maxShield*100,0,100):0}%`;
    $('shieldText').textContent=Math.ceil(p.shield);
    $('runCoins').textContent=run.coins;$('score').textContent=Math.floor(run.score);
    const boss=enemies.find(e=>e.boss&&!e.dead);if(boss)$('bossFill').style.width=`${clamp(boss.hp/boss.maxHp*100,0,100)}%`;
  }

  function updateRoomProgress(){
    $('roomProgress').innerHTML=Array.from({length:run.totalRooms},(_,i)=>`<span class="room-node ${i<run.room?'complete':i===run.room?'current':''}"></span>`).join('');
  }

  function updateBuildPanel(){
    const list=$('buildList');$('buildCount').textContent=run?.bonuses.length||0;
    list.innerHTML=run?.bonuses.length?run.bonuses.map(b=>`<div class="build-item"><span>${b.icon}</span><div><b>${b.name}</b><span>${b.desc}</span></div></div>`).join(''):'<div class="build-item"><span>ℹ️</span><div><b>Sem bônus</b><span>Limpe uma sala para escolher.</span></div></div>';
  }

  function roundRect(c,x,y,w,h,r,fill=false,stroke=false){
    c.beginPath();c.roundRect(x,y,w,h,r);if(fill)c.fill();if(stroke)c.stroke();
  }

  function loop(now){
    const dt=Math.min(.033,(now-lastTime)/1000);lastTime=now;update(dt);draw();requestAnimationFrame(loop);
  }

  function renderLoadout(){
    $('characterCards').innerHTML='';
    Object.values(CHARACTERS).forEach(c=>{
      const unlocked=save.unlockedCharacters.includes(c.id);const card=document.createElement('button');
      card.className=`select-card ${selectedCharacter===c.id?'selected':''} ${unlocked?'':'locked'}`;
      card.innerHTML=`${unlocked?'':`<span class="lock-label">🔒 ${c.cost} CRISTAIS</span>`}<div class="icon">${c.icon}</div><h4>${c.name}</h4><p>${c.description}</p><div class="stats"><span class="stat-chip">HP ${c.maxHp}</span><span class="stat-chip">VEL ${c.speed}</span><span class="stat-chip">${c.special}</span></div>`;
      card.onclick=()=>{if(unlocked){selectedCharacter=c.id;renderLoadout();beep('select',.06);}else purchaseUnlock('character',c.id,c.cost);};$('characterCards').appendChild(card);
    });
    $('weaponCards').innerHTML='';
    Object.values(WEAPONS).forEach(w=>{
      const unlocked=save.unlockedWeapons.includes(w.id);const card=document.createElement('button');
      card.className=`select-card ${selectedWeapon===w.id?'selected':''} ${unlocked?'':'locked'}`;
      card.innerHTML=`${unlocked?'':`<span class="lock-label">🔒 ${w.cost} CRISTAIS</span>`}<div class="icon">${w.icon}</div><h4>${w.name}</h4><p>${w.description}</p><div class="stats"><span class="stat-chip">DANO ${w.damage}</span><span class="stat-chip">CAD ${w.cooldown}s</span><span class="stat-chip">ALC ${w.range}</span></div>`;
      card.onclick=()=>{if(unlocked){selectedWeapon=w.id;renderLoadout();beep('select',.06);}else purchaseUnlock('weapon',w.id,w.cost);};$('weaponCards').appendChild(card);
    });
    $('worldCards').innerHTML='';
    Object.values(WORLDS).forEach(w=>{
      const card=document.createElement('button');card.className=`select-card ${selectedWorld===w.id?'selected':''}`;
      card.innerHTML=`<div class="icon">${w.icon}</div><h4>${w.name}</h4><p>${w.description}</p>`;card.onclick=()=>{selectedWorld=w.id;renderLoadout();beep('select',.06);};$('worldCards').appendChild(card);
    });
  }

  function purchaseUnlock(type,id,cost){
    if(save.crystals<cost){toast('CRISTAIS INSUFICIENTES');return;}
    save.crystals-=cost;
    const key=type==='character'?'unlockedCharacters':'unlockedWeapons';save[key].push(id);saveGame();renderLoadout();updateMenuStats();toast('DESBLOQUEADO');
  }

  function renderUpgrades(){
    $('upgradeCrystals').textContent=save.crystals;$('upgradeCards').innerHTML='';
    Object.entries(PERMANENT_UPGRADES).forEach(([id,u])=>{
      const level=save.upgrades[id],cost=Math.floor(u.baseCost*(1+level*.65)),maxed=level>=u.max;
      const card=document.createElement('article');card.className='upgrade-card';
      card.innerHTML=`<div class="icon">${u.icon}</div><div><span class="level">NÍVEL ${level}/${u.max}</span><h4>${u.name}</h4><p>${u.description}</p></div><button ${maxed||save.crystals<cost?'disabled':''}>${maxed?'MÁXIMO':`MELHORAR • ${cost} 💎`}</button>`;
      card.querySelector('button').onclick=()=>buyUpgrade(id,cost);$('upgradeCards').appendChild(card);
    });
  }

  function buyUpgrade(id,cost){
    if(save.crystals<cost)return;save.crystals-=cost;save.upgrades[id]++;saveGame();renderUpgrades();updateMenuStats();beep('select',.1);
  }

  function updateMenuStats(){
    $('menuCrystals').textContent=save.crystals;$('bestScore').textContent=save.bestScore;$('wins').textContent=save.wins;
  }

  function pauseGame(){if(gameState!=='playing')return;gameState='paused';showScreen('pauseScreen');}
  function resumeGame(){if(gameState!=='paused')return;gameState='playing';hideScreens();}
  function goMenu(){gameState='menu';run=null;enemies=[];projectiles=[];enemyProjectiles=[];$('hud').classList.add('hidden');$('buildPanel').classList.add('hidden');$('touchControls').classList.add('hidden');showScreen('menuScreen');updateMenuStats();}

  document.addEventListener('keydown',e=>{
    if(['ArrowLeft','ArrowRight','ArrowUp','Space'].includes(e.code))e.preventDefault();
    if((e.code==='Escape'||e.code==='KeyP')&&gameState==='playing'){pauseGame();return;}
    if((e.code==='Escape'||e.code==='KeyP')&&gameState==='paused'){resumeGame();return;}
    if(gameState!=='playing')return;
    if((e.code==='Space'||e.code==='KeyW'||e.code==='ArrowUp')&&!keys.has(e.code))run.player.jump();
    if((e.code==='ShiftLeft'||e.code==='ShiftRight')&&!keys.has(e.code))run.player.dash();
    keys.add(e.code);
  });
  document.addEventListener('keyup',e=>keys.delete(e.code));
  window.addEventListener('blur',()=>{keys.clear();if(gameState==='playing')pauseGame();});

  $('playBtn').onclick=()=>{renderLoadout();showScreen('loadoutScreen');};
  $('progressionBtn').onclick=()=>{renderUpgrades();showScreen('upgradeScreen');};
  $('settingsBtn').onclick=()=>showScreen('settingsScreen');
  document.querySelectorAll('.close-btn').forEach(b=>b.onclick=()=>showScreen(b.dataset.target));
  $('startRunBtn').onclick=beginRun;
  $('pauseBtn').onclick=pauseGame;$('resumeBtn').onclick=resumeGame;
  $('quitRunBtn').onclick=()=>endRun(false);
  $('retryBtn').onclick=beginRun;$('resultMenuBtn').onclick=goMenu;
  $('toggleBuildBtn').onclick=()=>$('buildPanel').classList.toggle('open');
  $('resetSaveBtn').onclick=()=>{if(confirm('Apagar toda a progressão permanente?')){save=structuredClone(defaultSave);saveGame();renderUpgrades();updateMenuStats();toast('PROGRESSÃO APAGADA');}};
  document.querySelectorAll('[data-key]').forEach(button=>{
    const code=button.dataset.key;
    const down=e=>{e.preventDefault();keys.add(code);};
    const up=e=>{e.preventDefault();keys.delete(code);};
    button.addEventListener('pointerdown',down);
    button.addEventListener('pointerup',up);
    button.addEventListener('pointercancel',up);
    button.addEventListener('pointerleave',up);
  });
  $('touchJump').addEventListener('pointerdown',e=>{e.preventDefault();if(gameState==='playing')run.player.jump();});
  $('touchDash').addEventListener('pointerdown',e=>{e.preventDefault();if(gameState==='playing')run.player.dash();});

  $('volumeRange').value=save.settings.volume;$('particlesToggle').checked=save.settings.particles;$('shakeToggle').checked=save.settings.shake;
  $('volumeRange').oninput=e=>{save.settings.volume=Number(e.target.value);saveGame();};
  $('particlesToggle').onchange=e=>{save.settings.particles=e.target.checked;saveGame();};
  $('shakeToggle').onchange=e=>{save.settings.shake=e.target.checked;saveGame();};

  updateMenuStats();showScreen('menuScreen');requestAnimationFrame(loop);
})();
