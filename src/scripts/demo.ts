// @ts-nocheck
import "../range-group.ts";

            document.addEventListener("DOMContentLoaded", () => {
                /* --- Theme toggle (system -> light -> dark) --- */
                const themeToggles = Array.from(document.querySelectorAll("[data-theme-toggle]"));
                const THEME_STORAGE_KEY = "rangegroup-theme";
                const themeOrder = ["system", "light", "dark"];
                const htmlEl = document.documentElement;

                const getStoredTheme = () => {
                    try {
                        const stored = localStorage.getItem(THEME_STORAGE_KEY);
                        return themeOrder.includes(stored) ? stored : "system";
                    } catch {
                        return "system";
                    }
                };

                const prefersDarkMql = window.matchMedia("(prefers-color-scheme: dark)");

                const setThemeClasses = (theme) => {
                    htmlEl.classList.remove("light", "dark");
                    if (theme === "light") {
                        htmlEl.classList.add("light");
                    } else if (theme === "dark") {
                        htmlEl.classList.add("dark");
                    } else {
                        // System: use the same html.light / html.dark hooks as explicit themes so all
                        // theme-scoped CSS (TOC active state, anchored pills, etc.) stays consistent.
                        htmlEl.classList.add(prefersDarkMql.matches ? "dark" : "light");
                    }
                };

                const getNextTheme = (theme) => {
                    const index = themeOrder.indexOf(theme);
                    return themeOrder[(index + 1) % themeOrder.length];
                };

                const syncThemeToggleLabel = (theme) => {
                    const text = `Theme: ${theme}`;
                    themeToggles.forEach((toggle) => {
                        toggle.setAttribute("aria-label", text);
                        toggle.dataset.theme = theme;
                    });
                };

                let activeTheme = getStoredTheme();
                setThemeClasses(activeTheme);
                syncThemeToggleLabel(activeTheme);

                const onSystemColorSchemeChange = () => {
                    if (activeTheme === "system") {
                        setThemeClasses(activeTheme);
                    }
                };
                if (typeof prefersDarkMql.addEventListener === "function") {
                    prefersDarkMql.addEventListener("change", onSystemColorSchemeChange);
                } else if (typeof prefersDarkMql.addListener === "function") {
                    prefersDarkMql.addListener(onSystemColorSchemeChange);
                }

                if (themeToggles.length) {
                    themeToggles.forEach((themeToggle) =>
                        themeToggle.addEventListener("click", () => {
                            activeTheme = getNextTheme(activeTheme);
                            if (activeTheme === "system") {
                                localStorage.removeItem(THEME_STORAGE_KEY);
                            } else {
                                localStorage.setItem(THEME_STORAGE_KEY, activeTheme);
                            }
                            setThemeClasses(activeTheme);
                            syncThemeToggleLabel(activeTheme);
                        }),
                    );
                }

                /* --- Progressive Enhancement Toggle --- */
                const peToggles = Array.from(document.querySelectorAll(".js-pe-toggle"));
                if (peToggles.length) {
                    const togglePE = (enabled) => {
                        if (enabled) {
                            document.querySelectorAll(".fallback-container").forEach((fallback) => {
                                const componentId = fallback.dataset.componentId;
                                const component = document.getElementById(componentId);
                                if (component) {
                                    while (fallback.firstChild) {
                                        component.appendChild(fallback.firstChild);
                                    }
                                    component.style.display = "";
                                }
                                fallback.remove();
                            });
                        } else {
                            document.querySelectorAll("range-group").forEach((component, index) => {
                                if (!component.id) {
                                    component.id = `rg-component-${index}`;
                                }
                                if (document.querySelector(`[data-component-id="${component.id}"]`)) return;

                                const fallback = document.createElement("fieldset");
                                fallback.className = "fallback-container";
                                fallback.dataset.componentId = component.id;

                                while (component.firstChild) {
                                    fallback.appendChild(component.firstChild);
                                }

                                fallback.querySelectorAll("label.visually-hidden").forEach((label) => {
                                    label.classList.remove("visually-hidden");
                                    label.classList.add("fallback-label-visible");
                                });

                                component.style.display = "none";
                                component.parentNode.insertBefore(fallback, component);
                            });
                        }
                    };

                    const syncPeToggles = (enabled) => {
                        peToggles.forEach((toggle) => {
                            toggle.checked = enabled;
                        });
                    };

                    syncPeToggles(peToggles[0].checked);

                    peToggles.forEach((peToggle) => {
                        peToggle.addEventListener("change", (e) => {
                            const enabled = e.target.checked;
                            syncPeToggles(enabled);
                            togglePE(enabled);
                        });
                    });
                }

                /* --- Mobile popover menu --- */
                const mobileMenu = document.getElementById("mobile-header-menu");
                const mobileMenuButton = document.querySelector(".mobile-menu-button");
                if (mobileMenu && mobileMenuButton && typeof mobileMenu.showPopover === "function") {
                    document.body.classList.add("has-popover-menu");
                    const syncExpanded = () => {
                        mobileMenuButton.setAttribute(
                            "aria-expanded",
                            mobileMenu.matches(":popover-open") ? "true" : "false",
                        );
                    };
                    mobileMenu.addEventListener("toggle", syncExpanded);
                    syncExpanded();
                }

                /* --- Sidebar scroll-spy (desktop only) --- */
                const tocDesktopMedia = window.matchMedia("(min-width: 961px)");
                const sidebarLinks = Array.from(document.querySelectorAll(".sidebar a[href^='#']"));
                const targets = sidebarLinks
                    .map((link) => document.querySelector(link.getAttribute("href")))
                    .filter(Boolean);
                const linkByHash = new Map(sidebarLinks.map((link) => [link.getAttribute("href"), link]));
                let currentActive = null;
                let activeCheckRaf = 0;
                let desktopSpyBound = false;

                const clearActiveLinks = () => {
                    sidebarLinks.forEach((link) => link.classList.remove("is-active"));
                    currentActive = null;
                };

                const setActive = (id) => {
                    if (!id || id === currentActive) return;
                    currentActive = id;
                    sidebarLinks.forEach((link) => link.classList.remove("is-active"));
                    const active = linkByHash.get(`#${id}`);
                    if (active) {
                        active.classList.add("is-active");
                    }
                };

                const computeClosestSection = () => {
                    const ACTIVATION_OFFSET = 92;
                    let bestId = targets[0]?.id ?? null;
                    for (const target of targets) {
                        const rect = target.getBoundingClientRect();
                        if (rect.top <= ACTIVATION_OFFSET && rect.bottom > ACTIVATION_OFFSET) {
                            return target.id;
                        }
                    }
                    for (const target of targets) {
                        const top = target.getBoundingClientRect().top;
                        if (top - ACTIVATION_OFFSET <= 0) {
                            bestId = target.id;
                        } else {
                            break;
                        }
                    }
                    return bestId;
                };

                const updateActiveFromScroll = () => {
                    activeCheckRaf = 0;
                    if (!tocDesktopMedia.matches || !targets.length) return;
                    const bestId = computeClosestSection();
                    if (bestId) setActive(bestId);
                };

                const queueActiveCheck = () => {
                    if (activeCheckRaf) return;
                    activeCheckRaf = window.requestAnimationFrame(updateActiveFromScroll);
                };

                const handleHashChange = () => {
                    const id = window.location.hash.replace("#", "");
                    if (id) setActive(id);
                };

                const enableDesktopScrollSpy = () => {
                    if (!tocDesktopMedia.matches || !targets.length || desktopSpyBound) return;
                    desktopSpyBound = true;
                    window.addEventListener("scroll", queueActiveCheck, { passive: true });
                    window.addEventListener("resize", queueActiveCheck, { passive: true });
                    window.addEventListener("hashchange", handleHashChange);
                    queueActiveCheck();
                };

                const disableDesktopScrollSpy = () => {
                    if (desktopSpyBound) {
                        window.removeEventListener("scroll", queueActiveCheck);
                        window.removeEventListener("resize", queueActiveCheck);
                        window.removeEventListener("hashchange", handleHashChange);
                        desktopSpyBound = false;
                    }
                    if (activeCheckRaf) {
                        window.cancelAnimationFrame(activeCheckRaf);
                        activeCheckRaf = 0;
                    }
                    clearActiveLinks();
                };

                const syncScrollSpyForViewport = () => {
                    if (tocDesktopMedia.matches) {
                        enableDesktopScrollSpy();
                    } else {
                        disableDesktopScrollSpy();
                    }
                };

                syncScrollSpyForViewport();
                if (typeof tocDesktopMedia.addEventListener === "function") {
                    tocDesktopMedia.addEventListener("change", syncScrollSpyForViewport);
                } else if (typeof tocDesktopMedia.addListener === "function") {
                    tocDesktopMedia.addListener(syncScrollSpyForViewport);
                }

                /* --- Code block init (tabs + Prism) --- */
                initCodeBlocks();
            });

            function dedent(text) {
                const lines = text.split("\n");
                while (lines.length && !lines[0].trim()) lines.shift();
                while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
                if (!lines.length) return "";
                const indent = lines
                    .filter((l) => l.trim())
                    .reduce((min, l) => Math.min(min, l.match(/^(\s*)/)[1].length), Infinity);
                return lines.map((l) => l.slice(indent)).join("\n");
            }

            function highlightPanel(panel) {
                panel.querySelectorAll('code[class*="language-"]:not(.prism-highlighted)').forEach((code) => {
                    Prism.highlightElement(code);
                    code.classList.add("prism-highlighted");
                });
            }

            function initCodeBlocks() {
                document.querySelectorAll(".code-block").forEach((details, idx) => {
                    const sources = details.querySelectorAll('script[type="text/plain"]');
                    if (sources.length === 0) return;

                    const tablist = document.createElement("div");
                    tablist.setAttribute("role", "tablist");
                    tablist.setAttribute("aria-label", "Code example");

                    const panels = [];

                    sources.forEach((source, i) => {
                        const lang = source.dataset.lang;
                        const langLabel = { html: "HTML", css: "CSS", javascript: "JS" }[lang] || lang;
                        const tabId = `cb${idx}-tab-${lang}`;
                        const panelId = `cb${idx}-panel-${lang}`;

                        const tab = document.createElement("button");
                        tab.setAttribute("role", "tab");
                        tab.id = tabId;
                        tab.setAttribute("aria-controls", panelId);
                        tab.setAttribute("aria-selected", i === 0 ? "true" : "false");
                        tab.setAttribute("tabindex", i === 0 ? "0" : "-1");
                        tab.textContent = langLabel;
                        tablist.appendChild(tab);

                        const panel = document.createElement("div");
                        panel.setAttribute("role", "tabpanel");
                        panel.id = panelId;
                        panel.setAttribute("aria-labelledby", tabId);
                        if (i > 0) panel.hidden = true;

                        const pre = document.createElement("pre");
                        pre.className = `language-${lang}`;
                        const code = document.createElement("code");
                        code.className = `language-${lang}`;
                        code.textContent = dedent(source.textContent);
                        pre.appendChild(code);
                        panel.appendChild(pre);

                        details.appendChild(panel);
                        panels.push(panel);
                    });

                    sources.forEach((s) => s.remove());

                    const summary = details.querySelector("summary");
                    summary.after(tablist);

                    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));

                    function selectTab(selectedTab) {
                        tabs.forEach((t) => {
                            t.setAttribute("aria-selected", "false");
                            t.setAttribute("tabindex", "-1");
                        });
                        panels.forEach((p) => (p.hidden = true));
                        selectedTab.setAttribute("aria-selected", "true");
                        selectedTab.setAttribute("tabindex", "0");
                        const panelEl = details.querySelector(`#${selectedTab.getAttribute("aria-controls")}`);
                        panelEl.hidden = false;
                        highlightPanel(panelEl);
                    }

                    tabs.forEach((tab) => {
                        tab.addEventListener("click", () => selectTab(tab));
                        tab.addEventListener("keydown", (e) => {
                            const i = tabs.indexOf(tab);
                            let next;
                            switch (e.key) {
                                case "ArrowRight":
                                    next = (i + 1) % tabs.length;
                                    break;
                                case "ArrowLeft":
                                    next = (i - 1 + tabs.length) % tabs.length;
                                    break;
                                case "Home":
                                    next = 0;
                                    break;
                                case "End":
                                    next = tabs.length - 1;
                                    break;
                                default:
                                    return;
                            }
                            e.preventDefault();
                            selectTab(tabs[next]);
                            tabs[next].focus();
                        });
                    });

                    details.addEventListener("toggle", () => {
                        if (details.open) {
                            const activePanel = details.querySelector('[role="tabpanel"]:not([hidden])');
                            if (activePanel) highlightPanel(activePanel);
                        }
                    });
                });
            }
