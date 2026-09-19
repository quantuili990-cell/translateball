// ==UserScript==
// @name         Translateball - Selection & Region Translator
// @namespace    https://github.com/translateball
// @version      3.9.7
// @description  Edge free engine + auto fallback chain, word dictionary mode, GLM streaming output, translation history, shortcuts (Alt+Q region select / Alt+A toggle), per-site switch. The UI language follows the selected target language.
// @author       translateball
// @match        *://*/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_setClipboard
// @connect      115.159.125.227
// @connect      api.mymemory.translated.net
// @connect      cdnjs.cloudflare.com
// ==/UserScript==

(function () {
    'use strict';

    const API = 'http://115.159.125.227:8002';
    const API_TOKEN = 'URo5odEviKGUVWqJxpwHMU_78ovD7bX7';
    // MyMemory email param: anonymous 5000 chars/day -> 50000 chars/day with email; change to your own email
    const MYMEMORY_DE = 'reader@example.com';
    const LS_LANG = 'gz_target_lang';
    const LS_ENGINE = 'gz_engine';
    const LS_TBOX_X = 'gz_tbox_x';
    const LS_TBOX_Y = 'gz_tbox_y';
    const LS_TBOX_OPEN = 'gz_tbox_open'; // shared across pages: 0 = never auto-show, 1 = always show
    const LS_BALL_X = 'gz_ball_x';
    const LS_BALL_Y = 'gz_ball_y';
    const LS_HISTORY = 'gz_history';
    const TARGET_LANGS = ['简体中文', '繁體中文', 'English', '日本語', '한국어'];
    const ENGINES = ['fast', 'glm'];
    const LANG_CODE_MAP = {
        '简体中文': 'zh-CN', '繁體中文': 'zh-TW',
        'English': 'en', '日本語': 'ja', '한국어': 'ko',
    };
    const TARGET_ROOT = { '简体中文': 'zh', '繁體中文': 'zh', 'English': 'en', '日本語': 'ja', '한국어': 'ko' };
    const MAX_LEN = 2000;

    const getLang = () => localStorage.getItem(LS_LANG) || '简体中文';
    const getEngine = () => localStorage.getItem(LS_ENGINE) || 'glm';

    // ---------- UI text (i18n): every visible string follows the selected target language ----------
    const UI_LANG_MAP = { '简体中文': 'zh-CN', '繁體中文': 'zh-TW', 'English': 'en', '日本語': 'ja', '한국어': 'ko' };
    const I18N = {
        'en': {
            translating: 'Translating…',
            copyResult: 'Copy result',
            close: 'Close',
            backToSelect: '↩ Back to select',
            backToSelectTitle: 'Close the current result and select a region again to translate',
            errBackend: '⚠️ Translation service is temporarily unavailable. Please try again later.',
            errTimeout: '⏱ Translation timed out, please retry',
            translateFailed: 'Translation failed: ',
            unknownError: 'unknown error',
            sameLang: 'Already {lang}, no translation needed',
            boxTitle: 'Translation box (Alt+A to toggle)',
            inputPlaceholder: 'Type/paste text, or click "Select" to pick a page region…',
            outputPlaceholder: 'Translation will appear here',
            selectBtn: '▢ Select',
            selectBtnTitle: 'Drag to select a page region to translate (Alt+Q)',
            minimize: 'Minimize',
            resize: 'Drag to resize',
            openBox: '📋 Open translation box',
            engine: 'Translation engine',
            engineFast: '⚡ Fast (Edge/MyMemory)',
            engineGlm: '🧠 Accurate (GLM)',
            mmLeft: 'MM left {n}',
            free: 'Free',
            fastBadgeTitle: 'Fast chain: Edge first (free, unlimited), MyMemory as fallback, {limit} chars/day (local count)',
            glmBadgeTitle: 'GLM-4-Flash is free, via the local backend',
            targetLang: 'Target language',
            enableSite: '✅ Enable translation on this site',
            disableSite: '🚫 Disable translation on this site',
            recent: '🕘 Recent ({n})',
            clickToFill: 'Click to fill into the box',
            clearHistory: '🗑 Clear history',
            clearCache: '🗑 Clear translation cache',
            cacheCleared: 'Cleared {n} cache entries',
            ballDisabled: 'Translation disabled on this site. Click to enable (page will reload)',
            ballSensitive: 'Sensitive page, translation unavailable',
            ballTitle: 'Click: restore the box / open settings; drag to move; Alt+Q to select',
            selectHint: 'Drag to select a region; Esc to return to the translation box',
            ocrRecognizing: 'Recognizing image… (slower on first use)',
            ocrFailed: 'OCR failed: ',
            ocrNoText: 'No translatable text found in the image',
            captureFailed: 'Screenshot failed: ',
            mmTooLong: 'Text too long, skipped MyMemory',
            noEngine: 'No available engine',
            edgeNoResult: 'Edge returned no result',
            edgeBadResponse: 'Edge responded abnormally',
            mmNoResult: 'MyMemory returned no result',
            mmBadResponse: 'MyMemory responded abnormally',
            mmNetworkError: 'MyMemory network error',
            glmEmpty: 'GLM returned an empty result',
            h2cExecFailed: 'Failed to execute the screenshot library',
            h2cLoadFailed: 'Failed to load the screenshot library',
            h2cLoadTimeout: 'Screenshot library load timed out',
            h2cUnavailable: 'Screenshot library unavailable',
        },
        'zh-CN': {
            translating: '翻译中…',
            copyResult: '复制译文',
            close: '关闭',
            backToSelect: '↩ 返回框选',
            backToSelectTitle: '关闭当前结果，重新框选区域翻译',
            errBackend: '⚠️ 翻译服务暂时不可用，请稍后重试',
            errTimeout: '⏱ 翻译超时，请重试',
            translateFailed: '翻译失败：',
            unknownError: '未知错误',
            sameLang: '原文已是{lang}，无需翻译',
            boxTitle: '常驻翻译（Alt+A 开关）',
            inputPlaceholder: '输入/粘贴文字，或点「框选」选网页区域…',
            outputPlaceholder: '译文会显示在这里',
            selectBtn: '▢ 框选',
            selectBtnTitle: '拖动框选网页区域进行翻译（Alt+Q）',
            minimize: '最小化',
            resize: '拖动调整大小',
            openBox: '📋 打开常驻翻译框',
            engine: '翻译引擎',
            engineFast: '⚡ 快速（Edge/MyMemory）',
            engineGlm: '🧠 精准（GLM）',
            mmLeft: 'MM剩{n}字',
            free: '免费',
            fastBadgeTitle: '快速链主用 Edge（免费无限），MyMemory 兜底，每日 {limit} 字（本地统计已用）',
            glmBadgeTitle: 'GLM-4-Flash 免费，走本地后端',
            targetLang: '目标语言',
            enableSite: '✅ 在此网站启用翻译',
            disableSite: '🚫 在此网站禁用翻译',
            recent: '🕘 最近翻译（{n}）',
            clickToFill: '点击填入常驻框',
            clearHistory: '🗑 清空历史',
            clearCache: '🗑 清理翻译缓存',
            cacheCleared: '已清理 {n} 条缓存',
            ballDisabled: '本站翻译已禁用，点击启用（会刷新页面）',
            ballSensitive: '敏感页面，无法翻译',
            ballTitle: '点击：恢复常驻框/设置面板；拖动移动；Alt+Q 框选',
            selectHint: '拖动框选区域，Esc 返回翻译框',
            ocrRecognizing: '识别图片中…（首次较慢）',
            ocrFailed: 'OCR 失败：',
            ocrNoText: '图片里没有可翻译的文字',
            captureFailed: '截图失败：',
            mmTooLong: '文本过长，跳过 MyMemory',
            noEngine: '无可用引擎',
            edgeNoResult: 'Edge 无结果',
            edgeBadResponse: 'Edge 响应异常',
            mmNoResult: 'MyMemory 无结果',
            mmBadResponse: 'MyMemory 响应异常',
            mmNetworkError: 'MyMemory 网络错误',
            glmEmpty: 'GLM 空结果',
            h2cExecFailed: '截图库执行失败',
            h2cLoadFailed: '截图库加载失败',
            h2cLoadTimeout: '截图库加载超时',
            h2cUnavailable: '截图库不可用',
        },
        'zh-TW': {
            translating: '翻譯中…',
            copyResult: '複製譯文',
            close: '關閉',
            backToSelect: '↩ 返回框選',
            backToSelectTitle: '關閉目前結果，重新框選區域翻譯',
            errBackend: '⚠️ 翻譯服務暫時無法使用，請稍後重試',
            errTimeout: '⏱ 翻譯逾時，請重試',
            translateFailed: '翻譯失敗：',
            unknownError: '未知錯誤',
            sameLang: '原文已是{lang}，無需翻譯',
            boxTitle: '常駐翻譯（Alt+A 開關）',
            inputPlaceholder: '輸入/貼上文字，或點「框選」選網頁區域…',
            outputPlaceholder: '譯文會顯示在這裡',
            selectBtn: '▢ 框選',
            selectBtnTitle: '拖曳框選網頁區域進行翻譯（Alt+Q）',
            minimize: '最小化',
            resize: '拖曳調整大小',
            openBox: '📋 開啟常駐翻譯框',
            engine: '翻譯引擎',
            engineFast: '⚡ 快速（Edge/MyMemory）',
            engineGlm: '🧠 精準（GLM）',
            mmLeft: 'MM剩{n}字',
            free: '免費',
            fastBadgeTitle: '快速鏈主用 Edge（免費無限），MyMemory 兜底，每日 {limit} 字（本機統計已用）',
            glmBadgeTitle: 'GLM-4-Flash 免費，走本機後端',
            targetLang: '目標語言',
            enableSite: '✅ 在此網站啟用翻譯',
            disableSite: '🚫 在此網站停用翻譯',
            recent: '🕘 最近翻譯（{n}）',
            clickToFill: '點擊填入常駐框',
            clearHistory: '🗑 清空歷史',
            clearCache: '🗑 清理翻譯快取',
            cacheCleared: '已清理 {n} 筆快取',
            ballDisabled: '本站翻譯已停用，點擊啟用（會重新整理頁面）',
            ballSensitive: '敏感頁面，無法翻譯',
            ballTitle: '點擊：恢復常駐框/設定面板；拖曳移動；Alt+Q 框選',
            selectHint: '拖曳框選區域，Esc 返回翻譯框',
            ocrRecognizing: '識別圖片中…（首次較慢）',
            ocrFailed: 'OCR 失敗：',
            ocrNoText: '圖片裡沒有可翻譯的文字',
            captureFailed: '截圖失敗：',
            mmTooLong: '文本過長，跳過 MyMemory',
            noEngine: '無可用引擎',
            edgeNoResult: 'Edge 無結果',
            edgeBadResponse: 'Edge 回應異常',
            mmNoResult: 'MyMemory 無結果',
            mmBadResponse: 'MyMemory 回應異常',
            mmNetworkError: 'MyMemory 網路錯誤',
            glmEmpty: 'GLM 空結果',
            h2cExecFailed: '截圖庫執行失敗',
            h2cLoadFailed: '截圖庫載入失敗',
            h2cLoadTimeout: '截圖庫載入逾時',
            h2cUnavailable: '截圖庫不可用',
        },
        'ja': {
            translating: '翻訳中…',
            copyResult: 'コピー',
            close: '閉じる',
            backToSelect: '↩ 枠選択に戻る',
            backToSelectTitle: '現在の結果を閉じて、枠選択で翻訳し直します',
            errBackend: '⚠️ 翻訳サービスは一時的に利用できません。後でもう一度お試しください',
            errTimeout: '⏱ 翻訳がタイムアウトしました。もう一度お試しください',
            translateFailed: '翻訳失敗：',
            unknownError: '不明なエラー',
            sameLang: '原文は{lang}です。翻訳は不要です',
            boxTitle: '常駐翻訳（Alt+A 切替）',
            inputPlaceholder: 'テキストを入力/貼り付け、または「枠選択」でページ領域を選択…',
            outputPlaceholder: '翻訳結果がここに表示されます',
            selectBtn: '▢ 枠選択',
            selectBtnTitle: 'ページ領域をドラッグ選択して翻訳（Alt+Q）',
            minimize: '最小化',
            resize: 'ドラッグでサイズ変更',
            openBox: '📋 常駐翻訳ボックスを開く',
            engine: '翻訳エンジン',
            engineFast: '⚡ 高速（Edge/MyMemory）',
            engineGlm: '🧠 高精度（GLM）',
            mmLeft: 'MM残り{n}字',
            free: '無料',
            fastBadgeTitle: '高速チェーン：Edge（無料・無制限）優先、MyMemory をフォールバックに使用、1日 {limit} 文字（ローカル集計）',
            glmBadgeTitle: 'GLM-4-Flash は無料、ローカルバックエンド経由',
            targetLang: '対象言語',
            enableSite: '✅ このサイトで翻訳を有効化',
            disableSite: '🚫 このサイトで翻訳を無効化',
            recent: '🕘 最近の翻訳（{n}）',
            clickToFill: 'クリックで常駐ボックスに反映',
            clearHistory: '🗑 履歴をクリア',
            clearCache: '🗑 翻訳キャッシュをクリア',
            cacheCleared: '{n} 件のキャッシュを削除しました',
            ballDisabled: 'このサイトでは翻訳が無効です。クリックで有効化（ページが再読み込みされます）',
            ballSensitive: '機密ページのため翻訳できません',
            ballTitle: 'クリック：常駐ボックス/設定パネルを復元、ドラッグで移動、Alt+Q 枠選択',
            selectHint: '領域をドラッグ選択、Esc で翻訳ボックスに戻る',
            ocrRecognizing: '画像を認識中…（初回は遅めです）',
            ocrFailed: 'OCR 失敗：',
            ocrNoText: '画像に翻訳可能なテキストがありません',
            captureFailed: 'スクリーンショット失敗：',
            mmTooLong: 'テキストが長すぎるため MyMemory をスキップしました',
            noEngine: '利用可能なエンジンがありません',
            edgeNoResult: 'Edge が結果を返しませんでした',
            edgeBadResponse: 'Edge の応答が異常です',
            mmNoResult: 'MyMemory が結果を返しませんでした',
            mmBadResponse: 'MyMemory の応答が異常です',
            mmNetworkError: 'MyMemory ネットワークエラー',
            glmEmpty: 'GLM が空の結果を返しました',
            h2cExecFailed: 'スクリーンショットライブラリの実行に失敗しました',
            h2cLoadFailed: 'スクリーンショットライブラリの読み込みに失敗しました',
            h2cLoadTimeout: 'スクリーンショットライブラリの読み込みがタイムアウトしました',
            h2cUnavailable: 'スクリーンショットライブラリが利用できません',
        },
        'ko': {
            translating: '번역 중…',
            copyResult: '결과 복사',
            close: '닫기',
            backToSelect: '↩ 선택 모드로 돌아가기',
            backToSelectTitle: '현재 결과를 닫고 영역을 다시 선택하여 번역',
            errBackend: '⚠️ 번역 서비스를 일시적으로 사용할 수 없습니다. 나중에 다시 시도하세요',
            errTimeout: '⏱ 번역 시간 초과. 다시 시도하세요',
            translateFailed: '번역 실패: ',
            unknownError: '알 수 없는 오류',
            sameLang: '원문이 이미 {lang}이므로 번역할 필요가 없습니다',
            boxTitle: '번역 상자(Alt+A 전환)',
            inputPlaceholder: '텍스트를 입력/붙여넣거나 「영역 선택」으로 페이지 영역을 고르세요…',
            outputPlaceholder: '번역 결과가 여기에 표시됩니다',
            selectBtn: '▢ 영역 선택',
            selectBtnTitle: '페이지 영역을 드래그하여 선택해 번역(Alt+Q)',
            minimize: '최소화',
            resize: '드래그하여 크기 조절',
            openBox: '📋 번역 상자 열기',
            engine: '번역 엔진',
            engineFast: '⚡ 빠름(Edge/MyMemory)',
            engineGlm: '🧠 정밀(GLM)',
            mmLeft: 'MM 남음 {n}자',
            free: '무료',
            fastBadgeTitle: '빠른 체인: Edge(무료·무제한) 우선, MyMemory 대체, 일일 {limit}자(로컬 집계)',
            glmBadgeTitle: 'GLM-4-Flash 무료, 로컬 백엔드 경유',
            targetLang: '목표 언어',
            enableSite: '✅ 이 사이트에서 번역 활성화',
            disableSite: '🚫 이 사이트에서 번역 비활성화',
            recent: '🕘 최근 번역({n})',
            clickToFill: '클릭하여 상자에 채우기',
            clearHistory: '🗑 기록 지우기',
            clearCache: '🗑 번역 캐시 지우기',
            cacheCleared: '{n}개 캐시 항목 삭제됨',
            ballDisabled: '이 사이트에서 번역이 비활성화됨. 클릭하여 활성화(페이지가 새로고침됩니다)',
            ballSensitive: '민감한 페이지, 번역 불가',
            ballTitle: '클릭: 상자/설정 패널 복원, 드래그 이동, Alt+Q 영역 선택',
            selectHint: '영역을 드래그하여 선택, Esc로 번역 상자로 복귀',
            ocrRecognizing: '이미지 인식 중…(처음에는 느림)',
            ocrFailed: 'OCR 실패: ',
            ocrNoText: '이미지에 번역할 수 있는 텍스트가 없습니다',
            captureFailed: '캡처 실패: ',
            mmTooLong: '텍스트가 너무 길어 MyMemory 건너뜀',
            noEngine: '사용 가능한 엔진이 없습니다',
            edgeNoResult: 'Edge가 결과를 반환하지 않았습니다',
            edgeBadResponse: 'Edge 응답이 비정상입니다',
            mmNoResult: 'MyMemory가 결과를 반환하지 않았습니다',
            mmBadResponse: 'MyMemory 응답이 비정상입니다',
            mmNetworkError: 'MyMemory 네트워크 오류',
            glmEmpty: 'GLM이 빈 결과를 반환했습니다',
            h2cExecFailed: '스크린샷 라이브러리 실행 실패',
            h2cLoadFailed: '스크린샷 라이브러리 로드 실패',
            h2cLoadTimeout: '스크린샷 라이브러리 로드 시간 초과',
            h2cUnavailable: '스크린샷 라이브러리를 사용할 수 없습니다',
        },
    };
    function t(key, vars) {
        const ui = UI_LANG_MAP[getLang()] || 'en';
        const table = I18N[ui] || I18N.en;
        let s = (table[key] !== undefined) ? table[key] : (I18N.en[key] !== undefined ? I18N.en[key] : key);
        if (vars) {
            for (const k in vars) s = s.split('{' + k + '}').join(String(vars[k]));
        }
        return s;
    }

    // ---------- Sensitive pages / per-site switch ----------
    const SENSITIVE_HOSTS = [
        'icbc', 'cmbchina', 'ccb', 'abchina', 'boc', 'paypal', 'alipay', 'tmall', 'taobao',
        'mail.', 'outlook', 'gmail', 'proton', 'bank', 'zhifubao', 'wechat', 'weixin',
        'spdb', 'cmbc', 'citic', 'hxb', 'psdbc',
    ];
    function isSensitive() {
        const h = location.hostname.toLowerCase();
        return SENSITIVE_HOSTS.some(s => h.includes(s));
    }
    // localStorage is isolated per domain; storing '1' disables this site
    function siteDisabled() { return localStorage.getItem('gz_site_disabled') === '1'; }

    // ---------- Language detection (same-language skip + MyMemory source language) ----------
    // Ratio-based: a script counts as that language only when its chars outnumber Latin letters,
    // avoiding a single hanzi/hidden char skipping the whole segment.
    function detectLang(t) {
        const latin = (t.match(/[A-Za-z]/g) || []).length;
        const kana = (t.match(/[\u3040-\u30ff]/g) || []).length;
        const hangul = (t.match(/[가-힣]/g) || []).length;
        const han = (t.match(/[\u4e00-\u9fff]/g) || []).length;
        if (kana > 0 && kana + han > latin) return 'ja'; // kana first (Japanese also contains hanzi)
        if (hangul > latin) return 'ko';
        if (han > latin) return 'zh';
        return 'en';
    }
    function isSameLang(detected, target) { return TARGET_ROOT[target] === detected; }

    // ---------- Code block detection ----------
    function inCode(el) {
        return el && el.closest && el.closest(
            'pre, code, .highlight, .blob-code, .js-file-line, .react-blob-print-hide, ' +
            '.syntaxhighlighter, .code-block, .CodeMirror, .hljs, ' +
            'table.diff, .diff-table, .prettyprint, .chroma, kbd, samp'
        );
    }

    // ---------- Cache ----------
    function cacheKey(text, lang, engine) { return engine + '::' + lang + '::' + text; }
    function readCache(text, lang, engine) {
        try { return localStorage.getItem('gz_c_' + btoa(unescape(encodeURIComponent(cacheKey(text, lang, engine))))); }
        catch (e) { return null; }
    }
    function writeCache(text, lang, engine, t) {
        try { localStorage.setItem('gz_c_' + btoa(unescape(encodeURIComponent(cacheKey(text, lang, engine)))), t); } catch (e) {}
    }
    function parseCacheVal(v) {
        if (typeof v === 'string' && v.startsWith('D::')) {
            try { return { ok: true, dict: JSON.parse(v.slice(3)) }; } catch (e) {}
        }
        return { ok: true, text: v };
    }
    function clearCache() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('gz_c_')) keys.push(k);
        }
        keys.forEach(k => localStorage.removeItem(k));
        return keys.length;
    }

    // ---------- Translation history (GM storage, shared across sites, max 50) ----------
    function pushHistory(text, resultText) {
        try {
            const list = JSON.parse(GM_getValue(LS_HISTORY, '[]'));
            list.unshift({ t: text.slice(0, 200), r: (resultText || '').slice(0, 400), u: location.hostname, ts: Date.now() });
            GM_setValue(LS_HISTORY, JSON.stringify(list.slice(0, 50)));
        } catch (e) {}
    }
    function getHistory() {
        try { return JSON.parse(GM_getValue(LS_HISTORY, '[]')); } catch (e) { return []; }
    }
    function clearHistory() { try { GM_setValue(LS_HISTORY, '[]'); } catch (e) {} }

    // ---------- Translation engines (unified result: {ok, text, dict?, err}) ----------
    function callMs(text, targetLang) { // Edge free engine via the local backend, source language auto-detected
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'POST', url: API + '/translate_ms',
                headers: { 'Content-Type': 'application/json', 'X-Access-Token': API_TOKEN },
                data: JSON.stringify({ segments: { s0: text }, target_lang: targetLang }),
                timeout: 15000,
                onload: (res) => {
                    try {
                        const t = (JSON.parse(res.responseText).translated || {}).s0 || '';
                        resolve(t ? { ok: true, text: t } : { ok: false, err: t('edgeNoResult') });
                    } catch (e) { resolve({ ok: false, err: t('edgeBadResponse') }); }
                },
                onerror: () => resolve({ ok: false, err: 'backend-down' }),
                ontimeout: () => resolve({ ok: false, err: 'timeout' }),
            });
        });
    }
    // ---------- MyMemory daily quota (50k chars/day with email, counted locally) ----------
    const MM_DAILY_LIMIT = 50000;
    function mmKey() {
        const d = new Date();
        return 'gz_mm_usage_' + d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    }
    function mmUsedToday() {
        try { return parseInt(localStorage.getItem(mmKey()) || '0', 10) || 0; } catch (e) { return 0; }
    }
    function addMmUsage(chars) {
        try {
            localStorage.setItem(mmKey(), String(mmUsedToday() + chars));
            Object.keys(localStorage).forEach(k => {
                if (k.indexOf('gz_mm_usage_') === 0 && k !== mmKey()) localStorage.removeItem(k);
            });
        } catch (e) {}
    }
    function callFast(text, targetLang) { // MyMemory: source language from detection; long text skipped (q limit 500 bytes)
        return new Promise((resolve) => {
            const bytes = new TextEncoder().encode(text).length;
            if (bytes > 480) { resolve({ ok: false, err: t('mmTooLong') }); return; }
            const src = detectLang(text) === 'zh' ? 'zh-CN' : detectLang(text);
            const tl = LANG_CODE_MAP[targetLang] || 'zh-CN';
            const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) +
                '&langpair=' + src + '|' + tl + '&de=' + MYMEMORY_DE;
            GM_xmlhttpRequest({
                method: 'GET', url: url, timeout: 10000,
                onload: (res) => {
                    try {
                        const j = JSON.parse(res.responseText);
                        const t = j.responseData && j.responseData.translatedText || '';
                        if (t && t !== text) { addMmUsage(text.length); resolve({ ok: true, text: t }); }
                        else resolve({ ok: false, err: t('mmNoResult') });
                    } catch (e) { resolve({ ok: false, err: t('mmBadResponse') }); }
                },
                onerror: () => resolve({ ok: false, err: t('mmNetworkError') }),
                ontimeout: () => resolve({ ok: false, err: 'timeout' }),
            });
        });
    }
    function callGlm(text, targetLang, onDelta) { // GLM streaming (SSE), onDelta(accumulated text)
        return new Promise((resolve) => {
            let consumed = 0, buf = '', acc = '', settled = false;
            GM_xmlhttpRequest({
                method: 'POST', url: API + '/translate_stream',
                headers: { 'Content-Type': 'application/json', 'X-Access-Token': API_TOKEN },
                data: JSON.stringify({ text: text, target_lang: targetLang }),
                timeout: 60000, fetch: true,
                onprogress: (res) => {
                    const full = res.responseText || '';
                    buf += full.slice(consumed);
                    consumed = full.length;
                    const lines = buf.split('\n');
                    buf = lines.pop();
                    for (const line of lines) {
                        const s = line.trim();
                        if (!s.startsWith('data:')) continue;
                        try {
                            const j = JSON.parse(s.slice(5).trim());
                            if (j.error) { if (!settled) { settled = true; resolve({ ok: false, err: 'GLM: ' + j.error }); } return; }
                            if (j.delta) { acc += j.delta; if (onDelta) onDelta(acc); }
                            if (j.done && !settled) { settled = true; resolve(acc ? { ok: true, text: acc } : { ok: false, err: t('glmEmpty') }); }
                        } catch (e) {}
                    }
                },
                onload: () => { if (!settled) { settled = true; resolve(acc ? { ok: true, text: acc } : { ok: false, err: t('glmEmpty') }); } },
                onerror: () => { if (!settled) { settled = true; resolve({ ok: false, err: 'backend-down' }); } },
                ontimeout: () => { if (!settled) { settled = true; resolve({ ok: false, err: 'timeout' }); } },
            });
        });
    }
    function callDefine(word, targetLang) { // Dictionary mode
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'POST', url: API + '/define',
                headers: { 'Content-Type': 'application/json', 'X-Access-Token': API_TOKEN },
                data: JSON.stringify({ word: word, target_lang: targetLang }),
                timeout: 30000,
                onload: (res) => {
                    try {
                        const j = JSON.parse(res.responseText);
                        if (j.define) resolve({ ok: true, dict: j.define });
                        else resolve({ ok: false, err: j.error || 'not found' });
                    } catch (e) { resolve({ ok: false, err: 'bad response' }); }
                },
                onerror: () => resolve({ ok: false, err: 'backend-down' }),
                ontimeout: () => resolve({ ok: false, err: 'timeout' }),
            });
        });
    }

    // Engine fallback chain: fast = Edge -> MyMemory -> GLM; accurate = GLM -> Edge -> MyMemory
    async function translate(text, targetLang, onDelta) {
        const chain = getEngine() === 'fast' ? ['ms', 'fast', 'glm'] : ['glm', 'ms', 'fast'];
        let lastErr = t('noEngine');
        for (const eng of chain) {
            const r = eng === 'glm' ? await callGlm(text, targetLang, onDelta)
                : eng === 'ms' ? await callMs(text, targetLang)
                    : await callFast(text, targetLang);
            if (r && r.ok) return r;
            if (r && r.err) lastErr = r.err;
        }
        return { ok: false, err: lastErr };
    }
    function friendlyError(err) {
        if (err === 'backend-down') return t('errBackend');
        if (err === 'timeout') return t('errTimeout');
        return t('translateFailed') + (err || t('unknownError'));
    }

    // ---------- Dictionary mode detection ----------
    const WORD_RE = /^[A-Za-z][A-Za-z''-]*(\s+[A-Za-z][A-Za-z''-]*){0,2}$/;
    function isDictWord(t) {
        return t.length <= 40 && !/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(t) && WORD_RE.test(t);
    }
    function dictToText(d) {
        const lines = [(d.word || '') + (d.phonetic ? '  /' + d.phonetic + '/' : '')];
        (d.senses || []).forEach(s => lines.push((s.pos ? s.pos + ' ' : '') + (s.meaning || '')));
        (d.examples || []).forEach(x => lines.push('· ' + (x.en || '') + '\n  ' + (x.zh || '')));
        return lines.filter(Boolean).join('\n');
    }

    // ---------- Translation box visibility ----------
    function isBoxVisible() {
        const b = document.getElementById('gz-tbox');
        return b && b.style.display !== 'none';
    }
    function setBoxOutput(text) {
        const out = document.querySelector('#gz-tbox .gz-tbox-output');
        if (out) { out.textContent = text; out.scrollTop = out.scrollHeight; }
    }

    // ---------- Bubble (used when the box is hidden; draggable, copyable; stays until × is clicked) ----------
    let bubble = null;
    let bubbleToken = 0;
    let bubbleResultText = '';
    let bubbleNeedPos = false; // re-position on the first frame of a new job (keep position during streaming)

    function ensureBubble() {
        if (bubble) return bubble;
        bubble = document.createElement('div');
        bubble.id = 'gz-bubble';
        bubble.style.cssText = 'position:fixed;z-index:2147483647;max-width:380px;min-width:120px;padding:10px 40px 10px 28px;background:#fff;color:#1f2328;border:1px solid #d0d7de;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.18);font-family:system-ui,sans-serif;font-size:13px;line-height:1.55;display:none;cursor:grab;';
        const grip = document.createElement('span');
        grip.textContent = '≡';
        grip.style.cssText = 'position:absolute;left:8px;top:50%;transform:translateY(-50%);color:#8b949e;cursor:grab;';
        bubble.appendChild(grip);
        const copy = document.createElement('span');
        copy.className = 'gz-b-copy';
        copy.textContent = '📋';
        copy.title = t('copyResult');
        copy.style.cssText = 'position:absolute;top:3px;right:24px;cursor:pointer;font-size:12px;line-height:1;';
        copy.addEventListener('mousedown', (e) => e.stopPropagation());
        copy.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!bubbleResultText) return;
            GM_setClipboard(bubbleResultText);
            copy.textContent = '✓';
            setTimeout(() => { copy.textContent = '📋'; }, 1200);
        });
        bubble.appendChild(copy);
        const close = document.createElement('span');
        close.className = 'gz-b-close';
        close.textContent = '×';
        close.title = t('close');
        close.style.cssText = 'position:absolute;top:2px;right:8px;cursor:pointer;color:#8b949e;font-size:14px;line-height:1;';
        close.addEventListener('mousedown', (e) => { e.stopPropagation(); hideBubble(); });
        bubble.appendChild(close);
        const body = document.createElement('div');
        body.className = 'gz-bubble-body';
        body.style.maxHeight = '55vh';
        body.style.overflowY = 'auto';
        bubble.appendChild(body);
        const foot = document.createElement('div');
        foot.style.cssText = 'margin-top:6px;padding-top:6px;border-top:1px solid #eaeef2;display:flex;justify-content:flex-end;align-items:center;';
        const backBtn = document.createElement('span');
        backBtn.className = 'gz-b-back';
        backBtn.textContent = t('backToSelect');
        backBtn.title = t('backToSelectTitle');
        backBtn.style.cssText = 'cursor:pointer;color:#0969da;font-size:12px;user-select:none;';
        backBtn.addEventListener('mousedown', (e) => e.stopPropagation());
        backBtn.addEventListener('click', (e) => { e.stopPropagation(); hideBubble(); startSelectMode(); });
        foot.appendChild(backBtn);
        bubble.appendChild(foot);
        document.body.appendChild(bubble);

        let dragging = false, sx = 0, sy = 0, sl = 0, st = 0;
        bubble.addEventListener('mousedown', (e) => {
            if (e.target === close || e.target === copy || e.target === backBtn) return;
            dragging = true;
            const r = bubble.getBoundingClientRect();
            sx = e.clientX; sy = e.clientY; sl = r.left; st = r.top;
            bubble.style.cursor = 'grabbing';
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            bubble.style.left = Math.max(0, Math.min(window.innerWidth - 60, sl + e.clientX - sx)) + 'px';
            bubble.style.top = Math.max(0, Math.min(window.innerHeight - 60, st + e.clientY - sy)) + 'px';
        });
        document.addEventListener('mouseup', () => { if (dragging) { dragging = false; bubble.style.cursor = 'grab'; } });

        return bubble;
    }

    function positionBubble(b, rect) {
        const r = rect || { left: window.innerWidth / 2 - 100, right: window.innerWidth / 2 + 100, top: 60, bottom: 80 };
        const rw = (r.width != null) ? r.width : Math.max(0, (r.right || r.left) - r.left);
        const rh = (r.height != null) ? r.height : Math.max(0, (r.bottom || r.top) - r.top);
        const bw = b.offsetWidth, bh = b.offsetHeight;
        let left = Math.round(r.left + rw / 2 - bw / 2);
        let top = (r.bottom || 80) + 8;
        if (top + bh > window.innerHeight - 8) top = (r.top || 60) - bh - 8; // flip above if no room below
        // fallback clamping: never leave the screen
        top = Math.max(8, Math.min(window.innerHeight - bh - 8, top));
        left = Math.max(8, Math.min(window.innerWidth - bw - 8, left));
        b.style.left = left + 'px';
        b.style.top = top + 'px';
    }
    function clampBubble(b) { // when content grows, only clamp against overflow; keep the anchor position
        const bw = b.offsetWidth, bh = b.offsetHeight;
        const curL = parseInt(b.style.left, 10) || 8, curT = parseInt(b.style.top, 10) || 8;
        b.style.left = Math.max(8, Math.min(window.innerWidth - bw - 8, curL)) + 'px';
        b.style.top = Math.max(8, Math.min(window.innerHeight - bh - 8, curT)) + 'px';
    }
    function showBubbleText(rect, text) {
        const b = ensureBubble();
        const needPos = b.style.display !== 'block' || bubbleNeedPos;
        b.querySelector('.gz-bubble-body').textContent = text;
        bubbleResultText = text;
        b.style.display = 'block';
        if (needPos) positionBubble(b, rect); else clampBubble(b);
        bubbleNeedPos = false;
    }
    function showBubbleDict(rect, d) {
        const b = ensureBubble();
        const body = b.querySelector('.gz-bubble-body');
        body.textContent = '';
        const title = document.createElement('div');
        title.style.cssText = 'font-size:16px;font-weight:600;color:#0969da;';
        title.textContent = d.word || '';
        body.appendChild(title);
        if (d.phonetic) {
            const ph = document.createElement('div');
            ph.style.cssText = 'color:#8b949e;font-size:12px;margin-bottom:6px;';
            ph.textContent = '/' + d.phonetic + '/';
            body.appendChild(ph);
        }
        (d.senses || []).slice(0, 4).forEach(s => {
            const line = document.createElement('div');
            line.style.marginBottom = '2px';
            if (s.pos) {
                const pos = document.createElement('span');
                pos.style.cssText = 'color:#0969da;font-weight:600;margin-right:4px;';
                pos.textContent = s.pos;
                line.appendChild(pos);
            }
            line.appendChild(document.createTextNode(s.meaning || ''));
            body.appendChild(line);
        });
        (d.examples || []).slice(0, 2).forEach(x => {
            const ex = document.createElement('div');
            ex.style.cssText = 'margin-top:6px;padding-top:6px;border-top:1px dashed #eaeef2;color:#57606a;font-size:12px;';
            ex.textContent = '· ' + (x.en || '');
            const tr = document.createElement('div');
            tr.style.cssText = 'color:#8b949e;margin-left:10px;';
            tr.textContent = x.zh || '';
            ex.appendChild(tr);
            body.appendChild(ex);
        });
        bubbleResultText = dictToText(d);
        const needPos = b.style.display !== 'block' || bubbleNeedPos;
        b.style.display = 'block';
        if (needPos) positionBubble(b, rect); else clampBubble(b);
        bubbleNeedPos = false;
    }
    function hideBubble() {
        if (bubble) bubble.style.display = 'none';
        bubbleToken++;
    }

    // Unified result display: write into the box if visible, otherwise show the bubble
    function showResult(rect, val) {
        if (isBoxVisible()) {
            if (typeof val === 'string') setBoxOutput(val);
            else setBoxOutput(val.dict ? dictToText(val.dict) : (val.text || ''));
            return;
        }
        if (typeof val === 'string') { showBubbleText(rect, val); return; }
        if (val.dict) showBubbleDict(rect, val.dict);
        else showBubbleText(rect, val.text || '');
    }
    function showLoading(rect) {
        bubbleNeedPos = true; // new job first frame: re-anchor the bubble next to the selection
        showResult(rect, t('translating'));
    }

    // ---------- Unified translation job (same-lang skip -> cache -> dictionary -> fallback chain) ----------
    async function doTranslateJob(text, rect, myToken, opts = {}) {
        const lang = getLang(), engine = getEngine();
        if (isSameLang(detectLang(text), lang)) {
            if (myToken === bubbleToken) showResult(rect, t('sameLang', { lang: lang }));
            return;
        }
        showLoading(rect);
        const hit = readCache(text, lang, engine);
        if (hit) {
            if (myToken === bubbleToken) showResult(rect, parseCacheVal(hit));
            return;
        }
        if (isDictWord(text)) {
            const d = await callDefine(text, lang);
            if (d.ok) {
                writeCache(text, lang, engine, 'D::' + JSON.stringify(d.dict));
                pushHistory(text, dictToText(d.dict));
                if (myToken === bubbleToken) showResult(rect, { ok: true, dict: d.dict });
                return;
            }
            // dictionary unavailable -> fall through to normal translation
        }
        const onDelta = opts.stream ? (acc) => { if (myToken === bubbleToken) showResult(rect, { ok: true, text: acc }); } : null;
        const r = await translate(text, lang, onDelta);
        if (myToken !== bubbleToken) return;
        if (r.ok) {
            writeCache(text, lang, engine, r.text);
            pushHistory(text, r.text);
            showResult(rect, r);
        } else {
            showResult(rect, friendlyError(r.err));
        }
    }

    // ---------- Selection translation ----------
    document.addEventListener('mouseup', async (e) => {
        if (isSensitive() || siteDisabled()) return;
        if (selectMode) return;
        if (e.target.closest && e.target.closest('#gz-ball, #gz-lang-panel, #gz-bubble, #gz-tbox')) return;

        setTimeout(async () => {
            const sel = window.getSelection();
            const text = (sel.toString() || '').trim();
            if (text.length < 2 || text.length > MAX_LEN) return;

            const range = sel.getRangeAt(0);
            const anchor = range.startContainer.nodeType === 3
                ? range.startContainer.parentElement : range.startContainer;
            if (inCode(anchor)) { hideBubble(); return; }

            const rect = range.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) return;

            const myToken = ++bubbleToken;
            await doTranslateJob(text, rect, myToken, { stream: true });
        }, 80);
    });

    // The bubble persists: clicking the page or scrolling does not dismiss it; only the top-right × or "↩ Back to select" closes it

    // ---------- Shortcuts: Alt+Q region select / Alt+A toggle the translation box ----------
    document.addEventListener('keydown', (e) => {
        if (isSensitive() || siteDisabled()) return;
        if (!e.altKey || e.ctrlKey || e.shiftKey || e.metaKey) return;
        const k = e.key.toLowerCase();
        if (k === 'q') {
            e.preventDefault();
            if (!selectMode) { const b = document.getElementById('gz-tbox'); if (b) b.style.display = 'none'; startSelectMode(); }
        } else if (k === 'a') {
            e.preventDefault();
            const b = document.getElementById('gz-tbox');
            if (b && b.style.display !== 'none') { b.style.display = 'none'; localStorage.setItem(LS_TBOX_OPEN, '0'); }
            else if (window.__gzShowBox) window.__gzShowBox();
        }
    });

    // ---------- Region select translation ----------
    let selectMode = false;
    let selStart = { x: 0, y: 0 };
    let selOverlay = null, selRectBox = null, selHint = null;

    function exitSelectMode() {
        selectMode = false;
        document.body.style.cursor = '';
        if (selOverlay) { selOverlay.remove(); selOverlay = null; }
        if (selRectBox) { selRectBox.remove(); selRectBox = null; }
        if (selHint) { selHint.remove(); selHint = null; }
        document.removeEventListener('mousedown', onSelectMouseDown, true);
        document.removeEventListener('keydown', onSelectKeyDown);
        // after cancelling a selection, return to the translation box (type text or select again)
        const tbox = document.getElementById('gz-tbox');
        if (tbox && tbox.style.display === 'none') window.__gzShowBox();
    }
    function onSelectKeyDown(e) { if (e.key === 'Escape') exitSelectMode(); }

    function extractTextInRect(rect) {
        function point(x, y) {
            if (document.caretPositionFromPoint) {
                const p = document.caretPositionFromPoint(x, y);
                return p ? { node: p.offsetNode, offset: p.offset } : null;
            }
            if (document.caretRangeFromPoint) {
                const r = document.caretRangeFromPoint(x, y);
                return r ? { node: r.startContainer, offset: r.startOffset } : null;
            }
            return null;
        }
        const s = point(rect.left + 2, rect.top + 2);
        const e = point(rect.right - 2, rect.bottom - 2);
        if (!s || !e) return '';
        const range = document.createRange();
        try { range.setStart(s.node, s.offset); range.setEnd(e.node, e.offset); }
        catch (err) { return ''; }

        // range.toString() cannot be used directly: it would include hidden content
        // (style/script etc.) between the two DOM points. Use a TreeWalker to collect
        // only the text nodes that are actually rendered inside the selection.
        const root = range.commonAncestorContainer.nodeType === 3
            ? range.commonAncestorContainer.parentElement : range.commonAncestorContainer;
        if (!root || !root.querySelectorAll) return range.toString();
        const SKIP = 'style, script, noscript, template, iframe, svg, canvas';
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                const v = node.nodeValue;
                if (!v || !v.trim()) return NodeFilter.FILTER_REJECT;
                if (!range.intersectsNode(node)) return NodeFilter.FILTER_REJECT;
                const el = node.parentElement;
                if (!el || (el.closest && el.closest(SKIP))) return NodeFilter.FILTER_REJECT;
                // elements that are not rendered (display:none etc.) have empty getClientRects
                if (!el.getClientRects || el.getClientRects().length === 0) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        let text = '', node;
        while ((node = walker.nextNode())) text += node.nodeValue + ' ';
        return text.replace(/\s+/g, ' ').trim();
    }

    // html2canvas lazy load: fetch the script via GM and run it in the sandbox (bypasses GitHub CSP etc.);
    // loaded on demand, not on every page
    let h2cLoading = null;
    function loadHtml2Canvas() {
        if (typeof html2canvas === 'function') return Promise.resolve();
        if (h2cLoading) return h2cLoading;
        h2cLoading = new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
                timeout: 20000,
                onload: (res) => {
                    try { new Function(res.responseText)(); resolve(); }
                    catch (e) { reject(new Error(t('h2cExecFailed'))); }
                },
                onerror: () => reject(new Error(t('h2cLoadFailed'))),
                ontimeout: () => reject(new Error(t('h2cLoadTimeout'))),
            });
        });
        return h2cLoading;
    }
    async function captureRect(rect) {
        await loadHtml2Canvas();
        if (typeof html2canvas !== 'function') throw new Error(t('h2cUnavailable'));
        return new Promise((resolve, reject) => {
            html2canvas(document.body, {
                x: rect.left, y: rect.top,
                width: rect.right - rect.left, height: rect.bottom - rect.top,
                useCORS: true, backgroundColor: '#ffffff', logging: false,
            }).then(canvas => resolve(canvas.toDataURL('image/png'))).catch(reject);
        });
    }

    function onSelectMouseDown(e) {
        if (e.button !== 0) return;
        if (e.target.closest && e.target.closest('#gz-tbox, #gz-ball, #gz-lang-panel, #gz-bubble')) return;

        e.preventDefault(); e.stopPropagation();
        selStart = { x: e.clientX, y: e.clientY };

        selOverlay = document.createElement('div');
        selOverlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,0.25);cursor:crosshair;';
        selRectBox = document.createElement('div');
        selRectBox.style.cssText = 'position:fixed;z-index:2147483647;border:1px solid #0969da;background:rgba(9,105,218,0.12);pointer-events:none;';
        document.body.appendChild(selOverlay);
        document.body.appendChild(selRectBox);

        function onMove(ev) {
            selRectBox.style.left = Math.min(selStart.x, ev.clientX) + 'px';
            selRectBox.style.top = Math.min(selStart.y, ev.clientY) + 'px';
            selRectBox.style.width = Math.abs(ev.clientX - selStart.x) + 'px';
            selRectBox.style.height = Math.abs(ev.clientY - selStart.y) + 'px';
        }
        async function onUp(ev) {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            const selLeft = Math.min(selStart.x, ev.clientX), selTop = Math.min(selStart.y, ev.clientY);
            const selRight = Math.max(selStart.x, ev.clientX), selBottom = Math.max(selStart.y, ev.clientY);
            const rect = {
                left: selLeft, top: selTop, right: selRight, bottom: selBottom,
                width: selRight - selLeft, height: selBottom - selTop,
            };
            const tooSmall = (rect.right - rect.left) < 4 || (rect.bottom - rect.top) < 4;
            selOverlay.remove(); selOverlay = null;
            selRectBox.remove(); selRectBox = null;
            exitSelectMode();
            if (tooSmall) return;

            const myToken = ++bubbleToken;
            const text = extractTextInRect(rect).trim();

            if (text) {
                await doTranslateJob(text, rect, myToken, { stream: true });
                return;
            }

            // DOM could not grab text -> screenshot and OCR
            showResult(rect, t('ocrRecognizing'));
            try {
                const dataUrl = await captureRect(rect);
                if (myToken !== bubbleToken) return;
                const r = await callOcr(dataUrl, getLang());
                if (myToken !== bubbleToken) return;
                if (r.translated) {
                    if (isSameLang(detectLang(r.translated), getLang())) showResult(rect, t('sameLang', { lang: getLang() }));
                    else { pushHistory(r.text || r.translated, r.translated); showResult(rect, r.translated); }
                }
                else if (r.error) showResult(rect, t('ocrFailed') + r.error);
                else showResult(rect, t('ocrNoText'));
            } catch (err) {
                if (myToken === bubbleToken) showResult(rect, t('captureFailed') + (err.message || err));
            }
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    function startSelectMode() {
        if (isSensitive() || siteDisabled() || selectMode) return;
        selectMode = true;
        hideBubble(); // hide the old result when entering select mode so it does not block the selection
        document.body.style.cursor = 'crosshair';
        selHint = document.createElement('div');
        selHint.style.cssText = 'position:fixed;z-index:2147483647;top:16px;left:50%;transform:translateX(-50%);padding:8px 16px;background:#1f2328;color:#fff;border-radius:20px;font-family:system-ui,sans-serif;font-size:13px;box-shadow:0 4px 14px rgba(0,0,0,.25);';
        selHint.textContent = t('selectHint');
        document.body.appendChild(selHint);
        document.addEventListener('mousedown', onSelectMouseDown, true);
        document.addEventListener('keydown', onSelectKeyDown);
    }

    function callOcr(dataUrl, targetLang) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'POST', url: API + '/ocr',
                headers: { 'Content-Type': 'application/json', 'X-Access-Token': API_TOKEN },
                data: JSON.stringify({ image: dataUrl, target_lang: targetLang }),
                timeout: 120000,
                onload: (res) => {
                    try {
                        const j = JSON.parse(res.responseText);
                        resolve({ text: j.text || '', translated: j.translated || '', error: j.error || '' });
                    } catch (e) { resolve({ text: '', translated: '', error: 'bad response' }); }
                },
                onerror: () => resolve({ text: '', translated: '', error: 'network' }),
                ontimeout: () => resolve({ text: '', translated: '', error: 'timeout' }),
            });
        });
    }

    // ---------- Persistent translation box ----------
    function buildTranslateBox() {
        if (isSensitive() || siteDisabled()) return;
        if (document.getElementById('gz-tbox')) return;

        const box = document.createElement('div');
        box.id = 'gz-tbox';
        box.style.cssText = 'position:fixed;z-index:2147483647;width:300px;background:#fff;border:1px solid #d0d7de;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.18);font-family:system-ui,sans-serif;font-size:13px;display:flex;flex-direction:column;';

        const savedX = parseInt(localStorage.getItem(LS_TBOX_X) || 'NaN', 10);
        const savedY = parseInt(localStorage.getItem(LS_TBOX_Y) || 'NaN', 10);
        const vw = window.innerWidth, vh = window.innerHeight;
        if (!isNaN(savedX) && !isNaN(savedY) && savedX > 0 && savedY > 0 && savedX < vw - 100 && savedY < vh - 100) {
            box.style.left = savedX + 'px';
            box.style.top = savedY + 'px';
        } else {
            box.style.left = Math.max(8, (vw - 300) / 2) + 'px';
            box.style.top = Math.max(8, vh * 0.25) + 'px';
        }
        // toggle state shared across pages: once minimized it never auto-shows until opened manually (ball/Alt+A)
        box.style.display = localStorage.getItem(LS_TBOX_OPEN) === '0' ? 'none' : 'flex';

        const titleBar = document.createElement('div');
        titleBar.style.cssText = 'display:flex;align-items:center;padding:7px 12px;border-bottom:1px solid #eaeef2;font-weight:600;cursor:move;user-select:none;';
        const titleText = document.createElement('span');
        titleText.className = 'gz-tbox-title';
        titleText.textContent = t('boxTitle');
        titleBar.appendChild(titleText);

        const copyBtn = document.createElement('span');
        copyBtn.className = 'gz-tbox-copy';
        copyBtn.textContent = '📋';
        copyBtn.title = t('copyResult');
        copyBtn.style.cssText = 'margin-left:auto;cursor:pointer;font-size:13px;padding:0 6px;';
        copyBtn.addEventListener('click', () => {
            const t = output.textContent;
            if (!t || t === t('outputPlaceholder') || t === t('translating')) return;
            GM_setClipboard(t);
            copyBtn.textContent = '✓';
            setTimeout(() => { copyBtn.textContent = '📋'; }, 1200);
        });
        titleBar.appendChild(copyBtn);

        const rectBtn = document.createElement('button');
        rectBtn.className = 'gz-tbox-rect';
        rectBtn.textContent = t('selectBtn');
        rectBtn.title = t('selectBtnTitle');
        rectBtn.style.cssText = 'margin-right:6px;padding:2px 8px;border:1px solid #d0d7de;background:#f6f8fa;color:#0969da;border-radius:5px;cursor:pointer;font-size:12px;font-family:inherit;';
        rectBtn.addEventListener('click', () => { box.style.display = 'none'; startSelectMode(); });
        titleBar.appendChild(rectBtn);

        const miniBtn = document.createElement('span');
        miniBtn.className = 'gz-tbox-mini';
        miniBtn.textContent = '－';
        miniBtn.title = t('minimize');
        miniBtn.style.cssText = 'cursor:pointer;color:#8b949e;font-size:16px;line-height:1;padding:0 4px;';
        miniBtn.addEventListener('click', () => {
            box.style.display = 'none';
            localStorage.setItem(LS_TBOX_OPEN, '0'); // after minimizing, no page auto-shows it
        });
        titleBar.appendChild(miniBtn);
        box.appendChild(titleBar);

        const input = document.createElement('textarea');
        input.placeholder = t('inputPlaceholder');
        input.style.cssText = 'box-sizing:border-box;width:100%;height:70px;padding:10px;border:none;outline:none;resize:none;font-family:inherit;font-size:13px;line-height:1.5;color:#1f2328;';
        box.appendChild(input);

        const output = document.createElement('div');
        output.className = 'gz-tbox-output';
        output.style.cssText = 'padding:10px 12px;border-top:1px solid #eaeef2;background:#f6f8fa;max-height:140px;overflow:auto;line-height:1.55;color:#1f2328;white-space:pre-wrap;word-break:break-word;min-height:40px;';
        output.textContent = t('outputPlaceholder');
        box.appendChild(output);

        document.body.appendChild(box);

        // Resize: bottom-right handle, width 220~640, input height 50~400, output height follows, size remembered
        function applySize(w, inH) {
            box.style.width = w + 'px';
            input.style.height = inH + 'px';
            output.style.maxHeight = Math.max(140, inH) + 'px';
        }
        const savedW = parseInt(localStorage.getItem('gz_tbox_w') || 'NaN', 10);
        const savedIH = parseInt(localStorage.getItem('gz_tbox_h') || 'NaN', 10);
        if (!isNaN(savedW) && savedW >= 220 && savedW <= 640) box.style.width = savedW + 'px';
        if (!isNaN(savedIH) && savedIH >= 50 && savedIH <= 400) applySize(isNaN(savedW) ? 300 : savedW, savedIH);

        const resizer = document.createElement('div');
        resizer.className = 'gz-tbox-resizer';
        resizer.textContent = '⌟';
        resizer.title = t('resize');
        resizer.style.cssText = 'position:absolute;right:2px;bottom:0;width:16px;height:16px;cursor:nwse-resize;color:#8b949e;font-size:13px;line-height:16px;text-align:center;user-select:none;';
        box.appendChild(resizer);
        let rez = false, rx = 0, ry = 0, rw = 0, rh = 0;
        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault(); e.stopPropagation();
            rez = true;
            const r = box.getBoundingClientRect();
            rx = e.clientX; ry = e.clientY; rw = r.width; rh = input.offsetHeight;
        });
        document.addEventListener('mousemove', (e) => {
            if (!rez) return;
            const w = Math.min(640, Math.max(220, rw + e.clientX - rx));
            const h = Math.min(400, Math.max(50, rh + e.clientY - ry));
            applySize(w, h);
        });
        document.addEventListener('mouseup', () => {
            if (!rez) return;
            rez = false;
            localStorage.setItem('gz_tbox_w', String(parseInt(box.style.width, 10) || 300));
            localStorage.setItem('gz_tbox_h', String(parseInt(input.style.height, 10) || 70));
        });

        let dragging = false, sx = 0, sy = 0, sl = 0, st = 0;
        titleBar.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target === miniBtn || e.target === copyBtn) return;
            dragging = true;
            const r = box.getBoundingClientRect();
            sx = e.clientX; sy = e.clientY; sl = r.left; st = r.top;
            titleBar.style.cursor = 'grabbing';
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            box.style.left = Math.max(0, Math.min(vw - 60, sl + e.clientX - sx)) + 'px';
            box.style.top = Math.max(0, Math.min(vh - 60, st + e.clientY - sy)) + 'px';
        });
        document.addEventListener('mouseup', () => {
            if (!dragging) return;
            dragging = false;
            titleBar.style.cursor = 'move';
            localStorage.setItem(LS_TBOX_X, box.style.left);
            localStorage.setItem(LS_TBOX_Y, box.style.top);
        });

        let timer = null;
        input.addEventListener('input', () => {
            clearTimeout(timer);
            const text = input.value.trim();
            if (!text) { output.textContent = t('outputPlaceholder'); return; }
            timer = setTimeout(async () => {
                await doTranslateJob(text, null, ++bubbleToken, { stream: true });
            }, 400);
        });

        window.__gzShowBox = function () {
            box.style.display = 'flex';
            localStorage.setItem(LS_TBOX_OPEN, '1'); // once opened manually, all pages keep it visible
            input.focus();
        };
    }

    // ---------- Floating ball ----------
    function buildBall() {
        if (document.getElementById('gz-ball')) return;

        const ball = document.createElement('div');
        ball.id = 'gz-ball';
        ball.style.cssText = 'position:fixed;z-index:2147483647;width:44px;height:44px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;font-family:system-ui,sans-serif;user-select:none;';
        ball.style.right = '16px';
        ball.style.bottom = '16px';

        const disabled = siteDisabled();
        const sensitive = isSensitive();

        const panel = document.createElement('div');
        panel.id = 'gz-lang-panel';
        panel.style.cssText = 'position:fixed;z-index:2147483647;width:220px;padding:14px;background:#fff;color:#1f2328;border:1px solid #d0d7de;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.18);font-family:system-ui,sans-serif;font-size:13px;display:none;max-height:80vh;overflow-y:auto;';
        document.body.appendChild(panel);

        function positionPanel() {
            const r = ball.getBoundingClientRect();
            let top = r.top - panel.offsetHeight - 8;
            if (top < 8) top = r.bottom + 8;
            panel.style.left = Math.max(8, Math.min(window.innerWidth - 228, r.left - 90)) + 'px';
            panel.style.top = top + 'px';
        }

        function addSectionTitle(text) {
            const h = document.createElement('div');
            h.style.cssText = 'font-size:14px;font-weight:600;margin:8px 0 6px;';
            h.textContent = text;
            panel.appendChild(h);
        }

        function showPanel() {
            panel.innerHTML = '';
            const openBtn = document.createElement('div');
            openBtn.style.cssText = 'padding:8px 10px;margin-bottom:8px;border-radius:6px;cursor:pointer;background:#ddf4ff;font-weight:600;text-align:center;';
            openBtn.textContent = t('openBox');
            openBtn.addEventListener('click', () => {
                if (window.__gzShowBox) window.__gzShowBox();
                panel.style.display = 'none';
            });
            panel.appendChild(openBtn);

            addSectionTitle(t('engine'));
            ENGINES.forEach(id => {
                const b = document.createElement('div');
                b.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:6px;padding:6px 10px;margin:3px 0;border-radius:6px;cursor:pointer;' +
                    (getEngine() === id ? 'background:#ddf4ff;font-weight:600;' : 'background:#f6f8fa;');
                const lt = document.createElement('span');
                lt.textContent = id === 'fast' ? t('engineFast') : t('engineGlm');
                b.appendChild(lt);
                // quota badge: MyMemory has a daily limit (local count); GLM/Edge are free
                const badge = document.createElement('span');
                badge.style.cssText = 'font-size:11px;font-weight:400;color:#57606a;background:#fff;border:1px solid #d0d7de;border-radius:4px;padding:1px 6px;white-space:nowrap;';
                if (id === 'fast') {
                    const left = Math.max(0, MM_DAILY_LIMIT - mmUsedToday());
                    badge.textContent = t('mmLeft', { n: (left >= 10000 ? (left / 10000).toFixed(1).replace(/\.0$/, '') + 'w' : left) });
                    badge.title = t('fastBadgeTitle', { limit: MM_DAILY_LIMIT });
                } else {
                    badge.textContent = t('free');
                    badge.title = t('glmBadgeTitle');
                }
                b.appendChild(badge);
                b.addEventListener('click', () => {
                    localStorage.setItem(LS_ENGINE, id);
                    ball.textContent = id === 'fast' ? '⚡' : '🧠';
                    panel.style.display = 'none';
                });
                panel.appendChild(b);
            });

            addSectionTitle(t('targetLang'));
            TARGET_LANGS.forEach(lang => {
                const b = document.createElement('div');
                b.style.cssText = 'padding:6px 10px;margin:3px 0;border-radius:6px;cursor:pointer;' +
                    (getLang() === lang ? 'background:#ddf4ff;font-weight:600;' : 'background:#f6f8fa;');
                b.textContent = lang;
                b.addEventListener('click', () => {
                    localStorage.setItem(LS_LANG, lang);
                    refreshUiTexts(); // UI language follows the selected target language
                    panel.style.display = 'none';
                });
                panel.appendChild(b);
            });

            const sep1 = document.createElement('div');
            sep1.style.cssText = 'height:1px;background:#eaeef2;margin:10px 0;';
            panel.appendChild(sep1);

            // per-site switch
            const siteBtn = document.createElement('div');
            siteBtn.style.cssText = 'padding:6px 10px;margin:3px 0;border-radius:6px;cursor:pointer;background:#fff8e1;color:#9a6700;font-size:12px;text-align:center;';
            siteBtn.textContent = siteDisabled() ? t('enableSite') : t('disableSite');
            siteBtn.addEventListener('click', () => {
                if (siteDisabled()) localStorage.removeItem('gz_site_disabled');
                else localStorage.setItem('gz_site_disabled', '1');
                location.reload();
            });
            panel.appendChild(siteBtn);

            // recent translations
            const hist = getHistory();
            const histBtn = document.createElement('div');
            histBtn.style.cssText = 'font-size:14px;font-weight:600;margin:8px 0 6px;';
            histBtn.textContent = t('recent', { n: hist.length });
            panel.appendChild(histBtn);
            if (hist.length) {
                hist.slice(0, 8).forEach(item => {
                    const row = document.createElement('div');
                    row.className = 'gz-hist-row';
                    row.title = (item.t || '') + '\n—— ' + (item.u || '') + '\n' + t('clickToFill');
                    row.style.cssText = 'padding:5px 8px;margin:2px 0;border-radius:5px;cursor:pointer;background:#f6f8fa;font-size:12px;color:#57606a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
                    row.textContent = (item.t || '').slice(0, 16) + ' → ' + (item.r || '').slice(0, 22);
                    row.addEventListener('click', () => {
                        panel.style.display = 'none';
                        if (window.__gzShowBox) window.__gzShowBox();
                        const box = document.getElementById('gz-tbox');
                        if (box) {
                            const inp = box.querySelector('textarea');
                            const out = box.querySelector('.gz-tbox-output');
                            if (inp) inp.value = item.t || '';
                            if (out) out.textContent = item.r || '';
                        }
                    });
                    panel.appendChild(row);
                });
                const clearHist = document.createElement('div');
                clearHist.style.cssText = 'padding:4px 8px;margin:2px 0 6px;border-radius:5px;cursor:pointer;font-size:12px;color:#c00;text-align:center;';
                clearHist.textContent = t('clearHistory');
                clearHist.addEventListener('click', () => {
                    clearHistory();
                    histBtn.textContent = t('recent', { n: 0 });
                    panel.querySelectorAll('.gz-hist-row').forEach(n => n.remove());
                    clearHist.remove();
                });
                panel.appendChild(clearHist);
            }

            const sep2 = document.createElement('div');
            sep2.style.cssText = 'height:1px;background:#eaeef2;margin:10px 0;';
            panel.appendChild(sep2);

            const clearBtn = document.createElement('div');
            clearBtn.style.cssText = 'padding:6px 10px;margin:3px 0;border-radius:6px;cursor:pointer;background:#fff0f0;color:#c00;font-size:12px;text-align:center;';
            clearBtn.textContent = t('clearCache');
            clearBtn.addEventListener('click', () => {
                const n = clearCache();
                clearBtn.textContent = t('cacheCleared', { n: n });
                setTimeout(() => { clearBtn.textContent = t('clearCache'); }, 2000);
            });
            panel.appendChild(clearBtn);

            panel.style.display = 'block';
            positionPanel();
        }

        if (disabled) {
            ball.style.background = '#999';
            ball.textContent = '🚫';
            ball.title = t('ballDisabled');
            ball.style.cursor = 'pointer';
            ball.addEventListener('click', () => {
                localStorage.removeItem('gz_site_disabled');
                location.reload();
            });
        } else if (sensitive) {
            ball.style.background = '#999';
            ball.textContent = '🔒';
            ball.title = t('ballSensitive');
        } else {
            ball.style.background = '#0969da';
            ball.style.cursor = 'grab';
            ball.textContent = getEngine() === 'fast' ? '⚡' : '🧠';
            ball.title = t('ballTitle');
            ball.addEventListener('click', () => {
                if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
                // when the box is minimized, clicking the ball restores it directly (replaces the old green "translate" ball)
                const tbox = document.getElementById('gz-tbox');
                if (tbox && tbox.style.display === 'none') { window.__gzShowBox(); return; }
                showPanel();
            });
        }

        let dragging = false, sx = 0, sy = 0, sl = 0, st = 0;
        ball.addEventListener('mousedown', (e) => {
            if (disabled || sensitive) return;
            dragging = true;
            const r = ball.getBoundingClientRect();
            sx = e.clientX; sy = e.clientY; sl = r.left; st = r.top;
            ball.style.cursor = 'grabbing';
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            const nx = Math.max(0, Math.min(window.innerWidth - 44, sl + e.clientX - sx));
            const ny = Math.max(0, Math.min(window.innerHeight - 44, st + e.clientY - sy));
            ball.style.left = nx + 'px';
            ball.style.top = ny + 'px';
            ball.style.right = 'auto';
            ball.style.bottom = 'auto';
            if (panel.style.display === 'block') positionPanel();
        });
        document.addEventListener('mouseup', () => {
            if (!dragging) return;
            dragging = false;
            ball.style.cursor = 'grab';
            localStorage.setItem(LS_BALL_X, ball.style.left);
            localStorage.setItem(LS_BALL_Y, ball.style.top);
        });

        const bx = parseInt(localStorage.getItem(LS_BALL_X) || 'NaN', 10);
        const by = parseInt(localStorage.getItem(LS_BALL_Y) || 'NaN', 10);
        if (!isNaN(bx) && !isNaN(by) && bx > 0 && by > 0) {
            ball.style.left = bx + 'px';
            ball.style.top = by + 'px';
            ball.style.right = 'auto';
            ball.style.bottom = 'auto';
        }

        document.body.appendChild(ball);
    }

    // Refresh all static UI texts when the target language changes
    function refreshUiTexts() {
        if (bubble) {
            const copy = bubble.querySelector('.gz-b-copy');
            const close = bubble.querySelector('.gz-b-close');
            const back = bubble.querySelector('.gz-b-back');
            if (copy) copy.title = t('copyResult');
            if (close) close.title = t('close');
            if (back) { back.textContent = t('backToSelect'); back.title = t('backToSelectTitle'); }
        }
        const box = document.getElementById('gz-tbox');
        if (box) {
            const title = box.querySelector('.gz-tbox-title');
            const copy = box.querySelector('.gz-tbox-copy');
            const rect = box.querySelector('.gz-tbox-rect');
            const mini = box.querySelector('.gz-tbox-mini');
            const resizer = box.querySelector('.gz-tbox-resizer');
            const inp = box.querySelector('textarea');
            const out = box.querySelector('.gz-tbox-output');
            if (title) title.textContent = t('boxTitle');
            if (copy) copy.title = t('copyResult');
            if (rect) { rect.textContent = t('selectBtn'); rect.title = t('selectBtnTitle'); }
            if (mini) mini.title = t('minimize');
            if (resizer) resizer.title = t('resize');
            if (inp) inp.placeholder = t('inputPlaceholder');
            // only replace the output text if it still shows one of the placeholder strings
            const placeholders = [];
            for (const key in I18N) placeholders.push(I18N[key].outputPlaceholder);
            if (out && placeholders.indexOf(out.textContent) !== -1) out.textContent = t('outputPlaceholder');
        }
        const ball = document.getElementById('gz-ball');
        if (ball) {
            const disabled = siteDisabled();
            const sensitive = isSensitive();
            if (disabled) ball.title = t('ballDisabled');
            else if (sensitive) ball.title = t('ballSensitive');
            else ball.title = t('ballTitle');
        }
    }

    buildTranslateBox();
    buildBall();
})();
