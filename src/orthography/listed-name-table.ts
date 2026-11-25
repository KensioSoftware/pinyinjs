/**
 * Each listed text, with the pinyin GB/T 16159 writes it in.
 *
 * See {@link import("./listed-names.js").LISTED_NAME} for why they are listed.
 *
 * A capitalised word is a proper noun. Both scripts are listed, since a run is
 * matched in the script it is in.
 */
export const LISTED_NAMES: ReadonlyMap<string, string> = new Map([
  // People in 歇后语 and sayings.
  ["郑板桥", "Zhèng Bǎnqiáo"],
  ["鄭板橋", "Zhèng Bǎnqiáo"],
  ["徐庶", "Xú Shù"],
  ["蒋干", "Jiǎng Gàn"],
  ["蔣幹", "Jiǎng Gàn"],
  ["严嵩", "Yán Sōng"],
  ["嚴嵩", "Yán Sōng"],
  ["杨五郎", "Yáng Wǔláng"],
  ["楊五郎", "Yáng Wǔláng"],
  ["孟获", "Mèng Huò"],
  ["孟獲", "Mèng Huò"],
  ["王叔和", "Wáng Shūhé"],
  // Cao Cao's camp, the Jia family and the temple of the immortal Lü Dongbin.
  ["曹营", "Cáo yíng"],
  ["曹營", "Cáo yíng"],
  ["贾家", "Jiǎ jiā"],
  ["賈家", "Jiǎ jiā"],
  ["贾门", "Jiǎ mén"],
  ["賈門", "Jiǎ mén"],
  ["吕祖庙", "Lǚzǔ Miào"],
  ["呂祖廟", "Lǚzǔ Miào"],
  // The states of Qin and Chu in 楚虽三户，亡秦必楚.
  ["亡秦必楚", "wáng Qín bì Chǔ"],
  ["楚虽三户", "Chǔ suī sānhù"],
  ["楚雖三戶", "Chǔ suī sānhù"],
  // Foreign names in the 例句.
  ["尤巴", "Yóubā"],
  ["吉雄", "Jíxióng"],
  ["安田", "Āntián"],
  ["藏王", "Zàngwáng"],
]);
