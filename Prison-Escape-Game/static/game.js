document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById("canvas");
  const context = canvas.getContext("2d");

  // https://developer.mozilla.org/en-US/docs/Web/API/Window/innerWidth
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const TILE = 40;
  const MAP_WIDTH = (canvas.width / TILE);
  const MAP_HEIGHT = (canvas.height / TILE);

  const images = {
    playerRight: new Image(),
    playerLeft: new Image(),
    playerUp: new Image(),
    playerDown: new Image(),
    police: new Image(),
    wall: new Image(),
    freeze: new Image(),
    ammo: new Image(),
    exit: new Image()
  };

  images.playerRight.src = 'static/images/playerright.png';
  images.playerLeft.src = 'static/images/playerleft.png';
  images.playerUp.src = 'static/images/playerup.png';
  images.playerDown.src = 'static/images/playerdown.png';
  images.police.src = 'static/images/police.png';
  images.wall.src = 'static/images/cell.png';
  images.freeze.src = 'static/images/freeze.png';
  images.ammo.src = 'static/images/ammo.png';
  images.exit.src = 'static/images/exit.png';

  const sounds = {
    backgroundMusic: new Audio('static/sounds/background.mp3'),
    playerShoot: new Audio('static/sounds/shoot.mp3'),
    escaped: new Audio('static/sounds/escaped.mp3'),
  };

  let soundEnabled = true;

  function playSound(sound) {
    if (soundEnabled) {
      const soundInstance = new Audio(sound.src);
      soundInstance.volume = sound.volume || 1.0;
      soundInstance.play().catch(error => {
        console.log("Audio playback error:", error);
      });
    }
  }

  function startBackgroundMusic() {
    if (soundEnabled) {
      sounds.backgroundMusic.play();
    }
  }

  let running       = true;
  let paused        = false;
  let won           = false;
  let timer         = 0;
  let timerInterval = null;
  let keysPressed   = {};

  let bullets    = [];
  let copBullets = [];
  let cops       = [];
  let walls      = [];
  let powerups   = [];
  let ammoPacks  = [];
  let exit       = {};

  let player = {
    x: TILE,
    y: TILE,
    width: TILE - 5,
    height: TILE - 5,
    speed: 1.5,
    health: 100,
    ammo: 10,
    direction: 'right'
  };

  let freezeEffect = {
    active: false,
    duration: 0,
    maxDuration: 120
  };

  function collides(obj1, obj2) {
    return (
      obj1.x < obj2.x + obj2.width &&
      obj1.x + obj1.width > obj2.x &&
      obj1.y < obj2.y + obj2.height &&
      obj1.y + obj1.height > obj2.y
    );
  }

  function createMap() {
    walls = [];

    // Outer Border Walls – Top & Bottom Rows - Horizontally
    for (let col = 0; col < MAP_WIDTH; col++) {
      walls.push({ x: col * TILE, y: 0, width: TILE, height: TILE });
      walls.push({ x: col * TILE, y: (MAP_HEIGHT - 1) * TILE, width: TILE, height: TILE });
    }
    // Outer Border Walls – Left & Right Columns - Vertically
    for (let row = 0; row < MAP_HEIGHT; row++) {
      walls.push({ x: 0, y: row * TILE, width: TILE, height: TILE });
      walls.push({ x: (MAP_WIDTH - 1) * TILE, y: row * TILE, width: TILE, height: TILE });
    }

    // // Add internal horizontal walls with gaps
    for (let x = 2; x < MAP_WIDTH - 2; x++) {
      if (x !== 5 && x !== 10 && x !== 15) {
        walls.push({ x: x * TILE, y: 2 * TILE, width: TILE, height: TILE });
      }
      if (x !== 6 && x !== 13) {
        walls.push({ x: x * TILE, y: 6 * TILE, width: TILE, height: TILE });
      }
      if (x !== 4 && x !== 14) {
        walls.push({ x: x * TILE, y: 10 * TILE, width: TILE, height: TILE });
      }
    }

    // Add internal vertical walls with gaps
    for (let y = 2; y < MAP_HEIGHT - 2; y++) {
      if (y !== 3 && y !== 8) {
        walls.push({ x: 4 * TILE, y: y * TILE, width: TILE, height: TILE });
      }
      if (y !== 5 && y !== 11) {
        walls.push({ x: 9 * TILE, y: y * TILE, width: TILE, height: TILE });
      }
      if (y !== 4 && y !== 9) {
        walls.push({ x: 14 * TILE, y: y * TILE, width: TILE, height: TILE });
      }
    }

    // This defines the exit tile location: 1 tile inside from bottom-right.
    let ex = {
      x: (MAP_WIDTH - 2) * TILE,
      y: (MAP_HEIGHT - 2) * TILE,
      width: TILE,
      height: TILE
    };
    exit = ex;

    // These two extra walls partially block access to the exit,
    walls.push({ x: ex.x - TILE, y: ex.y, width: TILE, height: TILE });
    walls.push({ x: ex.x - TILE, y: ex.y - TILE, width: TILE, height: TILE });
  }


  function createCops() {
    cops = [];

    // cop position: [x, y, p1x, p1y, p2x, p2y, speed, health, cooldown, range]
    const copPositions = [
      [6, 1, 6, 1, 10, 1, 0.6, 30, 100, 5],
      [15, 1, 15, 1, 20, 1, 0.6, 30, 100, 5],
      [9, 5, 5, 5, 13, 5, 0.6, 30, 100, 5],
      [15, 4, 15, 1, 15, 5, 0.6, 30, 100, 5],
      [13, 9, 13, 3, 13, 9, 0.6, 30, 100, 5],
      [4, 8, 1, 8, 8, 8, 0.6, 30, 100, 5],
      [3, 5, 3, 3, 3, 5, 0.6, 40, 100, 5],
      [MAP_WIDTH - 2, MAP_HEIGHT - 10, MAP_WIDTH - 2, MAP_HEIGHT - 13, MAP_WIDTH - 2, MAP_HEIGHT - 8, 0.7, 40, 90, 7],
      [MAP_WIDTH - 2, MAP_HEIGHT - 3, MAP_WIDTH - 2, MAP_HEIGHT - 5, MAP_WIDTH - 2, MAP_HEIGHT - 3, 0.7, 40, 90, 7],
      [MAP_WIDTH - 5, MAP_HEIGHT - 5, MAP_WIDTH - 7, MAP_HEIGHT - 6, MAP_WIDTH - 5, MAP_HEIGHT - 6, 0.8, 40, 80, 7]
    ];

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach
    copPositions.forEach(def => {
      cops.push({
        x: def[0] * TILE,
        y: def[1] * TILE,
        width: TILE - 4,
        height: TILE - 4,
        speed: def[6],
        health: def[7],
        shootCooldown: 0,
        maxShootCooldown: def[8],
        state: 'patrol',
        patrolPoint1: { x: def[2] * TILE, y: def[3] * TILE },
        patrolPoint2: { x: def[4] * TILE, y: def[5] * TILE },
        targetPoint: { x: def[4] * TILE, y: def[5] * TILE },
        detectionRange: TILE * def[9],
        frozen: false,
        direction: 'left'
      });
    });
  }

  function placeRandomItem(array, type, size, ammo) {
    let validPosition = false;
    let x, y;

    while (!validPosition) {
      x = Math.floor(Math.random() * (MAP_WIDTH - 2) + 1) * TILE;
      y = Math.floor(Math.random() * (MAP_HEIGHT - 2) + 1) * TILE;
      validPosition = true;

      for (let wall of walls) {
        const tempItem = { x, y, width: size, height: size };
        if (collides(tempItem, wall)) {
          validPosition = false;
          break;
        }
      }
    }

    const item = {
      x, y, width: size, height: size
    };

    if (type === 'freeze') {
      item.type = 'freeze';
    } else {
      item.ammo = ammo;
    }

    array.push(item);
  }

  function createPowerups() {
    powerups = [];
    ammoPacks = [];

    for (let i = 0; i < 3; i++) {
      placeRandomItem(powerups, 'freeze', TILE / 2);
    }

    for (let i = 0; i < 5; i++) {
      placeRandomItem(ammoPacks, 'ammo', TILE / 2, 5);
    }
  }

  function movePlayer() {
    let newX = player.x;
    let newY = player.y;

    if (keysPressed['w'] || keysPressed['ArrowUp']) {
      newY -= player.speed;
      player.direction = 'up';
    }
    if (keysPressed['s'] || keysPressed['ArrowDown']) {
      newY += player.speed;
      player.direction = 'down';
    }
    if (keysPressed['a'] || keysPressed['ArrowLeft']) {
      newX -= player.speed;
      player.direction = 'left';
    }
    if (keysPressed['d'] || keysPressed['ArrowRight']) {
      newX += player.speed;
      player.direction = 'right';
    }

    let canMoveX = true;
    let canMoveY = true;

    const playerAtNewX = { 
      x: newX, 
      y: player.y, 
      width: player.width, 
      height: player.height 
    };
    
    const playerAtNewY = { 
      x: player.x, 
      y: newY, 
      width: player.width, 
      height: player.height 
    };

    for (let wall of walls) {
      if (collides(playerAtNewX, wall)) {
        canMoveX = false;
      }

      if (collides(playerAtNewY, wall)) {
        canMoveY = false;
      }
    }

    if (canMoveX) player.x = newX;
    if (canMoveY) player.y = newY;
  }

  function playerShoot() {
    if (player.ammo <= 0) return;

    player.ammo--;

    const bullet = {
      x: player.x + player.width / 2 - 2,
      y: player.y + player.height / 2 - 2,
      width: 4, height: 4, speed: 8,
      direction: player.direction,
      damage: 10
    };

    bullets.push(bullet);

    playSound(sounds.playerShoot);
  }

  function moveBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
//-------------------
      switch (bullet.direction) {
        case 'right': bullet.x += bullet.speed; break;
        case 'left': bullet.x -= bullet.speed; break;
        case 'up': bullet.y -= bullet.speed; break;
        case 'down': bullet.y += bullet.speed; break;
      }

      let hitWall = false;
      for (let wall of walls) {
        if (collides(bullet, wall)) {
          bullets.splice(i, 1);
          hitWall = true;
          break;
        }
      }
      if (hitWall) continue;

      for (let j = cops.length - 1; j >= 0; j--) {
        const cop = cops[j];
        if (collides(bullet, cop)) {
          cop.health -= bullet.damage;
          bullets.splice(i, 1);

          if (cop.health <= 0) cops.splice(j, 1);
          break;
        }
      }
    }

    for (let i = copBullets.length - 1; i >= 0; i--) {
      const bullet = copBullets[i];

      bullet.x += bullet.directionX * bullet.speed;
      bullet.y += bullet.directionY * bullet.speed;

      let hitWall = false;
      for (let wall of walls) {
        if (collides(bullet, wall)) {
          copBullets.splice(i, 1);
          hitWall = true;
          break;
        }
      }
      if (hitWall) continue;

      if (collides(bullet, player)) {
        player.health -= bullet.damage;
        copBullets.splice(i, 1);

        if (player.health <= 0) gameOver();
      }
    }
  }

  function moveCops() {
    for (let cop of cops) {

      if (cop.frozen) continue;

      if (cop.shootCooldown > 0) cop.shootCooldown--;

      const dx = player.x - cop.x;
      const dy = player.y - cop.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < cop.detectionRange) {
        cop.state = 'chase';

        if (distance < cop.detectionRange * 0.7 && cop.shootCooldown === 0) {
          const shootDx = player.x + player.width / 2 - (cop.x + cop.width / 2);
          const shootDy = player.y + player.height / 2 - (cop.y + cop.height / 2);
          const length = Math.sqrt(shootDx * shootDx + shootDy * shootDy);

          copBullets.push({
            x: cop.x + cop.width / 2 - 2,
            y: cop.y + cop.height / 2 - 2,
            width: 4, height: 4, speed: 6,
            directionX: shootDx / length,
            directionY: shootDy / length,
            damage: 10
          });

          cop.shootCooldown = cop.maxShootCooldown;
        }

        const totalDistance = distance;
        if (totalDistance > 0) {
          const directionX = (player.x - cop.x) / totalDistance;
          const directionY = (player.y - cop.y) / totalDistance;

          const newX = cop.x + directionX * cop.speed;
          const newY = cop.y + directionY * cop.speed;

          const copAtNewX = { 
            x: newX, 
            y: cop.y, 
            width: cop.width, 
            height: cop.height 
          };
          
          const copAtNewY = { 
            x: cop.x, 
            y: newY, 
            width: cop.width, 
            height: cop.height 
          };

          let collisionX = false;
          let collisionY = false;

          for (let wall of walls) {
            if (collides(copAtNewX, wall)) {
              collisionX = true;
            }

            if (collides(copAtNewY, wall)) {
              collisionY = true;
            }
          }

          if (!collisionX) cop.x = newX;
          if (!collisionY) cop.y = newY;

          if (Math.abs(directionX) > Math.abs(directionY)) {
            cop.direction = (directionX > 0) ? 'right' : 'left';
          } else {
            cop.direction = (directionY > 0) ? 'down' : 'up';
          }
        }
      } else {
        cop.state = 'patrol';

        const target = cop.targetPoint;
        const patrolDx = target.x - cop.x;
        const patrolDy = target.y - cop.y;
        const patrolDistance = Math.sqrt(patrolDx * patrolDx + patrolDy * patrolDy);

        if (patrolDistance < 5) {
          cop.targetPoint = (cop.targetPoint === cop.patrolPoint1) ?
            cop.patrolPoint2 : cop.patrolPoint1;
        }

        if (patrolDistance > 0) {
          const directionX = patrolDx / patrolDistance;
          const directionY = patrolDy / patrolDistance;

          const newX = cop.x + directionX * (cop.speed * 0.5);
          const newY = cop.y + directionY * (cop.speed * 0.5);

          const copAtNewX = { 
            x: newX, 
            y: cop.y, 
            width: cop.width, 
            height: cop.height 
          };
          
          const copAtNewY = { 
            x: cop.x, 
            y: newY, 
            width: cop.width, 
            height: cop.height 
          };

          let collisionX = false;
          let collisionY = false;

          for (let wall of walls) {
            if (collides(copAtNewX, wall)) {
              collisionX = true;
            }

            if (collides(copAtNewY, wall)) {
              collisionY = true;
            }
          }

          if (!collisionX) cop.x = newX;
          if (!collisionY) cop.y = newY;

          if (Math.abs(directionX) > Math.abs(directionY)) {
            cop.direction = (directionX > 0) ? 'right' : 'left';
          } else {
            cop.direction = (directionY > 0) ? 'down' : 'up';
          }
        }
      }
    }
  }

  function checkPickups() {
    for (let i = powerups.length - 1; i >= 0; i--) {
      const powerup = powerups[i];
      if (collides(player, powerup)) {
        freezeEffect.active = true;
        freezeEffect.duration = freezeEffect.maxDuration;

        for (let cop of cops) cop.frozen = true;

        powerups.splice(i, 1);
      }
    }

    for (let i = ammoPacks.length - 1; i >= 0; i--) {
      const ammoPack = ammoPacks[i];
      if (collides(player, ammoPack)) {
        player.ammo += ammoPack.ammo;
        ammoPacks.splice(i, 1);
      }
    }

    if (collides(player, exit)) {
      won = true;

      playSound(sounds.escaped);

      gameOver();
    }
  }

  function updateFreezeEffect() {
    if (freezeEffect.active) {
      freezeEffect.duration--;

      if (freezeEffect.duration <= 0) {
        freezeEffect.active = false;
        for (let cop of cops) cop.frozen = false;
      }
    }
  }

  function togglePause() {
    paused = !paused;

    if (paused) {
      clearInterval(timerInterval);
      //----------------------------
      if (soundEnabled) sounds.backgroundMusic.pause();
    } else {
      timerInterval = setInterval(() => {
          if (running && !paused) timer++;
      }, 1000);
      if (soundEnabled) sounds.backgroundMusic.play();
    }
  }


  function gameOver() {
    running = false;
    clearInterval(timerInterval);

    sounds.backgroundMusic.pause();
  }

  function draw() {
    context.fillStyle = '#111111';
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (let wall of walls) {
      //--
      context.drawImage(images.wall, wall.x, wall.y, wall.width, wall.height);
    }

    context.drawImage(images.exit, exit.x, exit.y, exit.width, exit.height);

    for (let powerup of powerups) {
      context.drawImage(images.freeze, powerup.x, powerup.y, powerup.width, powerup.height);
    }

    for (let ammoPack of ammoPacks) {
      context.drawImage(images.ammo, ammoPack.x, ammoPack.y, ammoPack.width, ammoPack.height);
    }

    context.fillStyle = '#FFFF00';
    for (let bullet of bullets) {
      context.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    }

    context.fillStyle = '#FF0000';
    for (let bullet of copBullets) {
      context.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    }

    for (let cop of cops) {
      context.drawImage(images.police, cop.x, cop.y, cop.width, cop.height);
    }

    let playerImage;
    //--------------------
    switch (player.direction) {
      case 'right': playerImage = images.playerRight; break;
      case 'left': playerImage = images.playerLeft; break;
      case 'up': playerImage = images.playerUp; break;
      case 'down': playerImage = images.playerDown; break;
      default: playerImage = images.playerRight;
    }
    context.drawImage(playerImage, player.x, player.y, player.width, player.height);

    // health bar
    context.fillStyle = '#000000';
    context.fillRect(10, 10, 204, 24);
    context.fillStyle = '#FF0000';
    context.fillRect(12, 12, player.health * 2, 20);
    context.fillStyle = '#FFFFFF';
    context.font = '16px Arial';
    context.fillText('Health: ' + player.health, 15, 28);

    // ammo counter
    context.fillStyle = '#000000';
    context.fillRect(10, 40, 104, 24);
    context.fillStyle = '#FFFF00';
    context.fillRect(12, 42, Math.min(player.ammo * 5, 100), 20);
    context.fillStyle = '#FFFFFF';
    context.fillText('Ammo: ' + player.ammo, 15, 58);

    // timer
    context.fillStyle = '#FFFFFF';
    context.fillText('Time: ' + Math.floor(timer / 60) + ':' + String(timer % 60).padStart(2, '0'), canvas.width - 120, 28);

    // freeze effect
    if (freezeEffect.active) {
      context.fillStyle = '#00FFFF';
      context.fillText('Freeze: ' + Math.ceil(freezeEffect.duration / 60) + 's', canvas.width - 120, 58);
    }

    // game over screen
    if (!running) {
      context.fillStyle = 'rgba(0, 0, 0, 0.7)';
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.fillStyle = '#FFFFFF';
      context.font = '36px Arial';
      const message = won ?
        'ESCAPED! Time: ' + Math.floor(timer / 60) + ':' + String(timer % 60).padStart(2, '0') :
        'CAUGHT!';
      context.fillText(message, canvas.width / 2 - context.measureText(message).width / 2, canvas.height / 2 - 40);

      context.font = '24px Arial';
      const retryMsg = 'Press R to retry';
      context.fillText(retryMsg, canvas.width / 2 - context.measureText(retryMsg).width / 2, canvas.height / 2 + 20);
    }

    // pause screen
    if (paused && running) {
      context.fillStyle = 'rgba(0, 0, 0, 0.5)';
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.fillStyle = '#FFFFFF';
      context.font = '36px Arial';
      const pauseMsg = 'PAUSED';
      context.fillText(pauseMsg, canvas.width / 2 - context.measureText(pauseMsg).width / 2, canvas.height / 2);
    }
  }


  function gameLoop() {
    if (running && !paused) {
      movePlayer();
      moveBullets();
      moveCops();
      checkPickups();
      updateFreezeEffect();
    }

    draw();
    requestAnimationFrame(gameLoop);
  }


  function initGame() {
    running = true;
    won = false;
    paused = false;
    timer = 0;
    keysPressed = {};

    player.x = TILE;
    player.y = TILE;
    player.health = 100;
    player.ammo = 10;
    player.direction = 'right';

    bullets = [];
    copBullets = [];

    createMap();
    createCops();
    createPowerups();

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (running && !paused) timer++;
    }, 1000);

    sounds.backgroundMusic.currentTime = 0;
    startBackgroundMusic();

  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'p' || event.key === 'P') {
      if (running) togglePause();
      return;
    }

    if (!running) {
      if (event.key.toLowerCase() === 'r') initGame();
      return;
    }

    if (paused) return;

    keysPressed[event.key] = true;

    if (event.key === ' ') {
      playerShoot();
    }

    if (event.key.toLowerCase() === 'm') {
      soundEnabled = !soundEnabled;
      if (!soundEnabled) {
        sounds.backgroundMusic.pause();
      } else if (!paused && running) {
        sounds.backgroundMusic.play();
      }
    }
  });

  document.addEventListener('keyup', function (event) {
    delete keysPressed[event.key];
  });

  window.addEventListener("keydown", function (event) {
    if ([32, 37, 38, 39, 40].indexOf(event.keyCode) > -1) {
      event.preventDefault();
    }
  }, false);

  
  window.onload = function () {
    initGame();
    gameLoop();
  };
});