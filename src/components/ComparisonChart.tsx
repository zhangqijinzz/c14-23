import { formatMoney } from '../domain';
import type { FinanceScenario, ScenarioProjection } from '../types';

interface Props {
  scenarios: FinanceScenario[];
  projections: ScenarioProjection[];
  /** 统一比较基准年；null 时按旧表现整段实线渲染。 */
  baselineYear?: number | null;
}

export function ComparisonChart({ scenarios, projections, baselineYear = null }: Props) {
  const width = 760;
  const height = 300;
  const pad = { top: 24, right: 24, bottom: 36, left: 62 };
  const maxYears = Math.max(...projections.map((projection) => projection.points[projection.points.length - 1]?.year ?? 1), 1);
  const maxValue = Math.max(...projections.flatMap((projection) => projection.points.map((point) => point.nominal)), 1);
  const x = (year: number) => pad.left + (year / maxYears) * (width - pad.left - pad.right);
  const y = (value: number) => height - pad.bottom - (value / maxValue) * (height - pad.top - pad.bottom);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const baselineInRange = baselineYear !== null && baselineYear > 0 && baselineYear <= maxYears;
  const baselineAtEdge = baselineYear === maxYears;

  const toPath = (points: Array<{ year: number; nominal: number }>) => points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.year)} ${y(point.nominal)}`).join(' ');

  return (
    <div className="chart-shell">
      <div className="chart-legend">
        {scenarios.map((scenario) => <span key={scenario.id}><i style={{ background: scenario.color }} />{scenario.name}</span>)}
        {baselineYear !== null && <span className="legend-extrapolation"><i className="legend-dash" />外推（基准年之后）</span>}
        <span className="legend-note">名义终值 · 情景模拟</span>
      </div>
      <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="情景终值趋势比较图">
        {ticks.map((tick) => {
          const value = maxValue * tick;
          return <g key={tick}><line x1={pad.left} x2={width - pad.right} y1={y(value)} y2={y(value)} className="grid-line" /><text x={pad.left - 10} y={y(value) + 4} textAnchor="end" className="axis-label">{formatMoney(value)}</text></g>;
        })}
        {baselineInRange && !baselineAtEdge && <rect x={x(baselineYear as number)} y={pad.top} width={x(maxYears) - x(baselineYear as number)} height={height - pad.top - pad.bottom} className="extrapolation-band" />}
        <text x={pad.left} y={height - 10} className="axis-label">第 0 年</text>
        {baselineInRange
          ? <text x={x(baselineYear as number)} y={height - 10} textAnchor={baselineAtEdge || (baselineYear as number) > maxYears * 0.72 ? 'end' : 'start'} className="axis-label baseline-axis-label">{baselineAtEdge ? `基准 · 第 ${baselineYear} 年` : `基准 第 ${baselineYear} 年`}</text>
          : null}
        {!baselineAtEdge && <text x={width - pad.right} y={height - 10} textAnchor="end" className="axis-label">第 {maxYears} 年</text>}
        {projections.map((projection) => {
          const scenario = scenarios.find((item) => item.id === projection.scenarioId);
          if (!scenario) return null;
          if (baselineYear === null) {
            return <path key={projection.scenarioId} d={toPath(projection.points)} className="chart-line" stroke={scenario.color} />;
          }
          const endYear = projection.points[projection.points.length - 1]?.year ?? 0;
          const covered = endYear >= baselineYear;
          const corePoints = projection.points.filter((point) => point.year <= baselineYear);
          const extrapolationPoints = projection.points.filter((point) => point.year >= baselineYear);
          return (
            <g key={projection.scenarioId}>
              {!covered && <path d={toPath(corePoints)} className="chart-line chart-line--uncovered" stroke={scenario.color} />}
              {covered && corePoints.length > 0 && <path d={toPath(corePoints)} className="chart-line" stroke={scenario.color} />}
              {covered && extrapolationPoints.length > 1 && <path d={toPath(extrapolationPoints)} className="chart-line chart-line--extrapolation" stroke={scenario.color} />}
              {!covered && <text x={x(endYear) + 5} y={y(projection.points[projection.points.length - 1].nominal) - 6} className="short-scenario-label">未推演到基准年</text>}
            </g>
          );
        })}
        {baselineInRange && <line x1={x(baselineYear as number)} x2={x(baselineYear as number)} y1={pad.top} y2={height - pad.bottom} className="baseline-marker" />}
      </svg>
    </div>
  );
}
