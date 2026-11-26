/// <reference types="mdast" />
import { h } from "hastscript";

/**
 * 提取指令标签内的文本，作为图片替代文本。
 */
function getAltFromChildren(children) {
	if (!Array.isArray(children) || children.length === 0) return "";

	return children
		.map((child) => {
			if (child.type === "text") return child.value;
			if (Array.isArray(child.children)) return getAltFromChildren(child.children);
			return "";
		})
		.join("");
}

/**
 * 生成与文字同高的行内图标节点。
 */
export function IconComponent(properties, children) {
	const src = properties?.src;
	if (typeof src !== "string" || src.trim() === "") {
		return h(
			"span",
			{ class: "inline-icon-error" },
			'Invalid icon directive. (Use :icon{src="https://example.com/icon.svg"})',
		);
	}

	const alt = typeof properties?.alt === "string" ? properties.alt : getAltFromChildren(children);
	const size = typeof properties?.size === "string" ? properties.size.trim() : "";
	const title = typeof properties?.title === "string" ? properties.title : undefined;
	const classValue = properties?.class ?? properties?.className;
	const extraClasses = Array.isArray(classValue)
		? classValue
		: typeof classValue === "string"
			? classValue.split(/\s+/).filter(Boolean)
			: [];

	return h("img", {
		src,
		alt,
		title,
		class: ["inline-icon", ...extraClasses],
		style: size ? `height: ${size}; width: auto;` : undefined,
		decoding: "async",
		"data-pagefind-ignore": true,
	});
}
