/**
 * 织语 — 主入口模块
 *
 * 核心流程：
 * 1. 用户输入中文文本
 * 2. 语言学分析（语义/语法/语音三维度）
 * 3. 将5种映射（情感/主语/谓语/宾语/声调）叠加为综合结果
 * 4. 使用 Canvas 渲染综合纹样
 * 5. 设置背景纹样
 */

$(function () {
    var currentAnalysis = null;
    var editorVisible = true;

    // ==================== 探索页动画 ====================
    initIntroAnimations();

    // ==================== 封面进入按钮 ====================
    $('#cover-enter-btn').on('click', function () {
        $('#cover-page').addClass('fade-out');
        setTimeout(function () {
            $('#cover-page').remove();
            $('#main-page').show();
            drawEmptyGrid();
        }, 600);
    });

    function initIntroAnimations() {
        var coverPage = document.getElementById('cover-page');
        var introPage = document.getElementById('intro-page');
        if (!coverPage || !introPage) return;

        initIntroFlowGrids();

        var revealNodes = document.querySelectorAll('#intro-pattern-sheet, .intro-mark-logo, .intro-section h2, .intro-section p, .intro-flow-sheet, .intro-gallery-sheet-wrap, #intro-action p, #cover-enter-btn');
        var lastScrollTop = coverPage.scrollTop;
        coverPage.classList.add('scroll-down');
        coverPage.classList.toggle('has-scrolled', lastScrollTop > 4);

        revealNodes.forEach(function (node, index) {
            node.classList.add('intro-reveal');
            node.style.setProperty('--delay', (index % 6) * 70 + 'ms');
        });

        if ('IntersectionObserver' in window) {
            var observer = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                    } else {
                        entry.target.classList.remove('is-visible');
                    }
                });
            }, {
                root: coverPage,
                threshold: 0.01,
                rootMargin: '0px'
            });

            revealNodes.forEach(function (node) {
                observer.observe(node);
            });
        } else {
            revealNodes.forEach(function (node) {
                node.classList.add('is-visible');
            });
        }

        coverPage.addEventListener('scroll', function () {
            var currentScrollTop = coverPage.scrollTop;
            var isScrollingDown = currentScrollTop >= lastScrollTop;
            coverPage.classList.toggle('scroll-down', isScrollingDown);
            coverPage.classList.toggle('scroll-up', !isScrollingDown);
            coverPage.classList.toggle('has-scrolled', currentScrollTop > 4);
            lastScrollTop = Math.max(0, currentScrollTop);

            var progress = Math.min(1, currentScrollTop / 700);
            introPage.style.setProperty('--intro-scroll', progress);
        }, { passive: true });
    }

    function initIntroFlowGrids() {
        var text = '空山新雨后天气晚来秋明月松间照清泉石上流竹喧归浣女莲动下渔舟随意春芳歇王孙自可留';
        var highlights = {
            subject: [5, 6, 10, 11, 15, 16, 20, 23, 24, 28, 29, 32, 33, 35, 36],
            predicate: [9, 14, 19, 21, 22, 26, 27, 34, 35, 36],
            object: [0, 1, 3, 7, 8, 9, 10, 11, 16, 20, 21, 25, 26],
            emotion: [0, 1, 2, 3, 10, 11, 15, 16, 20, 21, 25, 26]
        };

        document.querySelectorAll('.flow-matrix-card').forEach(function (card) {
            var type = card.getAttribute('data-flow');
            var grid = card.querySelector('.flow-grid');
            if (!grid || grid.childElementCount) return;

            for (var i = 0; i < text.length; i++) {
                var cell = document.createElement('span');
                cell.textContent = text.charAt(i);
                if ((highlights[type] || []).indexOf(i) !== -1) {
                    cell.className = 'on';
                }
                grid.appendChild(cell);
            }
        });
    }

    // ==================== 初始化：绘制空网格 ====================
    drawEmptyGrid();
    $(window).on('resize', drawEmptyGrid);

    function drawEmptyGrid() {
        var canvas = document.getElementById('grid-canvas');
        var wrapper = document.getElementById('grid-wrapper');
        if (!canvas || !wrapper) return;

        var wrapperW = wrapper.clientWidth || 600;
        var wrapperH = wrapper.clientHeight || 600;
        var canvasSize = Math.min(wrapperW, wrapperH) * 0.75;
        canvasSize = Math.max(300, canvasSize);
        canvasSize = Math.floor(canvasSize);

        var gridCount = 30; // 默认30×30网格

        canvas.width = canvasSize;
        canvas.height = canvasSize;

        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvasSize, canvasSize);

        // 白色背景
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvasSize, canvasSize);

        // 格子大小随网格数量自适应
        var cellSize = canvasSize / gridCount;

        // 绘制网格线
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 0.5;

        for (var i = 0; i <= gridCount; i++) {
            var pos = Math.round(i * cellSize);
            // 竖线
            ctx.beginPath();
            ctx.moveTo(pos + 0.5, 0);
            ctx.lineTo(pos + 0.5, canvasSize);
            ctx.stroke();
            // 横线
            ctx.beginPath();
            ctx.moveTo(0, pos + 0.5);
            ctx.lineTo(canvasSize, pos + 0.5);
            ctx.stroke();
        }

        // 外边框加粗
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, canvasSize, canvasSize);
    }

    // ==================== 编辑栏显示/隐藏 ====================
    $('#toggle_editor_btn').on('click', function () {
        editorVisible = !editorVisible;
        if (editorVisible) {
            $('#editor-panel').removeClass('hidden');
            $(this).text('隐藏编辑栏');
        } else {
            $('#editor-panel').addClass('hidden');
            $(this).text('显示编辑栏');
        }
    });

    // ==================== 字数统计 ====================
    $('#text_input').on('input', function () {
        var text = $(this).val();
        var len = text.length;
        $('#char-count').text(len + '/200');
    });

    // ==================== 转换按钮 ====================
    $('#convert_btn').on('click', function () {
        handleConvert();
    });

    // ==================== 下载按钮 ====================
    $('#download_btn').on('click', function () {
        exportCanvasImage('png');
    });

    // ==================== 核心转换逻辑 ====================
    function handleConvert() {
        var text = $('#text_input').val().trim();
        if (!text) {
            alert('请输入文本');
            return;
        }

        // 检查是否包含汉字
        var hasChineseChar = false;
        for (var i = 0; i < text.length; i++) {
            if (text.charCodeAt(i) >= 0x4E00 && text.charCodeAt(i) <= 0x9FFF) {
                hasChineseChar = true;
                break;
            }
        }
        if (!hasChineseChar) {
            alert('请输入包含汉字的文本');
            return;
        }

        // 分析文本
        currentAnalysis = fullAnalysis(text);
        if (!currentAnalysis) {
            alert('分析失败，请检查输入');
            return;
        }

        // 显示进度
        $('#progress-overlay').show();
        $('#progress-bar-fill').css('width', '0%');
        $('#progress-text').text('正在分析文本……');

        // 禁用按钮
        $('#convert_btn').prop('disabled', true).css('opacity', 0.6);

        // 异步渲染综合叠加结果
        setTimeout(function () {
            $('#progress-text').text('转换中……');

            renderCombinedOverlayAsync(
                currentAnalysis,
                // 进度回调
                function (progress) {
                    var pct = Math.round(progress * 100);
                    $('#progress-bar-fill').css('width', pct + '%');
                    $('#progress-text').text('转换中……');
                },
                // 完成回调
                function (result) {
                    $('#progress-text').text('完成！');
                    $('#progress-bar-fill').css('width', '100%');

                    setTimeout(function () {
                        $('#progress-overlay').fadeOut(300);
                        $('#convert_btn').prop('disabled', false).css('opacity', 1);

                        // 显示下载按钮
                        $('#download_btn').addClass('visible');

                        // 设置背景纹样
                        try {
                            var bgDataURL = generateBgPatternDataURL(currentAnalysis);
                            $('#bg-pattern').css({
                                'background-image': 'url(' + bgDataURL + ')',
                                'opacity': 1
                            });
                            $('#main-page').addClass('has-pattern');
                        } catch (e) {
                            // 背景纹样生成失败不影响主功能
                        }
                    }, 400);
                }
            );
        }, 50);
    }

    // ==================== 键盘快捷键 ====================
    $(document).on('keydown', function (e) {
        // Ctrl/Cmd + Enter 触发转换
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            $('#convert_btn').trigger('click');
        }
    });
});
