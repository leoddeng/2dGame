import GameConfig from "./config";
import manifest from "./manifest";
import {
  ProgressState,
  GameStateManager,
  StartState,
  PlayState,
  GameOverState,
  CreateRoomState,
  JoinRoomState,
} from "./GameState";
import { loadResourcesWithProgress } from "./utils";

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
    this.updateValue = undefined;
    this.socket = null;
    window._game = {
      players: [],
      playerId: "",
      roomId: "",
      online: true,
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

// 导出游戏初始化函数
export default function initFlappyBird(container) {
  return new FlappyGame(container);
}
