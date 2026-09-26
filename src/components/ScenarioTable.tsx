import { formatMoney, pointAtYear } from '../domain';
import type { FinanceScenario, ScenarioProjection } from '../types';

interface Props { scenarios: FinanceScenario[]; projections: ScenarioProjection[]; baselineYear: number | null }

export function ScenarioTable({ scenarios, projections, baselineYear }: Props) {
  if (baselineYear == null) {
    return (
      <div className="table-wrap">
        <table>
          <thead><tr><th>情景</th><th>累计投入</th><th>名义终值</th><th>扣除通胀后</th><th>增值倍数</th></tr></thead>
          <tbody>
            {scenarios.map((scenario) => {
              const projection = projections.find((item) => item.scenarioId === scenario.id);
              if (!projection) return <tr key={scenario.id}><td><span className="table-dot" style={{ background: scenario.color }} />{scenario.name}</td><td colSpan={4} className="invalid-cell">参数待修正</td></tr>;
              return <tr key={scenario.id}><td><span className="table-dot" style={{ background: scenario.color }} />{scenario.name}</td><td>¥ {formatMoney(projection.totalInvested)}</td><td className="strong">¥ {formatMoney(projection.finalValue)}</td><td>¥ {formatMoney(projection.finalRealValue)}</td><td>{(projection.finalValue / projection.totalInvested).toFixed(1)}x</td></tr>;
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <div className="table-caption">对比基准：第 {baselineYear} 年 · 超出基准年的终值为外推结果，不参与上方汇总</div>
      <table>
        <thead><tr><th>情景</th><th>累计投入</th><th>名义价值</th><th>扣除通胀后</th><th>增值倍数</th><th>基准年后的终值</th></tr></thead>
        <tbody>
          {scenarios.map((scenario) => {
            const projection = projections.find((item) => item.scenarioId === scenario.id);
            if (!projection) return <tr key={scenario.id}><td><span className="table-dot" style={{ background: scenario.color }} />{scenario.name}</td><td colSpan={5} className="invalid-cell">参数待修正</td></tr>;
            const point = pointAtYear(projection, baselineYear);
            if (!point) {
              return (
                <tr key={scenario.id}>
                  <td><span className="table-dot" style={{ background: scenario.color }} />{scenario.name}</td>
                  <td colSpan={4} className="invalid-cell">仅推演至第 {scenario.years} 年，不足基准年</td>
                  <td className="extrapolated-value">¥ {formatMoney(projection.finalValue)}<span className="tag">终值</span></td>
                </tr>
              );
            }
            return (
              <tr key={scenario.id}>
                <td><span className="table-dot" style={{ background: scenario.color }} />{scenario.name}</td>
                <td>¥ {formatMoney(point.invested)}</td>
                <td className="strong">¥ {formatMoney(point.nominal)}</td>
                <td>¥ {formatMoney(point.real)}</td>
                <td>{(point.nominal / point.invested).toFixed(1)}x</td>
                <td className="extrapolated-value">{scenario.years > baselineYear ? <>¥ {formatMoney(projection.finalValue)}<span className="tag">外推</span></> : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
