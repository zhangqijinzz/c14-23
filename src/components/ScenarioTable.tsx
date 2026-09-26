import { formatMoney } from '../domain';
import type { BaselineRow } from '../domain';
import type { FinanceScenario, ScenarioProjection } from '../types';

interface Props {
  scenarios: FinanceScenario[];
  projections: ScenarioProjection[];
  /** 统一比较基准年；null 时按旧表格（各自终值）渲染。 */
  baselineYear?: number | null;
  rows?: BaselineRow[];
}

export function ScenarioTable({ scenarios, projections, baselineYear = null, rows = [] }: Props) {
  if (baselineYear === null) {
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
      <table>
        <thead>
          <tr>
            <th>情景</th>
            <th>累计投入<small>（至基准年）</small></th>
            <th>第 {baselineYear} 年名义值<small>可比口径</small></th>
            <th>第 {baselineYear} 年实际值</th>
            <th>外推名义终值<small>超出基准年 · 仅供参考</small></th>
          </tr>
        </thead>
        <tbody>
          {scenarios.map((scenario) => {
            const projection = projections.find((item) => item.scenarioId === scenario.id);
            if (!projection) return <tr key={scenario.id}><td><span className="table-dot" style={{ background: scenario.color }} />{scenario.name}</td><td colSpan={4} className="invalid-cell">参数待修正</td></tr>;
            const row = rows.find((item) => item.scenarioId === scenario.id);
            if (!row || !row.covered || !row.baselinePoint) {
              const endYear = projection.points[projection.points.length - 1]?.year ?? 0;
              return (
                <tr key={scenario.id} className="row-uncovered">
                  <td><span className="table-dot" style={{ background: scenario.color }} />{scenario.name}</td>
                  <td>¥ {formatMoney(projection.totalInvested)}</td>
                  <td colSpan={2} className="invalid-cell">仅推演到第 {endYear} 年，不参与基准比较</td>
                  <td className="extrapolation-cell">—</td>
                </tr>
              );
            }
            const point = row.baselinePoint;
            const extrapolationEnd = row.extrapolationPoints.length ? row.extrapolationPoints[row.extrapolationPoints.length - 1] : null;
            return (
              <tr key={scenario.id}>
                <td><span className="table-dot" style={{ background: scenario.color }} />{scenario.name}</td>
                <td>¥ {formatMoney(point.invested)}</td>
                <td className="strong">¥ {formatMoney(point.nominal)}</td>
                <td>¥ {formatMoney(point.real)}</td>
                <td className="extrapolation-cell">
                  {extrapolationEnd ? <>¥ {formatMoney(extrapolationEnd.nominal)}<small>第 {extrapolationEnd.year} 年 · 外推</small></> : <span className="no-extrapolation">已到自身终值</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="table-footnote">基准年内为可比结果；浅色虚线对应的“外推名义终值”超出统一口径，不参与上方汇总。</p>
    </div>
  );
}
