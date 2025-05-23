// 游戏常量配置
const CONFIG = {
  width: 432,
  height: 644,
  gravity: 0.05,
  jumpForce: 3,
  pipeWidth: 80,
  pipeGap: 160,
  pipeSpeed: 3,
  groundHeight: 146,
};
const BIRD_CONFIG = {
  x: 100,
  y: CONFIG.height / 2,
  size: 30,
};
/**
 * 通用列表组件
 * @param {Object} options 配置选项
 * @param {string} options.title 列表标题
 * @param {Array} options.items 列表项数据
 * @param {Function} options.renderItem 自定义列表项渲染函数
 * @param {string} options.buttonText 按钮文本
 * @param {Function} options.onButtonClick 按钮点击回调
 * @returns {Object} 返回组件对象，包含container和updateItems方法
 */
function createGenericList(options) {
  // 创建容器
  const container = document.createElement("div");
  container.className = "generic-list-container";

  // 创建标题
  const title = document.createElement("h3");
  title.textContent = options.title || "列表";
  container.appendChild(title);

  // 创建列表
  const list = document.createElement("ul");
  container.appendChild(list);

  // 渲染列表项
  const renderItems = () => {
    list.innerHTML = "";
    options.items.forEach((item) => {
      const listItem = document.createElement("li");
      listItem.addEventListener("click", () => {
        Array.from(list.children).forEach((li) => {
          li.classList.remove("active");
        });
        // 为当前点击项添加选中状态
        listItem.classList.add("active");
      });
      if (options.renderItem) {
        // 使用自定义渲染函数
        listItem.appendChild(options.renderItem(item));
      } else {
        // 默认渲染方式
        const content = document.createElement("span");
        content.textContent = item.toString();
        listItem.appendChild(content);
      }

      list.appendChild(listItem);
    });
  };

  // 初始渲染
  renderItems();
  const button = document.createElement("button");
  button.className = "btn-back";
  button.textContent = "返回";
  button.addEventListener("click", () => {
    if (options.onButtonClick) {
      options.onBackClick();
    }
  });
  container.appendChild(button);
  // 添加按钮
  if (options.buttonText) {
    const button = document.createElement("button");
    button.className = "btn-start";
    button.textContent = options.buttonText;
    button.addEventListener("click", () => {
      if (options.onButtonClick) {
        options.onButtonClick();
      }
    });
    container.appendChild(button);
  }

  // 返回组件对象
  return {
    container,
    updateItems: (newItems) => {
      options.items = newItems;
      renderItems();
    },
    updateTitle: (newTitle) => {
      options.title = newTitle;
      title.textContent = newTitle;
    },
  };
}

// 基类：游戏实体
class GameEntity {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.velocity = 0;
  }

  update() {
    throw new Error("Abstract method must be implemented");
  }

  draw(ctx) {
    throw new Error("Abstract method must be implemented");
  }
}

// 鸟类
class Bird extends GameEntity {
  constructor(x, y, size, frames) {
    super(x, y);
    this.size = size;
    this.animationFrames = frames;
    this.currentFrame = 0;
    this.frameCount = 0;
  }

  jump() {
    this.velocity = -CONFIG.jumpForce;
  }

  update() {
    this.velocity += CONFIG.gravity;
    this.y += this.velocity;
    this.frameCount++;
  }

  draw(ctx) {
    ctx.drawImage(
      this.animationFrames[this.currentFrame],
      this.x - this.size / 2,
      this.y - this.size / 2,
      this.size,
      this.size
    );

    // 更新动画帧
    if (this.frameCount % 5 === 0) {
      this.currentFrame = (this.currentFrame + 1) % this.animationFrames.length;
    }
    this.frameCount++;
  }
  reset() {
    this.x = BIRD_CONFIG.x;
    this.y = BIRD_CONFIG.y;
    this.currentFrame = 0;
    this.frameCount = 0;
    this.velocity = 0;
  }
}

// 管道类
class Pipe extends GameEntity {
  constructor(x, gapY, texture) {
    super(x, 0);
    this.gapY = gapY;
    this.passed = false;
    this.texture = texture;
  }

  update() {
    this.x -= CONFIG.pipeSpeed;
  }

  draw(ctx) {
    ctx.drawImage(
      this.texture,
      this.x,
      this.gapY,
      CONFIG.pipeWidth,
      CONFIG.height * 2
    ); //-CONFIG.groundHeight - CONFIG.pipeGap / 2 ->  -CONFIG.height + CONFIG.pipeGap / 2    CONFIG.height -  CONFIG.pipeGap - CONFIG.groundHeight  -226  -564 -644+180+
  }
}

// 游戏主控制器
class FlappyGame {
  constructor(container) {
    // 初始化容器
    this.container = container;
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.canvas.width = CONFIG.width;
    this.canvas.height = CONFIG.height;
    this.wrapperDom = document.createElement("div");
    this.wrapperDom.className = "flappyBird-wrapper";
    this.wrapperDom.appendChild(this.canvas);
    this.container.appendChild(this.wrapperDom);
    this.requestAnimationFrameHandle = null;
    this.jumpTimeoutHandle = null;
    this.gui = {
      startGuiBtns: [],
      endGuiBtns: [],
      createRoomGui: null,
      joinRoomGui: null,
    };
    // 资源加载
    this.resourcesUrl = {
      birdFrames: Array.from(
        { length: 8 },
        (_, i) => `/src/games/flappyBird/assets/${i}.png`
      ),
      background: "/src/games/flappyBird/assets/bg.png",
      ground: "/src/games/flappyBird/assets/ground.png",
      // start: "/src/games/flappyBird/assets/start.png",
      // gameover: "/src/games/flappyBird/assets/gameover.png",
      pipe: "/src/games/flappyBird/assets/pipe.png",
    };
    this.resources = {};
    this.loadedCount = 0;
    this.totalResources = Object.values(this.resourcesUrl).flat().length;

    this.audio = {
      bgMusic: new Audio("/src/games/flappyBird/assets/bg_music.mp3"),
      jumpSound: new Audio("/src/games/flappyBird/assets/sound.mp3"),
    };
    // 设置音频属性
    this.audio.bgMusic.loop = true;
    this.audio.bgMusic.volume = 0.3;
    this.audio.jumpSound.volume = 0.5;

    this.groundX = 0;
    this.groundWidth = CONFIG.width * 2; // 地面图片宽度应为画布两倍

    this.resourcesLoaded = false;
    this.loadResources().then(() => {
      this.resourcesLoaded = true;
      this.initGame();
    });
    this.playerId = "";
    this.roomId = "";
    this.ws = new WebSocket("ws://localhost:8080");
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case "createRole":
          this.playerId = data.playerId;
          break;
        case "roomCreated":
          this.roomId = data.roomId;
          this.gui.createRoomGui.updateTitle("房间成员 (1/4)");
          this.gui.createRoomGui.updateItems([
            {
              avatar: "/src/games/flappyBird/assets/0.png",
              id: data.playerId,
            },
          ]);
          break;
        case "pipeGenerate":
          this.pipes.push(
            new Pipe(CONFIG.width, data.gapY, this.resources.pipe)
          );
          break;
        case "showRoom":
          this.gui.joinRoomGui.updateTitle(`房间数 ${data.rooms.length}`);
          this.gui.joinRoomGui.updateItems(data.rooms.map((id) => ({ id })));
          break;
        case "playerJoined":
        case "getPlayers":
          this.gui.createRoomGui.updateTitle(
            `房间成员 (${data.players.length}/4)`
          );
          this.gui.createRoomGui.updateItems(
            data.players.map((id) => ({
              id,
              avatar: "/src/games/flappyBird/assets/0.png",
            }))
          );
          break;
        case "playGame":
          this.startGame();
          break;
        case "gameOver":
          this.renderGameOver(data.msg);
          break;
      }
    };
  }
  initGame() {
    // 初始化游戏对象
    this.bird = new Bird(
      BIRD_CONFIG.x,
      BIRD_CONFIG.y,
      BIRD_CONFIG.size,
      this.resources.birdFrames
    );
    this.pipes = [];
    this.score = 0;
    this.maxScore = localStorage.getItem("maxScore") || 0;
    this.gameOver = false;
    this.frameCount = 0;
    this.gameStarted = false;
    this.setupInput();
    this.renderStartScreen();
  }

  drawStartGuiBtn() {
    if (this.gui.startGuiBtns.length)
      return this.showBtns(this.gui.startGuiBtns);
    const fragment = document.createDocumentFragment();

    const startBtn = document.createElement("button");
    startBtn.innerHTML = "开始游戏";
    startBtn.className = "btn-start";
    startBtn.addEventListener("click", () => {
      this.startGame();
    });
    this.gui.startGuiBtns.push(startBtn);
    fragment.appendChild(startBtn);

    const createRoomBtn = document.createElement("button");
    createRoomBtn.innerHTML = "创建房间";
    createRoomBtn.className = "btn-create-room";
    createRoomBtn.addEventListener("click", () => {
      this.ws.send(JSON.stringify({ type: "createRoom" }));
      this.hideBtns(this.gui.startGuiBtns);
      this.gui.createRoomGui = this.drawCreateRoom({
        title: "房间成员 (0/4)",
        items: [],
        renderItem: (item) => {
          const wrapper = document.createElement("div");

          const avatar = document.createElement("img");
          avatar.src = item.avatar;

          const idSpan = document.createElement("span");
          idSpan.textContent = item.id;

          wrapper.appendChild(avatar);
          wrapper.appendChild(idSpan);
          return wrapper;
        },
        buttonText: "开始游戏",
        onButtonClick: () => {
          this.gui.createRoomGui.container.style.display = "none";
          this.ws.send(
            JSON.stringify({
              type: "playGame",
              roomId: this.roomId,
              msg: "start",
            })
          );
        },
        onBackClick: () => {
          this.gui.createRoomGui.container.style.display = "none";
          this.showBtns(this.gui.startGuiBtns);
        },
      });
    });
    this.gui.startGuiBtns.push(createRoomBtn);
    fragment.appendChild(createRoomBtn);

    const joinRoomBtn = document.createElement("button");
    joinRoomBtn.innerHTML = "加入房间";
    joinRoomBtn.className = "btn-join-room";
    joinRoomBtn.addEventListener("click", () => {
      this.ws.send(
        JSON.stringify({
          type: "showRoom",
        })
      );
      this.hideBtns(this.gui.startGuiBtns);
      this.gui.joinRoomGui = this.drawJoinRoom({
        title: "房间数 0",
        items: [{ id: "Room1" }],
        renderItem: (item) => {
          const wrapper = document.createElement("div");
          const idSpan = document.createElement("span");
          idSpan.textContent = item.id;
          wrapper.addEventListener("click", () => {
            this.roomId = item.id;
          });
          wrapper.appendChild(idSpan);
          return wrapper;
        },
        buttonText: "加入房间",
        onButtonClick: () => {
          this.ws.send(
            JSON.stringify({
              playerId: this.playerId,
              type: "joinRoom",
              roomId: this.roomId,
              msg: "join",
            })
          );
          this.gui.joinRoomGui.container.style.display = "none";
          this.gui.createRoomGui = null;
          this.gui.createRoomGui = this.drawCreateRoom({
            title: "房间成员 (0/4)",
            items: [],
            renderItem: (item) => {
              const wrapper = document.createElement("div");

              const avatar = document.createElement("img");
              avatar.src = item.avatar;

              const idSpan = document.createElement("span");
              idSpan.textContent = item.id;
              wrapper.appendChild(avatar);
              wrapper.appendChild(idSpan);
              return wrapper;
            },
            onBackClick: () => {
              this.gui.createRoomGui.container.style.display = "none";
              this.gui.joinRoomGui.container.style.display = "block";
            },
          });
        },
        onBackClick: () => {
          this.gui.joinRoomGui.container.style.display = "none";
          this.showBtns(this.gui.startGuiBtns);
        },
      });
    });
    this.gui.startGuiBtns.push(joinRoomBtn);
    fragment.appendChild(joinRoomBtn);

    const checkGradesBtn = document.createElement("button");
    checkGradesBtn.innerHTML = "查看成绩";
    checkGradesBtn.className = "btn-check-grades";
    this.gui.startGuiBtns.push(checkGradesBtn);
    fragment.appendChild(checkGradesBtn);

    this.wrapperDom.appendChild(fragment);
  }
  drawEndGuiBtn() {
    if (this.gui.endGuiBtns.length) return this.showBtns(this.gui.endGuiBtns);
    const fragment = document.createDocumentFragment();
    const restartBtn = document.createElement("button");
    restartBtn.innerHTML = "重新开始";
    restartBtn.className = "btn-restart";
    restartBtn.addEventListener("click", () => {
      this.ws.send(
        JSON.stringify({
          type: "playGame",
          roomId: this.roomId,
          msg: "start",
        })
      );
      this.startGame();
    });
    this.gui.endGuiBtns.push(restartBtn);
    fragment.appendChild(restartBtn);

    const exitBtn = document.createElement("button");
    exitBtn.innerHTML = "回到菜单";
    exitBtn.className = "btn-exit";
    exitBtn.addEventListener("click", () => {
      this.renderStartScreen();
    });
    this.gui.endGuiBtns.push(exitBtn);
    fragment.appendChild(exitBtn);
    this.wrapperDom.appendChild(fragment);

    this.wrapperDom.appendChild(fragment);
  }
  hideBtns(btns) {
    btns.forEach((e) => {
      e.style.display = "none";
    });
  }
  showBtns(btns) {
    btns.forEach((e) => {
      e.style.display = "block";
    });
  }
  drawCreateRoom(options) {
    if (this.gui.createRoomGui) {
      this.gui.createRoomGui.container.style.display = "block";
      return this.gui.createRoomGui;
    }
    const roomList = createGenericList(options);
    this.wrapperDom.appendChild(roomList.container);
    return roomList;
  }
  drawJoinRoom(options) {
    if (this.gui.joinRoomGui) {
      this.gui.joinRoomGui.container.style.display = "block";
      return this.gui.joinRoomGui;
    }
    const roomList = createGenericList(options);
    this.wrapperDom.appendChild(roomList.container);
    return roomList;
  }
  setupInput() {
    const handleStart = () => {
      if (this.gameStarted && !this.gameOver) {
        this.jumpTimeoutHandle = setTimeout(() => {
          if (this.jumpTimeoutHandle) {
            clearTimeout(this.jumpTimeoutHandle);
            this.audio.jumpSound.pause();
            this.audio.jumpSound.currentTime = 0;
            this.jumpTimeoutHandle = setTimeout(() => {
              this.audio.jumpSound.play();
            }, 0);
          }
        }, 0);
        this.bird.jump();
      } else {
        this.startGame();
      }
    };
    document.addEventListener("keydown", (e) => {
      if (e.code === "Space") handleStart();
    });

    this.canvas.addEventListener("click", handleStart);
  }
  async loadResources() {
    const loadImage = (src) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          this.loadedCount++;
          this.drawLoadingProgress();
          resolve(img);
        };
        img.src = src;
      });
    };

    //加载所有资源
    for (const [key, urls] of Object.entries(this.resourcesUrl)) {
      if (Array.isArray(urls)) {
        this.resources[key] = await Promise.all(urls.map(loadImage));
      } else {
        this.resources[key] = await loadImage(urls);
      }
    }
  }
  drawLoadingProgress() {
    // 清空画布
    this.ctx.clearRect(0, 0, CONFIG.width, CONFIG.height);

    // 绘制背景
    this.ctx.fillStyle = "#70c5ce";
    this.ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

    // 绘制进度条背景
    const barWidth = 400;
    const barHeight = 20;
    const barX = (CONFIG.width - barWidth) / 2;
    const barY = CONFIG.height / 2;

    this.ctx.fillStyle = "#ddd";
    this.ctx.fillRect(barX, barY, barWidth, barHeight);

    // 绘制进度条前景
    const progress = this.loadedCount / this.totalResources;
    this.ctx.fillStyle = "#2ecc71";
    this.ctx.fillRect(barX, barY, barWidth * progress, barHeight);

    // 绘制进度文本
    this.ctx.fillStyle = "#000";
    this.ctx.font = "20px Arial";
    this.ctx.textAlign = "center";
    this.ctx.fillText(
      `Loading: ${Math.round(progress * 100)}%`,
      CONFIG.width / 2,
      barY - 20
    );

    // 绘制加载提示
    this.ctx.font = "16px Arial";
    this.ctx.fillText(
      `Loaded ${this.loadedCount} of ${this.totalResources} resources`,
      CONFIG.width / 2,
      barY + 50
    );
  }
  generatePipe() {
    const gapY =
      Math.random() * (-CONFIG.groundHeight - CONFIG.pipeGap / 2) -
      (CONFIG.height - CONFIG.pipeGap - CONFIG.groundHeight);
    this.pipes.push(new Pipe(CONFIG.width, gapY, this.resources.pipe));
  }

  checkCollision() {
    // 边界检测
    if (this.bird.y < 0 || this.bird.y > CONFIG.height - CONFIG.groundHeight) {
      return true;
    }

    // 管道碰撞检测
    return this.pipes.some((pipe) => {
      const inPipeX =
        this.bird.x + this.bird.size / 2 > pipe.x &&
        this.bird.x - this.bird.size / 2 < pipe.x + CONFIG.pipeWidth;

      const inTopPipe =
        this.bird.y - this.bird.size / 2 <
        pipe.gapY + CONFIG.height - CONFIG.pipeGap / 2;
      const inBottomPipe =
        this.bird.y + this.bird.size / 2 >
        pipe.gapY + CONFIG.height + CONFIG.pipeGap / 2;

      return inPipeX && (inTopPipe || inBottomPipe);
    });
  }

  updateScore() {
    this.pipes.forEach((pipe) => {
      if (!pipe.passed && pipe.x + CONFIG.pipeWidth < this.bird.x) {
        pipe.passed = true;
        this.score++;
        if (this.score >= this.maxScore) {
          localStorage.setItem("maxScore", this.score);
          this.maxScore = this.score;
        }
      }
    });
  }

  gameLoop = () => {
    if (this.gameOver) return;

    // 更新状态
    this.bird.update();

    // if (this.frameCount % 150 === 0) {
    //   this.generatePipe();
    // }

    this.pipes.forEach((pipe) => pipe.update());
    this.updateScore();

    // 碰撞检测
    if (this.checkCollision()) {
      this.gameOver = true;
    }

    // 清理屏幕外的管道
    this.pipes = this.pipes.filter((pipe) => pipe.x + CONFIG.pipeWidth > 0);

    // 渲染
    this.render();

    this.frameCount++;
    this.requestAnimationFrameHandle = requestAnimationFrame(this.gameLoop);
  };
  renderStartScreen() {
    // 清空画布
    this.ctx.clearRect(0, 0, CONFIG.width, CONFIG.height);

    this.ctx.drawImage(
      this.resources.background,
      0,
      0,
      CONFIG.width,
      CONFIG.height
    );
    this.ctx.save();
    this.ctx.font = "bold 52px 'Courier New', monospace";
    const gradient = this.ctx.createLinearGradient(0, 0, CONFIG.width, 0);
    gradient.addColorStop(0, "#82eb86"); // 浅绿
    gradient.addColorStop(1, "#82eb86"); // 深绿
    this.ctx.fillStyle = gradient;
    this.ctx.shadowColor = "#2E7D32"; // 阴影颜色（深绿）
    this.ctx.shadowBlur = 8; // 模糊程度
    this.ctx.shadowOffsetX = 3; // 水平偏移
    this.ctx.shadowOffsetY = 3; // 垂直偏移
    this.ctx.fillText("GET READY?", CONFIG.width / 2, 100);
    this.ctx.textAlign = "center"; // 建议改为居中显示更协调
    this.ctx.restore();
    // this.ctx.drawImage(this.resources.start, 0, 0, CONFIG.width, CONFIG.height);
    this.drawStartGuiBtn();
    this.drawEndGuiBtn();
    this.hideBtns(this.gui.endGuiBtns);
    // 绘制作者信息
    this.ctx.save();
    this.ctx.font = "16px Arial";
    this.ctx.fillStyle = "white";
    this.ctx.fillText(
      "Created by leodeng",
      CONFIG.width / 2,
      CONFIG.height - 30
    );
    this.ctx.textAlign = "left";
    this.ctx.restore();
  }
  // 修改后的render方法
  render() {
    // 清空画布
    this.ctx.clearRect(0, 0, CONFIG.width, CONFIG.height);

    // 绘制背景
    this.ctx.drawImage(
      this.resources.background,
      0,
      0,
      CONFIG.width,
      CONFIG.height
    );

    // 绘制实体
    this.pipes.forEach((pipe) => pipe.draw(this.ctx));

    this.updateGround();

    if (this.gameStarted) {
      this.bird.draw(this.ctx);
    }

    // 绘制分数
    this.ctx.save();
    this.ctx.textAlign = "left";
    this.ctx.fillStyle = "#fff";
    this.ctx.font = "16px Arial";
    this.ctx.fillText(`Score: ${this.score}`, 20, 40);
    this.ctx.fillText(`​​High score: ${this.maxScore}`, 20, 60);
    this.ctx.restore();
    // 游戏结束提示
    if (this.gameOver) {
      this.ws.send(
        JSON.stringify({
          type: "gameOver",
          score: this.score,
          playerId: this.playerId,
          roomId: this.roomId,
        })
      );
      this.audio.bgMusic.pause();
      cancelAnimationFrame(this.requestAnimationFrameHandle);
      // this.renderGameOver();
    }
  }
  renderGameOver(msg = "GameOver") {
    this.ctx.save();
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)"; // 70%不透明度
    this.ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
    this.ctx.font = "bold 52px 'Courier New', monospace";
    const gradient = this.ctx.createLinearGradient(0, 0, CONFIG.width, 0);
    gradient.addColorStop(0, "orange");
    gradient.addColorStop(1, "orange");
    this.ctx.fillStyle = gradient;
    this.ctx.shadowColor = "#2E7D32";
    this.ctx.shadowBlur = 8;
    this.ctx.shadowOffsetX = 3;
    this.ctx.shadowOffsetY = 3;
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle"; // 新增垂直居中
    this.ctx.fillText(msg, CONFIG.width / 2, CONFIG.height / 2 - 100); // 修改坐标
    this.ctx.restore();
    this.showBtns(this.gui.endGuiBtns);
  }
  updateGround() {
    // 绘制地面（双图循环）
    this.ctx.drawImage(
      this.resources.ground,
      this.groundX,
      CONFIG.height - this.resources.ground.height,
      CONFIG.width * 2, // 地面图片宽度
      this.resources.ground.height
    );
    this.groundX -= CONFIG.pipeSpeed;
    if (this.groundX <= -CONFIG.width) {
      this.groundX = 0;
    }
  }
  startGame() {
    console.log(this.gui);

    this.gui.createRoomGui &&
      (this.gui.createRoomGui.container.style.display = "none");
    this.gui.joinRoomGui &&
      (this.gui.joinRoomGui.container.style.display = "none");
    this.bird.reset();
    this.pipes = [];
    this.score = 0;
    this.frameCount = 0;
    this.gameStarted = true;
    this.audio.bgMusic.currentTime = 0;
    this.audio.bgMusic.play();
    this.gameOver = false;
    this.hideBtns(this.gui.startGuiBtns);
    this.hideBtns(this.gui.endGuiBtns);
    this.gameLoop();
  }
}

// 导出游戏初始化函数
export default function initFlappyBird(container) {
  return new FlappyGame(container);
}
