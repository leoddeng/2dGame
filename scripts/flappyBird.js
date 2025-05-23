import { WebSocketServer } from "ws";
import * as crypto from "crypto";
const CONFIG = {
  width: 432,
  height: 644,
  gameSpeed: 2,
  frameSpeed: 10,
  groundHeight: 146,
  pipeGap: 156,
  pipeWidth: 78,
  pipeFrequency: 2000,
};

let handle = null;
let gameOverNum = 0;
function generatePipe() {
  return (
    Math.random() * (CONFIG.height - CONFIG.pipeGap - CONFIG.groundHeight) +
    (-CONFIG.height + CONFIG.pipeGap / 2)
  );
}
class GameServer {
  constructor(port = 8080) {
    this.wss = new WebSocketServer({ port, host: "10.151.253.202" });
    this.rooms = new Map();
    this.clientIds = new Map();
    this.setupEvents();
  }

  setupEvents() {
    this.wss.on("connection", (ws, req) => {
      // 从请求头获取User-Agent
      const userAgent = req.headers["user-agent"];
      const origin = req.headers.origin || "unknown";
      const originPort = origin.split(":")[2] || "unknown";

      // 生成基于浏览器特征和端口的ID
      const playerId = this.generateId(userAgent, origin, originPort);

      ws.send(JSON.stringify({ type: "createRole", playerId }));

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, playerId, message);
        } catch (e) {
          console.error("Message parse error:", e);
        }
      });

      ws.on("close", () => {
        // this.handleDisconnect(playerId);
      });
    });
  }

  handleMessage(ws, playerId, { type, roomId, ...data }) {
    switch (type) {
      case "createRoom":
        this.createRoom(playerId, ws);
        break;

      case "joinRoom":
        this.joinRoom(roomId, playerId, ws);
        break;
      case "leaveRoom":
        this.leaveRoom(roomId, playerId);
        break;
      case "showRoom":
        ws.send(JSON.stringify({ rooms: Array.from(this.rooms.keys()), type }));
        break;
      case "updatePlayer":
        this.updatePlayer(roomId, playerId, data);
        break;
      case "startGame":
        this.broadcast(roomId, { type: "startGame" });
        handle = setInterval(() => {
          this.broadcast(roomId, {
            type: "generatePipe",
            y: generatePipe(),
          });
        }, CONFIG.pipeFrequency);
        break;
      case "gameOver":
        gameOverNum++;
        if (this.rooms.get(roomId).players.size === gameOverNum) {
          clearInterval(handle);
          this.rooms.get(roomId).players.forEach(({ ws }, id) => {
            if (id === playerId) {
              ws.send(JSON.stringify({ type: "gameOver", msg: "你赢了" }));
            } else {
              ws.send(JSON.stringify({ type: "gameOver", msg: "你输了" }));
            }
          });
          gameOverNum = 0;
        } else {
          ws.send(JSON.stringify({ type: "processing", msg: "等待结算" }));
        }
        break;
    }
  }
  updatePlayer(roomId, playerId, data) {
    const room = this.rooms.get(roomId);
    room.players.set(playerId, { ...room.players.get(playerId), ...data });
    this.broadcast(roomId, { type: "updatePlayer", playerId, ...data });
  }
  createRoom(playerId, ws) {
    const roomId = this.generateRoomId();
    this.rooms.set(roomId, {
      players: new Map([[playerId, { ws }]]),
    });

    ws.send(
      JSON.stringify({
        type: "createRoom",
        roomId,
      })
    );
  }

  joinRoom(roomId, playerId, ws) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.players.set(playerId, { ws });
      const players = [...room.players.keys()];
      this.broadcast(roomId, {
        type: "playerJoined",
        players,
      });
    }
  }
  leaveRoom(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.players.delete(playerId);
      const players = [...room.players.keys()];
      if (players.length === 0) {
        return this.rooms.delete(roomId);
      }
      this.broadcast(roomId, {
        type: "playerLeft",
        players,
      });
    }
  }
  broadcast(roomId, message) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.players.forEach(({ ws }) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }
  generateRoomId() {
    return crypto.randomUUID().replace(/-/g, "").substr(0, 12); // 例如："550e8400e29b"
  }
  // 根据浏览器标识和端口号生成唯一ID
  generateId(userAgent, ip, port) {
    // 提取浏览器特征
    const browserInfo = this.extractBrowserInfo(userAgent);

    // 组合特征字符串
    const identifier = `${browserInfo}-${ip}-${port}`;

    // 生成哈希值作为ID
    return crypto
      .createHash("sha256")
      .update(identifier)
      .digest("hex")
      .substr(0, 12); // 取前12个字符作为ID
  }
  // 从User-Agent提取浏览器信息
  extractBrowserInfo(userAgent) {
    // 简单解析，实际项目建议使用useragent库
    if (userAgent.includes("Chrome")) return "Chrome";
    if (userAgent.includes("Firefox")) return "Firefox";
    if (userAgent.includes("Safari")) return "Safari";
    if (userAgent.includes("Edge")) return "Edge";
    return "Unknown";
  }
}

new GameServer(8080);
