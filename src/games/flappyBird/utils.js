export const isMatchImage = (s) => /\.(png)$/.test(s);
export const isMatchAudio = (s) => /\.(mp3)$/.test(s);

//基本加载资源函数
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

// 批量加载
const loadMultiple = (resources, loader) => {
  const entries = Object.entries(resources);
  const promises = entries.map(([key, src]) =>
    loader(src).then((resource) => ({ key, resource }))
  );

  return Promise.all(promises).then((results) =>
    results.reduce((acc, { key, resource }) => {
      acc[key] = resource;
      return acc;
    }, {})
  );
};

export const loadImages = (imageMap) => loadMultiple(imageMap, loadImage);
export const loadAudios = (audioMap) => loadMultiple(audioMap, loadAudio);

export const loadImage = (src) => loadResource(src, () => new Image(), "load");

export const loadAudio = (src) =>
  loadResource(src, () => new Audio(), "canplaythrough");

// 组合加载器
export const loadResources = async ({ images = {}, audios = {} }) => {
  const [loadedImages, loadedAudios] = await Promise.all([
    loadImages(images),
    loadAudios(audios),
  ]);

  return {
    images: loadedImages,
    audios: loadedAudios,
  };
};

//带进度的加载器
export const loadResourcesWithProgress = (resources, onProgress) => {
  const totalCount = Object.values(resources).flatMap((resource) =>
    Object.keys(resource)
  ).length;

  let loadedCount = 0;

  // 更新进度
  const updateProgress = () => {
    loadedCount++;
    if (onProgress) {
      onProgress(loadedCount, totalCount);
    }
  };

  // 包装加载函数，添加计数功能
  const createCountingLoader = (loader) => (src) => {
    return loader(src).then((resource) => {
      updateProgress();
      return resource;
    });
  };

  // 创建带计数的加载器
  const countingImageLoader = createCountingLoader(loadImage);
  const countingAudioLoader = createCountingLoader(loadAudio);

  // 加载所有资源
  return Promise.all([
    loadMultiple(resources.images, countingImageLoader),
    loadMultiple(resources.audios, countingAudioLoader),
  ]).then(([loadedImages, loadedAudios]) => {
    return {
      images: loadedImages,
      audios: loadedAudios,
    };
  });
};

export function createGenericList(options) {
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
  button.className = "room-back";
  button.textContent = "返回";
  button.addEventListener("click", () => {
    if (options.onBackClick) {
      options.onBackClick();
    }
  });
  container.appendChild(button);
  // 添加按钮
  if (options.buttonText) {
    const button = document.createElement("button");
    button.className = "room-start";
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
