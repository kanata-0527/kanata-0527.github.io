mixins.highlight = {
    data() { return {copying: false}; },
    created() {
        hljs.configure({ignoreUnescapedHTML: true});
        this.renderers.push(this.highlight);
    },
    methods: {
        highlight() {
            for (const pre of document.querySelectorAll(".content pre")) {
                const source = pre.querySelector("code");
                if (!source || source.classList.contains("language-mermaid")) continue;
                const code = source.textContent;
                const languageClass = Array.from(source.classList).find(name => name.startsWith("language-"));
                let language = languageClass ? languageClass.slice(9) : "plaintext";
                if (!hljs.getLanguage(language)) language = "plaintext";
                const highlighted = hljs.highlight(code, {language}).value;
                pre.innerHTML = '<div class="code-content hljs">' + highlighted + '</div>' +
                    '<div class="language"></div><button type="button" class="copycode" aria-label="复制代码">' +
                    '<i class="fa-solid fa-copy fa-fw"></i><i class="fa-solid fa-check fa-fw"></i></button>';
                pre.querySelector(".language").textContent = language;
                const button = pre.querySelector(".copycode");
                button.addEventListener("click", async () => {
                    try {
                        await navigator.clipboard.writeText(code);
                        button.classList.add("copied");
                        setTimeout(() => button.classList.remove("copied"), 1200);
                    } catch {
                        button.setAttribute("aria-label", "请选中代码后复制");
                    }
                });
            }
        }
    }
};
