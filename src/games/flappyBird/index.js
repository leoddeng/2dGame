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
    this.container.appendChild(this.canvas);
    this.requestAnimationFrameHandle = null;
    this.jumpTimeoutHandle = null;
    // 资源加载
    this.resourcesUrl = {
      birdFrames: Array.from(
        { length: 8 },
        (_, i) => `/src/games/flappyBird/assets/${i}.png`
      ),
      background: "/src/games/flappyBird/assets/bg.png",
      ground: "/src/games/flappyBird/assets/ground.png",
      start: "/src/games/flappyBird/assets/start.png",
      gameover: "/src/games/flappyBird/assets/gameover.png",
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

  setupInput() {
    const handleStart = () => {
      if (!this.gameStarted) {
        this.gameStarted = true;
        this.audio.bgMusic.play();
        this.startGame();
      } else if (!this.gameOver) {
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
        this.audio.bgMusic.currentTime = 0;
        this.audio.bgMusic.play();
        this.resetGame();
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

    if (this.frameCount % 150 === 0) {
      this.generatePipe();
    }

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

    this.ctx.drawImage(this.resources.start, 0, 0, CONFIG.width, CONFIG.height);

    // 绘制作者信息
    this.ctx.font = "16px Arial";
    this.ctx.fillStyle = "white";
    this.ctx.fillText(
      "Created by leodeng",
      CONFIG.width / 2,
      CONFIG.height - 30
    );
    this.ctx.textAlign = "left";
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
    this.ctx.fillStyle = "#fff";
    this.ctx.font = "16px Arial";
    this.ctx.fillText(`Score: ${this.score}`, 20, 40);
    this.ctx.fillText(`​​High score: ${this.maxScore}`, 20, 60);
    // 游戏结束提示
    if (this.gameOver) {
      this.audio.bgMusic.pause();
      cancelAnimationFrame(this.requestAnimationFrameHandle);
      this.renderGameOver();
    }
  }
  renderGameOver() {
    this.ctx.drawImage(
      this.resources.gameover,
      0,
      0,
      CONFIG.width,
      CONFIG.height
    );
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
    this.gameOver = false;
    this.gameLoop();
  }

  resetGame() {
    this.bird.reset();
    this.pipes = [];
    this.score = 0;
    this.frameCount = 0;
    this.gameOver = false;
    this.startGame();
  }
}

// 导出游戏初始化函数
export default function initFlappyBird(container) {
  return new FlappyGame(container);
}
