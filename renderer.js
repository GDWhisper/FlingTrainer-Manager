// renderer.js

// 页面切换函数
function navigateTo(pageId) {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.add("hidden");
  });
  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.remove("hidden");
  }

  // 如果是"我的修改器"，默认显示"已下载"页签
  if (pageId === "cheats") {
    showTab("downloaded");
  }

  // 如果是"所有游戏"页面，加载游戏数据
  if (pageId === "all-games") {
    loadAllGames();
  }
}

// 页签切换函数
function showTab(tabId) {
  // 清除所有按钮的 active 状态
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  // 给当前按钮加 active
  document.querySelector(`[data-tab="${tabId}"]`).classList.add("active");

  // 隐藏所有页签内容
  document.querySelectorAll(".tab-pane").forEach((pane) => {
    pane.classList.add("hidden");
  });
  // 显示目标页签
  document.getElementById(tabId).classList.remove("hidden");
}

// 加载所有游戏数据（带防抖处理）
async function loadAllGames() {
  // 如果正在加载中，则直接返回
  if (isLoadingGames) {
    return;
  }

  // 清除之前的防抖定时器
  if (loadGamesTimeout) {
    clearTimeout(loadGamesTimeout);
  }

  // 设置新的防抖定时器，延迟300ms执行加载
  loadGamesTimeout = setTimeout(async () => {
    isLoadingGames = true;

    const container = document.getElementById("games-container");
    container.innerHTML = "<p> 正在加载最近更新的游戏...</p>";

    try {
      // 确保 window.api 存在
      if (typeof window.api === "undefined") {
        throw new Error("API 未定义，请检查预加载脚本是否正确加载");
      }

      const result = await window.api.loadGames();

      if (result.error) {
        container.innerHTML = `<p> 加载失败：${result.error}</p>`;
        return;
      }

      let html = `<h4>最近更新</h4><div class="game-list">`;

      result.data.forEach((game) => {
        // 防止 game.img 或 game.name 为 null/undefined
        const img = game.img ? game.img.trim() : "pic/default.png";
        const name = game.name ? game.name.trim() : "未知游戏";
        const link = game.downloadPageLink ? game.downloadPageLink.trim() : "#";

        html += `
    <div class="game-card" data-download-link="${link}">
      <img src="${img}" alt="${name}" onerror="this.onerror=null;this.src='pic/default.png';">
      <div class="info">
        <h3 title="${name}">${name}</h3>
        <button class="btn detail-btn" onclick="openDetailPage('${link}', '${name.replace(
          /'/g,
          "\\'"
        )}', this)">详情页</button>
        <button class="btn download-btn" onclick="downloadGame('${link}', '${name.replace(
          /'/g,
          "\\'"
        )}', this)">下载</button>
      </div>
    </div>
  `;
      });

      html += `</div>`;

      const allGamesPage = document.getElementById("all-games");
      if (allGamesPage && !allGamesPage.classList.contains("hidden")) {
        if (result.fromCache) {
          showToast("没有更新哦");
        } else {
          showToast(`最新数据 | ${new Date().toLocaleString()}`);
        }
      }

      container.innerHTML = html;
    } catch (err) {
      console.error("前端加载游戏失败:", err);
      container.innerHTML = `<p>加载失败：${err.message}</p>`;
    } finally {
      isLoadingGames = false;
    }
  }, 300); // 300ms 防抖延迟
}

// 监听导航链接
document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const target = e.target.getAttribute("href").substring(1);

    if (target === "website") {
      // 打开外部网站
      openExternalUrl("https://flingtrainer.com");
    } else {
      navigateTo(target);
    }
  });
});

// 监听页签按钮
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tabId = btn.getAttribute("data-tab");
    showTab(tabId);
  });
});

// 浮动提示函数
function showToast(message) {
  // 创建提示元素
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;

  // 设置样式
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    z-index: 10000;
    font-size: 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  `;

  // 添加到页面
  document.body.appendChild(toast);

  // 4秒后移除
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 4000);
}

// 防抖变量
let searchTimeout;
let isSearching = false;
let loadGamesTimeout;
let isLoadingGames = false;

// 搜索渲染进程（带防抖处理）
async function performSearch() {
  // 如果正在搜索中，则直接返回
  if (isSearching) {
    return;
  }

  const keyword = document.getElementById("gameSearch").value.trim();
  if (!keyword) return;

  // 清除之前的防抖定时器
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  // 设置新的防抖定时器，延迟500ms执行搜索
  searchTimeout = setTimeout(async () => {
    isSearching = true;

    const searchButton = document.querySelector(".search-btn");
    const originalButtonText = searchButton.textContent;

    // 更新按钮状态
    searchButton.textContent = "搜索中...";
    searchButton.disabled = true;

    const container = document.getElementById("search-results");
    container.innerHTML = "<p> 正在搜索...</p>";

    // 显示搜索结果区域
    document.getElementById("search-results-container").style.display = "block";

    try {
      // 确保 window.api 存在
      if (typeof window.api === "undefined") {
        throw new Error("API 未定义，请检查预加载脚本是否正确加载");
      }

      const result = await window.api.searchGames(keyword);

      if (result.error) {
        container.innerHTML = `<p style="color: #999; text-align: center;">${result.error}</p>`;
      } else {
        if (result.data && result.data.length > 0) {
          container.innerHTML = result.data
            .map(
              (game) => `
            <div class="game-card" data-download-link="${
              game.downloadPageLink
            }">
              <img src="${game.img || "pic/default.png"}" alt="${
                game.name
              }" onerror="this.onerror=null;this.src='pic/default.png';">
              <div class="info">
                <h3 title="${game.name}">${game.name}</h3>
                <button class="btn detail-btn" onclick="openDetailPage('${
                  game.downloadPageLink
                }', '${game.name.replace(/'/g, "\\'")}', this)">详情页</button>
                <button class="btn download-btn" onclick="downloadGame('${
                  game.downloadPageLink
                }', '${game.name.replace(/'/g, "\\'")}', this)">下载</button>
              </div>
            </div>
          `
            )
            .join("");
        } else {
          container.innerHTML =
            '<p style="color: #999; text-align: center;">未找到相关游戏</p>';
        }
      }
    } catch (err) {
      console.error("搜索失败:", err);
      container.innerHTML = `<p style="color: #999; text-align: center;">搜索失败：${err.message}</p>`;
    } finally {
      // 恢复按钮状态
      searchButton.textContent = "搜索";
      searchButton.disabled = false;
      isSearching = false;
    }
  }, 500); // 500ms 防抖延迟
}

// 清空搜索输入框
function clearSearchInput() {
  document.getElementById("gameSearch").value = "";
  document.getElementById("search-results-container").style.display = "none";
  document.getElementById("search-results").innerHTML = "";

  // 如果有正在进行的搜索，取消它
  if (searchTimeout) {
    clearTimeout(searchTimeout);
    searchTimeout = null;
  }

  // 恢复搜索按钮状态
  const searchButton = document.querySelector(".search-btn");
  if (searchButton) {
    searchButton.textContent = "搜索";
    searchButton.disabled = false;
  }

  isSearching = false;
}

// 统一的打开外部链接方法
function openExternalUrl(url) {
  try {
    // 检查 window.api 是否存在
    if (typeof window.api !== "undefined" && window.api.openExternal) {
      // 使用预加载脚本中暴露的 API 打开外部链接
      window.api.openExternal(url);
    } else {
      // 备用方案：使用 window.open
      window.open(url, "_blank");
    }
  } catch (err) {
    console.error("打开外部链接失败:", err);
    // 最后的备用方案
    try {
      window.location.href = url;
    } catch (e) {
      showToast("无法打开链接，请手动访问: " + url);
    }
  }
}

// 打开详情页功能
async function openDetailPage(downloadPageUrl, gameName, buttonElement) {
  if (
    !downloadPageUrl ||
    downloadPageUrl === "#" ||
    downloadPageUrl === "undefined"
  ) {
    showToast("详情页链接无效");
    return;
  }

  try {
    // 保存原始按钮文本和状态
    const originalText = buttonElement.textContent;
    const wasOpened = buttonElement.classList.contains("opened");

    // 更新按钮状态为"打开中"
    // buttonElement.textContent = "打开中...";
    // buttonElement.disabled = true;

    // 检查 window.api 是否存在
    if (typeof window.api !== "undefined" && window.api.openDetailWindow) {
      // 使用 Electron 创建新窗口打开详情页
      await window.api.openDetailWindow(downloadPageUrl);
      showToast(`正在打开 ${gameName} 的Trainer下载详情页`);
    } else {
      // 备用方案：使用 window.open
      window.open(downloadPageUrl, "_blank");
      showToast(`正在打开 ${gameName} 的Trainer下载详情页`);
    }

    // // 更新按钮状态为"已打开"
    // buttonElement.textContent = "已打开";
    // buttonElement.disabled = false;
    // buttonElement.classList.add("opened");
  } catch (err) {
    console.error("打开详情页失败:", err);
    showToast("打开详情页失败");

    // 恢复按钮原始状态
    if (buttonElement) {
      buttonElement.textContent = "详情页";
      buttonElement.disabled = false;
      buttonElement.classList.remove("opened");
    }
  }
}

// 下载游戏功能
async function downloadGame(downloadPageUrl, gameName, buttonElement) {
  if (!downloadPageUrl || downloadPageUrl === "#") {
    showToast("下载链接无效");
    return;
  }

  // 保存原始按钮文本
  const originalText = buttonElement.textContent;
  buttonElement.textContent = "获取下载信息...";
  buttonElement.disabled = true;

  try {
    // 确保 window.api 存在
    if (typeof window.api === "undefined") {
      throw new Error("API 未定义，请检查预加载脚本是否正确加载");
    }

    // 获取下载信息
    const downloadInfo = await window.api.getDownloadInfo(downloadPageUrl);

    if (downloadInfo.error) {
      showToast(`下载失败: ${downloadInfo.error}`);
      buttonElement.textContent = originalText;
      buttonElement.disabled = false;
      return;
    }

    if (!downloadInfo.downloadLink) {
      showToast("未找到下载链接");
      buttonElement.textContent = originalText;
      buttonElement.disabled = false;
      return;
    }

    // 更新按钮状态
    buttonElement.textContent = "正在下载...";

    // 如果是外部链接，打开浏览器
    if (
      downloadInfo.isExternal ||
      downloadInfo.downloadLink.includes("mega.nz") ||
      downloadInfo.downloadLink.includes("mediafire.com") ||
      downloadInfo.downloadLink.includes("drive.google.com")
    ) {
      // 显示下载信息
      let message = `游戏: ${downloadInfo.gameName}\n`;
      message += `下载链接: ${downloadInfo.downloadLink}\n`;
      if (downloadInfo.downloadPassword) {
        message += `提取码: ${downloadInfo.downloadPassword}\n`;
      }

      alert(message);

      openExternalUrl(downloadInfo.downloadLink);
      buttonElement.textContent = "已打开外部链接";
    } else {
      // 直接下载文件
      const link = document.createElement("a");
      link.href = downloadInfo.downloadLink;
      link.download = "";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      buttonElement.textContent = "已开始下载";
    }

    // 3秒后恢复按钮状态
    setTimeout(() => {
      buttonElement.textContent = "下载";
      buttonElement.disabled = false;
    }, 3000);
  } catch (err) {
    console.error("下载失败:", err);
    showToast(`下载失败：${err.message}`);
    buttonElement.textContent = originalText;
    buttonElement.disabled = false;
  }
}

// 支持 Enter 键（带防抖处理）
document.getElementById("gameSearch").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    // 阻止默认行为，避免重复提交
    e.preventDefault();
    performSearch();
  }
});

// 调试信息：检查 API 是否正确加载
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM 加载完成");
  console.log("window.api:", window.api);

  if (typeof window.api === "undefined") {
    console.error("预加载脚本未正确加载，API 未定义");
    showToast("警告：部分功能可能无法正常工作");
  }
});
