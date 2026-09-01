# 发布指导

基础发版流程（改版本号 → 打 tag → 云构建）见 AGENTS.md「常见任务配方 → 发版」，本文不重复。这里只记录流程之外、需要探索才能发现的坑与惯例。

## 双 worktree 结构（先读这段）

仓库有两个常驻 worktree，分支绑定固定：

- 主目录 `FlingTrainer-Manager` → main
- `FlingTrainer-Manager-dev` → dev（独立的 worktree，不是克隆）

分支被另一个 worktree 占用时 `git checkout` 会报 `'xxx' is already used by worktree`——这是结构使然，不是故障。不要删 worktree、不要解除分支绑定；要操作另一分支，用 `git -C <对应目录> <命令>` 在那边执行。身处 dev 目录的会话同理：不能 checkout main，发布操作（commit / push / tag）在当前目录直接做即可，两个目录是同一仓库。

## 发版前核对清单（强制执行）

**在任何版本号改动之前，逐项确认。不通过则停止发版。**

1. **确认你在 dev worktree**
   ```bash
   pwd   # 路径应包含 FlingTrainer-Manager-dev
   git branch --show-current   # 必须输出 dev
   ```
   在 `FlingTrainer-Manager`（main worktree）上发版 = 遗漏 dev 分支所有独有改动。见过 v0.4.4 踩坑。

2. **确认 worktree 干净**
   ```bash
   git status   # 必须 "nothing to commit, working tree clean"
   ```
   有未提交改动 = 功能尚未入库。需先 commit 或 stash，绝不在发版 commit 里混入半成品。

3. **确认 dev 独有提交存在且符合预期**
   ```bash
   git log --oneline main..dev
   ```
   输出是该版本随附的全部 commit 列表（如果 dev 没有未合入 main 的提交，输出为空）。对照此列表与 `docs/ROADMAP.md` 的「当前迭代」确认无遗漏。

   输出为空但你预期有改动 → **停止，排查原因**（可能是 commit 在别的分支、或 worktree 绑定错误）。

4. **确认 `release-notes/vX.Y.Z.md` 已写好**
   ```bash
   test -f release-notes/v0.4.4.md && echo "exists"
   ```
   文件不存在 = 发布公告为空，CI 会自动用提交记录替代，但格式不可控且缺少「下载说明」段落。必须提前写，对照上一版格式。

5. **确认这份清单的每一步都已通过**，再进入下面的发版流程。

## 发版 commit 的标准构成

> 必须在 dev worktree / dev 分支上执行。版本号改动与 release notes 都加在 dev 上。

一次发版 = 一个 `chore(release): vX.Y.Z` 提交，恰好包含两样改动：

1. **版本号**：用 `npm version patch --no-git-tag-version`，一条命令同时更新 package.json 和 package-lock.json（lock 里有两处 version 字段，手改 package.json 必漏 lock）。
2. **新增 `release-notes/vX.Y.Z.md`**：格式照抄上一版（🚀 新功能 / 🐛 问题修复 或 🎨 界面调整 / 下载说明）。「下载说明」里的两个产物文件名（`FlingTrainer-Manager-Setup-X.Y.Z.exe`、`FlingTrainer-Manager-X.Y.Z-win.zip`）含版本号，按新版本号直接写好。

然后提交、推送 dev。

## 发版后的分支同步与打 tag

> **顺序：先在 dev 合入保证完整性，再打 tag。**

1. 到 main worktree，把 dev 合入 main：
   ```bash
   git -C FlingTrainer-Manager merge dev --no-edit
   git -C FlingTrainer-Manager push
   ```
2. 到 dev worktree（或任意 worktree，tag 是全局 ref），打 tag 并推送：
   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```
3. GitHub Actions 自动云构建并创建 Release（约 10 分钟）。

> **为什么先 merge 再 tag？** 如果 tag 打在未包含 dev 独有提交的分支上，CI 构建的产物缺少业务代码变更。v0.4.4 的教训：当时 dev 独有提交 `e069646 feat: 更新服务支持可配置代理` 未被合入 main 就打了 tag，导致 v0.4.4 实际内容与 v0.4.3 相同。

## 发版后同步 dev

dev worktree 已经拥有发版 commit（因为发版 commit 是在 dev 上创建的），但 main 此时的 HEAD 指向 merge commit，比 dev 多一个 merge node。回到 dev worktree 把 main 合回来：

```bash
git -C FlingTrainer-Manager-dev merge main --no-edit
git -C FlingTrainer-Manager-dev push
```

这样 dev 的版本号与 main 对齐，下轮迭代不会冲突。

## 版本号粒度惯例

小迭代一律 **patch**，即使包含 feat——v0.4.1、v0.4.2 都带新功能仍走 patch，只有成规模的大迭代才 bump minor（v0.3.0 → v0.4.0）。不要按 semver 直觉见到 feat 就升 minor。

## 发布后验证

`gh run list --limit 1` 看云构建状态；参考耗时约 10 分钟，成功后自动创建 GitHub Release 并上传产物，无需手动上传。
