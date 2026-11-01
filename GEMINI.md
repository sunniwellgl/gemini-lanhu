# 蓝湖设计接入扩展 (gemini-lanhu)

本扩展通过 MCP (Model Context Protocol) 协议将蓝湖 (Lanhu) UI 设计平台连接至 Gemini CLI，为日常 Qt/QML 界面研发提供设计稿结构审查、QML 样式属性提取与切图资源自动化下载能力。

## 一、 核心心智与调用规约

1. **渐进式披露与防爆仓防线**：
   - 严禁一次性将未经筛选的巨大设计图 JSON 倾倒至上下文。
   - 典型交互链路：
     - **步骤 1**：通过 `lanhu_parse_url` 或直接传入蓝湖链接，通过 `lanhu_get_image_info` 核验画板尺寸与基本元数据；
     - **步骤 2**：通过 `lanhu_search_layers` 或 `lanhu_list_layers(maxDepth: 2~3)` 定位目标图层 ID；
     - **步骤 3**：通过 `lanhu_get_element_properties` 精确提取指定图层的 QML 属性包与代码草稿；
     - **步骤 4**：通过 `lanhu_list_slices` 与 `lanhu_download_slices` 将切图下载到本地工程资产目录（如 `assets/images/`）。

2. **QML 物理坐标与色彩映射规则**：
   - **坐标系**：默认优先使用绝对坐标（`useAbsoluteCoords: true`），即自动累加所有上级 Group 偏移量计算得出，供全局绝对定位或相对锚定计算。
   - **颜色格式**：不透明颜色采用 `#RRGGBB`；带透明度颜色采用 8 位 Hex `#AARRGGBB`（Alpha 在前）或 `Qt.rgba(r, g, b, a)`。
   - **字体像素**：自动提取 `font.pixelSize`，字重映射为 QML `Font.Weight` 枚举（如 `Font.Bold`, `Font.Medium`, `Font.Normal`）。
   - **矩形与边框**：自动映射 `radius`、`border.width`、`border.color`。

3. **切图落地规范**：
   - 默认切图策略：默认采用 **Web 平台标准与 @1x PNG 格式**（`platform: 'web'`, `formats: ['png']`），输出无倍率后缀的干净文件名（如 `name.png`），完全契合常规 QML 开发需求。同时支持切换至 `ios`（@1x/@2x/@3x）或 `android`（mipmap-* 目录）。
   - 调用 `lanhu_download_slices` 时，`outputDir` 建议使用当前 QML 项目中的实际图片存放目录（例如 `./assets/images` 或 `./images`）。
   - 下载完成后，`lanhu_get_element_properties` 自动根据指定的 `assetsFolder` 前缀（支持 `qrc:/...`）输出即插即用的 `Image { source: ... }` 组件代码。

## 二、 核心 MCP 工具一览

| 工具名称 | 功能描述 |
| :--- | :--- |
| `lanhu_set_cookie` | 设置并持久化蓝湖登录凭证 Cookie |
| `lanhu_get_config` | 查看当前配置状态与 Cookie 掩码 |
| `lanhu_parse_url` | 解析蓝湖设计稿 Web URL，提取 project_id 与 image_id |
| `lanhu_get_image_info` | 获取画板基础信息（物理宽高、图层总数、切图总数） |
| `lanhu_list_layers` | 树形大纲查看图层层级（支持限制深度） |
| `lanhu_search_layers` | 按名称或文本内容快速模糊搜索图层 |
| `lanhu_get_element_properties` | 提取图层的详细样式与 QML 属性，生成 QML 代码片段草稿 |
| `lanhu_list_slices` | 列出画板中所有可导出的切图/切片资产 |
| `lanhu_download_slices` | 批量或指定名称下载切图文件保存至本地项目目录 |
