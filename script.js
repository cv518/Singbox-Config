/**
 * Sub-Store sing-box 节点注入
 *
 * 参数：
 *   subscription：订阅名称
 *
 * 注入位置：
 *   🚀节点选择：节点放在 🎈自动选择 前面
 *   🎈自动选择：全部节点参与自动测速
 */

const subscriptionName = String(
  $arguments?.subscription ?? ""
).trim();

if (!subscriptionName) {
  throw new Error("请在脚本参数中设置 subscription");
}

const parser = ProxyUtils.JSON5 || JSON;

console.log(`[${subscriptionName}] 开始生成配置`);

// 1. 读取配置模板
let config;

try {
  config = parser.parse($content ?? $files[0]);
} catch (e) {
  throw new Error("sing-box 模板解析失败：" + e.message);
}

if (!Array.isArray(config.outbounds)) {
  throw new Error("配置中不存在 outbounds 数组");
}

// 2. 获取参数指定的订阅节点
const proxies = await produceArtifact({
  type: "subscription",
  name: subscriptionName,
  platform: "sing-box",
  produceType: "internal",
  produceOpts: {
    "include-unsupported-proxy": true
  }
});

if (!Array.isArray(proxies)) {
  throw new Error(`${subscriptionName} 订阅获取失败`);
}

console.log(`[${subscriptionName}] 获取到 ${proxies.length} 个节点`);

// 3. 查找策略组
const selector = config.outbounds.find(
  item => item.tag === "🚀节点选择"
);

const autoSelect = config.outbounds.find(
  item => item.tag === "🎈自动选择"
);

if (!selector || !autoSelect) {
  throw new Error("找不到 🚀节点选择 或 🎈自动选择");
}

// 4. 整理节点，按 tag 去重
const uniqueProxies = [];
const proxyTags = new Set();

for (const proxy of proxies) {
  if (!proxy || !proxy.tag) continue;
  if (proxyTags.has(proxy.tag)) continue;

  proxyTags.add(proxy.tag);
  uniqueProxies.push(proxy);
}

// 5. 注入节点到 outbounds
const existingTags = new Set(
  config.outbounds.map(item => item.tag)
);

let added = 0;

for (const proxy of uniqueProxies) {
  if (!existingTags.has(proxy.tag)) {
    config.outbounds.push(proxy);
    existingTags.add(proxy.tag);
    added++;
  }
}

// 6. 注入 🚀节点选择
selector.outbounds ??= [];

// 清理当前订阅节点的旧引用
selector.outbounds = selector.outbounds.filter(
  tag => !proxyTags.has(tag)
);

// 将订阅节点放在自动选择前面
const selectorIndex = selector.outbounds.indexOf("🎈自动选择");

if (selectorIndex === -1) {
  selector.outbounds.unshift(
    ...uniqueProxies.map(proxy => proxy.tag)
  );
} else {
  selector.outbounds.splice(
    selectorIndex,
    0,
    ...uniqueProxies.map(proxy => proxy.tag)
  );
}

// 7. 注入 🎈自动选择
autoSelect.outbounds ??= [];

autoSelect.outbounds = autoSelect.outbounds.filter(
  tag => !proxyTags.has(tag)
);

autoSelect.outbounds.push(
  ...uniqueProxies.map(proxy => proxy.tag)
);

// 8. 输出完整配置
$content = JSON.stringify(config, null, 2);

console.log(
  `[${subscriptionName}] 完成：获取 ${proxies.length} 个，新增 ${added} 个`
);
