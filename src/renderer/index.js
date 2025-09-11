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

  // 如果是"我的工具"，默认显示"已下载"页签
  if (pageId === "cheats") {
    showTab("downloaded");
    downloadedPageLoaded = false; // 重置状态，确保下次切换时重新加载
  }

  // 如果是"所有游戏"页面，加载游戏数据
  if (pageId === "all-games") {
    loadAllGames();
  }
}

// 跟踪已安装页面是否已加载
let downloadedPageLoaded = false;
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

  // 如果是已安装标签页且未加载过，则加载内容
  if (tabId === "downloaded" && !downloadedPageLoaded) {
    loadDownloadedFiles();
    downloadedPageLoaded = true;
  }
}

// 加载已下载的文件列表
async function loadDownloadedFiles() {
  const container = document.getElementById("downloaded");

  try {
    // 显示加载状态
    container.innerHTML = "<p>正在加载已安装的工具...</p>";

    // 获取设置
    const settings = await window.api.loadSettings();

    if (!settings.downloadFolder) {
      container.innerHTML = `
        <div class="empty-state">
          <p>请先设置下载文件夹</p>
          <button class="btn" onclick="navigateTo('settings')">前往设置</button>
        </div>
      `;
      return;
    }

    // 获取文件列表
    const result = await window.api.listDownloadedFiles(
      settings.downloadFolder
    );

    if (!result.success) {
      container.innerHTML = `<p>加载失败: ${result.error}</p>`;
      return;
    }

    if (result.files.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>暂无已安装的工具</p>
          <p>前往"所有游戏"页面下载工具</p>
        </div>
      `;
      return;
    }

    // 生成文件列表HTML
    let html = '<div class="installed-tools-list">';

    result.files.forEach((file) => {
      const fileNameWithoutExt = path.basename(
        file.name,
        path.extname(file.name)
      );

      html += `
        <div class="tool-item">
          <div class="tool-icon">
            <img src="${
              file.image
            }" alt="${fileNameWithoutExt}" onerror="this.onerror=null;this.src=getDefaultImage();">
          </div>
          <div class="tool-info">
            <h4>${fileNameWithoutExt}</h4>
            <p class="file-name">${file.name}</p>
            <p class="file-size">大小: ${formatFileSize(file.size)}</p>
            <p class="file-date">修改时间: ${formatDate(file.modified)}</p>
          </div>
          <div class="tool-actions">
      `;

      if (file.isExecutable) {
        html += `
          <button class="btn launch-btn" onclick="launchTool('${file.path.replace(
            /\\/g,
            "\\\\"
          )}')">
            启动
          </button>
        `;
      } else if (file.isCompressed) {
        html += `
          <button class="btn open-folder-btn" onclick="openDownloadFolder('${settings.downloadFolder.replace(
            /\\/g,
            "\\\\"
          )}')">
            打开文件夹
          </button>
          <p class="compression-note">Oopz~!这个文件还没解压呢，请进入文件夹手动解压</p>
        `;
      }

      html += `
          </div>
        </div>
      `;
    });

    html += "</div>";
    container.innerHTML = html;
  } catch (err) {
    console.error("加载已下载文件失败:", err);
    container.innerHTML = `<p>加载失败: ${err.message}</p>`;
  }
}

// 启动工具函数
function launchTool(filePath) {
  try {
    // 使用 shell.openPath 启动可执行文件
    window.api.openFolder(filePath);
    showToast("正在启动工具...");
  } catch (err) {
    console.error("启动工具失败:", err);
    showToast("启动工具失败: " + err.message);
  }
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// 格式化日期
function formatDate(date) {
  return new Date(date).toLocaleString("zh-CN");
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
        const img = game.img ? game.img.trim() : getDefaultImage();
        const name = game.name ? game.name.trim() : "未知游戏";
        const link = game.downloadPageLink ? game.downloadPageLink.trim() : "#";

        html += `
    <div class="game-card" data-download-link="${link}">
      <img src="${img}" alt="${name}" onerror="this.onerror=null;this.src=getDefaultImage();">
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
document.addEventListener('click', function(e) {
  // 处理导航链接
  if (e.target.classList.contains('nav-link')) {
    e.preventDefault();
    const targetPage = e.target.getAttribute("data-page");
    
    if (targetPage === "website") {
      // 打开外部网站
      openExternalUrl("https://flingtrainer.com");
    } else if (targetPage) {
      navigateTo(targetPage);
    }
    return;
  }
  
  // 处理页签按钮
  if (e.target.classList.contains('tab-btn')) {
    const tabId = e.target.getAttribute("data-tab");
    if (tabId) {
      showTab(tabId);
    }
    return;
  }
  
  // 处理打开文件夹按钮
  if (e.target.classList.contains("open-folder-btn")) {
    const folderPath = e.target.getAttribute("data-folder");
    if (folderPath) {
      openDownloadFolder(folderPath);
    }
    return;
  }
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
              <img src="${game.img || getDefaultImage()}" alt="${
                game.name
              }" onerror="this.onerror=null;this.src=getDefaultImage();">
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

// 下载任务列表
let downloadTasks = [];

// 下载游戏功能
async function downloadGame(downloadPageUrl, gameName, buttonElement) {
  if (!downloadPageUrl || downloadPageUrl === "#") {
    showToast("下载链接无效");
    return;
  }

  // 检查用户是否设置了下载文件夹
  let settings = {};
  try {
    if (typeof window.api !== "undefined" && window.api.loadSettings) {
      settings = await window.api.loadSettings();
    }
  } catch (err) {
    console.error("加载设置失败:", err);
  }

  if (!settings.downloadFolder) {
    showToast("请先设置下载文件夹");
    navigateTo("settings");
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
    const downloadInfo = await window.api.getDownloadInfo(
      downloadPageUrl,
      gameName
    );

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
      // 添加下载任务
      addDownloadTask(downloadInfo, settings.downloadFolder);
      buttonElement.textContent = "已添加到下载队列";
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

// 添加下载任务
function addDownloadTask(downloadInfo, downloadFolder) {
  const taskId = Date.now().toString();
  const task = {
    id: taskId,
    gameName: downloadInfo.gameName,
    downloadLink: downloadInfo.downloadLink,
    downloadFolder: downloadFolder,
    status: "pending", // pending, downloading, completed, failed
    progress: 0,
    fileName: "",
  };

  downloadTasks.push(task);
  updateDownloadTasksUI();

  // 开始下载
  startDownload(task);
}

// 开始下载文件
async function startDownload(task) {
  try {
    // 更新任务状态
    task.status = "downloading";
    updateDownloadTasksUI();

    // 调用主进程下载文件
    if (typeof window.api !== "undefined" && window.api.downloadFile) {
      const result = await window.api.downloadFile(
        task.downloadLink,
        task.downloadFolder
      );

      if (result.success) {
        task.status = "completed";
        task.fileName = result.fileName;
        showToast(`"${task.gameName}" 下载完成`);
      } else {
        task.status = "failed";
        showToast(`"${task.gameName}" 下载失败: ${result.error}`);
      }
    } else {
      task.status = "failed";
      showToast(`"${task.gameName}" 下载失败: API未定义`);
    }
  } catch (err) {
    task.status = "failed";
    showToast(`"${task.gameName}" 下载失败: ${err.message}`);
  }

  updateDownloadTasksUI();
}

// 更新下载任务UI
function updateDownloadTasksUI() {
  const container = document.getElementById("download-tasks");

  if (downloadTasks.length === 0) {
    container.innerHTML = "<p>暂无下载任务</p>";
    return;
  }

  let html = '<div class="download-tasks-list">';

  downloadTasks.forEach((task) => {
    let statusText = "";
    let statusClass = "";

    switch (task.status) {
      case "pending":
        statusText = "等待中";
        statusClass = "status-pending";
        break;
      case "downloading":
        statusText = "下载中...";
        statusClass = "status-downloading";
        break;
      case "completed":
        statusText = "已完成";
        statusClass = "status-completed";
        break;
      case "failed":
        statusText = "失败";
        statusClass = "status-failed";
        break;
    }

    html += `
    <div class="download-task-item">
      <div class="task-info">
        <h4>${task.gameName}</h4>
        <div class="task-status ${statusClass}">${statusText}</div>
      </div>
      <div class="task-actions">
        ${
          task.status === "completed"
            ? `<button class="btn open-folder-btn" data-folder="${task.downloadFolder}">打开文件夹</button>`
            : ""
        }
      </div>
    </div>
  `;
  });

  html += "</div>";
  container.innerHTML = html;
}

// 打开下载文件夹
function openDownloadFolder(folderPath) {
  if (typeof window.api !== "undefined" && window.api.openFolder) {
    window.api.openFolder(folderPath);
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

// 设置相关功能
document.addEventListener("DOMContentLoaded", () => {
  // 加载保存的设置
  loadSettings();

  // 绑定选择文件夹按钮事件
  const selectFolderBtn = document.getElementById("select-folder-btn");
  if (selectFolderBtn) {
    selectFolderBtn.addEventListener("click", selectDownloadFolder);
  }
});

// 加载设置
async function loadSettings() {
  try {
    if (typeof window.api !== "undefined" && window.api.loadSettings) {
      const settings = await window.api.loadSettings();
      if (settings.downloadFolder) {
        document.getElementById("download-folder").value =
          settings.downloadFolder;
      }
    }
  } catch (err) {
    console.error("加载设置失败:", err);
  }
}

// 选择下载文件夹
async function selectDownloadFolder() {
  try {
    if (typeof window.api !== "undefined" && window.api.selectFolder) {
      const folderPath = await window.api.selectFolder();
      if (folderPath) {
        document.getElementById("download-folder").value = folderPath;
        // 保存设置
        saveSettings({ downloadFolder: folderPath });
      }
    }
  } catch (err) {
    console.error("选择文件夹失败:", err);
    showToast("选择文件夹失败");
  }
}

// 保存设置
async function saveSettings(settings) {
  try {
    if (typeof window.api !== "undefined" && window.api.saveSettings) {
      await window.api.saveSettings(settings);
      showToast("设置已保存");
    }
  } catch (err) {
    console.error("保存设置失败:", err);
    showToast("保存设置失败");
  }
}

// 添加事件委托处理打开文件夹按钮
document.addEventListener("click", function (e) {
  if (e.target.classList.contains("open-folder-btn")) {
    const folderPath = e.target.getAttribute("data-folder");
    openDownloadFolder(folderPath);
  }
});

// 添加 path 对象的简化实现（在浏览器环境中不可用）
if (typeof path === "undefined") {
  var path = {
    basename: function (path, ext) {
      let fileName = path.split("\\").pop().split("/").pop();
      if (ext && fileName.endsWith(ext)) {
        return fileName.slice(0, -ext.length);
      }
      return fileName;
    },
    extname: function (path) {
      const parts = path.split(".");
      return parts.length > 1 ? "." + parts.pop() : "";
    },
  };
}

// 拦截所有 a 标签点击事件
document.addEventListener("click", async (event) => {
  // 检查点击目标或其祖先是否是 <a> 标签
  let target = event.target;
  while (target && target !== document) {
    if (target.tagName === "A") {
      const href = target.getAttribute("href");
      if (href && isExternalLink(href)) {
        event.preventDefault(); // 阻止默认行为（在 Electron 窗口内打开）
        try {
          await window.api.openExternalLink(href);
          console.log(`Opened external link: ${href}`);
        } catch (error) {
          console.error("Failed to open link:", error);
        }
        return;
      }
      break; // 找到 a 标签后就跳出循环
    }
    target = target.parentElement;
  }
});

// 判断是否为外部链接（http/https）
function isExternalLink(url) {
  return url.startsWith("http://") || url.startsWith("https://");
}
// 动态生成首页内容
function generateWelcomeContent() {
  const welcomeContent = document.getElementById('welcome-content');
  if (welcomeContent) {
    welcomeContent.innerHTML = `
      <p class="welcome-text">
        1.本软件仅提供从宗门下载游戏辅助工具的便利服务。<br />
        2.任何要求您付费下载、购买激活码或解锁本软件功能等行为均视为诈骗，切勿相信。<br />
        3.通过任何非官方提供的软件、其他来源下载的程序可能已被篡改，存在严重安全风险。因使用非官方版本导致的任何损失后果自负。
      </p>
    `;
  }
}

// 动态生成关于页面内容
function generateAboutContent() {
  const aboutContent = document.getElementById('about-content');
  if (aboutContent) {
    aboutContent.innerHTML = `
      <div class="about-section">
        <h3>作者：bilibili@禾傀</h3>

        <div class="disclaimer-section">
          <h4>软件性质</h4>
          <p>
            本软件（风灵月影宗）是一个免费的游戏辅助工具下载程序，其唯一功能是从
            <a href="https://flingtrainer.com" target="_blank">https://flingtrainer.com</a>
            获取并本地管理游戏辅助工具。
          </p>

          <h4>免责声明</h4>

          <div class="disclaimer-item">
            <p class="disclaimer-title"><strong>非官方关联：</strong></p>
            <p>
              本软件由开发者本人独立开发，并非风灵月影(FLiNG
              Trainer)的官方团队、合作伙伴或代理商，也与其无任何隶属关系。
            </p>
            <p>
              用户从任何渠道跳转至风灵月影(FLiNG
              Trainer)官方网站，其页面上的广告、赞助内容、付费服务或任何形式的商业收入，均与本人（本软件开发者）无任何关联。本人不从中获取任何收益，也不对其内容负责。
            </p>
          </div>

          <div class="disclaimer-item">
            <p class="disclaimer-title"><strong>软件责任：</strong></p>
            <p>
              本软件不修改、不破解、不重新分发任何软件文件，不收集任何用户数据。所有下载的文件均来自其官方源或用户指定的镜像。因此，风灵月影(FLiNG
              Trainer)的版权、功能性、安全性以及使用该软件所产生的任何直接或间接问题，均由该软件的原始作者和提供商承担全部责任。
            </p>
          </div>

          <div class="disclaimer-item">
            <p class="disclaimer-title"><strong>用户责任：</strong></p>
            <p>
              用户在使用本软件下载并安装风灵月影(FLiNG
              Trainer)提供的软件前，应自行判断其合规性与安全性，并同意遵守该软件的所有授权条款。
            </p>
            <p>
              如果用户通过任何非官方渠道下载、安装或运行本程序，由此导致的一切后果（包括但不限于：程序被篡改、植入病毒木马、捆绑恶意软件、数据泄露、财产损失等）均须由用户自行承担。
            </p>  
          </div>

          <h4>支持与反馈</h4>
          <ul>
            <p><strong>关于本软件 (风灵月影宗)：</strong><br>
              如果您有问题、建议，或希望支持本软件的开发，请联系：<a href="https://space.bilibili.com/1783619/upload/opus">bilibili@禾傀</a>
            </p>
            <p><strong>关于风灵月影(FLiNG Trainer)：</strong><br>
              如果您希望支持风灵月影，请访问其官方网站： <a href="https://flingtrainer.com" target="_blank">https://flingtrainer.com</a>
            </p>
          </ul>
        </div>
      </div>
    `;
  }
}

// 在 DOMContentLoaded 事件中调用生成函数
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM 加载完成");
  console.log("window.api:", window.api);

  if (typeof window.api === "undefined") {
    console.error("预加载脚本未正确加载，API 未定义");
    showToast("警告：部分功能可能无法正常工作");
  }
  
  // 生成首页和关于页面内容
  generateWelcomeContent();
  generateAboutContent();
});

// 获取默认图片路径的函数
function getDefaultImage() {
  if (process.env.NODE_ENV === 'development') {
    return '/pic/default.png'; // 开发环境使用 public 目录下的路径
  } else {
    // 生产环境使用相对于应用根目录的路径
    return './pic/default.png';
  }
}

// 将函数暴露到全局作用域，以便HTML中的onclick可以访问
window.openDetailPage = openDetailPage;
window.downloadGame = downloadGame;
window.navigateTo = navigateTo;
window.showTab = showTab;
window.performSearch = performSearch;
window.clearSearchInput = clearSearchInput;
window.launchTool = launchTool;
window.openDownloadFolder = openDownloadFolder;
window.formatFileSize = formatFileSize;
window.formatDate = formatDate;
window.loadAllGames = loadAllGames;
window.loadDownloadedFiles = loadDownloadedFiles;
window.loadSettings = loadSettings;
window.selectDownloadFolder = selectDownloadFolder;
window.saveSettings = saveSettings;
window.getDefaultImage = getDefaultImage;
window.showToast = showToast;