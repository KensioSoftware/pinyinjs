/**
 * The 文 that closes a language name, and not the 文 of 文书 *a document*.
 *
 * 中文书, 日文书 and 外文书 are books in Chinese, in Japanese and in a foreign
 * language. 文书 is a word and 中文书 is not, and 中 is cheap enough on its
 * own that 中 + 文书 cost less than 中文 + 书. The decode came out `zhōng
 * wénshū`, a middle document, and 中文 lost the capital a language name takes.
 */
import type { EdgeContext, EdgeRule } from "./rules.js";

/** The word, in both scripts. */
const WENSHU = new Set(["文书", "文書"]);

/**
 * The language names that end in 文, in both scripts.
 *
 * Listed rather than read off the dictionary, because the dictionary holds
 * plenty of words ending in 文 that a 书 does not follow as a book: 公文书 is
 * an official document either way.
 */
const LANGUAGES = new Set([
  "中文",
  "英文",
  "日文",
  "法文",
  "德文",
  "俄文",
  "韩文",
  "韓文",
  "外文",
  "汉文",
  "漢文",
  "藏文",
  "蒙文",
  "越文",
  "泰文",
]);

/**
 * 文书 taken apart where its 文 closes a language name.
 *
 * Taking the edge away leaves the 文 to the language and the 书 to itself, so
 * 有很多中文书 reads `yǒu hěn duō Zhōngwén shū`.
 */
export const LANGUAGE_WENSHU: EdgeRule = {
  name: "language-wenshu",
  verdictFor: (context: EdgeContext) => {
    const { edge, characters } = context;
    return WENSHU.has(edge.text) &&
      edge.from > 0 &&
      LANGUAGES.has(characters.slice(edge.from - 1, edge.from + 1).join(""))
      ? "forbid"
      : "keep";
  },
};
