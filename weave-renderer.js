/**
 * 织物纹样渲染模块 — 基于踏板系统 + Canvas 渲染
 *
 * 核心逻辑（以《古朗月行》为例：8句×5字=40字）：
 *
 * 映射逻辑一（语义+语法 → 4种踏盘结构）
 *   文字网格：句子数(8行) × 最长句子字数(5列)
 *   踏盘连接图(tieup)：句子数(8) × 最长句子字数(5)
 *     → 在文字网格中，匹配的字标记为黑点
 *   综框穿综图(shaft)：句子数(8) × 总字数(40)
 *     → 每个字属于哪个句子，就在对应综框行标记
 *   踏盘踩踏图(treadle)：总字数(40) × 最长句子字数(5)
 *     → 每个字在句子内的位置，决定踩哪个踏木
 *     → 第1个字(第1句第1字)→列0，第6个字(第2句第1字)→也是列0
 *   组织图：总字数(40) × 总字数(40)
 *
 * 映射逻辑二（语音 → 声调踏盘）
 *   踏盘连接图(tieup)：4×4（4个声调）
 *   综框穿综图(shaft)：4 × 总字数(40)
 *     → 每个字根据声调分配到对应综框
 *   踏盘踩踏图(treadle)：总字数(40) × 4
 *     → 每个字根据声调踩对应踏木
 *   组织图：总字数(40) × 总字数(40)
 *
 * 分句规则：按 ，。！？、；等标点符号分行，不按\n
 *
 * 配色系统：基于文字意象的通感配色
 *   从文本中提取核心意象词，根据意象生成协调的5色调色板
 *   让观看者能通过纹样的色块感受到原有文字的意境
 */

// ==================== 意象色彩词典 ====================
// 每个意象词对应一个精确色值，参考中国传统色谱 + 通感美学
// 分为多个意象类别，每个类别有统一的色调倾向

var IMAGE_COLOR_DICT = {
    // ===== 寒冷/冬/孤寂 → 冷蓝灰色系 =====
    '冰': '#B8D4E3', '雪': '#E8EEF2', '寒': '#8FAABE', '冷': '#9BB5C9',
    '冻': '#A3C1D4', '霜': '#C8D8E4', '冬': '#7A9BB5', '凉': '#A8C4D6',
    '孤': '#8B9DAD', '独': '#7E929F', '寂': '#6B8294', '寞': '#7A8E9E',
    '默': '#8A9BA8', '静': '#9AACB8', '沉': '#5D7A8C', '深': '#4A6B7F',

    // ===== 温暖/爱/热烈 → 暖红粉色系 =====
    '爱': '#E85D75', '恋': '#D4687A', '情': '#E07088', '亲': '#D98A96',
    '吻': '#E8506A', '拥': '#D66B7E', '抱': '#CC7A8A', '怀': '#C98898',
    '甜': '#F0A0B0', '蜜': '#E8B090', '暖': '#E8A07A', '温': '#D4967A',
    '热': '#D45040', '烈': '#C83C30', '燃': '#D84828', '烧': '#CC5038',
    '火': '#D84020', '焰': '#E05828', '炎': '#D04830', '灼': '#C84028',

    // ===== 春天/花/生机 → 粉绿嫩色系 =====
    '春': '#E8A0B8', '花': '#E890A8', '朵': '#F0A8B8', '瓣': '#ECA0B0',
    '桃': '#E8889C', '梅': '#D87088', '樱': '#F098AC', '兰': '#B898C8',
    '菊': '#D8B060', '莲': '#E8A0B0', '荷': '#E8A8B0', '芳': '#D8A0B8',
    '芽': '#A8D870', '苗': '#90C860', '嫩': '#B8E080', '萌': '#A0D068',
    '蕾': '#D898A8', '蓓': '#D090A0', '绽': '#E088A0', '开': '#E8A0A8',

    // ===== 夏天/阳光/活力 → 明黄橙色系 =====
    '夏': '#E8C040', '阳': '#F0C830', '晴': '#F0D050', '灿': '#F0C020',
    '光': '#F8D848', '辉': '#E8B830', '耀': '#F0C838', '闪': '#F0D060',
    '亮': '#F0D858', '明': '#E8C848', '朝': '#E8B040', '晨': '#F0C050',
    '旭': '#E8A838', '曦': '#F0B840', '晖': '#E8B848', '煌': '#E0A830',
    '金': '#D4A828', '黄': '#E0C040', '橙': '#E89838', '丹': '#D86040',

    // ===== 秋天/落叶/成熟 → 赭黄褐色系 =====
    '秋': '#C89848', '叶': '#A8B050', '落': '#B89858', '枯': '#A08848',
    '萧': '#988050', '瑟': '#907848', '凋': '#887040', '残': '#806838',
    '暮': '#8A6848', '昏': '#987050', '夕': '#C88850', '晚': '#B08058',
    '黄': '#D0A840', '褐': '#8A6838', '赭': '#986840', '棕': '#8A6030',
    '枫': '#C86038', '霞': '#D88868', '醉': '#B86848', '熟': '#A87848',

    // ===== 大海/水/辽阔 → 深蓝青色系 =====
    '海': '#2868A0', '洋': '#3070A8', '潮': '#3878A8', '浪': '#4888B0',
    '涛': '#3068A0', '波': '#4080B0', '澜': '#3870A8', '汹': '#285898',
    '江': '#3878A0', '河': '#4888A8', '湖': '#5090B0', '溪': '#68A8C0',
    '泉': '#60A0B8', '瀑': '#4888B0', '流': '#5898B8', '水': '#5090B8',
    '池': '#68A0B8', '潭': '#3870A0', '渊': '#284880', '涧': '#5098B0',

    // ===== 山/大地/厚重 → 深绿褐色系 =====
    '山': '#3A6848', '岭': '#486850', '峰': '#385840', '崖': '#505848',
    '岩': '#687060', '石': '#788078', '壁': '#606858', '峡': '#486050',
    '谷': '#587050', '坡': '#688060', '丘': '#789068', '陵': '#688058',
    '地': '#807860', '土': '#908068', '尘': '#A09880', '沙': '#C0B898',
    '原': '#789868', '野': '#688858', '旷': '#88A078', '荒': '#989078',

    // ===== 森林/草木/自然 → 绿色系 =====
    '林': '#3A7848', '森': '#2A6838', '木': '#5A8050', '树': '#488848',
    '松': '#3A7040', '柏': '#2A5838', '竹': '#4A8850', '柳': '#68A858',
    '草': '#68A060', '茂': '#489040', '荣': '#58A048', '翠': '#38A048',
    '绿': '#48A850', '碧': '#38A068', '苍': '#3A7850', '葱': '#58A858',
    '茵': '#68B068', '蔓': '#58A050', '藤': '#488848', '萝': '#68A860',

    // ===== 月/夜/幽静 → 银蓝紫色系 =====
    '月': '#B0C0D8', '星': '#A8B8D0', '夜': '#4A5878', '暗': '#3A4868',
    '幽': '#5A6888', '影': '#4A5878', '幻': '#7888B0', '梦': '#8898C0',
    '眠': '#6878A0', '睡': '#7888A8', '宵': '#4A5870', '昏': '#5A6878',
    '银': '#B0B8C8', '霓': '#9888C0', '虹': '#A898C8', '紫': '#8868A8',
    '玉': '#B8C8D0', '珠': '#C0C8D0', '璧': '#A8B8C8', '琼': '#B0C0D0',

    // ===== 风/云/飘逸 → 浅灰蓝色系 =====
    '风': '#90A8C0', '云': '#B8C8D8', '雾': '#A8B8C8', '岚': '#88A0B8',
    '飘': '#A0B8D0', '飞': '#88A8C8', '翔': '#80A0C0', '翼': '#78A0B8',
    '轻': '#B0C8D8', '柔': '#C0C8D8', '丝': '#C8D0D8', '绸': '#B8C0D0',
    '纱': '#C8D0D8', '绵': '#C0C8D0', '棉': '#C8D0D0', '缕': '#B0C0D0',
    '烟': '#A0A8B8', '霭': '#98A8B8', '氤': '#A8B0C0', '氲': '#A0B0C0',

    // ===== 雨/愁/忧伤 → 灰蓝暗色系 =====
    '雨': '#6880A0', '泪': '#7088A0', '愁': '#5870A0', '忧': '#6078A0',
    '悲': '#586898', '伤': '#607098', '哀': '#506090', '痛': '#586898',
    '苦': '#687088', '恨': '#586078', '怒': '#785868', '怨': '#686878',
    '泣': '#6880A0', '哭': '#607098', '叹': '#708098', '惆': '#6878A0',
    '惘': '#7080A0', '迷': '#7888A8', '茫': '#8898B0', '惑': '#7888A0',

    // ===== 喜悦/欢乐/庆典 → 明亮暖色系 =====
    '喜': '#E07048', '欢': '#E88050', '乐': '#F0A050', '笑': '#F0B060',
    '庆': '#E06040', '福': '#D85040', '祝': '#E06848', '贺': '#D86048',
    '幸': '#E88868', '运': '#E09060', '吉': '#D87848', '祥': '#D08050',
    '瑞': '#C87848', '兆': '#D08858', '彩': '#E09068', '华': '#D88858',

    // ===== 壮阔/豪迈/力量 → 深红暗金色系 =====
    '壮': '#A04030', '豪': '#984038', '雄': '#883830', '伟': '#903828',
    '刚': '#884030', '强': '#804028', '猛': '#903020', '烈': '#A03828',
    '威': '#883828', '武': '#804030', '勇': '#983828', '战': '#883020',
    '铁': '#606068', '钢': '#585860', '剑': '#707078', '刀': '#686870',
    '龙': '#884830', '虎': '#A06838', '鹰': '#786858', '狼': '#686058',

    // ===== 宁静/禅意/淡泊 → 素雅灰白色系 =====
    '禅': '#B0B8A8', '道': '#A8B0A0', '佛': '#C0B898', '仙': '#B8C8C8',
    '空': '#C0C8D0', '虚': '#B8C0C8', '无': '#B0B8C0', '淡': '#C0C8C8',
    '素': '#C8C8C0', '净': '#C8D0D0', '清': '#A8C8C8', '雅': '#B0C0B8',
    '逸': '#A8C0B8', '闲': '#B0C0B0', '悠': '#A8B8B0', '然': '#B8C0B8',

    // ===== 思念/远方/离别 → 淡紫蓝色系 =====
    '思': '#8888B8', '念': '#8080B0', '忆': '#7878A8', '望': '#7888B0',
    '盼': '#8090B8', '等': '#8898B8', '归': '#7888A8', '还': '#8090B0',
    '离': '#7080A8', '别': '#6878A0', '送': '#7888A8', '行': '#8090A8',
    '远': '#6878A8', '遥': '#6070A0', '途': '#7080A0', '路': '#8088A0',
    '乡': '#9098A8', '家': '#A0A0A8', '故': '#8890A0', '旧': '#9098A0'
};

// ==================== 预设艺术调色板（电影级 60:30:10 配色 · 多变体色卡池） ====================
// 每个主题包含 9 套调色板（6套莫兰迪低饱和 + 3套高饱和鲜艳版），严格按照 60:30:10 黄金配色法设计：
//   · primary(60%)  主色调 —— 奠定氛围，面积最大（映射到渲染顶层 tone）
//   · secondary(30%) 辅助色 —— 与主色同色系，支撑主色（映射到 emotion）
//   · tertiary(30%)  次辅助 —— 邻近色相变体（映射到 subject）
//   · neutral(10%)   中性过渡 —— 柔化对比（映射到 predicate）
//   · accent(10%)    点睛色 —— 唯一鲜艳色，小面积（映射到底层 object）
// 前6套：莫兰迪/低饱和风格（亮度 > 0.65、饱和度 < 0.55），参考 nice-color-palettes
// 后3套：高饱和鲜艳风格（饱和度 0.55~0.85），与v1.3算法路径的高饱和结果对标
// 命中主题后，根据文本 hash 稳定选中某一套，实现灰调与高饱和两种风格并存。

// 原 ARTISTIC_PALETTES 已被动态生成器 ARTISTIC_THEMES 替代
// 意象主题字典：把每个意象字归类到一个主题（比单字色更稳定、更有艺术指向）
// 字典命中即主题投票 +1，得票最高的主题直接吸附到对应的预设艺术调色板。
// 总 20 个主题：sunset / forest / ocean / moonlight / autumn / spring / snow / summer /
//              zen / longing / fire / mist / stone / rain / festive / ink / jade /
//              twilight / starry / bamboo
//
// 【设计原则】
// 1. 每个字只归属一个主题（修掉旧版 海/翠/苍/无/逸/风 等多重归属导致的主题漂移）。
// 2. 共计 ~800 字，覆盖古典诗词高频意象（建筑/器物/花木/鸟兽/天象/情感/颜色…）。
// 3. 冲突时按"最具代表性"原则归类：
//       海→ocean（不再归 starry） / 翠→forest（不再归 jade）
//       苍 茫→stone / 无 空→zen / 风→mist / 逸 清→bamboo
var IMAGERY_THEME_DICT = {
    // ── sunset · 晚霞/黄昏/爱恋/温暖 ──
    '霞': 'sunset', '夕': 'sunset', '暮': 'sunset', '昏': 'sunset', '晚': 'sunset',
    '落': 'sunset', '斜': 'sunset', '醉': 'sunset', '粉': 'sunset', '橙': 'sunset',
    '爱': 'sunset', '恋': 'sunset', '情': 'sunset', '吻': 'sunset', '拥': 'sunset',
    '抱': 'sunset', '怀': 'sunset', '甜': 'sunset', '蜜': 'sunset', '暖': 'sunset',
    '温': 'sunset', '丹': 'sunset', '绯': 'sunset', '绛': 'sunset', '赤': 'sunset',
    '血': 'sunset', '胭': 'sunset', '脂': 'sunset', '妆': 'sunset', '颊': 'sunset',
    '唇': 'sunset', '腮': 'sunset', '娇': 'sunset', '妩': 'sunset', '媚': 'sunset',
    '羞': 'sunset', '痴': 'sunset', '缱': 'sunset', '绻': 'sunset', '眷': 'sunset',

    // ── forest · 森林/草木/山野 ──
    '林': 'forest', '森': 'forest', '木': 'forest', '树': 'forest', '松': 'forest',
    '柏': 'forest', '柳': 'forest', '草': 'forest', '茂': 'forest', '荣': 'forest',
    '翠': 'forest', '绿': 'forest', '碧': 'forest', '葱': 'forest', '茵': 'forest',
    '蔓': 'forest', '藤': 'forest', '萝': 'forest', '叶': 'forest', '芽': 'forest',
    '苗': 'forest', '嫩': 'forest', '萌': 'forest',
    '山': 'forest', '岭': 'forest', '峰': 'forest', '原': 'forest', '野': 'forest',
    '麓': 'forest', '坳': 'forest', '峦': 'forest', '嶂': 'forest', '峤': 'forest',
    '槐': 'forest', '榆': 'forest', '桐': 'forest', '桂': 'forest', '檀': 'forest',
    '杉': 'forest', '椿': 'forest', '蓬': 'forest', '蒿': 'forest', '莽': 'forest',
    '丛': 'forest', '薮': 'forest', '荫': 'forest', '蔽': 'forest', '蕨': 'forest',
    '苔': 'forest', '藓': 'forest', '蕤': 'forest',

    // ── ocean · 海/水/江河 ──
    '海': 'ocean', '洋': 'ocean', '潮': 'ocean', '浪': 'ocean', '涛': 'ocean',
    '波': 'ocean', '澜': 'ocean', '汹': 'ocean', '江': 'ocean', '河': 'ocean',
    '湖': 'ocean', '溪': 'ocean', '泉': 'ocean', '瀑': 'ocean', '流': 'ocean',
    '水': 'ocean', '池': 'ocean', '潭': 'ocean', '渊': 'ocean', '涧': 'ocean',
    '荡': 'ocean', '漾': 'ocean', '沧': 'ocean', '澄': 'ocean',
    '渚': 'ocean', '滩': 'ocean', '岸': 'ocean', '津': 'ocean', '渡': 'ocean',
    '汀': 'ocean', '浒': 'ocean', '浦': 'ocean', '湾': 'ocean', '港': 'ocean',
    '涯': 'ocean', '涌': 'ocean', '湍': 'ocean', '潺': 'ocean', '泠': 'ocean',
    '淼': 'ocean', '滔': 'ocean', '溟': 'ocean', '澹': 'ocean', '泊': 'ocean',
    '渔': 'ocean', '舟': 'ocean', '舫': 'ocean', '桨': 'ocean', '橹': 'ocean',
    '帆': 'ocean', '楫': 'ocean', '棹': 'ocean',

    // ── moonlight · 月夜/幽梦 ──
    '月': 'moonlight', '夜': 'moonlight', '暗': 'moonlight',
    '幽': 'moonlight', '影': 'moonlight', '幻': 'moonlight', '梦': 'moonlight',
    '眠': 'moonlight', '睡': 'moonlight', '宵': 'moonlight',
    '霓': 'moonlight', '虹': 'moonlight', '紫': 'moonlight',
    '魄': 'moonlight', '魂': 'moonlight', '婵': 'moonlight', '娟': 'moonlight',
    '蟾': 'moonlight', '桂': 'moonlight', '阙': 'moonlight', '嫦': 'moonlight',
    '娥': 'moonlight', '蓝': 'moonlight', '靛': 'moonlight', '黛': 'moonlight',
    '冥': 'moonlight', '阴': 'moonlight', '朦': 'moonlight', '胧': 'moonlight',

    // ── autumn · 秋/落叶/枯黄 ──
    '秋': 'autumn', '枯': 'autumn', '萧': 'autumn', '瑟': 'autumn', '凋': 'autumn',
    '残': 'autumn', '褐': 'autumn', '赭': 'autumn', '棕': 'autumn', '枫': 'autumn',
    '熟': 'autumn', '黄': 'autumn', '稻': 'autumn', '谷': 'autumn', '麦': 'autumn',
    '穗': 'autumn', '穰': 'autumn', '黍': 'autumn', '硕': 'autumn', '藕': 'autumn',
    '杏': 'autumn', '梨': 'autumn', '柿': 'autumn', '橘': 'autumn', '橙': 'autumn',
    '饱': 'autumn', '萎': 'autumn', '衰': 'autumn', '败': 'autumn', '蓑': 'autumn',
    '茅': 'autumn',

    // ── spring · 春/花/生机 ──
    '春': 'spring', '花': 'spring', '朵': 'spring', '瓣': 'spring', '桃': 'spring',
    '梅': 'spring', '樱': 'spring', '兰': 'spring', '菊': 'spring', '莲': 'spring',
    '荷': 'spring', '芳': 'spring', '蕾': 'spring', '蓓': 'spring', '绽': 'spring',
    '开': 'spring', '蕊': 'spring', '芬': 'spring', '馥': 'spring', '郁': 'spring',
    '香': 'spring', '菲': 'spring', '妍': 'spring', '艳': 'spring', '媺': 'spring',
    '蜂': 'spring', '蝶': 'spring', '燕': 'spring', '莺': 'spring', '啼': 'spring',
    '鸣': 'spring', '苏': 'spring', '醒': 'spring', '融': 'spring',

    // ── snow · 雪/冰/冬寒 ──
    '冰': 'snow', '雪': 'snow', '寒': 'snow', '冷': 'snow', '冻': 'snow',
    '霜': 'snow', '冬': 'snow', '凉': 'snow', '凛': 'snow', '冽': 'snow',
    '皑': 'snow', '素': 'snow', '皓': 'snow', '凇': 'snow', '絮': 'snow',
    '飘': 'snow', '扬': 'snow', '漫': 'snow', '簌': 'snow', '凄': 'snow',
    '萧': 'snow', '索': 'snow',

    // ── summer · 夏/阳/灿烂 ──
    '夏': 'summer', '阳': 'summer', '晴': 'summer', '灿': 'summer', '光': 'summer',
    '辉': 'summer', '耀': 'summer', '闪': 'summer', '亮': 'summer', '明': 'summer',
    '煌': 'summer', '炽': 'summer', '暑': 'summer', '炙': 'summer', '燥': 'summer',
    '蒸': 'summer', '郊': 'summer', '午': 'summer', '日': 'summer', '曝': 'summer',

    // ── zen · 禅意/素雅/淡泊 ──
    '禅': 'zen', '道': 'zen', '佛': 'zen', '仙': 'zen', '空': 'zen',
    '无': 'zen', '淡': 'zen', '雅': 'zen', '净': 'zen',
    '闲': 'zen', '悠': 'zen', '然': 'zen', '静': 'zen', '默': 'zen',
    '沉': 'zen', '深': 'zen', '寂': 'zen', '寞': 'zen',
    '清': 'zen' /* 注意：清 归 zen，"清风"不会被拉到 bamboo */,
    '虚': 'zen', '朴': 'zen', '真': 'zen', '悟': 'zen', '觉': 'zen',
    '境': 'zen', '心': 'zen', '意': 'zen', '寺': 'zen', '庙': 'zen',
    '塔': 'zen', '钟': 'zen', '磬': 'zen', '经': 'zen', '卷': 'zen',
    '僧': 'zen', '隐': 'zen', '避': 'zen', '栖': 'zen',

    // ── longing · 相思/离别/远方 ──
    '思': 'longing', '念': 'longing', '忆': 'longing', '望': 'longing',
    '盼': 'longing', '等': 'longing', '归': 'longing', '离': 'longing',
    '别': 'longing', '送': 'longing', '远': 'longing', '遥': 'longing',
    '途': 'longing', '路': 'longing', '乡': 'longing', '故': 'longing',
    '旧': 'longing', '孤': 'longing', '独': 'longing',
    '寄': 'longing', '托': 'longing', '书': 'longing', '信': 'longing',
    '雁': 'longing', '鸿': 'longing', '鲤': 'longing', '鱼': 'longing' /* 鱼传尺素 */,
    '家': 'longing', '客': 'longing', '旅': 'longing', '行': 'longing',
    '走': 'longing', '赴': 'longing', '迁': 'longing', '徙': 'longing',
    '漂': 'longing', '泊': 'longing' /* 漂泊 */, '羁': 'longing', '绊': 'longing',

    // ── fire · 火焰/热烈/豪迈/力量 ──
    '热': 'fire', '烈': 'fire', '燃': 'fire', '烧': 'fire', '火': 'fire',
    '焰': 'fire', '炎': 'fire', '灼': 'fire',
    '壮': 'fire', '豪': 'fire', '雄': 'fire', '伟': 'fire', '刚': 'fire',
    '强': 'fire', '猛': 'fire', '威': 'fire', '武': 'fire', '勇': 'fire',
    '战': 'fire', '龙': 'fire', '虎': 'fire', '怒': 'fire',
    '狂': 'fire', '傲': 'fire', '骁': 'fire', '悍': 'fire', '霸': 'fire',
    '剑': 'fire', '刀': 'fire', '戈': 'fire', '戟': 'fire', '矛': 'fire',
    '铁': 'fire', '锋': 'fire', '刃': 'fire', '鞭': 'fire', '甲': 'fire',
    '盔': 'fire', '旌': 'fire', '旗': 'fire', '鼓': 'fire', '角': 'fire',
    '征': 'fire', '伐': 'fire', '鏖': 'fire', '杀': 'fire',

    // ── mist · 烟云/缥缈/飘逸 ──
    '云': 'mist', '雾': 'mist', '岚': 'mist', '飞': 'mist',
    '翔': 'mist', '翼': 'mist', '轻': 'mist', '柔': 'mist', '丝': 'mist',
    '绸': 'mist', '纱': 'mist', '绵': 'mist', '棉': 'mist', '缕': 'mist',
    '烟': 'mist', '霭': 'mist', '氤': 'mist', '氲': 'mist',
    '风': 'mist' /* 风 归 mist："清风"= 清(zen)+风(mist) 是合理的禅/飘混合 */,
    '袅': 'mist', '婷': 'mist', '蒙': 'mist', '曚': 'mist', '翩': 'mist',
    '缥': 'mist', '缈': 'mist', '渺': 'mist', '氛': 'mist', '气': 'mist',

    // ── stone · 山石/厚重/苍茫 ──
    '石': 'stone', '岩': 'stone', '崖': 'stone', '壁': 'stone', '峡': 'stone',
    '坡': 'stone', '丘': 'stone', '陵': 'stone', '地': 'stone',
    '土': 'stone', '尘': 'stone', '沙': 'stone', '旷': 'stone', '荒': 'stone',
    '苍': 'stone', '茫': 'stone',
    '磐': 'stone', '磊': 'stone', '砺': 'stone', '砾': 'stone', '墩': 'stone',
    '垒': 'stone', '堡': 'stone', '堑': 'stone', '壑': 'stone', '冈': 'stone',
    '墟': 'stone', '圃': 'stone', '埃': 'stone', '垠': 'stone', '渺': 'stone',
    '莽': 'stone' /* 覆盖前面 forest 的 莽 吗？不，先到先得 */,

    // ── rain · 细雨/愁思/缠绵 ──
    '雨': 'rain', '泪': 'rain', '愁': 'rain', '忧': 'rain', '悲': 'rain',
    '伤': 'rain', '哀': 'rain', '痛': 'rain', '苦': 'rain', '泣': 'rain',
    '哭': 'rain', '叹': 'rain', '惆': 'rain', '惘': 'rain', '迷': 'rain',
    '惑': 'rain', '怨': 'rain', '恨': 'rain',
    '霖': 'rain', '濛': 'rain', '沥': 'rain', '潇': 'rain', '淅': 'rain',
    '咽': 'rain', '噎': 'rain', '嗟': 'rain', '嘘': 'rain', '唏': 'rain',
    '断': 'rain', '肠': 'rain', '凄': 'rain', '戚': 'rain', '恻': 'rain',
    '憔': 'rain', '悴': 'rain', '憾': 'rain', '郁': 'rain' /* 覆盖 spring 的 郁吗 —— JS 后定义覆盖前者，这里需注意顺序 */,

    // ── festive · 喜庆/欢乐/祥和 ──
    '喜': 'festive', '欢': 'festive', '乐': 'festive', '笑': 'festive',
    '庆': 'festive', '福': 'festive', '祝': 'festive', '贺': 'festive',
    '幸': 'festive', '运': 'festive', '吉': 'festive', '祥': 'festive',
    '兆': 'festive', '彩': 'festive', '华': 'festive', '锦': 'festive',
    '丰': 'festive', '盛': 'festive',
    '欣': 'festive', '悦': 'festive', '怡': 'festive', '愉': 'festive',
    '畅': 'festive', '爽': 'festive', '酣': 'festive', '团': 'festive',
    '圆': 'festive', '聚': 'festive', '宴': 'festive', '觞': 'festive',
    '酒': 'festive', '醇': 'festive', '歌': 'festive', '舞': 'festive',
    '鞭': 'festive' /* 鞭炮，但与 fire 的鞭冲突 —— 以后定义为准，归 festive */,

    // ── ink · 水墨/书画/文雅 ──
    '墨': 'ink', '笔': 'ink', '砚': 'ink', '画': 'ink',
    '诗': 'ink', '词': 'ink', '赋': 'ink', '篇': 'ink',
    '章': 'ink', '字': 'ink', '文': 'ink', '韵': 'ink', '律': 'ink',
    '砖': 'ink', '瓦': 'ink', '檐': 'ink', '梁': 'ink', '栋': 'ink',
    '亭': 'ink', '阁': 'ink', '楼': 'ink', '台': 'ink', '榭': 'ink',
    '廊': 'ink', '轩': 'ink', '斋': 'ink', '院': 'ink', '门': 'ink',
    '窗': 'ink', '帘': 'ink', '幕': 'ink', '屏': 'ink', '案': 'ink',
    '笺': 'ink', '帖': 'ink', '简': 'ink', '册': 'ink', '史': 'ink',
    '儒': 'ink', '士': 'ink', '贤': 'ink', '哲': 'ink',

    // ── jade · 玉石/珠光/华贵 ──
    '玉': 'jade', '珠': 'jade', '璧': 'jade', '琼': 'jade', '瑞': 'jade',
    '银': 'jade', '钗': 'jade', '簪': 'jade', '珍': 'jade', '宝': 'jade',
    '珂': 'jade', '琳': 'jade', '琅': 'jade', '瑶': 'jade', '琦': 'jade',
    '瑾': 'jade', '瑜': 'jade', '玛': 'jade', '瑙': 'jade', '珀': 'jade',
    '玳': 'jade', '瑁': 'jade', '珊': 'jade', '瑚': 'jade', '金': 'jade',
    '贵': 'jade', '富': 'jade', '奢': 'jade', '冠': 'jade', '冕': 'jade',
    '璎': 'jade', '珞': 'jade', '璀': 'jade', '璨': 'jade', '玲': 'jade',
    '珑': 'jade',

    // ── twilight · 破晓/晨光/希望 ──
    '朝': 'twilight', '晨': 'twilight', '旭': 'twilight', '曦': 'twilight',
    '晖': 'twilight', '露': 'twilight', '初': 'twilight', '晓': 'twilight',
    '早': 'twilight', '黎': 'twilight', '破': 'twilight',
    '启': 'twilight', '苏': 'twilight' /* 覆盖 spring 的 苏 —— 以此为准，归 twilight */,
    '新': 'twilight', '鲜': 'twilight', '青': 'twilight', '嫩': 'twilight' /* 覆盖 forest 嫩 */,
    '希': 'twilight', '望': 'twilight' /* 覆盖 longing 望 —— 以此为准 */,
    '向': 'twilight', '升': 'twilight', '腾': 'twilight',

    // ── starry · 星河/浩瀚/宇宙 ──
    '星': 'starry', '辰': 'starry', '宇': 'starry', '宙': 'starry', '穹': 'starry',
    '浩': 'starry', '瀚': 'starry', '际': 'starry',
    '河': 'starry' /* 覆盖 ocean 河 —— 以此为准，"银河"归 starry 更合适 */,
    '汉': 'starry' /* 银汉/天汉 */, '霄': 'starry', '昊': 'starry',
    '天': 'starry', '空': 'starry' /* 覆盖 zen 空 —— 星空/天空归 starry */,
    '深': 'starry' /* 覆盖 zen 深 —— 深空 */,
    '斗': 'starry', '奎': 'starry', '昴': 'starry',

    // ── bamboo · 竹林/清风/高洁 ──
    '竹': 'bamboo', '节': 'bamboo', '洁': 'bamboo',
    '高': 'bamboo', '逸': 'bamboo', '君': 'bamboo',
    '筠': 'bamboo', '篁': 'bamboo', '箨': 'bamboo', '萧': 'bamboo' /* 覆盖 autumn/snow 萧 —— 以此为准，箫笛之萧、竹影萧萧 */,
    '笛': 'bamboo', '箫': 'bamboo', '琴': 'bamboo', '瑟': 'bamboo' /* 覆盖 autumn 瑟 */,
    '筝': 'bamboo', '琶': 'bamboo', '琵': 'bamboo', '雅': 'bamboo' /* 覆盖 zen 雅 —— 以此为准 */,
    '淡': 'bamboo' /* 覆盖 zen 淡 —— 以此为准 */,
    '素': 'bamboo' /* 覆盖 snow 素 —— 以此为准 */
};

// 注：同一字在多处定义时，JS 对象以"最后定义"为准。上面注释明确标注了这些"覆盖"关系。
// 最终归属确认（冲突字）：
//   深→starry  空→starry  河→starry  望→twilight  嫩→twilight  苏→twilight
//   郁→rain    莽→forest（bamboo 段在后，但未重定义莽）
//   雅→bamboo  淡→bamboo  素→bamboo  瑟→bamboo  萧→bamboo  鞭→festive

// ===== 多字意象词典：2~4 字，命中投 2 票 =====
// 原理：先用"最大正向匹配"扫短语，命中段标记 consumed，短语内的字不再参与单字扫描。
// 这样能正确处理歧义：如"岁月"不会被当成 月(moonlight)，"月亮"会被识别为 moonlight。
// 设计：每条短语投 2 票（权重是单字的 2 倍），让成语/熟语直接锁定主题。
var IMAGERY_PHRASE_DICT = {
    // moonlight（月夜/幽思）
    '明月': 'moonlight', '月亮': 'moonlight', '月光': 'moonlight', '月色': 'moonlight',
    '月华': 'moonlight', '月影': 'moonlight', '皎月': 'moonlight', '新月': 'moonlight',
    '残月': 'moonlight', '弯月': 'moonlight', '满月': 'moonlight',
    '花前月下': 'moonlight', '风花雪月': 'moonlight', '月白风清': 'moonlight',

    // sunset（晚霞/温情）
    '夕阳': 'sunset', '落日': 'sunset', '残阳': 'sunset', '晚霞': 'sunset',
    '落霞': 'sunset', '红霞': 'sunset', '朝霞': 'sunset' /* 朝霞也归晚霞系暖调 */,
    '斜阳': 'sunset',

    // ocean（水/江海）
    '大海': 'ocean', '海洋': 'ocean', '海浪': 'ocean', '海水': 'ocean',
    '江海': 'ocean', '江河': 'ocean', '江水': 'ocean', '湖水': 'ocean',
    '烟波': 'ocean', '碧波': 'ocean', '波涛': 'ocean', '潮水': 'ocean',
    '孤舟': 'ocean', '扁舟': 'ocean', '渔舟': 'ocean', '帆船': 'ocean',
    '一叶扁舟': 'ocean', '烟波浩渺': 'ocean', '惊涛骇浪': 'ocean',

    // forest（山林/草木）
    '森林': 'forest', '山林': 'forest', '松林': 'forest', '树林': 'forest',
    '绿树': 'forest', '青山': 'forest', '群山': 'forest', '山川': 'forest',
    '山河': 'forest', '苍翠': 'forest', '葱郁': 'forest', '茂密': 'forest',

    // spring（春意/花）
    '春天': 'spring', '春日': 'spring', '春风': 'spring', '春光': 'spring',
    '春色': 'spring', '春花': 'spring', '春水': 'spring', '桃花': 'spring',
    '梅花': 'spring', '樱花': 'spring', '杏花': 'spring', '梨花': 'spring',
    '百花': 'spring', '繁花': 'spring', '落花': 'spring', '花开': 'spring',
    '花香': 'spring', '鸟语花香': 'spring', '百花齐放': 'spring', '春暖花开': 'spring',
    '阳春': 'spring', '江南': 'spring',

    // autumn（秋意/萧瑟）
    '秋天': 'autumn', '秋日': 'autumn', '秋风': 'autumn', '秋色': 'autumn',
    '秋水': 'autumn', '秋叶': 'autumn', '落叶': 'autumn', '枫叶': 'autumn',
    '金黄': 'autumn', '金秋': 'autumn', '深秋': 'autumn',

    // snow（冰雪/冬寒）
    '雪花': 'snow', '雪白': 'snow', '白雪': 'snow', '瑞雪': 'snow',
    '冰雪': 'snow', '冰霜': 'snow', '寒冬': 'snow', '寒风': 'snow',
    '塞北': 'snow', '风雪': 'snow',

    // rain（细雨/愁思）
    '细雨': 'rain', '小雨': 'rain', '微雨': 'rain', '春雨': 'rain',
    '秋雨': 'rain', '夜雨': 'rain', '苦雨': 'rain', '霏霏': 'rain',
    '潇潇': 'rain', '断肠': 'rain', '销魂': 'rain', '黯然': 'rain',
    '泪流': 'rain', '泪水': 'rain', '愁绪': 'rain', '忧愁': 'rain',
    '悲伤': 'rain', '哀伤': 'rain', '凄凉': 'rain', '凄美': 'rain',

    // mist（云烟/缥缈）
    '云烟': 'mist', '烟雾': 'mist', '云雾': 'mist', '薄雾': 'mist',
    '浓雾': 'mist', '轻烟': 'mist', '炊烟': 'mist', '飘渺': 'mist',
    '缥缈': 'mist', '氤氲': 'mist', '朦胧': 'mist', '云海': 'mist',

    // fire（热烈/豪迈）
    '烈火': 'fire', '火焰': 'fire', '火光': 'fire', '战火': 'fire',
    '狼烟': 'fire', '豪情': 'fire', '壮志': 'fire', '热血': 'fire',
    '激情': 'fire', '豪迈': 'fire', '铁马': 'fire', '金戈铁马': 'fire',
    '龙腾虎跃': 'fire',

    // longing（思念/离别）
    '思念': 'longing', '想念': 'longing', '怀念': 'longing', '相思': 'longing',
    '离别': 'longing', '离愁': 'longing', '乡愁': 'longing', '故乡': 'longing',
    '故人': 'longing', '故土': 'longing', '家乡': 'longing', '天涯': 'longing',
    '海角': 'longing', '远方': 'longing', '归人': 'longing', '归期': 'longing',
    '归途': 'longing', '鸿雁': 'longing', '孤独': 'longing', '孤单': 'longing',
    '独自': 'longing', '漂泊': 'longing', '羁旅': 'longing', '客居': 'longing',

    // zen（禅意/淡泊）
    '禅心': 'zen', '禅意': 'zen', '禅境': 'zen', '清净': 'zen',
    '淡泊': 'zen', '宁静': 'zen', '静谧': 'zen', '空灵': 'zen',
    '空山': 'zen', '古寺': 'zen', '钟声': 'zen', '禅房': 'zen',
    '隐居': 'zen', '归隐': 'zen',

    // festive（喜庆）
    '喜庆': 'festive', '欢庆': 'festive', '欢乐': 'festive', '欢笑': 'festive',
    '欢颜': 'festive', '团圆': 'festive', '吉祥': 'festive', '如意': 'festive',
    '福气': 'festive', '喜事': 'festive', '良辰': 'festive',

    // ink（水墨/文雅）
    '水墨': 'ink', '笔墨': 'ink', '丹青': 'ink', '书画': 'ink',
    '诗书': 'ink', '诗词': 'ink', '诗文': 'ink', '文章': 'ink',
    '古韵': 'ink', '雅韵': 'ink', '楼阁': 'ink', '亭台': 'ink',
    '廊桥': 'ink', '深闺': 'ink',

    // jade（华贵）
    '美玉': 'jade', '宝玉': 'jade', '珠玉': 'jade', '珍珠': 'jade',
    '玛瑙': 'jade', '琉璃': 'jade', '金银': 'jade', '璀璨': 'jade',

    // twilight（破晓/希望）
    '清晨': 'twilight', '早晨': 'twilight', '黎明': 'twilight', '破晓': 'twilight',
    '拂晓': 'twilight', '晨光': 'twilight', '晨曦': 'twilight', '朝阳': 'twilight',
    '朝露': 'twilight', '希望': 'twilight',

    // starry（星河/浩瀚）
    '星空': 'starry', '星河': 'starry', '星辰': 'starry', '星光': 'starry',
    '繁星': 'starry', '银河': 'starry', '银汉': 'starry', '天河': 'starry',
    '苍穹': 'starry', '浩瀚': 'starry', '宇宙': 'starry',

    // bamboo（竹林/清风）
    '竹林': 'bamboo', '翠竹': 'bamboo', '青竹': 'bamboo', '修竹': 'bamboo',
    '竹影': 'bamboo',
    '清风': 'bamboo' /* 整体短语归 bamboo：清风明月的经典意象 */,
    '高洁': 'bamboo', '君子': 'bamboo', '高风': 'bamboo', '亮节': 'bamboo',
    '高风亮节': 'bamboo',

    // stone（山石/苍茫）
    '岩石': 'stone', '山石': 'stone', '山崖': 'stone', '悬崖': 'stone',
    '峭壁': 'stone', '山谷': 'stone', '荒原': 'stone', '荒野': 'stone',
    '大漠': 'stone', '沙漠': 'stone', '戈壁': 'stone', '苍茫': 'stone',

    // summer（夏阳）
    '夏天': 'summer', '夏日': 'summer', '炎夏': 'summer', '烈日': 'summer',
    '艳阳': 'summer', '骄阳': 'summer', '阳光': 'summer'
};

// ===== 否定/弱化前缀：命中意象字前方若为这些字，则该票作废 =====
var NEGATION_CHARS = { '不': 1, '无': 1, '非': 1, '未': 1, '莫': 1, '勿': 1, '别': 1, '没': 1 };

// ==================== 意象调色板生成 ====================

/**
 * 从文本中提取意象词并生成5色协调调色板
 *
 * 算法流程：
 * 1. 扫描文本中的每个字，在 IMAGE_COLOR_DICT 中查找匹配
 * 2. 统计各意象类别的出现频率，确定主导意象氛围
 * 3. 从匹配到的意象色中，选出主色(primary)
 * 4. 基于主色，用色彩和谐算法生成辅助色、点缀色、补色、中性色
 * 5. 返回5色调色板，分别对应5种映射类型
 *
 * @param {string[]} chineseChars - 纯汉字数组
 * @returns {object} 包含5种映射类型颜色的调色板
 */
function generateImageryPalette(chineseChars) {
    // 1. 提取所有匹配到的意象色（去重！）和主题投票
    //    关键设计：配色只依赖"文本中出现过的意象字集合"，与出现次数、字数无关。
    //    这样"你好" vs "你好你好你好" 得到完全相同的调色板，保证重复文本色调一致。
    var matchedColors = [];
    var matchedChars = [];
    var themeVotes = {};        // 主题投票：{sunset: 3, ocean: 2, ...}
    var seenChars = {};

    // ========== Step 1: 短语最大匹配扫描（Phrase-level pass） ==========
    // 从位置 i 起，优先尝试 4→3→2 字短语匹配。命中后该短语所有字被标记为 consumed，
    // 不再参与后续单字扫描；短语投 2 票（权重是单字的 2 倍）。
    // 这样能正确消歧：如"岁月不居"的"月"被"岁月"消费，不会误投 moonlight。
    var consumed = new Array(chineseChars.length);
    var maxPhraseLen = 4;
    for (var i = 0; i < chineseChars.length; i++) {
        if (consumed[i]) continue;
        for (var L = Math.min(maxPhraseLen, chineseChars.length - i); L >= 2; L--) {
            var phrase = chineseChars.slice(i, i + L).join('');
            if (IMAGERY_PHRASE_DICT[phrase]) {
                // 否定词检测：短语前一字若是否定词，整个短语作废
                var prev = i > 0 ? chineseChars[i - 1] : null;
                if (!(prev && NEGATION_CHARS[prev])) {
                    var pTheme = IMAGERY_PHRASE_DICT[phrase];
                    themeVotes[pTheme] = (themeVotes[pTheme] || 0) + 2;
                }
                // 无论是否被否定，都要消费掉，避免单字扫描重复计票
                for (var k = 0; k < L; k++) consumed[i + k] = true;
                i += L - 1;  // for 循环自增后正好跳过整个短语
                break;
            }
        }
    }

    // ========== Step 2: 单字扫描（Char-level pass） ==========
    //   关键设计：配色只依赖"文本中出现过的意象字集合"，与出现次数、字数无关。
    //   这样"你好" vs "你好你好你好" 得到完全相同的调色板，保证重复文本色调一致。
    for (var i = 0; i < chineseChars.length; i++) {
        var c = chineseChars[i];
        if (consumed[i]) continue;         // 已被短语消费的字跳过
        if (seenChars[c]) continue;        // 去重：重复字只计一次
        seenChars[c] = true;

        // 颜色字典命中（参与后续 HSL 算法）
        if (IMAGE_COLOR_DICT[c]) {
            matchedColors.push(IMAGE_COLOR_DICT[c]);
            matchedChars.push(c);
        }

        // 主题投票 + 否定词检测：前一字若为 不/无/非/未/莫/勿/别/没，跳过该票
        if (IMAGERY_THEME_DICT[c]) {
            var prevC = i > 0 ? chineseChars[i - 1] : null;
            if (!(prevC && NEGATION_CHARS[prevC])) {
                var theme = IMAGERY_THEME_DICT[c];
                themeVotes[theme] = (themeVotes[theme] || 0) + 1;
            }
        }
    }

    // 注意：此处不能因 matchedColors 为空就直接 fallback！
    // 关键场景：短语匹配（如"月光"）命中主题后，会把"月""光"标记为 consumed，
    //         Step 2 单字扫描就不会再把这些字的 IMAGE_COLOR_DICT 颜色加入 matchedColors。
    //         此时 matchedColors 虽然为空，但 themeVotes 已正确投出主题票，
    //         应优先走下面的"主题吸附"路径使用预设艺术调色板，而不是走随机 hash fallback。
    //         早期版本在此处直接 return _generateFallbackPalette，导致"当月光洒在我身上"
    //         这类仅靠短语命中主题的文本，配色被 hash 随机出的亮绿覆盖，完全丢失月光意境。

    // 2. 优先路径：主题吸附到预设艺术调色板
    //    策略：若得票最高的主题票数 >= 2，或显著领先第二名，直接吸附到预设调色板。
    //    这能保证"爱河（晚霞/浪/荡漾）"这类组合稳定地吸附到 sunset，避免算法漂移。
    var topTheme = null;
    var topVotes = 0;
    var secondVotes = 0;
    for (var tn in themeVotes) {
        if (!themeVotes.hasOwnProperty(tn)) continue;
        if (themeVotes[tn] > topVotes) {
            secondVotes = topVotes;
            topVotes = themeVotes[tn];
            topTheme = tn;
        } else if (themeVotes[tn] > secondVotes) {
            secondVotes = themeVotes[tn];
        }
    }
    // 文本稳定 hash：用于从色卡池里稳定挑一套 + 做确定性 LAB 微调
    //   采用"去重排序字符集"作为种子，确保"你好"与"你好你好你好"得到同一 hash。
    var _textKey = _computeTextKey(chineseChars);

    // 找出票数前二的主题（用于判断是否进行双主题混合）
    var secondTheme = null;
    for (var tn2 in themeVotes) {
        if (!themeVotes.hasOwnProperty(tn2)) continue;
        if (tn2 === topTheme) continue;
        if (themeVotes[tn2] === secondVotes && secondTheme === null) {
            secondTheme = tn2;
        }
    }

    // 命中条件 1：双主题混合（Q4）
    //   前二主题都 >= 2 票且差值 <= 1 时 → 两个主题池各选一套做 LAB 50/50 混合
    //   典型例子："明月松间照" moonlight/forest 并立 → 生成"月下松林"中间调
    if (topTheme && secondTheme && topVotes >= 2 && secondVotes >= 2 &&
        (topVotes - secondVotes) <= 1 &&
        ARTISTIC_THEMES[topTheme] && ARTISTIC_THEMES[secondTheme]) {
        var artA = _generateThemePalette(topTheme, _textKey);
        var artB = _generateThemePalette(secondTheme, _textKey ^ 0x9e3779b9);  // 用另一种子避开同步
        var artMixed = _mixArtPalettes(artA, artB, 0.5);
        var result = _buildPaletteFromArtistic(artMixed, _textKey);
        result._matchedColors = matchedColors;
        result._matchedChars = matchedChars;
        result._theme = topTheme + '+' + secondTheme;
        result._themeVotes = themeVotes;
        return result;
    }

    // 命中条件 2：最高票 >= 2 且领先第二名 >= 1
    if (topTheme && topVotes >= 2 && (topVotes - secondVotes) >= 1 &&
        ARTISTIC_THEMES[topTheme]) {
        var art = _generateThemePalette(topTheme, _textKey);
        var result = _buildPaletteFromArtistic(art, _textKey);
        result._matchedColors = matchedColors;
        result._matchedChars = matchedChars;
        result._theme = topTheme;
        result._themeVotes = themeVotes;
        return result;
    }
    // 命中条件 3（弱命中）：最高票 == 1，但只命中一个主题，也吸附
    if (topTheme && topVotes >= 1 && secondVotes === 0 &&
        ARTISTIC_THEMES[topTheme]) {
        var art = _generateThemePalette(topTheme, _textKey);
        var result = _buildPaletteFromArtistic(art, _textKey);
        result._matchedColors = matchedColors;
        result._matchedChars = matchedChars;
        result._theme = topTheme;
        result._themeVotes = themeVotes;
        return result;
    }

    // 3. 回退路径：未命中预设主题，走改良算法（60:30:10 协调配色）
    //    注意：若所有颜色都被短语消费（matchedColors 为空）且主题也未达吸附阈值，
    //         此时 hslColors 为空会导致后续 _classifyColorFamily / primaryHsl 空引用，
    //         因此这里必须兜底走 _generateFallbackPalette。
    if (matchedColors.length === 0) {
        var fb = _generateFallbackPalette(chineseChars);
        fb._themeVotes = themeVotes;
        return fb;
    }
    //    将匹配到的颜色转为HSL
    var hslColors = [];
    for (var i = 0; i < matchedColors.length; i++) {
        hslColors.push(_hexToHsl(matchedColors[i]));
    }

    // 色系投票法选主色（避免 HSL 平均的"脏绿陷阱"）
    function _classifyColorFamily(hsl) {
        var h = ((hsl.h % 360) + 360) % 360;
        var s = hsl.s, l = hsl.l;
        if (s < 0.18) {
            return l > 0.70 ? 'neutralLight' : 'neutralDark';
        }
        if (l < 0.45 && h >= 20 && h < 55) return 'warmBrown';
        if (h < 20 || h >= 330) return 'warmRedPink';
        if (h < 55)              return 'warmOrange';
        if (h < 80)              return 'warmBrown';
        if (h < 160)             return 'coolGreen';
        if (h < 240)             return 'coolBlue';
        if (h < 310)             return 'coolPurple';
        return 'warmRedPink';
    }

    var buckets = {};
    for (var i = 0; i < hslColors.length; i++) {
        var fam = _classifyColorFamily(hslColors[i]);
        var w = (fam === 'neutralLight' || fam === 'neutralDark') ? 0.35 : 1.0;
        if (!buckets[fam]) buckets[fam] = { count: 0, colors: [] };
        buckets[fam].count += w;
        buckets[fam].colors.push(hslColors[i]);
    }

    var famOrder = ['warmRedPink', 'warmOrange', 'coolBlue', 'coolGreen',
                    'coolPurple', 'warmBrown', 'neutralLight', 'neutralDark'];
    var winnerFam = null;
    var winnerCount = -1;
    for (var fi = 0; fi < famOrder.length; fi++) {
        var f = famOrder[fi];
        if (buckets[f] && buckets[f].count > winnerCount) {
            winnerCount = buckets[f].count;
            winnerFam = f;
        }
    }

    var winnerColors = buckets[winnerFam].colors;
    var primaryHsl = winnerColors[0];
    var bestScore = -Infinity;
    for (var i = 0; i < winnerColors.length; i++) {
        var c = winnerColors[i];
        var score = c.s * 2.0 - Math.abs(c.l - 0.55);
        if (score > bestScore) {
            bestScore = score;
            primaryHsl = c;
        }
    }

    // 4. 使用 v1.3 的 HSL 算法逻辑生成 5 色
    // 计算色调方差，决定调色板的色相跨度
    var hueVariance = 0;
    for (var i = 0; i < hslColors.length; i++) {
        var diff = _hueDiff(hslColors[i].h, primaryHsl.h);
        hueVariance += diff * diff;
    }
    hueVariance = Math.sqrt(hueVariance / hslColors.length);

    // 色相跨度：意象词色调越统一，调色板越集中；越分散，调色板越丰富
    var hueSpread = Math.max(15, Math.min(60, hueVariance * 1.5));

    // 辅助色(secondary)：主色的邻近色，色相偏移 +hueSpread*0.6，更鲜艳
    var secondaryHue = (primaryHsl.h + hueSpread * 0.6) % 360;
    var secondarySat = Math.max(0.45, Math.min(0.92, primaryHsl.s * 1.05));
    var secondaryLight = Math.max(0.42, Math.min(0.68, primaryHsl.l + 0.03));

    // 点缀色(accent)：主色的对比色，色相偏移 -hueSpread*0.8，饱和度更高
    var accentHue = (primaryHsl.h - hueSpread * 0.8 + 360) % 360;
    var accentSat = Math.max(0.50, Math.min(0.95, primaryHsl.s * 1.2));
    var accentLight = Math.max(0.40, Math.min(0.65, primaryHsl.l - 0.03));

    // 补色(complement)：色相偏移较大，形成对比但不冲突，保持鲜艳
    var complementHue = (primaryHsl.h + hueSpread * 1.5) % 360;
    var complementSat = Math.max(0.40, Math.min(0.85, primaryHsl.s * 0.90));
    var complementLight = Math.max(0.45, Math.min(0.72, primaryHsl.l + 0.06));

    // 中性色(neutral)：中等饱和度，接近主色色调，但更明亮柔和
    var neutralHue = primaryHsl.h;
    var neutralSat = Math.max(0.25, Math.min(0.55, primaryHsl.s * 0.55));
    var neutralLight = Math.max(0.58, Math.min(0.78, primaryHsl.l + 0.12));

    var palette = {
        tone:      { h: primaryHsl.h,  s: primaryHsl.s,  l: primaryHsl.l },
        emotion:   { h: secondaryHue,  s: secondarySat,  l: secondaryLight },
        predicate: { h: neutralHue,    s: neutralSat,    l: neutralLight },
        subject:   { h: complementHue, s: complementSat, l: complementLight },
        object:    { h: accentHue,     s: accentSat,     l: accentLight }
    };

    // 将HSL转为hex存储
    var result = {};
    var types = ['emotion', 'subject', 'predicate', 'object', 'tone'];
    for (var ti = 0; ti < types.length; ti++) {
        var t = types[ti];
        var p = palette[t];
        result[t] = {
            baseColor: _hslToHex(p.h, p.s, p.l),
            hsl: p,
            // 亮调风格：light 上限提到 0.94，dark 下限提到 0.42 —— 避免出现严重压暗
            light: _hslToHex(p.h, p.s * 0.75, Math.min(0.94, p.l + 0.12)),
            dark: _hslToHex(p.h, p.s * 1.05, Math.max(0.42, p.l - 0.12))
        };
    }

    result._matchedColors = matchedColors;
    result._matchedChars = matchedChars;
    result._theme = null;  // 未命中预设主题
    result._themeVotes = themeVotes;

    return result;
}

// ==================== chromaLite · 内嵌精简颜色库（LAB 色彩空间） ====================
// 仅包含"从色卡池选套 + LAB 微调 + LAB 混合"所需的最小实现，约 70 行。
// 采用 D65 光源 / sRGB → XYZ → Lab 标准转换。
// 所有 API 均为确定性函数（同输入 → 同输出），保证渲染结果可复现。

var chromaLite = (function() {
    function _srgbToLinear(v) {
        v /= 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
    function _linearToSrgb(v) {
        v = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
        return Math.max(0, Math.min(255, Math.round(v * 255)));
    }
    function _fwd(t) { return t > 0.008856 ? Math.pow(t, 1/3) : (7.787 * t + 16/116); }
    function _inv(t) { var t3 = t*t*t; return t3 > 0.008856 ? t3 : (t - 16/116) / 7.787; }

    function hexToLab(hex) {
        var rgb = _hexToRgb(hex);
        var r = _srgbToLinear(rgb[0]), g = _srgbToLinear(rgb[1]), b = _srgbToLinear(rgb[2]);
        // sRGB → XYZ（D65）
        var x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
        var y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
        var z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
        var fx = _fwd(x), fy = _fwd(y), fz = _fwd(z);
        return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
    }
    function labToHex(lab) {
        var fy = (lab.L + 16) / 116;
        var fx = lab.a / 500 + fy;
        var fz = fy - lab.b / 200;
        var x = _inv(fx) * 0.95047;
        var y = _inv(fy) * 1.00000;
        var z = _inv(fz) * 1.08883;
        // XYZ → sRGB
        var r =  x * 3.2406 + y * -1.5372 + z * -0.4986;
        var g =  x * -0.9689 + y * 1.8758 + z * 0.0415;
        var b =  x * 0.0557 + y * -0.2040 + z * 1.0570;
        return _rgbToHex(_linearToSrgb(r), _linearToSrgb(g), _linearToSrgb(b));
    }
    // LAB 线性混合（t=0 → labA，t=1 → labB）
    function mixLab(labA, labB, t) {
        return {
            L: labA.L + (labB.L - labA.L) * t,
            a: labA.a + (labB.a - labA.a) * t,
            b: labA.b + (labB.b - labA.b) * t
        };
    }
    // 在 LAB 的 a/b 平面做"色相轻旋"（等同于绕 L 轴旋转 theta 弧度）
    function rotateAb(lab, theta) {
        var cos = Math.cos(theta), sin = Math.sin(theta);
        return { L: lab.L, a: lab.a * cos - lab.b * sin, b: lab.a * sin + lab.b * cos };
    }
    // 亮度微调（clip 到合理范围）
    function adjustL(lab, dL) {
        return { L: Math.max(0, Math.min(100, lab.L + dL)), a: lab.a, b: lab.b };
    }
    function mixHex(hexA, hexB, t) { return labToHex(mixLab(hexToLab(hexA), hexToLab(hexB), t)); }

    return {
        hexToLab: hexToLab, labToHex: labToHex,
        mixLab: mixLab, mixHex: mixHex,
        rotateAb: rotateAb, adjustL: adjustL
    };
})();

// ==================== 主题池选套 / 双主题混合 / LAB 微调 ====================

// FNV-1a 32-bit hash：将去重排序后的字符集映射到稳定 uint32
function _computeTextKey(chineseChars) {
    var uniq = {};
    for (var i = 0; i < chineseChars.length; i++) uniq[chineseChars[i]] = true;
    var list = [];
    for (var ch in uniq) if (uniq.hasOwnProperty(ch)) list.push(ch);
    list.sort();
    var h = 2166136261;
    for (var j = 0; j < list.length; j++) {
        h = ((h ^ list[j].charCodeAt(0)) * 16777619) >>> 0;
    }
    return h >>> 0;
}

// 动态主题色卡生成器：基于 v1.3 的 HSL 算法，结合 v1.4 的主题基色
var ARTISTIC_THEMES = {
    sunset:    { h: 15,  s: 0.75, l: 0.65 },
    forest:    { h: 130, s: 0.55, l: 0.55 },
    ocean:     { h: 210, s: 0.70, l: 0.60 },
    moonlight: { h: 230, s: 0.50, l: 0.65 },
    autumn:    { h: 35,  s: 0.65, l: 0.55 },
    spring:    { h: 340, s: 0.60, l: 0.75 },
    snow:      { h: 200, s: 0.30, l: 0.85 },
    summer:    { h: 50,  s: 0.80, l: 0.60 },
    zen:       { h: 80,  s: 0.20, l: 0.75 },
    longing:   { h: 260, s: 0.45, l: 0.65 },
    fire:      { h: 0,   s: 0.85, l: 0.55 },
    mist:      { h: 220, s: 0.25, l: 0.75 },
    stone:     { h: 30,  s: 0.20, l: 0.55 },
    rain:      { h: 200, s: 0.40, l: 0.65 },
    festive:   { h: 355, s: 0.85, l: 0.55 },
    ink:       { h: 0,   s: 0.05, l: 0.35 },
    jade:      { h: 160, s: 0.55, l: 0.65 },
    twilight:  { h: 280, s: 0.60, l: 0.65 },
    starry:    { h: 240, s: 0.70, l: 0.35 },
    bamboo:    { h: 100, s: 0.50, l: 0.60 }
};

// 动态生成主题色卡（替代原有的预设色卡池）
function _generateThemePalette(themeName, textKey) {
    var base = ARTISTIC_THEMES[themeName];
    if (!base) return null;

    // 1. 基于 textKey 产生微小的色相偏移 (-15 到 +15)
    var hueOffset = ((textKey >>> 2) % 31) - 15;
    var primaryHue = (base.h + hueOffset + 360) % 360;

    // 2. 确定主色的饱和度和亮度 (使用主题基色，但允许微小波动)
    var satOffset = (((textKey >>> 5) % 21) - 10) / 100; // -0.1 到 +0.1
    var lightOffset = (((textKey >>> 8) % 21) - 10) / 100; // -0.1 到 +0.1
    
    var primarySat = Math.max(0.2, Math.min(0.9, base.s + satOffset));
    var primaryLight = Math.max(0.3, Math.min(0.8, base.l + lightOffset));

    // 3. 使用 v1.3 的 HSL 算法逻辑生成 5 色
    // 色相跨度 (hueSpread) 根据 textKey 随机，15 到 60 (v1.3 的范围)
    var hueSpread = 15 + ((textKey >>> 7) % 46);

    // 辅助色 (secondary)：主色的邻近色，色相偏移 +hueSpread*0.6，更鲜艳
    var secondaryHue = (primaryHue + hueSpread * 0.6) % 360;
    var secondarySat = Math.max(0.45, Math.min(0.92, primarySat * 1.05));
    var secondaryLight = Math.max(0.42, Math.min(0.68, primaryLight + 0.03));

    // 点缀色 (accent)：主色的对比色，色相偏移 -hueSpread*0.8，饱和度更高
    var accentHue = (primaryHue - hueSpread * 0.8 + 360) % 360;
    var accentSat = Math.max(0.50, Math.min(0.95, primarySat * 1.2));
    var accentLight = Math.max(0.40, Math.min(0.65, primaryLight - 0.03));

    // 补色/第三色 (tertiary)：色相偏移较大，形成对比但不冲突，保持鲜艳
    var tertiaryHue = (primaryHue + hueSpread * 1.5) % 360;
    var tertiarySat = Math.max(0.40, Math.min(0.85, primarySat * 0.90));
    var tertiaryLight = Math.max(0.45, Math.min(0.72, primaryLight + 0.06));

    // 中性色 (neutral)：中等饱和度，接近主色色调，但更明亮柔和
    var neutralHue = primaryHue;
    var neutralSat = Math.max(0.25, Math.min(0.55, primarySat * 0.55));
    var neutralLight = Math.max(0.58, Math.min(0.78, primaryLight + 0.12));

    // 转换为 hex，匹配 v1.4 的艺术色卡结构
    // 注意：v1.4 的 _buildPaletteFromArtistic 期望的键是 primary, secondary, tertiary, neutral, accent
    // 对应 v1.3 的 emotion, subject, object, tone, predicate
    return {
        primary: _hslToHex(primaryHue, primarySat, primaryLight),
        secondary: _hslToHex(secondaryHue, secondarySat, secondaryLight),
        tertiary: _hslToHex(tertiaryHue, tertiarySat, tertiaryLight),
        neutral: _hslToHex(neutralHue, neutralSat, neutralLight),
        accent: _hslToHex(accentHue, accentSat, accentLight)
    };
}

// 在 LAB 空间线性混合两套 art 调色板（用于双主题交融，比如"明月松林"）
function _mixArtPalettes(artA, artB, t) {
    var keys = ['primary', 'secondary', 'tertiary', 'neutral', 'accent'];
    var mixed = {};
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        mixed[k] = chromaLite.mixHex(artA[k], artB[k], t);
    }
    return mixed;
}

// 对单套 art 调色板做轻微 LAB 微调（色相 ±8°，亮度 ±0.02·L[0~100]→±2）
// 轻微 = 让同主题不同文本有细微艺术性差异，但仍保持原主题气质。
// 关键：微调量由 textKey 决定 → 同文本永远微调到同结果（确定性）。
function _polishArtPalette(art, textKey) {
    // 从 textKey 抽两组确定性"噪声"：一组控色相旋转角，一组控亮度微调量
    var h1 = (textKey >>> 0);
    var h2 = ((textKey * 2654435761) >>> 0);
    // 色相旋转角 ∈ [-8°, +8°]
    var hueDeg = ((h1 % 1601) / 100.0 - 8.0);    // -8.00 ~ +8.00
    var hueRad = hueDeg * Math.PI / 180;
    // 亮度微调 ∈ [-2, +2]（LAB L 尺度）
    var dL = ((h2 % 401) / 100.0 - 2.0);         // -2.00 ~ +2.00

    var keys = ['primary', 'secondary', 'tertiary', 'neutral', 'accent'];
    var polished = {};
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var lab = chromaLite.hexToLab(art[k]);
        // accent 色微调幅度放大 1.5 倍 —— 点睛色变化更明显
        var kHueRad = (k === 'accent') ? hueRad * 1.5 : hueRad;
        var kdL = (k === 'accent') ? dL * 1.2 : dL;
        lab = chromaLite.rotateAb(lab, kHueRad);
        lab = chromaLite.adjustL(lab, kdL);
        polished[k] = chromaLite.labToHex(lab);
    }
    return polished;
}

/**
 * 从预设艺术调色板（5 色：primary/secondary/tertiary/neutral/accent）构造 5 层配色结果
 *
 * 【角色→图层】分配经过反转设计。
 *   渲染时的覆盖顺序 LAYER_ORDER = ['object','subject','predicate','emotion','tone']
 *   其中 object 最先画（被覆盖最多，只从纹样空隙露一点点），tone 最后画（最大可见面积）。
 *   若把 primary（主色）给 emotion、把 accent（点睛）给 tone，顶层大面积盖上点睛色，
 *   画面就会脏乱异色当家、主色被盖死。故反转映射：
 *
 *   · tone      ← primary   （顶层最大可见面积 → 主色 60% 占据画面主色调）
 *   · emotion   ← secondary （次顶层 → 同色系辅助色，支撑主色）
 *   · predicate ← neutral   （中层 → 柔和中性过渡）
 *   · subject   ← tertiary  （次底层 → 深色纵深）
 *   · object    ← accent    （最底层，几乎被覆盖 → 点睛色只从空隙露出，真正做到「10%」面积）
 *
 * 若传入 textKey，会先对 art 做一次 LAB 空间的确定性微调（色相 ±8°、亮度 ±2），
 * 让同一主题下的不同文本产生细微差异但整体气质一致。
 *
 * 每一层都基于预设 hex 生成 baseColor / hsl / light / dark，保持与算法路径同构。
 */
function _buildPaletteFromArtistic(art, textKey) {
    // 应用 LAB 微调（如果给定 textKey）
    var polished = (typeof textKey === 'number') ? _polishArtPalette(art, textKey) : art;

    var mapping = {
        tone:      polished.primary,    // 顶层 · 主色 60% · 画面主色调
        emotion:   polished.secondary,  // 次顶 · 辅助色 30%
        predicate: polished.neutral,    // 中间 · 中性过渡
        subject:   polished.tertiary,   // 次底 · 深色纵深
        object:    polished.accent      // 底层 · 点睛色 10%（只从空隙露出）
    };

    var result = {};
    var types = ['emotion', 'subject', 'predicate', 'object', 'tone'];

    for (var ti = 0; ti < types.length; ti++) {
        var t = types[ti];
        var hex = mapping[t];
        var hsl = _hexToHsl(hex);
        
        result[t] = {
            baseColor: hex,
            hsl: hsl,
            // 亮调风格：light 上限提到 0.94，dark 下限提到 0.42 —— 避免出现严重压暗
            light: _hslToHex(hsl.h, hsl.s * 0.75, Math.min(0.94, hsl.l + 0.12)),
            dark: _hslToHex(hsl.h, hsl.s * 1.05, Math.max(0.42, hsl.l - 0.12))
        };
    }
    return result;
}
/**
 * 当文本中没有匹配到任何意象词时，根据文字编码生成默认调色板
 * 使用文字的Unicode编码作为种子，生成柔和的色调
 */
function _generateFallbackPalette(chineseChars) {
    // 用"去重排序后的字符集"作为种子：
    //   关键设计：确保"你好"和"你好你好你好"得到完全相同的种子 → 完全相同的调色板。
    //   旧实现 seed += charCodeAt 与字数强相关（重复文本 seed 倍增 → 色相完全跳变），
    //   这正是"同一段文字重复输入长度不同，颜色完全不同"的根本原因。
    var uniqueChars = {};
    for (var i = 0; i < chineseChars.length; i++) {
        uniqueChars[chineseChars[i]] = true;
    }
    var uniqueList = [];
    for (var ch in uniqueChars) {
        if (uniqueChars.hasOwnProperty(ch)) uniqueList.push(ch);
    }
    uniqueList.sort();  // 排序确保顺序无关

    // 对去重排序后的字符集用 FNV-like hash 求稳定种子
    var seed = 2166136261;
    for (var i = 0; i < uniqueList.length; i++) {
        var code = uniqueList[i].charCodeAt(0);
        seed = ((seed ^ code) * 16777619) >>> 0;
    }

    // 基于种子生成一个基础色相
    var baseHue = (seed * 7919) % 360;
    var baseSat = 0.55 + ((seed * 1103) % 100) / 300; // 0.55-0.88
    var baseLight = 0.48 + ((seed * 1664) % 100) / 500; // 0.48-0.68

    // 使用 v1.3 的 HSL 算法逻辑生成 5 色
    var hueSpread = 15 + ((seed >>> 7) % 46);

    var secondaryHue = (baseHue + hueSpread * 0.6) % 360;
    var secondarySat = Math.max(0.45, Math.min(0.92, baseSat * 1.05));
    var secondaryLight = Math.max(0.42, Math.min(0.68, baseLight + 0.03));

    var accentHue = (baseHue - hueSpread * 0.8 + 360) % 360;
    var accentSat = Math.max(0.50, Math.min(0.95, baseSat * 1.2));
    var accentLight = Math.max(0.40, Math.min(0.65, baseLight - 0.03));

    var tertiaryHue = (baseHue + hueSpread * 1.5) % 360;
    var tertiarySat = Math.max(0.40, Math.min(0.85, baseSat * 0.90));
    var tertiaryLight = Math.max(0.45, Math.min(0.72, baseLight + 0.06));

    var neutralHue = baseHue;
    var neutralSat = Math.max(0.25, Math.min(0.55, baseSat * 0.55));
    var neutralLight = Math.max(0.58, Math.min(0.78, baseLight + 0.12));

    var palette = {
        tone:      { h: baseHue,      s: baseSat,      l: baseLight },
        emotion:   { h: secondaryHue, s: secondarySat, l: secondaryLight },
        predicate: { h: neutralHue,   s: neutralSat,   l: neutralLight },
        subject:   { h: tertiaryHue,  s: tertiarySat,  l: tertiaryLight },
        object:    { h: accentHue,    s: accentSat,    l: accentLight }
    };

    var result = {};
    var types = ['emotion', 'subject', 'predicate', 'object', 'tone'];

    for (var ti = 0; ti < types.length; ti++) {
        var t = types[ti];
        var p = palette[t];
        result[t] = {
            baseColor: _hslToHex(p.h, p.s, p.l),
            hsl: p,
            light: _hslToHex(p.h, p.s * 0.8, Math.min(0.88, p.l + 0.12)),
            dark: _hslToHex(p.h, p.s * 1.1, Math.max(0.25, p.l - 0.12))
        };
    }

    result._matchedColors = [];
    result._matchedChars = [];
    result._avgHsl = { h: baseHue, s: baseSat, l: baseLight };

    return result;
}

// ==================== HSL 工具函数 ====================

/**
 * Hex → HSL 转换
 */
function _hexToHsl(hex) {
    var rgb = _hexToRgb(hex);
    var r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) {
            h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        } else if (max === g) {
            h = ((b - r) / d + 2) * 60;
        } else {
            h = ((r - g) / d + 4) * 60;
        }
    }
    return { h: h, s: s, l: l };
}

/**
 * 计算两个色相之间的最短距离（考虑环形）
 */
function _hueDiff(h1, h2) {
    var d = h1 - h2;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
}

// ==================== 颜色工具函数 ====================

function _hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(1, s));
    l = Math.max(0, Math.min(1, l));
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs((h / 60) % 2 - 1));
    var m = l - c / 2;
    var r1, g1, b1;
    if (h < 60)       { r1 = c; g1 = x; b1 = 0; }
    else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
    else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
    else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
    else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
    else               { r1 = c; g1 = 0; b1 = x; }
    var r = Math.round((r1 + m) * 255);
    var g = Math.round((g1 + m) * 255);
    var b = Math.round((b1 + m) * 255);
    return '#' + [r, g, b].map(function(v) {
        return Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
    }).join('');
}

function _hexToRgb(hex) {
    if (!hex || hex.length < 7) return [200, 200, 200];
    return [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16)
    ];
}

function _rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(function(v) {
        return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    }).join('');
}

function _darkenColor(hex, factor) {
    if (!hex || hex.length < 7) return hex;
    var rgb = _hexToRgb(hex);
    return _rgbToHex(rgb[0] * factor, rgb[1] * factor, rgb[2] * factor);
}

function _blendColors(colorHexArray) {
    if (colorHexArray.length === 0) return '#FFFFFF';
    if (colorHexArray.length === 1) return colorHexArray[0];
    // 选择最淡（亮度最高）的颜色，保证画面中只出现原始的5种颜色
    var lightest = colorHexArray[0];
    var maxBrightness = -1;
    for (var i = 0; i < colorHexArray.length; i++) {
        var rgb = _hexToRgb(colorHexArray[i]);
        // 使用感知亮度公式
        var brightness = rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114;
        if (brightness > maxBrightness) {
            maxBrightness = brightness;
            lightest = colorHexArray[i];
        }
    }
    return lightest;
}

// ==================== 动态颜色生成（基于意象调色板） ====================

// 缓存当前调色板，避免重复计算
var _cachedPalette = null;
var _cachedPaletteText = '';

/**
 * 为指定映射类型生成逐字颜色数组
 *
 * 每个字的颜色 = 该映射类型的基础色 + 基于字符特征的微调
 * 微调包括：
 *   - 如果该字本身是意象词，颜色偏向其意象色
 *   - 基于字在文中的位置，产生渐变效果
 *   - 基于字的编码，产生细微的随机变化（确定性伪随机）
 */
function generateDynamicColors(analysis, mappingType) {
    var N = analysis.charCount;
    var chars = analysis.chineseChars;

    // 获取或生成调色板（缓存机制）
    var textKey = chars.join('');
    if (_cachedPaletteText !== textKey) {
        _cachedPalette = generateImageryPalette(chars);
        _cachedPaletteText = textKey;
    }
    var palette = _cachedPalette;

    var paletteEntry = palette[mappingType];
    if (!paletteEntry) paletteEntry = palette.emotion;

    // 已移除逐字微调：每字直接使用该层的 baseColor，
    // 保持数组长度 = N 的接口不变，供 renderCombinedOverlay 按列索引取色
    var flatColor = paletteEntry.baseColor;
    var colors = [];
    for (var i = 0; i < N; i++) {
        colors.push(flatColor);
    }

    return colors;
}

// ==================== 核心：生成踏盘系统数据 ====================

/**
 * 映射逻辑一：语义/语法类型的踏盘系统
 *
 * 以"小时不识月，呼作白玉盘。"为例（2句×5字=10字）：
 *
 * 踏盘连接图(tieup) 2×5：
 *   在文字网格中匹配的字标记为1
 *   例如主语映射：
 *     小 时 不 识 月    → [1, 1, 0, 0, 0]  （"小时"是主语）
 *     呼 作 白 玉 盘    → [0, 0, 0, 0, 0]  （无主语）
 *
 * 综框穿综图(shaft) 2×10：
 *   第1-5个字属于第1句 → shaft[0][0..4] = 1
 *   第6-10个字属于第2句 → shaft[1][5..9] = 1
 *
 * 踏盘踩踏图(treadle) 10×5：
 *   第1个字(第1句第1字) → treadle[0][0] = 1
 *   第2个字(第1句第2字) → treadle[1][1] = 1
 *   ...
 *   第6个字(第2句第1字) → treadle[5][0] = 1  ← 回到第0列！
 *   第7个字(第2句第2字) → treadle[6][1] = 1
 *   ...
 */
function generateMapping1(analysis, filterType) {
    var sentences = analysis.sentences;
    var syntaxData = analysis.syntax;
    var N = analysis.charCount;

    var sentenceCount = sentences.length;
    var maxSentLen = 0;
    for (var i = 0; i < sentences.length; i++) {
        if (sentences[i].charCount > maxSentLen) {
            maxSentLen = sentences[i].charCount;
        }
    }

    var shaftNum = sentenceCount;    // 综框数 = 句子数
    var treadleNum = maxSentLen;     // 踏木数 = 最长句子字数
    var chartWidth = N;              // 组织图宽 = 总字数
    var chartHeight = N;             // 组织图高 = 总字数

    // ===== 1. 踏盘连接图(tieup)：sentenceCount × maxSentLen =====
    // 在文字网格(句子×字位)中，匹配filterType的字标记为1
    var tieupGrid = [];
    for (var si = 0; si < shaftNum; si++) {
        var row = new Array(treadleNum).fill(0);
        var sent = sentences[si];

        for (var ci = 0; ci < sent.charCount; ci++) {
            var charGlobalIdx = sent.startIndex + ci;
            if (charGlobalIdx >= N) break;

            var matched = false;
            var theChar = analysis.chineseChars[charGlobalIdx];

            if (filterType === 'emotion') {
                // 使用上下文感知版：能识别 "不喜/无愁" 这类否定语境
                matched = isEmotionWordAt(analysis.chineseChars, charGlobalIdx);
            } else if (filterType === 'subject') {
                matched = (syntaxData[charGlobalIdx] && syntaxData[charGlobalIdx].role === 'subject');
            } else if (filterType === 'predicate') {
                matched = (syntaxData[charGlobalIdx] && syntaxData[charGlobalIdx].role === 'predicate');
            } else if (filterType === 'object') {
                matched = (syntaxData[charGlobalIdx] && syntaxData[charGlobalIdx].role === 'object');
            }

            if (matched && ci < treadleNum) {
                row[ci] = 1;
            }
        }
        tieupGrid.push(row);
    }

    // ===== 2. 综框穿综图(shaft)：sentenceCount × N =====
    // 每个字属于哪个句子，就在对应综框行标记
    var shaftGrid = [];
    for (var si = 0; si < shaftNum; si++) {
        var row = new Array(chartWidth).fill(0);
        var sent = sentences[si];
        for (var ci = sent.startIndex; ci <= sent.endIndex && ci < N; ci++) {
            row[ci] = 1;
        }
        shaftGrid.push(row);
    }

    // ===== 3. 踏盘踩踏图(treadle)：N × maxSentLen =====
    // 每个字在句子内的位置，决定踩哪个踏木
    // 第1个字(第1句第1字)→列0，第6个字(第2句第1字)→也是列0
    var treadleGrid = [];
    for (var ri = 0; ri < chartHeight; ri++) {
        var row = new Array(treadleNum).fill(0);
        // 找到该字属于哪个句子
        var sentIdx = -1;
        for (var si = 0; si < sentences.length; si++) {
            if (ri >= sentences[si].startIndex && ri <= sentences[si].endIndex) {
                sentIdx = si;
                break;
            }
        }
        if (sentIdx >= 0) {
            // 该字在句子内的位置
            var posInSent = ri - sentences[sentIdx].startIndex;
            if (posInSent < treadleNum) {
                row[posInSent] = 1;
            }
        }
        treadleGrid.push(row);
    }

    return {
        shaftNum: shaftNum,
        treadleNum: treadleNum,
        chartWidth: chartWidth,
        chartHeight: chartHeight,
        shaftGrid: shaftGrid,
        tieupGrid: tieupGrid,
        treadleGrid: treadleGrid
    };
}

/**
 * 映射逻辑二：声调踏盘系统
 *
 * 踏盘连接图(tieup) 4×4：固定图案
 * 综框穿综图(shaft) 4×N：每个字根据声调分配到对应综框
 * 踏盘踩踏图(treadle) N×4：每个字根据声调踩对应踏木
 */
function generateMapping2(analysis) {
    var N = analysis.charCount;
    var phoneticData = analysis.phonetic;

    var shaftNum = 4;
    var treadleNum = 4;
    var chartWidth = N;
    var chartHeight = N;

    // 踏盘连接图 4×4
    var tieupGrid = [
        [1, 0, 1, 0],
        [0, 1, 0, 1],
        [1, 1, 0, 0],
        [0, 0, 1, 1]
    ];

    // 综框穿综图 4×N
    var shaftGrid = [];
    for (var si = 0; si < shaftNum; si++) {
        var row = new Array(chartWidth).fill(0);
        for (var ci = 0; ci < N; ci++) {
            var tone = phoneticData[ci].tone;
            if (tone === 0) tone = 1;
            if (tone === (si + 1)) {
                row[ci] = 1;
            }
        }
        shaftGrid.push(row);
    }

    // 踏盘踩踏图 N×4
    var treadleGrid = [];
    for (var ri = 0; ri < chartHeight; ri++) {
        var row = new Array(treadleNum).fill(0);
        var tone = phoneticData[ri].tone;
        if (tone === 0) tone = 1;
        if (tone >= 1 && tone <= 4) {
            row[tone - 1] = 1;
        }
        treadleGrid.push(row);
    }

    return {
        shaftNum: shaftNum,
        treadleNum: treadleNum,
        chartWidth: chartWidth,
        chartHeight: chartHeight,
        shaftGrid: shaftGrid,
        tieupGrid: tieupGrid,
        treadleGrid: treadleGrid
    };
}

// ==================== 情感词筛选（优化版）====================
//
// 【为什么要重写】
// 旧版 isEmotionWord 依赖一个从未定义的 SENTIMENT_DICT，调用时直接走到
// fallback "只要在 IMAGE_COLOR_DICT 里就算情感字" —— 结果把"月/山/竹/石/花"
// 等纯客观意象都标记为情感字，emotion 层过度激活，失去了层级的语义区分度。
//
// 【新方案】
// 1) 建立真正的 EMOTION_CHAR_DICT（单字 → 情感类别），按 7 大类分组：
//       joy 喜  / anger 怒 / sorrow 哀 / fear 惧 / love 爱 / hate 恶 / desire 欲
//    严格限定为"本身承载情感色彩的字"，不混入客观意象。
// 2) 意象字 → 情感字的桥接表 IMAGERY_EMOTION_BRIDGE：
//    只有少量意象字（如"愁/泪/叹"）同时也是情感字，列入白名单。
// 3) 提供上下文版 isEmotionWordAt(chars, idx)：
//    - 前一字为否定词（不/无/非/未/莫/勿/别/没）时，情感强度作废。
//    - 例如 "不喜" → "喜" 不计为情感字；"无愁" → "愁" 不计。
// 4) 保留 isEmotionWord(char) 单字接口供旧调用使用（不做否定判断）。

var EMOTION_CHAR_DICT = {
    // joy · 喜悦/欢乐
    '喜': 'joy', '欢': 'joy', '乐': 'joy', '笑': 'joy', '悦': 'joy',
    '欣': 'joy', '怡': 'joy', '愉': 'joy', '畅': 'joy', '爽': 'joy',
    '酣': 'joy', '兴': 'joy', '庆': 'joy', '幸': 'joy', '福': 'joy',
    '甜': 'joy', '美': 'joy', '妙': 'joy', '醉': 'joy',

    // anger · 愤怒/激烈
    '怒': 'anger', '愤': 'anger', '怨': 'anger', '恨': 'anger', '恚': 'anger',
    '忿': 'anger', '憎': 'anger', '恼': 'anger', '嗔': 'anger', '嫉': 'anger',
    '妒': 'anger', '狂': 'anger', '暴': 'anger', '烈': 'anger',

    // sorrow · 悲伤/哀愁（古典诗词高频）
    '悲': 'sorrow', '哀': 'sorrow', '愁': 'sorrow', '忧': 'sorrow', '伤': 'sorrow',
    '痛': 'sorrow', '苦': 'sorrow', '泣': 'sorrow', '哭': 'sorrow', '叹': 'sorrow',
    '嗟': 'sorrow', '怆': 'sorrow', '恻': 'sorrow', '戚': 'sorrow', '凄': 'sorrow',
    '惆': 'sorrow', '怅': 'sorrow', '憾': 'sorrow', '悼': 'sorrow', '吊': 'sorrow',
    '唉': 'sorrow', '咽': 'sorrow', '噎': 'sorrow', '唏': 'sorrow', '嘘': 'sorrow',
    '憔': 'sorrow', '悴': 'sorrow', '郁': 'sorrow', '寂': 'sorrow', '寞': 'sorrow',
    '孤': 'sorrow', '独': 'sorrow', '泪': 'sorrow', '肠': 'sorrow' /* 断肠 */,

    // fear · 恐惧/不安
    '怕': 'fear', '惧': 'fear', '恐': 'fear', '畏': 'fear', '惊': 'fear',
    '骇': 'fear', '惶': 'fear', '悚': 'fear', '栗': 'fear', '慄': 'fear',
    '忧': 'fear' /* 覆盖 sorrow 忧，以此为准——忧多含惧意 */,
    '虑': 'fear', '忐': 'fear', '忑': 'fear', '慌': 'fear',

    // love · 爱恋/珍惜/思慕
    '爱': 'love', '恋': 'love', '慕': 'love', '怜': 'love', '惜': 'love',
    '眷': 'love', '宠': 'love', '昵': 'love', '亲': 'love', '密': 'love',
    '暖': 'love', '温': 'love', '柔': 'love',
    '思': 'love', '念': 'love', '忆': 'love', '盼': 'love', '想': 'love',

    // hate · 厌恶/鄙夷
    '厌': 'hate', '恶': 'hate', '嫌': 'hate',
    '鄙': 'hate', '蔑': 'hate', '弃': 'hate',

    // desire · 欲望/期待/渴求
    '欲': 'desire', '愿': 'desire', '望': 'desire', '期': 'desire', '盼': 'desire',
    '求': 'desire', '渴': 'desire', '贪': 'desire', '痴': 'desire', '迷': 'desire',
    '醉': 'desire' /* 覆盖 joy 醉——更偏 desire */
};

/**
 * 判断单字是否为情感字（向后兼容接口，不做上下文判断）
 * @param {string} char 单个汉字
 * @returns {boolean}
 */
function isEmotionWord(char) {
    if (!char) return false;
    return !!EMOTION_CHAR_DICT[char];
}

/**
 * 获取字的情感类别（如 'joy'/'sorrow'/...），非情感字返回 null
 * @param {string} char 单个汉字
 * @returns {string|null}
 */
function getEmotionCategory(char) {
    if (!char) return null;
    return EMOTION_CHAR_DICT[char] || null;
}

/**
 * 判断在字符数组中，索引 idx 处的字是否为"有效情感字"（增强版·推荐使用）
 *
 * 相比 isEmotionWord(char) 的两点增强：
 *   1. 否定语境感知：前一字若为 不/无/非/未/莫/勿/别/没，则当前情感字作废。
 *      例：["不","喜","自","胜"] 中的 "喜" 不计；["喜","自","胜"] 中的 "喜" 计入。
 *   2. 连续情感字聚合："凄凄惨惨戚戚" 全部计入，不去重（交由上层处理密度）。
 *
 * @param {string[]} chars 原文汉字数组
 * @param {number}   idx   当前字位索引
 * @returns {boolean} 是否有效情感字
 */
function isEmotionWordAt(chars, idx) {
    if (!chars || idx < 0 || idx >= chars.length) return false;
    var cur = chars[idx];
    if (!EMOTION_CHAR_DICT[cur]) return false;
    // 否定词前缀 → 当前情感作废
    if (idx > 0 && NEGATION_CHARS[chars[idx - 1]]) return false;
    return true;
}

// ==================== 从踏盘系统生成组织图 ====================

/**
 * 根据 综框穿综图 + 踏盘连接图 + 踏盘踩踏图 → 生成组织图
 *
 * 算法：对于组织图的每一行j：
 *   1. 初始化该行所有列为false（纬面）
 *   2. 检查该行踩了哪些踏木（treadleGrid[j]）
 *   3. 对于每个被踩的踏木t：
 *      a. 检查踏木t连接了哪些综框（tieupGrid[s][t]）
 *      b. 对于每个被连接的综框s：
 *         翻转该综框上所有经线的状态（shaftGrid[s][i]）
 *   4. 状态为true的格子 = 经面(1)，false = 纬面(0)
 */
function generateDrawdown(loomData, up) {
    var shaftNum = loomData.shaftNum;
    var treadleNum = loomData.treadleNum;
    var chartWidth = loomData.chartWidth;
    var chartHeight = loomData.chartHeight;
    var shaftGrid = loomData.shaftGrid;
    var tieupGrid = loomData.tieupGrid;
    var treadleGrid = loomData.treadleGrid;

    if (typeof up === 'undefined') up = true;

    var chartGrid = [];

    for (var j = 0; j < chartHeight; j++) {
        var rowStatus = new Array(chartWidth).fill(false);

        // 如果是"踩下时综框下降"模式，初始状态为经面
        if (!up) {
            for (var i = 0; i < chartWidth; i++) {
                for (var s = 0; s < shaftNum; s++) {
                    if (shaftGrid[s][i] === 1) {
                        rowStatus[i] = true;
                        break;
                    }
                }
            }
        }

        // 遍历踏木，翻转对应经线状态
        for (var t = 0; t < treadleNum; t++) {
            if (treadleGrid[j][t] === 1) {
                for (var s = 0; s < shaftNum; s++) {
                    if (tieupGrid[s][t] === 1) {
                        for (var i = 0; i < chartWidth; i++) {
                            if (shaftGrid[s][i] === 1) {
                                rowStatus[i] = !rowStatus[i];
                            }
                        }
                    }
                }
            }
        }

        var row = [];
        for (var i = 0; i < chartWidth; i++) {
            row.push(rowStatus[i] ? 1 : 0);
        }
        chartGrid.push(row);
    }

    return chartGrid;
}

// ==================== Canvas 渲染 ====================

/**
 * 计算合适的像素大小
 * 外框大小固定在 300~560px 范围内，格子大小 = 外框大小 / N 自适应
 */
function calcPixelSize(N) {
    var wrapper = document.getElementById('grid-wrapper');
    if (!wrapper) return 4;
    var wrapperW = wrapper.clientWidth || 600;
    var wrapperH = wrapper.clientHeight || 600;
    // 外框大小与 drawEmptyGrid / calcCanvasSize 保持一致
    var canvasSize = Math.min(wrapperW, wrapperH) * 0.75;
    canvasSize = Math.max(300, canvasSize);
    canvasSize = Math.floor(canvasSize);
    // 格子大小 = 外框大小 / 字数，至少1px
    var size = Math.floor(canvasSize / N);
    return Math.max(1, size);
}

/**
 * 计算与空网格一致的固定 canvas 尺寸
 * 织物渲染时使用此值作为 canvas.width/height，确保显示边界与空网格完全相同
 */
function calcCanvasSize() {
    var wrapper = document.getElementById('grid-wrapper');
    if (!wrapper) return 450;
    var wrapperW = wrapper.clientWidth || 600;
    var wrapperH = wrapper.clientHeight || 600;
    var canvasSize = Math.min(wrapperW, wrapperH) * 0.75;
    canvasSize = Math.max(300, canvasSize);
    return Math.floor(canvasSize);
}

/**
 * 绘制圆角矩形辅助函数
 * 兼容不支持 roundRect 的浏览器
 */
function _drawRoundRect(ctx, x, y, w, h, r) {
    if (r > w / 2) r = w / 2;
    if (r > h / 2) r = h / 2;
    if (r < 0.5) {
        ctx.fillRect(x, y, w, h);
        return;
    }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
}

/**
 * 核心渲染：将5种映射按固定图层顺序依次覆盖（painter's algorithm），渲染到 Canvas
 *
 * 叠加逻辑（覆盖，非混合）：
 * - 固定图层顺序（从底到顶）：object → subject → predicate → emotion → tone
 *   原则：同色系浅变体（object/tone，见配色设计）在大面积层铺展，
 *         高饱和主色（emotion）上浮，余下映射层分布其间
 *     · object（同色系浅变体，面积大）—— 最底层，充当底色
 *     · subject / predicate —— 中间层（同色系中间调）
 *     · emotion（满饱和主色）—— 上层，构成画面主色调
 *     · tone（近互补对比色，压饱和）—— 最顶层，小面积点睛
 * - 同一格若被多层命中，后画的直接覆盖先画的（fillRect 不透明覆盖），
 *   画面上最终只出现 5 种调色板原色之一，不产生混合色（干净、不脏）
 * - 无任何映射命中的格子留空白（透明）
 */
// 固定图层顺序：从底到顶（越在后面越靠上，会覆盖前面的）
var LAYER_ORDER = ['object', 'subject', 'predicate', 'emotion', 'tone'];

function renderCombinedOverlay(analysis, onProgress) {
    var N = analysis.charCount;
    var pixelSize = calcPixelSize(N);
    var canvasSize = calcCanvasSize();

    var types = LAYER_ORDER;
    var grids = {};
    var colorArrays = {};

    for (var ti = 0; ti < types.length; ti++) {
        var type = types[ti];
        var loomData;
        if (type === 'tone') {
            loomData = generateMapping2(analysis);
        } else {
            loomData = generateMapping1(analysis, type);
        }
        grids[type] = generateDrawdown(loomData, true);
        colorArrays[type] = generateDynamicColors(analysis, type);
    }

    var canvas = document.getElementById('grid-canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    // 按图层顺序从底到顶依次绘制，后画的直接覆盖先画的（painter's algorithm）
    for (var ti = 0; ti < types.length; ti++) {
        var type = types[ti];
        var grid = grids[type];
        var colors = colorArrays[type];
        for (var j = 0; j < N; j++) {
            for (var i = 0; i < N; i++) {
                if (grid[j][i] === 1) {
                    ctx.fillStyle = colors[i];
                    ctx.fillRect(i * pixelSize, j * pixelSize, pixelSize, pixelSize);
                }
            }
        }
        if (onProgress) onProgress((ti + 1) / types.length);
    }

    if (onProgress) onProgress(1);

    return { canvas: canvas, pixelSize: pixelSize, N: N };
}

/**
 * 异步渲染（分批处理，避免阻塞UI）
 */
function renderCombinedOverlayAsync(analysis, onProgress, onComplete) {
    var N = analysis.charCount;
    var pixelSize = calcPixelSize(N);
    var canvasSize = calcCanvasSize();

    var types = LAYER_ORDER;
    var grids = {};
    var colorArrays = {};

    for (var ti = 0; ti < types.length; ti++) {
        var type = types[ti];
        var loomData;
        if (type === 'tone') {
            loomData = generateMapping2(analysis);
        } else {
            loomData = generateMapping1(analysis, type);
        }
        grids[type] = generateDrawdown(loomData, true);
        colorArrays[type] = generateDynamicColors(analysis, type);
    }

    var canvas = document.getElementById('grid-canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    // 分批处理：以"图层 × 行"为粒度，按图层顺序从底到顶依次绘制（覆盖式）
    // 每批绘制若干行，跨图层时清零 currentRow 进入下一图层
    var currentLayer = 0;
    var currentRow = 0;
    var rowsPerBatch = Math.max(1, Math.floor(N / 20));
    var totalSteps = types.length * N;
    var stepsDone = 0;

    function processBatch() {
        var type = types[currentLayer];
        var grid = grids[type];
        var colors = colorArrays[type];
        var endRow = Math.min(currentRow + rowsPerBatch, N);

        for (var j = currentRow; j < endRow; j++) {
            for (var i = 0; i < N; i++) {
                if (grid[j][i] === 1) {
                    ctx.fillStyle = colors[i];
                    ctx.fillRect(i * pixelSize, j * pixelSize, pixelSize, pixelSize);
                }
            }
        }
        stepsDone += (endRow - currentRow);
        currentRow = endRow;

        if (onProgress) onProgress(stepsDone / totalSteps);

        if (currentRow >= N) {
            // 当前图层完成，进入下一图层
            currentLayer++;
            currentRow = 0;
        }

        if (currentLayer < types.length) {
            requestAnimationFrame(processBatch);
        } else {
            if (onProgress) onProgress(1);
            if (onComplete) {
                onComplete({ canvas: canvas, pixelSize: pixelSize, N: N });
            }
        }
    }

    requestAnimationFrame(processBatch);
}

// ==================== 导出功能 ====================

function exportCanvasImage(format) {
    var canvas = document.getElementById('grid-canvas');
    if (!canvas || canvas.width === 0) {
        alert('没有可导出的内容');
        return;
    }

    var mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    var ext = format === 'jpeg' ? '.jpg' : '.png';

    canvas.toBlob(function(blob) {
        if (!blob) { alert('导出失败'); return; }
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.download = '织语纹样_' + new Date().getTime() + ext;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    }, mimeType, 0.95);
}

/**
 * 生成背景纹样缩略图
 */
function generateBgPatternDataURL(analysis) {
    var N = analysis.charCount;
    var types = LAYER_ORDER;
    var grids = {};
    var colorArrays = {};

    for (var ti = 0; ti < types.length; ti++) {
        var type = types[ti];
        var loomData;
        if (type === 'tone') {
            loomData = generateMapping2(analysis);
        } else {
            loomData = generateMapping1(analysis, type);
        }
        grids[type] = generateDrawdown(loomData, true);
        colorArrays[type] = generateDynamicColors(analysis, type);
    }

    // 背景纹样格子大小 = 显示格子大小的20%，最小1px
    var pixelSize = calcPixelSize(N);
    var bgPixel = Math.max(1, Math.round(pixelSize * 0.2));
    var offCanvas = document.createElement('canvas');
    offCanvas.width = N * bgPixel;
    offCanvas.height = N * bgPixel;
    var ctx = offCanvas.getContext('2d');

    // 按图层顺序从底到顶依次覆盖绘制，与主画面一致
    for (var ti = 0; ti < types.length; ti++) {
        var type = types[ti];
        var grid = grids[type];
        var colors = colorArrays[type];
        for (var j = 0; j < N; j++) {
            for (var i = 0; i < N; i++) {
                if (grid[j][i] === 1) {
                    ctx.fillStyle = colors[i];
                    ctx.fillRect(i * bgPixel, j * bgPixel, bgPixel, bgPixel);
                }
            }
        }
    }

    return offCanvas.toDataURL('image/png');
}
