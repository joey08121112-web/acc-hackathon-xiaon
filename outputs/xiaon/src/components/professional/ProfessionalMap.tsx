/** 专业模式的五维地图：复用探索地图的形象，按测评进度依次点亮；第一站「理解花园」深度融合星溪镇互动游戏。 */
import { Check, Gamepad2 } from 'lucide-react';
import { INTERVIEW_MODULE_ORDER } from '../../../shared/learning-contracts';
import { MapArt } from '../../Art';
import { dimensionDetails } from '../../data';
import { icons } from '../learning/ExplorationMap';

export type MapModule = (typeof INTERVIEW_MODULE_ORDER)[number];
export type MapNodeState = 'done' | 'current' | 'waiting';
export const placeOf = (m: string) => dimensionDetails.find((d) => d.name === m)?.place ?? m;

const labels: Record<MapNodeState, string> = {
  done: '已点亮',
  current: '点这里进入',
  waiting: '待探索',
};

export function ProfessionalMap({
  stateOf,
  onNode,
  starbrookDone = false,
}: {
  stateOf: (m: MapModule) => MapNodeState;
  onNode: (m: MapModule) => void;
  starbrookDone?: boolean;
}) {
  return (
    <div className="exploration-map professional-map" role="group" aria-label="五维地图">
      <MapArt />
      <span className="map-stamp">
        小N的探索手记
        <br />
        <small>五站 · 依次点亮</small>
      </span>
      {INTERVIEW_MODULE_ORDER.map((m, i) => {
        const d = dimensionDetails[i];
        const Icon = icons[i];
        const state = stateOf(m);
        const isStarbrook = m === '理解';
        const subLabel = isStarbrook
          ? starbrookDone || state === 'done'
            ? '已点亮 · 再逛星溪镇'
            : '点此进星溪镇'
          : labels[state];
        return (
          <button
            key={m}
            className={`map-node node-${i}${isStarbrook ? ' map-node-starbrook' : ''}`}
            data-state={state}
            data-game={isStarbrook ? 'starbrook' : undefined}
            aria-current={state === 'current' ? 'step' : undefined}
            onClick={() => onNode(m)}
          >
            <span className="node-icon" style={{ background: d.color }}>
              {isStarbrook ? <Gamepad2 size={25} /> : <Icon size={25} />}
              {state === 'done' && (
                <i>
                  <Check size={12} />
                </i>
              )}
              {isStarbrook && state !== 'done' && (
                <em className="node-game-dot" aria-hidden="true">
                  游
                </em>
              )}
            </span>
            <strong>{d.place}</strong>
            {isStarbrook && <span className="map-node-game-tag">理解能力 · 星溪镇</span>}
            <small>{subLabel}</small>
          </button>
        );
      })}
    </div>
  );
}
