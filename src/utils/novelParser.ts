// FILE: src/utils/novelParser.ts
/**
 * [nextpage] タグで本文を分割し、純粋な文字数を計算
 */
export function parseNovel(content: string): {
  pages: string[];
  wordCount: number;
} {
  // [nextpage] で分割
  const pages = content
    .split(/\[nextpage\]/i)
    .map(page => page.trim())
    .filter(page => page.length > 0);

  // 制御タグを除去して文字数をカウント
  const cleanText = content
    .replace(/\[nextpage\]/gi, '')
    .replace(/\s+/g, '');
  
  const wordCount = cleanText.length;

  return {
    pages: pages.length > 0 ? pages : [content],
    wordCount
  };
}

/**
 * 指定された文字数範囲に該当する演出設定を取得
 */
export function getActiveQuadrantSettings(
  charIndex: number,
  settings: import('../types/domain').QuadrantSetting[]
): Record<string, import('../types/domain').QuadrantSetting | null> {
  const result: Record<string, import('../types/domain').QuadrantSetting | null> = {
    LT: null,
    LB: null,
    RT: null,
    RB: null
  };

  for (const setting of settings) {
    if (charIndex >= setting.startChar && charIndex <= setting.endChar) {
      result[setting.slot] = setting;
    }
  }

  return result;
}

/**
 * ページ内の文字数から全体の文字インデックスを計算
 */
export function calculateCharIndex(pages: string[], currentPage: number): number {
  let charIndex = 0;
  for (let i = 0; i < currentPage && i < pages.length; i++) {
    charIndex += pages[i].length;
  }
  return charIndex;
}