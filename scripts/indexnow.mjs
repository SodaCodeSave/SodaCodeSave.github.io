/**
 * 从线上 sitemap 收集全部页面 URL，提交给 IndexNow 接口，让 Bing / Yandex 立即抓取。
 * 用法：node scripts/indexnow.mjs（需站点已部署，且根目录的 key 文件可访问）
 */

const HOST = "sodacodesave.github.io";
const KEY = "76625df2a9cd759ccc099e765d72525f";
const ORIGIN = `https://${HOST}`;
const KEY_LOCATION = `${ORIGIN}/${KEY}.txt`;
const SITEMAP_INDEX = `${ORIGIN}/sitemap-index.xml`;
const ENDPOINT = "https://api.indexnow.org/indexnow";
const MAX_ATTEMPTS = 3;

async function fetchText(url) {
	const res = await fetch(url, { headers: { "user-agent": "indexnow-submit" } });
	if (!res.ok) {
		throw new Error(`GET ${url} 失败：${res.status}`);
	}
	return res.text();
}

function extractLocs(xml) {
	return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

/** sitemap 索引返回子 sitemap 列表，普通 sitemap 返回页面 URL 列表 */
async function collectUrls() {
	const indexXml = await fetchText(SITEMAP_INDEX);
	const entries = extractLocs(indexXml);
	const sitemaps = entries.filter((u) => u.endsWith(".xml"));
	if (sitemaps.length === 0) {
		return entries;
	}
	const urls = [];
	for (const sitemap of sitemaps) {
		urls.push(...extractLocs(await fetchText(sitemap)));
	}
	return urls;
}

/** 确认 key 文件已上线，否则接口会返回 403；部署后 CDN 可能有延迟，故重试 */
async function assertKeyOnline() {
	const attempts = 6;
	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			const content = (await fetchText(KEY_LOCATION)).trim();
			if (content !== KEY) {
				throw new Error(`key 文件内容不匹配：期望 ${KEY}，实际 ${content}`);
			}
			return;
		} catch (err) {
			if (attempt === attempts) {
				throw err;
			}
			console.log(`等待 key 文件生效（${attempt}/${attempts}）：${err.message}`);
			await new Promise((resolve) => setTimeout(resolve, 5000));
		}
	}
}

async function submit(urlList) {
	const res = await fetch(ENDPOINT, {
		method: "POST",
		headers: { "content-type": "application/json; charset=utf-8" },
		body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList }),
	});
	return res;
}

async function main() {
	await assertKeyOnline();
	const urls = await collectUrls();
	if (urls.length === 0) {
		throw new Error("sitemap 里没有可提交的 URL");
	}
	console.log(`IndexNow 待提交 ${urls.length} 个 URL`);

	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		const res = await submit(urls);
		const body = await res.text();
		if (res.ok) {
			console.log(`提交成功（HTTP ${res.status}）${body ? `：${body}` : ""}`);
			return;
		}
		console.error(`第 ${attempt} 次提交失败（HTTP ${res.status}）：${body}`);
		if (res.status === 400 || res.status === 403 || res.status === 422) {
			throw new Error("请求被拒，检查 key、keyLocation 与 URL 是否属于同一 host");
		}
		await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
	}
	throw new Error(`连续 ${MAX_ATTEMPTS} 次提交失败`);
}

main().catch((err) => {
	console.error(`IndexNow 提交失败：${err.message}`);
	process.exit(1);
});
