# 简介

本储存库是 [Cloudflare Worker](https://developers.cloudflare.com/workers/) 的源代码，本源代码用于 GitHub OAuth 并获取 [beaudar-bot](https://github.com/beaudar-bot) 权限，用于创建 GitHub issue。

## 安装

```bash
yarn install
```

## 配置文件

在项目根目录创建一个名为 “.env” 的文件。文件应具有以下值：

- BOT_TOKEN：创建 GitHub 问题时将使用的个人访问令牌。
- CLIENT_ID：在 [GitHub OAuth Web](https://developer.github.com/v3/oauth/#web-application-flow) 中使用的 GitHub app ID。
- CLIENT_SECRET：OAuth Web app 的客户端密码
- STATE_PASSWORD：32 个字符。用于加密请求标头 /cookie 中的状态。自定义 OR 在[此处](https://lastpass.com/generatepassword.php)获取。
- ORIGINS：以逗号分隔的允许来源列表。 对于 CORS。

例子:

```config
BOT_TOKEN=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
CLIENT_ID=aaaaaaaaaaaaaaaaaaaa
CLIENT_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
STATE_PASSWORD=01234567890123456789012345678901
ORIGINS=https://beaudar.lipk.org,http://localhost:9000
```

## 本地运行

```bash
yarn run start
```

## 编译

```bash
yarn run build
```

## 部署

需要增加 `CLOUDFLARE\_\*` 配置在 `.env` 文件中。

例子：

```config
CLOUDFLARE_EMAIL=mail@lipk.org
CLOUDFLARE_API_KEY=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
CLOUDFLARE_ZONE_ID=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
CLOUDFLARE_ACCOUNT_ID=cccccccccccccccccccccccccccccccc
CLOUDFLARE_WORKERS_DEV_PROJECT=beaudar
```

配置的更多详细，可以参考 [@cfworker/dev README](https://www.npmjs.com/package/@cfworker/dev).

执行:

```bash
yarn run deploy
```

### 可能需要的

> 如果在终端遇到 *cfworker 路径不存在的报错*

- 不要惊慌，不要害怕。
- 终端（cmd OR powershell） 执行 `npm i -g @cfworker/dev`
- 将 git 的 bin 目录增加到 系统的环境变量 path 中（一般路径为：C:\Program Files\Git\bin）。
- 终端执行 `sh` 进入 sh，然后在 sh 中直接执行 scripts 中的命令。

> 即：cfworker 需要 sh.exe 的环境。(花了好一阵功夫调查)
