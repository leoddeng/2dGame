const GameConfig = {
  width: 432,
  height: 644,
  gameSpeed: 2,
  frameSpeed: 10,
  groundHeight: 146,
  pipeGap: 156,
  pipeWidth: 78,
  pipeFrequency: 200
};
const manifest = {
  images: {
    bgImage: "/src/games/flappyBird/assets/bg.png",
    groundImage: "/src/games/flappyBird/assets/ground.png",
    birdImage: "/src/games/flappyBird/assets/bird.png",
    pipeImage: "/src/games/flappyBird/assets/pipe.png"
  },
  audios: {
    bgMusic: "/src/games/flappyBird/assets/bg_music.mp3",
    jumpSound: "/src/games/flappyBird/assets/jump.mp3"
  }
};
const loadResource = (src, resourceCreator, loadEventName) => {
  return new Promise((resolve, reject) => {
    const resource = resourceCreator();
    resource.src = src;
    const onLoad = () => {
      cleanup();
      resolve(resource);
    };
    const onError = (error) => {
      cleanup();
      reject(new Error(`Failed to load resource ${src}: ${error.message}`));
    };
    const cleanup = () => {
      resource.removeEventListener(loadEventName, onLoad);
      resource.removeEventListener("error", onError);
    };
    resource.addEventListener(loadEventName, onLoad);
    resource.addEventListener("error", onError);
  });
};
const loadMultiple = (resources, loader) => {
  const entries = Object.entries(resources);
  const promises = entries.map(
    ([key, src]) => loader(src).then((resource) => ({ key, resource }))
  );
  return Promise.all(promises).then(
    (results) => results.reduce((acc, { key, resource }) => {
      acc[key] = resource;
      return acc;
    }, {})
  );
};
const loadImage = (src) => loadResource(src, () => new Image(), "load");
const loadAudio = (src) => loadResource(src, () => new Audio(), "canplaythrough");
const loadResourcesWithProgress = (resources, onProgress) => {
  const totalCount = Object.values(resources).flatMap(
    (resource) => Object.keys(resource)
  ).length;
  let loadedCount = 0;
  const updateProgress = () => {
    loadedCount++;
    if (onProgress) {
      onProgress(loadedCount, totalCount);
    }
  };
  const createCountingLoader = (loader) => (src) => {
    return loader(src).then((resource) => {
      updateProgress();
      return resource;
    });
  };
  const countingImageLoader = createCountingLoader(loadImage);
  const countingAudioLoader = createCountingLoader(loadAudio);
  return Promise.all([
    loadMultiple(resources.images, countingImageLoader),
    loadMultiple(resources.audios, countingAudioLoader)
  ]).then(([loadedImages, loadedAudios]) => {
    return {
      images: loadedImages,
      audios: loadedAudios
    };
  });
};
function createGenericList(options) {
  const container = document.createElement("div");
  container.className = "generic-list-container";
  const title = document.createElement("h3");
  title.textContent = options.title || "列表";
  container.appendChild(title);
  const list = document.createElement("ul");
  container.appendChild(list);
  const renderItems = () => {
    list.innerHTML = "";
    options.items.forEach((item) => {
      const listItem = document.createElement("li");
      listItem.addEventListener("click", () => {
        Array.from(list.children).forEach((li) => {
          li.classList.remove("active");
        });
        listItem.classList.add("active");
      });
      if (options.renderItem) {
        listItem.appendChild(options.renderItem(item));
      } else {
        const content = document.createElement("span");
        content.textContent = item.toString();
        listItem.appendChild(content);
      }
      list.appendChild(listItem);
    });
  };
  renderItems();
  const button = document.createElement("button");
  button.className = "room-back";
  button.textContent = "返回";
  button.addEventListener("click", () => {
    if (options.onBackClick) {
      options.onBackClick();
    }
  });
  container.appendChild(button);
  if (options.buttonText) {
    const button2 = document.createElement("button");
    button2.className = "room-start";
    button2.textContent = options.buttonText;
    button2.addEventListener("click", () => {
      if (options.onButtonClick) {
        options.onButtonClick();
      }
    });
    container.appendChild(button2);
  }
  return {
    container,
    updateItems: (newItems) => {
      options.items = newItems;
      renderItems();
    },
    updateTitle: (newTitle) => {
      options.title = newTitle;
      title.textContent = newTitle;
    }
  };
}
class GameStateManager {
  constructor() {
    this.state = {};
    this.currentState = null;
    this.lastStateName = "";
    this.history = [];
  }
  registerState(name, state) {
    this.state[name] = state;
  }
  changeState(name, args, isPush = true) {
    if (this.lastStateName === name) return;
    this.lastStateName = name;
    isPush && this.history.push({ name, args });
    if (this.currentState && this.currentState.exit) {
      this.currentState.exit();
    }
    const newState = this.state[name];
    if (newState) {
      this.currentState = newState;
      if (newState.enter) {
        this.currentState.enter(args);
      }
    }
  }
  update(gameframe) {
    if (this.currentState && this.currentState.update) {
      this.currentState.update(gameframe);
    }
  }
  render(ctx) {
    if (this.currentState && this.currentState.render) {
      this.currentState.render(ctx);
    }
  }
  back() {
    if (this.history.length < 2) return;
    this.history.pop();
    const last = this.history[this.history.length - 1];
    this.changeState(last.name, last.args, false);
  }
}
class GameState {
  constructor(game) {
    this.game = game;
  }
  enter() {
    throw new Error("enter method must be implemented");
  }
  exit() {
    throw new Error("exit method must be implemented");
  }
  update() {
    throw new Error("update method must be implemented");
  }
  render() {
    throw new Error("render method must be implemented");
  }
  handleMessage() {
  }
}
class ProgressState extends GameState {
  constructor(game) {
    super(game);
    this.barWidth = 400;
    this.barHeight = 30;
    this.barX = (GameConfig.width - this.barWidth) / 2;
    this.barY = (GameConfig.height - this.barHeight) / 2;
    this.progress = 0;
  }
  enter() {
    this.game.ctx.save();
  }
  exit() {
    this.game.ctx.restore();
  }
  update(progress = 0) {
    this.progress = progress.toFixed(2);
  }
  render() {
    this.game.ctx.clearRect(0, 0, GameConfig.width, GameConfig.height);
    const gradient = this.game.ctx.createLinearGradient(
      this.barX,
      this.barY,
      this.barX + this.barWidth * this.progress,
      this.barY + this.barHeight
    );
    gradient.addColorStop(0, "#4CAF50");
    gradient.addColorStop(1, "#2E7D32");
    this.game.ctx.fillStyle = gradient;
    this.game.ctx.fillRect(
      this.barX,
      this.barY,
      this.barWidth * this.progress,
      this.barHeight
    );
    this.game.ctx.font = "20px Arial";
    this.game.ctx.textAlign = "center";
    this.game.ctx.fillText(
      `加载进度 ${this.progress * 100}%`,
      GameConfig.width / 2,
      this.barY + 50
    );
  }
}
class Layer {
  constructor(image, speedModifier) {
    this.x = 0;
    this.y = 0;
    this.width = GameConfig.width;
    this.height = GameConfig.height;
    this.image = image;
    this.speed = GameConfig.gameSpeed * speedModifier;
  }
  update() {
    throw new Error("update method must be implemented");
  }
  draw(ctx) {
    throw new Error("draw method must be implemented");
  }
}
class BackgroundLayer extends Layer {
  constructor(image, speedModifier) {
    super(image, speedModifier);
  }
  update() {
    if (this.x < -this.width) {
      this.x = 0;
    }
    this.x -= this.speed;
  }
  draw(ctx) {
    ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
    ctx.drawImage(
      this.image,
      this.x + this.width - this.speed,
      this.y,
      this.width,
      this.height
    );
  }
}
class GroundLayer extends Layer {
  constructor(image, speedModifier) {
    super(image, speedModifier);
    this.height = GameConfig.groundHeight;
    this.y = GameConfig.height - this.height;
  }
  update() {
    if (this.x < -this.width) {
      this.x = 0;
    }
    this.x -= this.speed;
  }
  draw(ctx) {
    ctx.drawImage(this.image, this.x, this.y, this.width * 2, this.height);
  }
}
class Sprite {
  constructor(image, width, height) {
    this.x = 0;
    this.y = 0;
    this.image = image;
    this.width = width;
    this.height = height;
  }
  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }
  update() {
    throw new Error("update method must be implemented");
  }
  draw() {
    throw new Error("draw method must be implemented");
  }
}
class Bird extends Sprite {
  constructor(image, id = 0, opacity = "1", jumpHeight = 3, gravity = 0.05) {
    super(image, 58 * 0.8, 48 * 0.8);
    this.jumpHeight = jumpHeight;
    this.gravity = gravity;
    this.cropWidth = 58;
    this.cropHeight = 48;
    this.opacity = opacity;
    this.id = id;
    this.isColliding = false;
    this.init();
  }
  init() {
    this.frameX = 1;
    this.gameframe = 0;
    this.setPosition(50, GameConfig.height / 2 - 100);
    this.velocityY = 0;
  }
  jump() {
    this.velocityY = -this.jumpHeight;
  }
  update() {
    this.gameframe++;
    this.velocityY += this.gravity;
    this.y += this.velocityY;
    if (this.gameframe % GameConfig.frameSpeed === 0) {
      this.frameX = (this.frameX + 1) % 8;
    }
  }
  draw(ctx) {
    ctx.globalAlpha = this.opacity;
    ctx.drawImage(
      this.image,
      this.frameX * this.cropWidth,
      0,
      this.cropWidth,
      this.cropHeight,
      this.x,
      this.y,
      this.width,
      this.height
    );
    ctx.globalAlpha = 1;
  }
}
class Pipe extends Sprite {
  constructor(image, y) {
    super(image, GameConfig.pipeWidth, GameConfig.height * 2);
    this.x = GameConfig.width;
    this.y = y;
    this.passed = false;
  }
  update() {
    this.x -= GameConfig.gameSpeed;
  }
  draw(ctx) {
    ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
  }
}
class BaseMenuState extends GameState {
  constructor(game) {
    super(game);
  }
  enter() {
    this.game.ctx.save();
    this.backgroundLayer = new BackgroundLayer(
      this.game.resources.images.bgImage,
      0.2
    );
    this.groundLayer = new GroundLayer(
      this.game.resources.images.groundImage,
      1
    );
    this.bird = new Bird(
      this.game.resources.images.birdImage,
      window._game.playerId,
      1,
      10,
      0
    );
    this.bird.setPosition(GameConfig.width / 2 - this.bird.width / 2, 120);
  }
  exit() {
    this.game.ctx.restore();
  }
  update() {
    this.backgroundLayer.update();
    this.groundLayer.update();
    this.bird.update();
  }
  render() {
    this.game.ctx.clearRect(0, 0, GameConfig.width, GameConfig.height);
    this.backgroundLayer.draw(this.game.ctx);
    this.groundLayer.draw(this.game.ctx);
    this.bird.draw(this.game.ctx);
    this.renderPromptText();
  }
  renderPromptText() {
    this.game.ctx.font = "bold 52px 'Courier New', monospace";
    const gradient = this.game.ctx.createLinearGradient(
      0,
      0,
      GameConfig.width,
      0
    );
    gradient.addColorStop(0, "#82eb86");
    gradient.addColorStop(1, "#82eb86");
    this.game.ctx.fillStyle = gradient;
    this.game.ctx.textAlign = "center";
    this.game.ctx.fillText("GET READY?", GameConfig.width / 2, 100);
  }
}
class StartState extends BaseMenuState {
  constructor(game) {
    super(game);
  }
  enter() {
    super.enter();
    this.game.ctx.save();
    if (this.container) return this.container.style.display = "block";
    this.container = document.createElement("div");
    this.container.className = "btns-wrapper";
    const startBtn = document.createElement("button");
    startBtn.className = "btn-start";
    startBtn.innerHTML = "开始游戏";
    startBtn.addEventListener("click", () => {
      window._game.online = false;
      this.game.resources.audios.bgMusic.play();
      this.game.gameStateManager.changeState("play");
    });
    this.container.appendChild(startBtn);
    const createRoomBtn = document.createElement("button");
    createRoomBtn.innerHTML = "创建房间";
    createRoomBtn.className = "btn-create-room";
    this.container.appendChild(createRoomBtn);
    createRoomBtn.addEventListener("click", () => {
      this.game.socket.send(
        JSON.stringify({
          type: "createRoom"
        })
      );
    });
    this.container.appendChild(createRoomBtn);
    const joinRoomBtn = document.createElement("button");
    joinRoomBtn.innerHTML = "加入房间";
    joinRoomBtn.className = "btn-join-room";
    this.container.appendChild(joinRoomBtn);
    joinRoomBtn.addEventListener("click", () => {
      this.game.socket.send(
        JSON.stringify({
          type: "showRoom"
        })
      );
    });
    this.container.appendChild(joinRoomBtn);
    this.game.wrapperDom.appendChild(this.container);
  }
  exit() {
    super.exit();
    this.container.style.display = "none";
  }
  handleMessage(data) {
    switch (data.type) {
      case "createRole":
        window._game.playerId = data.playerId;
        break;
      case "createRoom":
        window._game.roomId = data.roomId;
        window._game.players = [window._game.playerId];
        this.game.gameStateManager.changeState("createRoom");
        break;
      case "showRoom":
        window._game.rooms = data.rooms;
        this.game.gameStateManager.changeState("joinRoom");
    }
  }
}
class CreateRoomState extends BaseMenuState {
  constructor(game) {
    super(game);
    this.room = {};
  }
  enter({ joined } = { joined: false }) {
    super.enter();
    if (this.room.container) {
      this.room.container.style.display = "block";
      this.room.updateItems(window._game.players);
      this.room.updateTitle(`房间成员 ${window._game.players.length}`);
      return;
    }
    const options = {
      title: `房间成员 ${window._game.players.length}`,
      items: window._game.players,
      renderItem: (playerId) => {
        const wrapper = document.createElement("div");
        const avatar = document.createElement("img");
        avatar.src = "src/games/flappyBird/assets/avatar.png";
        const idSpan = document.createElement("span");
        idSpan.textContent = playerId;
        wrapper.appendChild(avatar);
        wrapper.appendChild(idSpan);
        return wrapper;
      },
      onBackClick: () => {
        this.game.socket.send(
          JSON.stringify({
            type: "leaveRoom",
            roomId: window._game.roomId
          })
        );
        this.game.gameStateManager.back();
      }
    };
    if (!joined) {
      Object.assign(options, {
        buttonText: "开始游戏",
        onButtonClick: () => {
          window._game.online = true;
          this.game.resources.audios.bgMusic.play();
          this.game.socket.send(
            JSON.stringify({
              type: "startGame",
              roomId: window._game.roomId
            })
          );
        }
      });
    }
    this.room = createGenericList(options);
    this.game.wrapperDom.appendChild(this.room.container);
  }
  exit() {
    super.exit();
    this.room.container.style.display = "none";
  }
  handleMessage(data) {
    switch (data.type) {
      case "startGame":
        this.game.gameStateManager.changeState("play");
        break;
      case "playerJoined":
      case "playerLeft":
        window._game.players = data.players;
        this.room.updateItems(data.players);
        this.room.updateTitle(`房间成员 ${data.players.length}`);
        break;
    }
  }
}
class JoinRoomState extends BaseMenuState {
  constructor(game) {
    super(game);
    this.room = {};
  }
  enter() {
    super.enter();
    if (this.room.container) {
      this.room.container.style.display = "block";
      this.room.updateItems(window._game.rooms);
      this.room.updateTitle(`房间数 ${window._game.rooms.length}`);
      return;
    }
    this.room = createGenericList({
      title: `房间数 ${window._game.rooms.length}`,
      items: window._game.rooms,
      renderItem: (id) => {
        const wrapper = document.createElement("div");
        wrapper.addEventListener("click", () => {
          window._game.roomId = id;
        });
        const idSpan = document.createElement("span");
        idSpan.textContent = id;
        wrapper.appendChild(idSpan);
        return wrapper;
      },
      buttonText: "加入游戏",
      onButtonClick: () => {
        this.game.socket.send(
          JSON.stringify({
            type: "joinRoom",
            roomId: window._game.roomId
          })
        );
      },
      onBackClick: () => {
        this.game.gameStateManager.back();
      }
    });
    this.game.wrapperDom.appendChild(this.room.container);
  }
  exit() {
    super.exit();
    this.room.container.style.display = "none";
  }
  handleMessage(data) {
    switch (data.type) {
      case "playerJoined":
        window._game.players = data.players;
        this.game.gameStateManager.changeState("createRoom", {
          joined: true
        });
        break;
    }
  }
}
class PlayState extends GameState {
  constructor(game) {
    super(game);
  }
  enter() {
    this.game.ctx.save();
    this.backgroundLayer = new BackgroundLayer(
      this.game.resources.images.bgImage,
      0.2
    );
    this.groundLayer = new GroundLayer(
      this.game.resources.images.groundImage,
      1
    );
    this.bird = new Bird(this.game.resources.images.birdImage);
    this.game.canvas.addEventListener("click", this.bird.jump.bind(this.bird));
    this.pipes = [];
    this.gameframe = 0;
    this.score = 0;
    this.maxScore = localStorage.getItem("maxScore") || 0;
    if (window._game.online) {
      this.otherPlayers = /* @__PURE__ */ new Map();
      window._game.players.forEach((playerId) => {
        this.otherPlayers.set(
          playerId,
          new Bird(this.game.resources.images.birdImage, playerId, 0.5)
        );
      });
    }
  }
  exit() {
    this.game.ctx.restore();
    this.game.canvas.onclick = null;
  }
  generatePipe(y) {
    this.pipes = this.pipes.filter((pipe) => pipe.x + pipe.width > 0);
    this.pipes.push(
      new Pipe(
        this.game.resources.images.pipeImage,
        y || Math.random() * (GameConfig.height - GameConfig.pipeGap - GameConfig.groundHeight) + (-644 + GameConfig.pipeGap / 2)
      )
    );
  }
  checkCollision() {
    if (this.bird.y < 0 || this.bird.y + this.bird.height > GameConfig.height - GameConfig.groundHeight) {
      return true;
    }
    return this.pipes.some((pipe) => {
      const inPipeX = this.bird.x + this.bird.width > pipe.x && this.bird.x < pipe.x + GameConfig.pipeWidth;
      const inTopPipe = this.bird.y < pipe.y + GameConfig.height - GameConfig.pipeGap / 2;
      const inBottomPipe = this.bird.y + this.bird.height > pipe.y + GameConfig.height + GameConfig.pipeGap / 2;
      return inPipeX && (inTopPipe || inBottomPipe);
    });
  }
  updateScore() {
    this.pipes.forEach((pipe) => {
      if (!pipe.passed && pipe.x + GameConfig.pipeWidth < this.bird.x) {
        pipe.passed = true;
        this.score++;
        if (this.score >= this.maxScore) {
          localStorage.setItem("maxScore", this.score);
          this.maxScore = this.score;
        }
      }
    });
  }
  update() {
    this.gameframe++;
    if (!window._game.online && this.gameframe % GameConfig.pipeFrequency === 0) {
      this.generatePipe();
    }
    this.backgroundLayer.update();
    this.pipes.forEach((pipe) => pipe.update());
    this.groundLayer.update();
    if (!this.bird.isColliding) this.bird.update();
    this.updateScore();
    if (!this.bird.isColliding && window._game.online) {
      this.game.socket.send(
        JSON.stringify({
          type: "updatePlayer",
          roomId: window._game.roomId,
          playerId: window._game.playerId,
          score: this.score,
          x: this.bird.x,
          y: this.bird.y
        })
      );
    }
  }
  render() {
    this.game.ctx.clearRect(0, 0, GameConfig.width, GameConfig.height);
    this.backgroundLayer.draw(this.game.ctx);
    this.pipes.forEach((pipe) => pipe.draw(this.game.ctx));
    this.groundLayer.draw(this.game.ctx);
    if (!this.bird.isColliding) this.bird.draw(this.game.ctx);
    if (window._game.online)
      this.otherPlayers.forEach(
        (player) => !player.isColliding && player.id !== window._game.playerId && player.draw(this.game.ctx)
      );
    this.game.ctx.textAlign = "left";
    this.game.ctx.fillStyle = "#fff";
    this.game.ctx.font = "16px Arial";
    this.game.ctx.fillText(`当前分数: ${this.score}`, 20, 40);
    this.game.ctx.fillText(`​​最高分数: ${this.maxScore}`, 20, 60);
    if (!this.bird.isColliding && this.checkCollision()) {
      this.bird.isColliding = true;
      if (!window._game.online) {
        return this.game.gameStateManager.changeState("gameover");
      }
      this.game.socket.send(
        JSON.stringify({
          type: "updatePlayer",
          roomId: window._game.roomId,
          playerId: window._game.playerId,
          score: this.score,
          x: this.bird.x,
          y: this.bird.y,
          isColliding: true
        })
      );
      this.game.socket.send(
        JSON.stringify({
          type: "gameOver",
          roomId: window._game.roomId,
          score: this.score
        })
      );
    }
  }
  handleMessage(data) {
    switch (data.type) {
      case "generatePipe":
        this.generatePipe(data.y);
        break;
      case "gameOver":
        this.game.gameStateManager.changeState("gameover", {
          msg: data.msg
        });
        break;
      case "updatePlayer":
        this.otherPlayers.get(data.playerId).setPosition(data.x, data.y);
        this.otherPlayers.get(data.playerId).isColliding = !!data.isColliding;
        break;
    }
  }
}
class GameOverState extends GameState {
  constructor(game) {
    super(game);
    this.container = null;
  }
  enter({ msg } = { msg: "GAME OVER" }) {
    this.game.ctx.save();
    this.game.resources.audios.bgMusic.pause();
    this.game.resources.audios.bgMusic.currentTime = 0;
    this.game.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    this.game.ctx.fillRect(0, 0, GameConfig.width, GameConfig.height);
    this.game.ctx.font = "bold 52px 'Courier New', monospace";
    const gradient = this.game.ctx.createLinearGradient(
      0,
      0,
      GameConfig.width,
      0
    );
    gradient.addColorStop(0, "orange");
    gradient.addColorStop(1, "orange");
    this.game.ctx.fillStyle = gradient;
    this.game.ctx.textAlign = "center";
    this.game.ctx.fillText(
      msg,
      GameConfig.width / 2,
      GameConfig.height / 2 - 100
    );
    if (this.container) return this.container.style.display = "block";
    this.container = document.createElement("div");
    this.container.className = "btns-wrapper";
    const restartBtn = document.createElement("button");
    restartBtn.className = "btn-restart";
    restartBtn.innerHTML = "重新开始";
    restartBtn.addEventListener("click", () => {
      this.game.resources.audios.bgMusic.play();
      if (!window._game.online) {
        return this.game.gameStateManager.changeState("play");
      }
      this.game.socket.send(
        JSON.stringify({
          type: "startGame",
          roomId: window._game.roomId
        })
      );
    });
    this.container.appendChild(restartBtn);
    const exitBtn = document.createElement("button");
    exitBtn.innerHTML = "回到菜单";
    exitBtn.className = "btn-exit";
    this.container.appendChild(exitBtn);
    exitBtn.addEventListener("click", () => {
      this.game.socket.send(
        JSON.stringify({
          type: "leaveRoom",
          roomId: window._game.roomId
        })
      );
      this.game.gameStateManager.changeState("start");
    });
    this.container.appendChild(exitBtn);
    this.game.wrapperDom.appendChild(this.container);
  }
  exit() {
    this.game.ctx.restore();
    this.container.style.display = "none";
  }
  update() {
  }
  render() {
  }
  handleMessage(data) {
    switch (data.type) {
      case "startGame":
        this.game.gameStateManager.changeState("play");
        break;
    }
  }
}
class FlappyGame {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement("canvas");
    this.wrapperDom = document.createElement("div");
    this.wrapperDom.className = "flappyBird-wrapper";
    this.wrapperDom.appendChild(this.canvas);
    this.container.appendChild(this.wrapperDom);
    this.canvas.width = GameConfig.width;
    this.canvas.height = GameConfig.height;
    this.ctx = this.canvas.getContext("2d");
    this.resources = {};
    this.loadCnt = 0;
    this.gameStateManager = new GameStateManager();
    this.updateValue = void 0;
    this.socket = null;
    window._game = {
      players: [],
      playerId: "",
      roomId: "",
      online: true
    };
    this.initGameStateManager();
    this.loadResource();
    this.gameloop();
  }
  initWebsoket() {
    this.socket = new WebSocket("ws://10.151.253.202:8080");
    this.socket.onmessage = (event) => {
      this.gameStateManager.currentState.handleMessage(JSON.parse(event.data));
    };
  }
  loadResource() {
    this.gameStateManager.changeState("progress");
    loadResourcesWithProgress(manifest, (loaded, total) => {
      this.updateValue = loaded / total;
    }).then((resources) => {
      this.resources = resources;
      this.gameStateManager.changeState("start");
      this.initWebsoket();
    });
  }
  initGameStateManager() {
    this.gameStateManager.registerState("progress", new ProgressState(this));
    this.gameStateManager.registerState("start", new StartState(this));
    this.gameStateManager.registerState("play", new PlayState(this));
    this.gameStateManager.registerState("gameover", new GameOverState(this));
    this.gameStateManager.registerState(
      "createRoom",
      new CreateRoomState(this)
    );
    this.gameStateManager.registerState("joinRoom", new JoinRoomState(this));
  }
  gameloop() {
    this.gameStateManager.update(this.updateValue);
    this.gameStateManager.render();
    requestAnimationFrame(this.gameloop.bind(this));
  }
}
function initFlappyBird(container) {
  return new FlappyGame(container);
}
export {
  initFlappyBird as default
};
