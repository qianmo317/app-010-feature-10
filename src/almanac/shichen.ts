import { TIAN_GAN, DI_ZHI, SHENG_XIAO } from './constants';
import { getDayGanZhi } from './lunar';
import { gregorianToJDN, jdnToGregorian } from '../utils/date';
import { getDayYiJi, CHONG_SHA } from './yiji';

// 黄黑道十二神（青龙歌诀顺行顺序）
const TWELVE_SPIRITS = [
  '青龙', '明堂', '天刑', '朱雀', '金匮', '天德',
  '白虎', '玉堂', '天牢', '玄武', '司命', '勾陈'
] as const;
// 黄道六神为吉，黑道六神为凶
const GOOD_SPIRITS = new Set<string>(['青龙', '明堂', '金匮', '天德', '玉堂', '司命']);

// 日支起青龙的时支序号（歌诀：寅申须加子，卯酉却居寅，
// 子午临申地，丑未戌上寻，辰戌龙位上，巳亥午上存）
const QING_LONG_START: number[] = [
  8,  // 子 → 申
  10, // 丑 → 戌
  0,  // 寅 → 子
  2,  // 卯 → 寅
  4,  // 辰 → 辰
  6,  // 巳 → 午
  8,  // 午 → 申
  10, // 未 → 戌
  0,  // 申 → 子
  2,  // 酉 → 寅
  4,  // 戌 → 辰
  6   // 亥 → 午
];

// 时辰基础数据：早子时属当日、晚子时属次日，其余时辰顺排
interface SegmentDef {
  name: string;
  range: string;
  zhiIndex: number;
  dayOffset: 0 | 1;
}

const SEGMENTS: SegmentDef[] = [
  { name: '早子时', range: '00:00-01:00', zhiIndex: 0, dayOffset: 0 },
  { name: '丑时', range: '01:00-03:00', zhiIndex: 1, dayOffset: 0 },
  { name: '寅时', range: '03:00-05:00', zhiIndex: 2, dayOffset: 0 },
  { name: '卯时', range: '05:00-07:00', zhiIndex: 3, dayOffset: 0 },
  { name: '辰时', range: '07:00-09:00', zhiIndex: 4, dayOffset: 0 },
  { name: '巳时', range: '09:00-11:00', zhiIndex: 5, dayOffset: 0 },
  { name: '午时', range: '11:00-13:00', zhiIndex: 6, dayOffset: 0 },
  { name: '未时', range: '13:00-15:00', zhiIndex: 7, dayOffset: 0 },
  { name: '申时', range: '15:00-17:00', zhiIndex: 8, dayOffset: 0 },
  { name: '酉时', range: '17:00-19:00', zhiIndex: 9, dayOffset: 0 },
  { name: '戌时', range: '19:00-21:00', zhiIndex: 10, dayOffset: 0 },
  { name: '亥时', range: '21:00-23:00', zhiIndex: 11, dayOffset: 0 },
  { name: '晚子时', range: '23:00-24:00', zhiIndex: 0, dayOffset: 1 }
];

// 值神宜忌基础数据（黄黑道十二神）
const SPIRIT_YI_JI: Record<string, { yi: string[]; ji: string[] }> = {
  '青龙': { yi: ['祈福', '订婚', '嫁娶', '开市', '出行', '见贵', '安床'], ji: ['安葬', '伐木'] },
  '明堂': { yi: ['祭祀', '祈福', '上任', '求职', '见贵', '嫁娶', '修造'], ji: ['针灸', '掘井'] },
  '天刑': { yi: ['祭祀', '捕捉', '破屋', '坏垣'], ji: ['嫁娶', '开市', '出行', '安葬', '祈福', '动土'] },
  '朱雀': { yi: ['上书', '献策', '投递文书'], ji: ['嫁娶', '搬家', '出行', '词讼', '宴会'] },
  '金匮': { yi: ['订婚', '嫁娶', '开市', '签约', '祭祀', '祈福', '求财'], ji: ['服药', '针灸', '乘船'] },
  '天德': { yi: ['祭祀', '祈福', '求嗣', '出行', '嫁娶', '上任', '修造'], ji: ['争论', '词讼', '处决'] },
  '白虎': { yi: ['祭祀', '酬神', '捕捉'], ji: ['嫁娶', '安葬', '出行', '赴任', '乘船', '入宅'] },
  '玉堂': { yi: ['祭祀', '祈福', '修造', '安床', '开市', '嫁娶', '见贵'], ji: ['诉讼', '伐木'] },
  '天牢': { yi: ['祭祀', '捕捉', '平治道涂'], ji: ['嫁娶', '开市', '出行', '上任', '祈福', '入宅'] },
  '玄武': { yi: ['祭祀', '捕捉', '缉盗'], ji: ['嫁娶', '开市', '签约', '交易', '出行', '安葬'] },
  '司命': { yi: ['祭祀', '祈福', '修灶', '安床', '开光', '入学'], ji: ['行丧', '安葬', '伐木'] },
  '勾陈': { yi: ['祭祀', '捕捉'], ji: ['嫁娶', '出行', '开市', '搬家', '安葬', '动土'] }
};

// 时支宜忌基础数据
const HOUR_ZHI_YI_JI: Record<string, { yi: string[]; ji: string[] }> = {
  '子': { yi: ['祭祀', '祈福', '求嗣', '安葬'], ji: ['修造', '动土', '问卜'] },
  '丑': { yi: ['祭祀', '祈福', '冠笄', '签约'], ji: ['乘船', '远行', '搬家'] },
  '寅': { yi: ['祭祀', '祈福', '上任', '出行', '嫁娶'], ji: ['安葬', '破土', '开仓'] },
  '卯': { yi: ['祭祀', '祈福', '订婚', '出行', '入宅'], ji: ['穿井', '动土', '伐木'] },
  '辰': { yi: ['祭祀', '祈福', '修造', '动土', '开市'], ji: ['安葬', '行丧'] },
  '巳': { yi: ['祭祀', '祈福', '出行', '交易', '立券'], ji: ['安葬', '破土'] },
  '午': { yi: ['祭祀', '祈福', '嫁娶', '开市', '出行'], ji: ['动土', '盖屋'] },
  '未': { yi: ['祭祀', '祈福', '嫁娶', '开市', '交易'], ji: ['服药', '求医'] },
  '申': { yi: ['祭祀', '祈福', '求财', '签约', '出行'], ji: ['安床', '搬家'] },
  '酉': { yi: ['祭祀', '祈福', '嫁娶', '入宅', '安葬'], ji: ['会客', '饮酒'] },
  '戌': { yi: ['祭祀', '祈福', '求嗣', '交易'], ji: ['嫁娶', '开市', '远行'] },
  '亥': { yi: ['祭祀', '祈福', '求嗣', '嫁娶', '出行'], ji: ['行丧', '安葬', '破土'] }
};

export interface ShiChenEntry {
  name: string;          // 早子时 / 丑时 / … / 晚子时
  range: string;         // 时段
  ganZhi: string;        // 时柱干支
  zhi: string;           // 时支
  spirit: string;        // 当值黄黑道神
  luck: '吉' | '凶';
  yi: string[];
  ji: string[];
  chongZhi: string;      // 冲的地支
  chongShengxiao: string;// 冲的生肖
  sha: string;           // 煞方
  dayOffset: 0 | 1;      // 0=属今日 1=属次日
  belongsLabel: string;  // 归属说明
  // 与归属日宜忌的冲突（晚子时对次日）
  yiClashWithDayJi: string[]; // 时辰宜、但归属日忌
  jiClashWithDayYi: string[]; // 时辰忌、但归属日宜
}

export interface ShiChenTable {
  dayGanZhi: string;       // 今日日柱
  nextDayGanZhi: string;   // 次日日柱
  hours: ShiChenEntry[];
  best: ShiChenEntry;      // 今日最吉时辰（晚子时属次日，不参与）
  worst: ShiChenEntry;     // 今日最凶时辰
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

// 五鼠遁：由日干起时干
function hourGanZhiOf(ownerDayGanZhi: string, zhiIndex: number): string {
  const dayGanIndex = TIAN_GAN.indexOf(ownerDayGanZhi[0]);
  const hourGanStart = (dayGanIndex % 5) * 2;
  return TIAN_GAN[(hourGanStart + zhiIndex) % 10] + DI_ZHI[zhiIndex];
}

// 黄黑道十二神：由日支起青龙，顺排到时支
function spiritOf(ownerDayZhiIndex: number, hourZhiIndex: number): string {
  const start = QING_LONG_START[ownerDayZhiIndex];
  const index = (hourZhiIndex - start + 12) % 12;
  return TWELVE_SPIRITS[index];
}

// 计算某日全天的时辰表（含属次日的晚子时）
export function getShiChenTable(year: number, month: number, day: number): ShiChenTable {
  const jdn = gregorianToJDN(year, month, day);
  const dayGanZhi = getDayGanZhi(jdn);
  const [ny, nm, nd] = jdnToGregorian(jdn + 1);
  const nextDayGanZhi = getDayGanZhi(jdn + 1);

  const dayYiJi = getDayYiJi(year, month, day);
  const nextYiJi = getDayYiJi(ny, nm, nd);
  const ownerYiSet = [new Set(dayYiJi.yi), new Set(nextYiJi.yi)];
  const ownerJiSet = [new Set(dayYiJi.ji), new Set(nextYiJi.ji)];

  const ownerGanZhi = [dayGanZhi, nextDayGanZhi];
  const ownerZhiIndex = [DI_ZHI.indexOf(dayGanZhi[1]), DI_ZHI.indexOf(nextDayGanZhi[1])];

  const hours: ShiChenEntry[] = SEGMENTS.map(seg => {
    const ownerGan = ownerGanZhi[seg.dayOffset];
    const ganZhi = hourGanZhiOf(ownerGan, seg.zhiIndex);
    const zhi = DI_ZHI[seg.zhiIndex];
    const spirit = spiritOf(ownerZhiIndex[seg.dayOffset], seg.zhiIndex);
    const luck: '吉' | '凶' = GOOD_SPIRITS.has(spirit) ? '吉' : '凶';

    const spiritYiJi = SPIRIT_YI_JI[spirit];
    const zhiYiJi = HOUR_ZHI_YI_JI[zhi];
    const yi = unique([...spiritYiJi.yi, ...zhiYiJi.yi]);
    const ji = unique([...spiritYiJi.ji, ...zhiYiJi.ji]);

    const chongSha = CHONG_SHA[zhi];
    const chongShengxiao = SHENG_XIAO[DI_ZHI.indexOf(chongSha.chong)];

    const belongsLabel = seg.dayOffset === 0
      ? '属今日'
      : `属次日（${nm}月${nd}日，日柱${nextDayGanZhi}）`;

    return {
      name: seg.name,
      range: seg.range,
      ganZhi,
      zhi,
      spirit,
      luck,
      yi,
      ji,
      chongZhi: chongSha.chong,
      chongShengxiao,
      sha: chongSha.sha,
      dayOffset: seg.dayOffset,
      belongsLabel,
      yiClashWithDayJi: yi.filter(y => ownerJiSet[seg.dayOffset].has(y)),
      jiClashWithDayYi: ji.filter(j => ownerYiSet[seg.dayOffset].has(j))
    };
  });

  // 最吉/最凶只在属今日的十二个时辰里挑；同吉凶按值神次序取首位
  const todayHours = hours.filter(h => h.dayOffset === 0);
  const rankOf = (h: ShiChenEntry) => TWELVE_SPIRITS.indexOf(h.spirit as typeof TWELVE_SPIRITS[number]);
  const best = todayHours
    .filter(h => h.luck === '吉')
    .sort((a, b) => rankOf(a) - rankOf(b))[0];
  const worst = todayHours
    .filter(h => h.luck === '凶')
    .sort((a, b) => rankOf(a) - rankOf(b))[0];

  return { dayGanZhi, nextDayGanZhi, hours, best, worst };
}
