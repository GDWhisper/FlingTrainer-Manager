// renderer.js - 页面交互逻辑
console.log("window.api:", window.api);

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

// 加载所有游戏数据
async function loadAllGames() {
  const container = document.getElementById("games-container");
  container.innerHTML = "<p> 正在加载最近更新的游戏...</p>";

  try {
    const result = await window.api.loadGames();

    if (result.error) {
      container.innerHTML = `<p> 加载失败：${result.error}</p>`;
      return;
    }

    let html = `<h4>最近更新</h4><div class="game-list">`;

    result.data.forEach((game, index) => {
      // 防止 game.img 或 game.name 为 null/undefined
      const img = game.img ? game.img.trim() : "pic/default.png";
      const name = game.name ? game.name.trim() : "未知游戏";
      const link = game.downloadPageLink ? game.downloadPageLink.trim() : "#";

      html += `
    <div class="game-card" data-download-link="${link}">
      <img src="${img}" alt="${name}" onerror="this.onerror=null;this.src='pic/default.png';">
      <div class="info">
        <h3 title="${name}">${name}</h3>
        <button class="btn download-btn" onclick="downloadGame('${link}', '${name.replace(/'/g, "\\'")}', this)">下载</button>
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
    container.innerHTML = "<p>网络错误，请检查连接或重试。</p>";
  }
}

// 监听导航链接
document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const target = e.target.getAttribute("href").substring(1);

    if (target === "website") {
      // 打开外部网站
      require("electron").shell.openExternal("https://flingtrainer.com");
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

// 搜索渲染进程
async function performSearch() {
  const keyword = document.getElementById('gameSearch').value.trim();
  if (!keyword) return;

  const container = document.getElementById('search-results');
  container.innerHTML = '<p> 正在搜索...</p>';
  
  // 显示搜索结果区域
  document.getElementById('search-results-container').style.display = 'block';
  
  try {
    const result = await window.api.searchGames(keyword);
    
    if (result.error) {
      container.innerHTML = `<p style="color: #999; text-align: center;">${result.error}</p>`;
    } else {
      if (result.data && result.data.length > 0) {
        container.innerHTML = result.data.map((game, index) => `
          <div class="game-card" data-download-link="${game.downloadPageLink}">
            <img src="${game.img || 'pic/default.png'}" alt="${game.name}" onerror="this.onerror=null;this.src='pic/default.png';">
            <div class="info">
              <h3 title="${game.name}">${game.name}</h3>
              <button class="btn download-btn" onclick="downloadGame('${game.downloadPageLink}', '${game.name.replace(/'/g, "\\'")}', this)">下载</button>
            </div>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<p style="color: #999; text-align: center;">未找到相关游戏</p>';
      }
    }
  } catch (err) {
    console.error('搜索失败:', err);
    container.innerHTML = '<p style="color: #999; text-align: center;">搜索失败，请稍后重试</p>';
  }
}

// 清空搜索输入框
function clearSearchInput() {
  document.getElementById('gameSearch').value = '';
  document.getElementById('search-results-container').style.display = 'none';
  document.getElementById('search-results').innerHTML = '';
}

// 支持 Enter 键
document.getElementById('gameSearch').addEventListener('keypress', e => {
  if (e.key === 'Enter') performSearch();
});

// 下载游戏功能
async function downloadGame(downloadPageUrl, gameName, buttonElement) {
  if (!downloadPageUrl || downloadPageUrl === '#') {
    showToast('下载链接无效');
    return;
  }

  // 保存原始按钮文本
  const originalText = buttonElement.textContent;
  buttonElement.textContent = '获取下载信息...';
  buttonElement.disabled = true;

  try {
    // 获取下载信息
    const downloadInfo = await window.api.getDownloadInfo(downloadPageUrl);
    
    if (downloadInfo.error) {
      showToast(`下载失败: ${downloadInfo.error}`);
      buttonElement.textContent = originalText;
      buttonElement.disabled = false;
      return;
    }

    if (!downloadInfo.downloadLink) {
      showToast('未找到下载链接');
      buttonElement.textContent = originalText;
      buttonElement.disabled = false;
      return;
    }

    // 更新按钮状态
    buttonElement.textContent = '正在下载...';

    // 如果是外部链接，打开浏览器
    if (downloadInfo.isExternal || 
        downloadInfo.downloadLink.includes('mega.nz') || 
        downloadInfo.downloadLink.includes('mediafire.com') || 
        downloadInfo.downloadLink.includes('drive.google.com')) {
      
      // 显示下载信息
      let message = `游戏: ${downloadInfo.gameName}\n`;
      message += `下载链接: ${downloadInfo.downloadLink}\n`;
      if (downloadInfo.downloadPassword) {
        message += `提取码: ${downloadInfo.downloadPassword}\n`;
      }
      
      alert(message);
      require('electron').shell.openExternal(downloadInfo.downloadLink);
      
      buttonElement.textContent = '已打开外部链接';
    } else {
      // 直接下载文件
      const link = document.createElement('a');
      link.href = downloadInfo.downloadLink;
      link.download = '';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      buttonElement.textContent = '已开始下载';
    }
    
    // 3秒后恢复按钮状态
    setTimeout(() => {
      buttonElement.textContent = '下载';
      buttonElement.disabled = false;
    }, 3000);
    
  } catch (err) {
    console.error('下载失败:', err);
    showToast('下载失败，请稍后重试');
    buttonElement.textContent = originalText;
    buttonElement.disabled = false;
  }
}

// 支持 Enter 键
document.getElementById('gameSearch').addEventListener('keypress', e => {
  if (e.key === 'Enter') performSearch();
});