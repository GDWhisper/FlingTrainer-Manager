// 静态页面内容生成（欢迎页、关于页）

/**
 * 生成欢迎页内容
 */
export function generateWelcomeContent() {
  const container = document.getElementById('welcome-content');
  if (!container) return;

  container.innerHTML = `
    <div class="welcome-section">
      <h2>欢迎使用风灵月影宗</h2>
      <p>风灵月影修改器管理工具，帮助你轻松下载和管理单机游戏修改器。</p>
    </div>
  `;
}

/**
 * 生成关于页内容
 */
export function generateAboutContent() {
  const container = document.getElementById('about-content');
  if (!container) return;

  container.innerHTML = `
    <div class="about-section">
      <h3>风灵月影宗</h3>

      <div class="disclaimer-section">
        <h4>软件性质</h4>
        <p>
          本软件（风灵月影宗）是一个免费的游戏辅助工具下载程序，其唯一功能是从
          <a href="https://flingtrainer.com" class="external-link">https://flingtrainer.com</a>
          获取并本地管理单机游戏辅助工具。
        </p>

        <h4>免责声明</h4>

        <div class="disclaimer-item">
          <p class="disclaimer-title"><strong>非官方关联：</strong></p>
          <p>
            本软件由开发者本人独立开发，并非风灵月影 (FLiNG Trainer) 的官方团队、合作伙伴或代理商，也与其无任何隶属关系。
          </p>
          <p>
            用户从任何渠道跳转至风灵月影 (FLiNG Trainer) 官方网站，其页面上的广告、赞助内容、付费服务或任何形式的商业收入，均与本人（本软件开发者）无任何关联。本人不从中获取任何收益，也不对其内容负责。
          </p>
        </div>

        <div class="disclaimer-item">
          <p class="disclaimer-title"><strong>软件责任：</strong></p>
          <p>
            本软件不修改、不破解、不重新分发任何软件文件，不收集任何用户数据。所有下载的文件均来自其官方源或用户指定的镜像。因此，风灵月影 (FLiNG Trainer) 的版权、功能性、安全性以及使用该软件所产生的任何直接或间接问题，均由该软件的原始作者和提供商承担全部责任。
          </p>
        </div>

        <div class="disclaimer-item">
          <p class="disclaimer-title"><strong>用户责任：</strong></p>
          <p>
            用户在使用本软件下载并安装风灵月影 (FLiNG Trainer) 提供的软件前，应自行判断其合规性与安全性，并同意遵守该软件的所有授权条款。
          </p>
          <p>
            如果用户通过任何非官方渠道下载、安装或运行本软件，由此导致的一切后果（包括但不限于：程序被篡改、植入病毒木马、捆绑恶意软件、数据泄露、财产损失等）均须由用户自行承担。
          </p>  
        </div>

        <h4>支持与反馈</h4>
        <ul>
          <li>
            <p><strong>关于本软件 (风灵月影宗)：</strong><br>
              如果您有关于本软件的问题或建议，请访问：<a href="https://github.com/GDWhisper/FlingTrainer-Manager" class="external-link">Github</a>
            </p>
          </li>
          <li>
            <p><strong>关于风灵月影 (FLiNG Trainer)：</strong><br>
              如果您希望支持风灵月影，请访问其官方网站：<a href="https://flingtrainer.com" class="external-link">https://flingtrainer.com</a>
            </p>
          </li>
        </ul>
      </div>
    </div>
  `;

  // 为关于页面的外链绑定点击事件，使用系统默认浏览器打开
  setTimeout(() => {
    const externalLinks = container.querySelectorAll('.external-link');
    externalLinks.forEach(link => {
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const href = link.getAttribute('href');
        if (href && typeof window.api !== 'undefined' && window.api.openExternalLink) {
          try {
            await window.api.openExternalLink(href);
            console.log(`已使用默认浏览器打开：${href}`);
          } catch (error) {
            console.error('打开链接失败:', error);
          }
        }
      });
    });
  }, 0);
}
