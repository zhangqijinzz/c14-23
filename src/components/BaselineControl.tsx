import type { BaselineSetting } from '../types';

interface Props {
  /** null = 旧版工作区（尚无基准年设置），按旧口径渲染。 */
  setting: BaselineSetting | null;
  baselineYear: number | null;
  error: string | null;
  shortestYear: number | null;
  longestYear: number | null;
  onToggleEnabled: (enabled: boolean) => void;
  onYearChange: (year: number) => void;
  onReset: () => void;
}

export function BaselineControl({ setting, baselineYear, error, shortestYear, longestYear, onToggleEnabled, onYearChange, onReset }: Props) {
  const enabled = setting?.enabled ?? false;
  const manualYear = setting?.manualYear;
  const isManual = enabled && typeof manualYear === 'number' && manualYear === baselineYear && !error;

  return (
    <div className={`baseline-bar ${enabled ? 'is-enabled' : ''}`}>
      <label className="baseline-toggle">
        <input type="checkbox" checked={enabled} onChange={(event) => onToggleEnabled(event.target.checked)} />
        <span>统一比较基准年</span>
      </label>
      {enabled ? (
        <div className="baseline-config">
          <label className="baseline-year-field">
            <span>基准年</span>
            <div className={`baseline-input-wrap ${error ? 'has-error' : ''}`}>
              <input
                aria-label="统一比较基准年"
                type="number"
                min={1}
                max={longestYear ?? 60}
                step={1}
                value={typeof manualYear === 'number' ? (Number.isNaN(manualYear) ? '' : manualYear) : ''}
                placeholder={baselineYear === null ? '—' : String(baselineYear)}
                onChange={(event) => onYearChange(event.target.value === '' ? Number.NaN : Number(event.target.value))}
              />
              <em>年</em>
            </div>
          </label>
          <button type="button" className="baseline-reset" onClick={onReset} disabled={typeof manualYear !== 'number'}>恢复最短年限</button>
          <p className="baseline-hint" role={error ? 'alert' : undefined}>
            {error
              ? error
              : baselineYear === null
                ? '参数修正后自动取最短年限'
                : isManual
                  ? <>第 <strong>{baselineYear}</strong> 年为手动基准；汇总只统计推演到该年的情景，之后为外推。</>
                  : <>默认取最短情景的 <strong>{shortestYear}</strong> 年；汇总只统计推演到该年的情景，之后为外推。</>}
          </p>
        </div>
      ) : (
        <p className="baseline-hint baseline-hint--muted">
          未启用时各情景按各自年限的终值并列，年限不同会让比较失真；启用后统一到同一年，超出部分标记为外推。
        </p>
      )}
    </div>
  );
}
