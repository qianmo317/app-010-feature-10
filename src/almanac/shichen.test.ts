import { describe, it, expect } from 'vitest';
import { getShiChenTable } from './shichen';
import { getDayGanZhi } from './lunar';
import { getDayYiJi } from './yiji';
import { gregorianToJDN, addDays } from '../utils/date';
import { TIAN_GAN, DI_ZHI, SHENG_XIAO } from './constants';

// 五鼠遁参考实现
function expectHourGanZhi(dayGanZhi: string, zhiIndex: number): string {
  const dayGanIndex = TIAN_GAN.indexOf(dayGanZhi[0]);
  const start = (dayGanIndex % 5) * 2;
  return TIAN_GAN[(start + zhiIndex) % 10] + DI_ZHI[zhiIndex];
}

describe('时辰表结构', () => {
  const table = getShiChenTable(2024, 6, 15);

  it('应返回13个时段（早子时…亥时 + 晚子时）', () => {
    expect(table.hours).toHaveLength(13);
    expect(table.hours[0].name).toBe('早子时');
    expect(table.hours[0].range).toBe('00:00-01:00');
    expect(table.hours[11].name).toBe('亥时');
    expect(table.hours[12].name).toBe('晚子时');
    expect(table.hours[12].range).toBe('23:00-24:00');
  });

  it('每个时辰都带宜忌、冲生肖、煞方、值神', () => {
    table.hours.forEach(h => {
      expect(h.yi.length).toBeGreaterThan(0);
      expect(h.ji.length).toBeGreaterThan(0);
      expect(h.chongShengxiao).toBeTruthy();
      expect(SHENG_XIAO).toContain(h.chongShengxiao);
      expect(['东', '南', '西', '北']).toContain(h.sha);
      expect(h.spirit).toBeTruthy();
      expect(['吉', '凶']).toContain(h.luck);
    });
  });

  it('早子时属今日，晚子时属次日', () => {
    expect(table.hours[0].dayOffset).toBe(0);
    expect(table.hours[0].belongsLabel).toBe('属今日');
    expect(table.hours[12].dayOffset).toBe(1);
    expect(table.hours[12].belongsLabel).toContain('属次日');
  });
});

describe('早晚子时与日柱衔接', () => {
  it('早子时按今日日柱起时柱', () => {
    const table = getShiChenTable(2024, 6, 15);
    expect(table.dayGanZhi).toBe(getDayGanZhi(gregorianToJDN(2024, 6, 15)));
    expect(table.hours[0].ganZhi).toBe(expectHourGanZhi(table.dayGanZhi, 0));
  });

  it('晚子时按次日日柱起时柱', () => {
    const table = getShiChenTable(2024, 6, 15);
    const [ny, nm, nd] = addDays(2024, 6, 15, 1);
    const nextPillar = getDayGanZhi(gregorianToJDN(ny, nm, nd));
    expect(table.nextDayGanZhi).toBe(nextPillar);
    // 子时时干由日干决定，晚子干 = 次日子时干
    expect(table.hours[12].ganZhi).toBe(expectHourGanZhi(nextPillar, 0));
  });

  it('今日晚子时与次日早子时是同一个干支时辰', () => {
    const today = getShiChenTable(2024, 6, 15);
    const [ny, nm, nd] = addDays(2024, 6, 15, 1);
    const tomorrow = getShiChenTable(ny, nm, nd);
    expect(today.hours[12].ganZhi).toBe(tomorrow.hours[0].ganZhi);
    // 日柱相接：今日次日柱 = 次日日柱
    expect(today.nextDayGanZhi).toBe(tomorrow.dayGanZhi);
  });

  it('日柱六十甲子逐日推进（跨月也成立）', () => {
    const t1 = getShiChenTable(2024, 6, 30);
    const t2 = getShiChenTable(2024, 7, 1);
    expect(t1.nextDayGanZhi).toBe(t2.dayGanZhi);
    expect(t1.hours[12].ganZhi).toBe(t2.hours[0].ganZhi);
  });
});

describe('黄黑道十二神吉凶', () => {
  it('按日支起青龙歌诀排神（寅日起子、戌日起辰、子日起申）', () => {
    // 2024-01-15 戊寅日：寅申须加子 → 子时青龙
    const yinDay = getShiChenTable(2024, 1, 15);
    expect(yinDay.dayGanZhi).toBe('戊寅');
    expect(yinDay.hours[0].spirit).toBe('青龙');
    expect(yinDay.hours[0].luck).toBe('吉');
    expect(yinDay.hours[2].spirit).toBe('天刑');
    expect(yinDay.hours[2].luck).toBe('凶');

    // 2024-06-15 庚戌日：辰戌龙位上 → 辰时青龙
    const xuDay = getShiChenTable(2024, 6, 15);
    expect(xuDay.dayGanZhi).toBe('庚戌');
    expect(xuDay.hours[4].spirit).toBe('青龙');
    expect(xuDay.hours[0].spirit).toBe('天牢'); // 子时为天牢（凶）
    expect(xuDay.hours[0].luck).toBe('凶');

    // 2024-06-05 庚子日：子午临申地 → 申时青龙
    const ziDay = getShiChenTable(2024, 6, 5);
    expect(ziDay.dayGanZhi).toBe('庚子');
    expect(ziDay.hours[8].spirit).toBe('青龙');
  });

  it('吉凶与值神一致（黄道6神为吉，黑道6神为凶）', () => {
    const good = ['青龙', '明堂', '金匮', '天德', '玉堂', '司命'];
    const bad = ['天刑', '朱雀', '白虎', '天牢', '玄武', '勾陈'];
    const table = getShiChenTable(2024, 1, 15);
    table.hours.forEach(h => {
      if (good.includes(h.spirit)) expect(h.luck).toBe('吉');
      if (bad.includes(h.spirit)) expect(h.luck).toBe('凶');
    });
  });

  it('十二神按时支顺排，覆盖全部12位', () => {
    const table = getShiChenTable(2024, 3, 20); // 癸未日
    const spirits = table.hours.slice(0, 12).map(h => h.spirit);
    expect(new Set(spirits).size).toBe(12);
    // 未日戌上起青龙：戌时为青龙
    expect(table.hours[10].spirit).toBe('青龙');
  });

  it('日支不同的两天时辰表不同（不再只看日干单双）', () => {
    // 2024-06-15 庚戌 与 2024-06-16：日柱不同，时柱与值神全表随之变化
    const t1 = getShiChenTable(2024, 6, 15);
    const t2 = getShiChenTable(2024, 6, 16);
    const s1 = t1.hours.slice(0, 12).map(h => `${h.ganZhi}${h.spirit}`).join('|');
    const s2 = t2.hours.slice(0, 12).map(h => `${h.ganZhi}${h.spirit}`).join('|');
    expect(s1).not.toBe(s2);
  });

  it('同一日干但不同日支的两天，值神排列不同', () => {
    // 2024-06-05 庚子 与 2024-06-15 庚戌：日干同为庚、日支不同
    const t1 = getShiChenTable(2024, 6, 5);
    const t2 = getShiChenTable(2024, 6, 15);
    expect(t1.dayGanZhi[0]).toBe(t2.dayGanZhi[0]);
    expect(t1.dayGanZhi[1]).not.toBe(t2.dayGanZhi[1]);
    const spirits1 = t1.hours.slice(0, 12).map(h => h.spirit).join(',');
    const spirits2 = t2.hours.slice(0, 12).map(h => h.spirit).join(',');
    expect(spirits1).not.toBe(spirits2);
  });
});

describe('时辰冲煞与宜忌冲突', () => {
  it('冲的生肖与时支六冲一致', () => {
    const table = getShiChenTable(2024, 6, 15);
    const chongMap: Record<string, string> = {
      '子': '马', '丑': '羊', '寅': '猴', '卯': '鸡',
      '辰': '狗', '巳': '猪', '午': '鼠', '未': '牛',
      '申': '虎', '酉': '兔', '戌': '龙', '亥': '蛇'
    };
    table.hours.forEach(h => {
      expect(h.chongShengxiao).toBe(chongMap[h.zhi]);
    });
  });

  it('煞方随各时辰时支变化（不全相同）', () => {
    const table = getShiChenTable(2024, 6, 15);
    const shas = new Set(table.hours.slice(0, 12).map(h => h.sha));
    expect(shas.size).toBeGreaterThan(1);
  });

  it('标注时辰宜忌与当日宜忌的冲突', () => {
    const table = getShiChenTable(2024, 6, 15);
    table.hours.forEach(h => {
      h.yiClashWithDayJi.forEach(item => {
        // 标记出的“时辰宜”确实在时辰宜中
        expect(h.yi).toContain(item);
      });
    });
  });

  it('晚子时的宜忌冲突按次日宜忌比对，不按今日', () => {
    const table = getShiChenTable(2024, 6, 15);
    const nextYiJi = getDayYiJi(2024, 6, 16);
    const lateZi = table.hours[12];
    expect(lateZi.dayOffset).toBe(1);
    lateZi.yiClashWithDayJi.forEach(item => {
      expect(nextYiJi.ji).toContain(item);
    });
    lateZi.jiClashWithDayYi.forEach(item => {
      expect(nextYiJi.yi).toContain(item);
    });
    // 今日忌而次日不忌的事项，不应出现在晚子时冲突里
    const todayYiJi = getDayYiJi(2024, 6, 15);
    todayYiJi.ji
      .filter(item => !nextYiJi.ji.includes(item))
      .forEach(item => {
        expect(lateZi.yiClashWithDayJi).not.toContain(item);
      });
  });
});

describe('最吉最凶', () => {
  const table = getShiChenTable(2024, 6, 15);

  it('最吉为黄道时辰、最凶为黑道时辰', () => {
    expect(table.best.luck).toBe('吉');
    expect(table.worst.luck).toBe('凶');
  });

  it('最吉最凶只在属今日的十二个时辰里挑', () => {
    expect(table.best.dayOffset).toBe(0);
    expect(table.worst.dayOffset).toBe(0);
    const today = table.hours.filter(h => h.dayOffset === 0);
    expect(today).toContain(table.best);
    expect(today).toContain(table.worst);
  });
});
