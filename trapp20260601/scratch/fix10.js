const fs = require('fs');
let content = fs.readFileSync('script.js', 'utf8');

// Replace Uvance line
const oldUvance = '"螟ｧ蜥後ワ繧ｦ繧ｹ 繝励Ξ繝溘せ繝医ラ繝ｼ繝": "譛ｭ蟷悟ｸりｱ雁ｹｳ蛹ｺ", "蟷ｳ蜥悟・ATO繧ｹ繧ｿ繧ｸ繧｢繝": "蠖ｦ譬ｹ蟶・';
const newUvance = '"大和ハウス プレミストドーム": "札幌市豊平区", "平和堂HATOスタジアム": "彦根市"';

// Wait, the corrupted string is different:
const oldUvance2 = '"繧ｿ繝斐ャ繧ｯ逵檎ｷ上・繧・＃繧薙せ繧ｿ繧ｸ繧｢繝": "豐也ｸ・ｸ・, "Uvance縺ｨ縺ｩ繧阪″繧ｹ繧ｿ繧ｸ繧｢繝 by Fujitsu": "蟾晏ｴ主ｸゆｸｭ蜴溷玄",';
const newUvance2 = '"タピック県総ひやごんスタジアム": "沖縄市", "Uvanceとどろきスタジアム by Fujitsu": "川崎市中原区",';

content = content.replace(oldUvance, newUvance);
content = content.replace(oldUvance2, newUvance2);

const oldJTeam = 'const J_TEAM_KWS = ["FC譚ｱ莠ｬ", "譚ｱ莠ｬV", "讓ｪ豬廡M", "讓ｪ豬廡C", "YS讓ｪ豬・, "FC螟ｧ髦ｪ", "G螟ｧ髦ｪ", "C螟ｧ髦ｪ", "繧ｻ繝ｬ繝・た", "FC蟯宣・", "FC莉頑ｲｻ", "FC逅臥帥", "譛ｭ蟷・, "鮖ｿ蟲ｶ", "豬ｦ蜥・, "譟・, "逕ｺ逕ｰ", "蟾晏ｴ・, "貉伜漉", "譁ｰ貎・, "蟇悟ｱｱ", "驥第ｲ｢", "貂・ｰｴ", "阯､譫・, "豐ｼ豢･", "逎千伐", "蜷榊商螻・, "蟯宣・", "莠ｬ驛ｽ", "逾樊虻", "螂郁憶", "魑･蜿・, "蟯｡螻ｱ", "蠎・ｳｶ", "螻ｱ蜿｣", "隶・ｲ・, "蠕ｳ蟲ｶ", "諢帛ｪ・, "莉頑ｲｻ", "遖丞ｲ｡", "蛹嶺ｹ晏ｷ・, "魑･譬・, "髟ｷ蟠・, "辭頑悽", "螟ｧ蛻・, "螳ｮ蟠・, "鮖ｿ蜈仙ｳｶ", "逅臥帥", "鬮倡衍", "貊玖ｳ€", "蜈ｫ謌ｸ", "逶帛ｲ｡", "遘狗伐", "螻ｱ蠖｢", "莉吝床", "遖丞ｳｶ", "豌ｴ謌ｸ", "鄒､鬥ｬ", "譬・惠", "螟ｧ螳ｮ", "蜊・痩", "逶ｸ讓｡蜴・, "逕ｲ蠎・, "譚ｾ譛ｬ", "髟ｷ驥・];';
const newJTeam = 'const J_TEAM_KWS = ["FC東京", "東京V", "横浜FM", "横浜FC", "YS横浜", "FC大阪", "G大阪", "C大阪", "セレッソ", "FC岐阜", "FC今治", "FC琉球", "札幌", "鹿島", "浦和", "柏", "町田", "川崎", "湘南", "新潟", "富山", "金沢", "清水", "藤枝", "沼津", "磐田", "名古屋", "岐阜", "京都", "神戸", "奈良", "鳥取", "岡山", "広島", "山口", "讃岐", "徳島", "愛媛", "今治", "福岡", "北九州", "鳥栖", "長崎", "熊本", "大分", "宮崎", "鹿児島", "琉球", "高知", "滋賀", "八戸", "盛岡", "秋田", "山形", "仙台", "福島", "水戸", "群馬", "栃木", "大宮", "千葉", "相模原", "甲府", "松本", "長野"];';

content = content.replace(oldJTeam, newJTeam);
content = content.replace(oldJTeam, newJTeam);

fs.writeFileSync('script.js', content, 'utf8');
