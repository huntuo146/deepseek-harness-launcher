# deepseek-harness-launcher

![npm version](https://img.shields.io/npm/v/deepseek-harness-launcher)
![npm downloads](https://img.shields.io/npm/dt/deepseek-harness-launcher)
![license](https://img.shields.io/npm/l/deepseek-harness-launcher)
![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

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

### 方法二：npx 免安装（临时使用）

不想全局安装时，可直接用 npx 运行：

```sh
npx deepseek-harness-launcher
```

> npx 每次会临时拉取最新包，适合尝鲜；长期使用建议用方法一全局安装。

### 方法三：通过 git 安装（源码调试）

从 GitHub 拉取源码后本地链接：

```sh
git clone https://github.com/huntuo146/deepseek-harness-launcher.git
cd deepseek-harness-launcher
npm install -g .
```

> 说明：三种方式都会在当前机器注册 `deepseek` 命令。方法一最省事；方法三适用于需要修改源码或网络受限环境。

### 方法四：下载 Release 压缩包

从 GitHub [Releases 页面](https://github.com/huntuo146/deepseek-harness-launcher/releases) 下载最新的 `deepseek-harness-launcher-vX.Y.Z.zip` 压缩包：

```sh
# 解压后进入目录
cd deepseek-harness-launcher-v1.0.0
npm install -g .
```

> 压缩包含完整源码与配置，解压后同样通过 `npm install -g .` 注册 `deepseek` 命令。适合不方便使用 git 或 npm registry 的环境。

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
npm link        # 本机注册 deepseek 命令（开发调试用）
npm test        # 运行单元测试
```

## 发布

如需发布新版到 npm：

```sh
npm version patch   # 或 minor / major，自动递增版本号
npm publish         # 发布（需要 npm 账号 + 发布权限）
```

同步发布 GitHub Release 压缩包（供不便使用 npm 的用户下载）：

1. 打包：将 `bin/`、`src/`、`test/`、`package.json`、`README.md`、`LICENSE` 压缩为 `deepseek-harness-launcher-v<版本>.zip`
2. 在 GitHub 创建 tag `v<版本>` 和 Release，上传该压缩包

最新 Release 见：[Releases](https://github.com/huntuo146/deepseek-harness-launcher/releases)

## License

MIT
