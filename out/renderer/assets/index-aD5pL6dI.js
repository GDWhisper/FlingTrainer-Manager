let externalLinkClickTimeout = null;
let globalClickTimeout = null;
document.removeEventListener("click", handleNavigationClick);
document.removeEventListener("click", handleTabClick);
document.removeEventListener("click", handleFolderClick);
function handleNavigationClick(e) {
  if (globalClickTimeout) return;
  if (e.target.classList.contains("nav-link")) {
    globalClickTimeout = setTimeout(() => {
      globalClickTimeout = null;
    }, 300);
    e.preventDefault();
    const targetPage = e.target.getAttribute("data-page");
    if (targetPage === "website") {
      openExternalUrl("https://flingtrainer.com");
    } else if (targetPage) {
      navigateTo(targetPage);
    }
    return;
  }
}
function handleTabClick(e) {
  if (globalClickTimeout) return;
  if (e.target.classList.contains("tab-btn")) {
    globalClickTimeout = setTimeout(() => {
      globalClickTimeout = null;
    }, 300);
    const tabId = e.target.getAttribute("data-tab");
    if (tabId) {
      showTab(tabId);
    }
    return;
  }
}
function handleFolderClick(e) {
  if (e.target.classList.contains("open-folder-btn")) {
    const folderPath = e.target.getAttribute("data-folder");
    if (folderPath) {
      openDownloadFolder(folderPath);
    }
    return;
  }
}
document.addEventListener("click", function(e) {
  handleNavigationClick(e);
  handleTabClick(e);
  handleFolderClick(e);
});
function navigateTo(pageId) {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.add("hidden");
  });
  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.remove("hidden");
  }
  if (pageId === "cheats") {
    showTab("downloaded");
    downloadedPageLoaded = false;
  }
  if (pageId === "all-games") {
    loadAllGames();
  }
}
let downloadedPageLoaded = false;
function showTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  document.querySelector(`[data-tab="${tabId}"]`).classList.add("active");
  document.querySelectorAll(".tab-pane").forEach((pane) => {
    pane.classList.add("hidden");
  });
  document.getElementById(tabId).classList.remove("hidden");
  if (tabId === "downloaded" && !downloadedPageLoaded) {
    loadDownloadedFiles();
    downloadedPageLoaded = true;
  }
}
async function loadDownloadedFiles() {
  const container = document.getElementById("downloaded");
  try {
    container.innerHTML = "<p>正在加载已安装的工具...</p>";
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
    const formattedFiles = await Promise.all(
      result.files.map(async (file) => {
        return {
          ...file,
          formattedSize: await formatFileSize(file.size),
          formattedDate: await formatDate(file.modified),
          fileNameWithoutExt: path.basename(file.name, path.extname(file.name))
        };
      })
    );
    let html = '<div class="installed-tools-list">';
    formattedFiles.forEach((file) => {
      html += `
        <div class="tool-item">
          <div class="tool-icon">
            <img src="${file.image}" alt="${file.fileNameWithoutExt}" onerror="this.onerror=null;this.src=getDefaultImage();">
          </div>
          <div class="tool-info">
            <h4>${file.fileNameWithoutExt}</h4>
            <p class="file-name">${file.name}</p>
            <p class="file-size">大小: ${file.formattedSize}</p>
            <p class="file-date">修改时间: ${file.formattedDate}</p>
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
async function launchTool(filePath) {
  try {
    const result = await window.api.launchTool(filePath);
    if (result.success) {
      showToast("正在启动工具...");
    } else {
      showToast("启动工具失败: " + result.error);
    }
  } catch (err) {
    console.error("启动工具失败:", err);
    showToast("启动工具失败: " + err.message);
  }
}
async function formatFileSize(bytes) {
  return await window.api.formatFileSize(bytes);
}
async function formatDate(date) {
  return await window.api.formatDate(date);
}
async function loadAllGames() {
  if (isLoadingGames) {
    return;
  }
  if (loadGamesTimeout) {
    clearTimeout(loadGamesTimeout);
  }
  loadGamesTimeout = setTimeout(async () => {
    isLoadingGames = true;
    const container = document.getElementById("games-container");
    container.innerHTML = "<p> 正在加载最近更新的游戏...</p>";
    try {
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
          showToast(`最新数据 | ${(/* @__PURE__ */ new Date()).toLocaleString()}`);
        }
      }
      container.innerHTML = html;
    } catch (err) {
      console.error("前端加载游戏失败:", err);
      container.innerHTML = `<p>加载失败：${err.message}</p>`;
    } finally {
      isLoadingGames = false;
    }
  }, 300);
}
document.addEventListener("click", function(e) {
  if (e.target.classList.contains("nav-link")) {
    e.preventDefault();
    const targetPage = e.target.getAttribute("data-page");
    if (targetPage === "website") {
      openExternalUrl("https://flingtrainer.com");
    } else if (targetPage) {
      navigateTo(targetPage);
    }
    return;
  }
  if (e.target.classList.contains("tab-btn")) {
    const tabId = e.target.getAttribute("data-tab");
    if (tabId) {
      showTab(tabId);
    }
    return;
  }
  if (e.target.classList.contains("open-folder-btn")) {
    const folderPath = e.target.getAttribute("data-folder");
    if (folderPath) {
      openDownloadFolder(folderPath);
    }
    return;
  }
});
function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
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
  document.body.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 4e3);
}
let searchTimeout;
let isSearching = false;
let loadGamesTimeout;
let isLoadingGames = false;
async function performSearch() {
  if (isSearching) {
    return;
  }
  const keyword = document.getElementById("gameSearch").value.trim();
  if (!keyword) return;
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = setTimeout(async () => {
    isSearching = true;
    const searchButton = document.querySelector(".search-btn");
    searchButton.textContent;
    searchButton.textContent = "搜索中...";
    searchButton.disabled = true;
    const container = document.getElementById("search-results");
    container.innerHTML = "<p> 正在搜索...</p>";
    document.getElementById("search-results-container").style.display = "block";
    try {
      if (typeof window.api === "undefined") {
        throw new Error("API 未定义，请检查预加载脚本是否正确加载");
      }
      const result = await window.api.searchGames(keyword);
      if (result.error) {
        container.innerHTML = `<p style="color: #999; text-align: center;">${result.error}</p>`;
      } else {
        if (result.data && result.data.length > 0) {
          container.innerHTML = result.data.map(
            (game) => `
            <div class="game-card" data-download-link="${game.downloadPageLink}">
              <img src="${game.img || getDefaultImage()}" alt="${game.name}" onerror="this.onerror=null;this.src=getDefaultImage();">
              <div class="info">
                <h3 title="${game.name}">${game.name}</h3>
                <button class="btn detail-btn" onclick="openDetailPage('${game.downloadPageLink}', '${game.name.replace(/'/g, "\\'")}', this)">详情页</button>
                <button class="btn download-btn" onclick="downloadGame('${game.downloadPageLink}', '${game.name.replace(/'/g, "\\'")}', this)">下载</button>
              </div>
            </div>
          `
          ).join("");
        } else {
          container.innerHTML = '<p style="color: #999; text-align: center;">未找到相关游戏</p>';
        }
      }
    } catch (err) {
      console.error("搜索失败:", err);
      container.innerHTML = `<p style="color: #999; text-align: center;">搜索失败：${err.message}</p>`;
    } finally {
      searchButton.textContent = "搜索";
      searchButton.disabled = false;
      isSearching = false;
    }
  }, 500);
}
function clearSearchInput() {
  document.getElementById("gameSearch").value = "";
  document.getElementById("search-results-container").style.display = "none";
  document.getElementById("search-results").innerHTML = "";
  if (searchTimeout) {
    clearTimeout(searchTimeout);
    searchTimeout = null;
  }
  const searchButton = document.querySelector(".search-btn");
  if (searchButton) {
    searchButton.textContent = "搜索";
    searchButton.disabled = false;
  }
  isSearching = false;
}
function openExternalUrl(url) {
  try {
    if (typeof window.api !== "undefined" && window.api.openExternal) {
      window.api.openExternal(url);
    } else {
      window.open(url, "_blank");
    }
  } catch (err) {
    console.error("打开外部链接失败:", err);
    try {
      window.location.href = url;
    } catch (e) {
      showToast("无法打开链接，请手动访问: " + url);
    }
  }
}
async function openDetailPage(downloadPageUrl, gameName, buttonElement) {
  if (!downloadPageUrl || downloadPageUrl === "#" || downloadPageUrl === "undefined") {
    showToast("详情页链接无效");
    return;
  }
  try {
    if (typeof window.api !== "undefined" && window.api.openDetailWindow) {
      await window.api.openDetailWindow(downloadPageUrl);
      showToast(`正在打开 ${gameName} 的Trainer下载详情页`);
    } else {
      window.open(downloadPageUrl, "_blank");
      showToast(`正在打开 ${gameName} 的Trainer下载详情页`);
    }
  } catch (err) {
    console.error("打开详情页失败:", err);
    showToast("打开详情页失败");
  }
}
let downloadTasks = [];
async function downloadGame(downloadPageUrl, gameName, buttonElement) {
  if (!downloadPageUrl || downloadPageUrl === "#") {
    showToast("下载链接无效");
    return;
  }
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
  const originalText = buttonElement.textContent;
  buttonElement.textContent = "获取下载信息...";
  buttonElement.disabled = true;
  try {
    if (typeof window.api === "undefined") {
      throw new Error("API 未定义，请检查预加载脚本是否正确加载");
    }
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
    if (downloadInfo.isExternal || downloadInfo.downloadLink.includes("mega.nz") || downloadInfo.downloadLink.includes("mediafire.com") || downloadInfo.downloadLink.includes("drive.google.com")) {
      let message = `游戏: ${downloadInfo.gameName}
`;
      message += `下载链接: ${downloadInfo.downloadLink}
`;
      if (downloadInfo.downloadPassword) {
        message += `提取码: ${downloadInfo.downloadPassword}
`;
      }
      alert(message);
      openExternalUrl(downloadInfo.downloadLink);
      buttonElement.textContent = "已打开外部链接";
    } else {
      addDownloadTask(downloadInfo, settings.downloadFolder);
      buttonElement.textContent = "已添加到下载队列";
    }
    setTimeout(() => {
      buttonElement.textContent = "下载";
      buttonElement.disabled = false;
    }, 3e3);
  } catch (err) {
    console.error("下载失败:", err);
    showToast(`下载失败：${err.message}`);
    buttonElement.textContent = originalText;
    buttonElement.disabled = false;
  }
}
function addDownloadTask(downloadInfo, downloadFolder) {
  const taskId = Date.now().toString();
  const task = {
    id: taskId,
    gameName: downloadInfo.gameName,
    downloadLink: downloadInfo.downloadLink,
    downloadFolder,
    status: "pending",
    // pending, downloading, completed, failed
    progress: 0,
    fileName: ""
  };
  downloadTasks.push(task);
  updateDownloadTasksUI();
  startDownload(task);
}
async function startDownload(task) {
  try {
    task.status = "downloading";
    updateDownloadTasksUI();
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
        ${task.status === "completed" ? `<button class="btn open-folder-btn" data-folder="${task.downloadFolder}">打开文件夹</button>` : ""}
      </div>
    </div>
  `;
  });
  html += "</div>";
  container.innerHTML = html;
}
function openDownloadFolder(folderPath) {
  if (typeof window.api !== "undefined" && window.api.openFolder) {
    window.api.openFolder(folderPath);
  }
}
document.getElementById("gameSearch").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    performSearch();
  }
});
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM 加载完成");
  console.log("window.api:", window.api);
  if (typeof window.api === "undefined") {
    console.error("预加载脚本未正确加载，API 未定义");
    showToast("警告：部分功能可能无法正常工作");
  }
});
document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  const selectFolderBtn = document.getElementById("select-folder-btn");
  if (selectFolderBtn) {
    selectFolderBtn.addEventListener("click", selectDownloadFolder);
  }
});
async function loadSettings() {
  try {
    if (typeof window.api !== "undefined" && window.api.loadSettings) {
      const settings = await window.api.loadSettings();
      if (settings.downloadFolder) {
        document.getElementById("download-folder").value = settings.downloadFolder;
      }
    }
  } catch (err) {
    console.error("加载设置失败:", err);
  }
}
async function selectDownloadFolder() {
  try {
    if (typeof window.api !== "undefined" && window.api.selectFolder) {
      const folderPath = await window.api.selectFolder();
      if (folderPath) {
        document.getElementById("download-folder").value = folderPath;
        saveSettings({ downloadFolder: folderPath });
      }
    }
  } catch (err) {
    console.error("选择文件夹失败:", err);
    showToast("选择文件夹失败");
  }
}
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
document.addEventListener("click", function(e) {
  if (e.target.classList.contains("open-folder-btn")) {
    const folderPath = e.target.getAttribute("data-folder");
    openDownloadFolder(folderPath);
  }
});
if (typeof path === "undefined") {
  var path = {
    basename: function(path2, ext) {
      let fileName = path2.split("\\").pop().split("/").pop();
      if (ext && fileName.endsWith(ext)) {
        return fileName.slice(0, -ext.length);
      }
      return fileName;
    },
    extname: function(path2) {
      const parts = path2.split(".");
      return parts.length > 1 ? "." + parts.pop() : "";
    }
  };
}
document.addEventListener(
  "click",
  async (event) => {
    if (externalLinkClickTimeout) {
      event.preventDefault();
      return;
    }
    let target = event.target;
    while (target && target !== document) {
      if (target.tagName === "A") {
        const href = target.getAttribute("href");
        if (href && isExternalLink(href)) {
          event.preventDefault();
          externalLinkClickTimeout = setTimeout(() => {
            externalLinkClickTimeout = null;
          }, 1e3);
          try {
            await window.api.openExternalLink(href);
            console.log(`Opened external link: ${href}`);
          } catch (error) {
            console.error("Failed to open link:", error);
          }
          return;
        }
        break;
      }
      target = target.parentElement;
    }
  },
  true
);
function isExternalLink(url) {
  return url.startsWith("http://") || url.startsWith("https://");
}
async function generateWelcomeContent() {
  const welcomeContent = document.getElementById("welcome-content");
  if (welcomeContent) {
    try {
      const content = await window.api.getWelcomeContent();
      welcomeContent.innerHTML = content;
    } catch (error) {
      console.error("获取首页内容失败:", error);
      welcomeContent.innerHTML = "<p>内容加载失败</p>";
    }
  }
}
async function generateAboutContent() {
  const aboutContent = document.getElementById("about-content");
  if (aboutContent) {
    try {
      const content = await window.api.getAboutContent();
      aboutContent.innerHTML = content;
      aboutContent.addEventListener("click", async (e) => {
        if (externalLinkClickTimeout) {
          e.preventDefault();
          return;
        }
        if (e.target.tagName === "A") {
          e.preventDefault();
          const href = e.target.getAttribute("href");
          if (href) {
            externalLinkClickTimeout = setTimeout(() => {
              externalLinkClickTimeout = null;
            }, 1e3);
            try {
              await window.api.openExternal(href);
            } catch (error) {
              console.error("打开链接失败:", error);
            }
          }
        }
      });
    } catch (error) {
      console.error("获取关于页面内容失败:", error);
      aboutContent.innerHTML = "<p>内容加载失败</p>";
    }
  }
}
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM 加载完成");
  console.log("window.api:", window.api);
  if (typeof window.api === "undefined") {
    console.error("预加载脚本未正确加载，API 未定义");
    showToast("警告：部分功能可能无法正常工作");
  }
  generateWelcomeContent();
  generateAboutContent();
});
async function getDefaultImage() {
  return await window.api.getDefaultImage();
}
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
