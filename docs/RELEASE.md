# 发布指导

基础发版流程（改版本号 → 打 tag → 云构建）见 AGENTS.md「常见任务配方 → 发版」，本文不重复。这里只记录流程之外、需要探索才能发现的坑与惯例。

## 双 worktree 结构（先读这段）

仓库有两个常驻 worktree，分支绑定固定：

- 主目录 `FlingTrainer-Manager` → main
- `FlingTrainer-Manager-dev` → dev（独立的 worktree，不是克隆）

分支被另一个 worktree 占用时 `git checkout` 会报 `'xxx' is already used by worktree`——这是结构使然，不是故障。不要删 worktree、不要解除分支绑定；要操作另一分支，用 `git -C <对应目录> <命令>` 在那边执行。身处 dev 目录的会话同理：不能 checkout main，发布操作（commit / push / tag）在当前目录直接做即可，两个目录是同一仓库。

## 发版 commit 的标准构成

一次发版 = 一个 `chore(release): vX.Y.Z` 提交，恰好包含两样改动：

1. **版本号**：用 `npm version patch --no-git-tag-version`，一条命令同时更新 package.json 和 package-lock.json（lock 里有两处 version 字段，手改 package.json 必漏 lock）。
2. **新增 `release-notes/vX.Y.Z.md`**：格式照抄上一版（🚀 新功能 / 🐛 问题修复 或 🎨 界面调整 / 下载说明）。「下载说明」里的两个产物文件名（`FlingTrainer-Manager-Setup-X.Y.Z.exe`、`FlingTrainer-Manager-X.Y.Z-win.zip`）含版本号，按新版本号直接写好。

然后提交、推送、打同名 tag `vX.Y.Z` 并推送（tag 与 version 必须一致，工作流有校验）。

## 版本号粒度惯例

小迭代一律 **patch**，即使包含 feat——v0.4.1、v0.4.2 都带新功能仍走 patch，只有成规模的大迭代才 bump minor（v0.3.0 → v0.4.0）。不要按 semver 直觉见到 feat 就升 minor。

## 发版后同步 dev

发版 commit 只落在执行它的分支上，另一条分支不会自动获得版本号与 release notes。发布完成后把 main 合回 dev 并推送（在 dev worktree 里 `git merge main`），否则 dev 的版本号从此落后，下轮迭代合并时可能冲突。

## 发布后验证

`gh run list --limit 1` 看云构建状态；参考耗时约 10 分钟，成功后自动创建 GitHub Release 并上传产物，无需手动上传。
