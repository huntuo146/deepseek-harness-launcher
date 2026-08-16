# deepseek-harness-launcher

为 [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness) 打造的一个友好启动器。

原生启动命令 `npx @deepseek-ai/dsh web` 对普通用户不友好。安装本插件后，只需输入 `deepseek` 即可：

- ✅ 一键启动 Harness Web UI（等价于 `npx @deepseek-ai/dsh web`）
- ✅ 启动完成后**自动打开默认浏览器**到 Web UI
- ✅ 每次启动**自动检测更新**，发现新版本时询问是否升级
- ✅ 参数透传（`--port`、`--patch` 等）

## 安装

### 方法一：npm 全局安装（一条命令，推荐）

```sh
npm install -g deepseek-harness-launcher
```

装完即可使用，无需其他步骤。

### 方法二：通过 git 安装

从 GitHub 拉取源码后本地链接：

```sh
git clone https://github.com/huntuo146/deepseek-harness-launcher.git
cd deepseek-harness-launcher
npm install -g .
```

> 说明：两种方式效果相同——都会在当前机器注册 `deepseek` 命令。`npm install -g deepseek-harness-launcher` 最省事；git 方式适用于源码调试或网络受限环境。

## 使用

在任意终端直接输入：

```sh
deepseek
```

启动完成后浏览器会自动打开 `http://127.0.0.1:3080`。

### 常用命令

| 命令 | 作用 |
|---|---|
| `deepseek` | 启动 Web UI 并自动打开默认浏览器 |
| `deepseek --port 8080` | 指定端口启动（浏览器自动打开到 8080） |
| `deepseek --no-browser` | 启动后不自动打开浏览器 |
| `deepseek --check-update` | 强制检查更新 |
| `deepseek --no-update` | 跳过本次更新检测 |
| `deepseek -h, --help` | 查看帮助 |

## 工作原理

- **启动**：内部调用 `npx --yes @deepseek-ai/dsh web`，所有额外参数原样透传。
- **自动开浏览器**：轮询探测 HTTP 端口，服务就绪且进程仍存活时才调用系统默认浏览器打开（Windows `start` / macOS `open` / Linux `xdg-open`）。
- **更新检测**：用 `npm view @deepseek-ai/dsh version` 查询远程最新版本，与本地状态文件对比（`~/.deepseek-harness/launcher-state.json`），有新版则询问是否升级；6 小时内不重复检测，避免每次启动都联网。

## 开发

```sh
npm link        # 本机注册 deepseek 命令
npm test        # 运行单元测试
```

## License

MIT
