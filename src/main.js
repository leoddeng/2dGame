const container = document.querySelector(".game-container");
const gameList = document.querySelector(".game-list");
const exitBtn = document.querySelector(".exit-btn");

// 游戏模块映射
const gameModules = {
  flappyBird: () => import("./games/flappyBird/index.js"),
  pubg: () => import("./games/pubg/index.js"),
};

// 事件代理
gameList.addEventListener("click", async (e) => {
  const game = e.target.dataset.game;
  console.log(e, game);

  if (!game) return;
  try {
    const gameModule = await gameModules[game]();
    gameList.style.display = "none";
    gameModule.default(container);
    exitBtn.style.display = "inline-block";
  } catch (error) {
    console.error(`加载游戏 ${game} 失败:`, error);
    alert(`加载游戏 ${game} 失败，请稍后再试`);
  }
});

// 游戏退出
exitBtn.addEventListener("click", () => {
  window.location.reload();
  exitBtn.style.display = "none";
});
