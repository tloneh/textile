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
    var savedDirHandle = null;

    // ==================== IndexedDB 保存文件夹句柄逻辑 ====================
    var DB_NAME = 'TextileSaveDirDB';
    var STORE_NAME = 'handles';
    var KEY_NAME = 'save_dir_handle';

    function getDB() {
        return new Promise(function (resolve, reject) {
            var request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = function (e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            request.onsuccess = function (e) {
                resolve(e.target.result);
            };
            request.onerror = function (e) {
                reject(e.target.error);
            };
        });
    }

    function saveDirHandle(handle) {
        return getDB().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(STORE_NAME, 'readwrite');
                var store = tx.objectStore(STORE_NAME);
                var req = store.put(handle, KEY_NAME);
                req.onsuccess = function () { resolve(); };
                req.onerror = function () { reject(req.error); };
            });
        });
    }

    function loadDirHandle() {
        return getDB().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(STORE_NAME, 'readonly');
                var store = tx.objectStore(STORE_NAME);
                var req = store.get(KEY_NAME);
                req.onsuccess = function () { resolve(req.result); };
                req.onerror = function () { reject(req.error); };
            });
        }).catch(function () {
            return null;
        });
    }

    function verifyPermission(fileHandle, readWrite) {
        var options = {};
        if (readWrite) {
            options.mode = 'readwrite';
        }
        return fileHandle.queryPermission(options).then(function (permission) {
            if (permission === 'granted') {
                return true;
            }
            return fileHandle.requestPermission(options).then(function (newPermission) {
                return permission === 'granted' || newPermission === 'granted';
            });
        }).catch(function () {
            return false;
        });
    }

    function updateSaveDirBtnState() {
        var btn = $('#save_dir_btn');
        if (savedDirHandle) {
            // 已选择默认保存文件夹：隐藏按钮，由 flex 容器自动重排其余按钮
            btn.addClass('is-saved').removeClass('active').text('选择保存文件夹');
        } else {
            btn.removeClass('is-saved active').text('选择保存文件夹');
        }
    }

    // 初始化：恢复已选择的保存文件夹
    loadDirHandle().then(function (handle) {
        if (handle) {
            savedDirHandle = handle;
            updateSaveDirBtnState();
        }
    });

    // 绑定选择保存文件夹按钮事件
    $('#save_dir_btn').on('click', function () {
        if (!window.showDirectoryPicker) {
            alert('您的浏览器不支持此功能。请使用 Chrome, Edge 或 Opera 等现代浏览器启用自动保存目录功能。');
            return;
        }
        window.showDirectoryPicker({ mode: 'readwrite' }).then(function (handle) {
            if (handle) {
                verifyPermission(handle, true).then(function (hasPermission) {
                    if (hasPermission) {
                        savedDirHandle = handle;
                        saveDirHandle(handle).then(function () {
                            updateSaveDirBtnState();
                            alert('成功关联保存文件夹: ' + handle.name + '\n此后每次“转换为纹样”都将自动静默保存生成的文件和日志到此文件夹。');
                        });
                    } else {
                        alert('需要读写权限以进行自动保存。');
                    }
                });
            }
        }).catch(function (err) {
            if (err.name !== 'AbortError') {
                console.error(err);
                alert('选择文件夹失败：' + err.message);
            }
        });
    });

    // 自动保存图片与日志函数
    function autoSaveResult(text, analysis) {
        if (!savedDirHandle) return;
        verifyPermission(savedDirHandle, true).then(function (hasPermission) {
            if (!hasPermission) {
                console.warn('未获得保存目录读写权限，无法自动保存。');
                return;
            }

            var timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            var safeText = text.substring(0, 10).replace(/[\\/:*?"<>|]/g, '_');

            // 1. 保存图片
            var canvas = document.getElementById('grid-canvas');
            if (canvas) {
                canvas.toBlob(function (blob) {
                    if (blob) {
                        var imgFileName = '纹样_' + safeText + '_' + timestamp + '.png';
                        savedDirHandle.getFileHandle(imgFileName, { create: true }).then(function (imgFileHandle) {
                            return imgFileHandle.createWritable().then(function (writable) {
                                return writable.write(blob).then(function () {
                                    return writable.close();
                                });
                            });
                        }).then(function () {
                            console.log('纹样图片自动保存成功:', imgFileName);
                        }).catch(function (e) {
                            console.error('保存纹样图片失败:', e);
                        });
                    }
                }, 'image/png');
            }

            // 2. 保存日志数据
            var logFileName = '记录_' + safeText + '_' + timestamp + '.json';
            var logData = {
                text: text,
                timestamp: new Date().toLocaleString(),
                analysis: {
                    emotion: analysis.emotion,
                    subject: analysis.subject,
                    predicate: analysis.predicate,
                    object: analysis.object,
                    tones: analysis.tones
                }
            };
            var logBlob = new Blob([JSON.stringify(logData, null, 4)], { type: 'application/json' });
            savedDirHandle.getFileHandle(logFileName, { create: true }).then(function (logFileHandle) {
                return logFileHandle.createWritable().then(function (writable) {
                    return writable.write(logBlob).then(function () {
                        return writable.close();
                    });
                });
            }).then(function () {
                console.log('数据记录日志自动保存成功:', logFileName);
            }).catch(function (e) {
                console.error('保存数据记录日志失败:', e);
            });
        });
    }

    // ==================== 探索页动画 ====================
    initIntroAnimations();

    // ==================== 封面进入按钮 ====================
    $('#cover-enter-btn').on('click', function () {
        $('#cover-page').addClass('fade-out');
        setTimeout(function () {
            // 隐藏（保留 DOM）以便“返回主页”可重新显示
            $('#cover-page').hide().removeClass('fade-out');
            $('#main-page').show();
            drawEmptyGrid();
        }, 600);
    });

    function initIntroAnimations() {
        var coverPage = document.getElementById('cover-page');
        var introPage = document.getElementById('intro-page');
        if (!coverPage || !introPage) return;

        initIntroFlowGrids();

        // 预解码所有探索页图片，避免动画首帧解码大图导致卡顿
        var allImgs = coverPage.querySelectorAll('img');
        allImgs.forEach(function (img) {
            if (img.decode) {
                if (img.complete) {
                    img.decode().catch(function () {});
                } else {
                    img.addEventListener('load', function () {
                        img.decode && img.decode().catch(function () {});
                    }, { once: true });
                }
            }
        });

        var revealNodes = document.querySelectorAll('#intro-pattern-sheet, .intro-mark-logo, .intro-text-image, .intro-flow-sheet, .intro-gallery-sheet-wrap, #intro-action p, #cover-enter-btn');
        var lastScrollTop = coverPage.scrollTop;
        var scrollTicking = false;
        var lastHasScrolled = lastScrollTop > 4;
        coverPage.classList.toggle('has-scrolled', lastHasScrolled);

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
            if (scrollTicking) return;
            scrollTicking = true;
            requestAnimationFrame(function () {
                var currentScrollTop = coverPage.scrollTop;
                var willHasScrolled = currentScrollTop > 4;

                if (willHasScrolled !== lastHasScrolled) {
                    coverPage.classList.toggle('has-scrolled', willHasScrolled);
                    lastHasScrolled = willHasScrolled;
                }

                var progress = Math.min(1, currentScrollTop / 700);
                introPage.style.setProperty('--intro-scroll', progress);

                lastScrollTop = Math.max(0, currentScrollTop);
                scrollTicking = false;
            });
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

    // ==================== 返回主页（回到前置探索封面，保留自动保存设置） ====================
    $('#back_home_btn').on('click', function () {
        // 清空输入与字数统计
        $('#text_input').val('');
        $('#char-count').text('0/200');

        // 复位编辑栏显示
        editorVisible = true;
        $('#editor-panel').removeClass('hidden');
        $('#toggle_editor_btn').text('隐藏编辑栏');

        // 复位转换按钮状态
        $('#convert_btn').prop('disabled', false).css('opacity', 1);

        // 隐藏下载按钮
        $('#download_btn').removeClass('visible');

        // 关闭进度遮罩
        $('#progress-overlay').hide();
        $('#progress-bar-fill').css('width', '0%');
        $('#progress-text').text('转换中……');

        // 清除背景纹样与画布
        $('#bg-pattern').css({ 'background-image': 'none', 'opacity': 0 });
        $('#main-page').removeClass('has-pattern');
        currentAnalysis = null;
        drawEmptyGrid();

        // 隐藏主界面，重新显示前置探索封面页
        $('#main-page').hide();
        var $cover = $('#cover-page');
        if ($cover.length === 0) {
            // 兜底：若封面 DOM 已被移除，则刷新页面
            location.reload();
            return;
        }
        $cover.removeClass('fade-out').show();

        // 封面页滚动回顶部并复位动画状态
        var coverEl = document.getElementById('cover-page');
        if (coverEl) {
            coverEl.scrollTop = 0;
            coverEl.classList.remove('has-scrolled', 'scroll-up');
            coverEl.classList.add('scroll-down');
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

                        // 如果关联了保存文件夹，自动静默保存
                        if (savedDirHandle) {
                            try {
                                autoSaveResult(text, currentAnalysis);
                            } catch (e) {
                                console.error('自动保存失败:', e);
                            }
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
