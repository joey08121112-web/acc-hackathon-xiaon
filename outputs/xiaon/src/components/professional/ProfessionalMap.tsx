/** 专业模式的五维地图：复用探索地图的形象，按测评进度依次点亮；第一站「理解花园」融合星溪镇、第三站「计算工坊」融合符号拆包坊、第五站「空间山丘」融合星象风车台互动游戏。 */
import { Check, Compass, Gamepad2, Wrench } from 'lucide-react';
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
  calcDone = false,
  spatialDone = false,
}: {
  stateOf: (m: MapModule) => MapNodeState;
  onNode: (m: MapModule) => void;
  starbrookDone?: boolean;
  calcDone?: boolean;
  spatialDone?: boolean;
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
        const isCalc = m === '计算';
        const isSpatial = m === '空间想象';
        const isGameNode = isStarbrook || isCalc || isSpatial;
        const subLabel = isStarbrook
          ? starbrookDone || state === 'done'
            ? '星溪镇 · 再逛逛'
            : '星溪镇 · 点此玩'
          : isCalc
            ? calcDone || state === 'done'
              ? '口袋整理坊 · 再玩'
              : '口袋整理坊 · 点此玩'
            : isSpatial
              ? spatialDone || state === 'done'
                ? '风车山丘 · 再玩'
                : '风车山丘 · 点此玩'
              : labels[state];
        return (
          <button
            key={m}
            className={`map-node node-${i}${isStarbrook ? ' map-node-starbrook' : ''}${isCalc ? ' map-node-calc' : ''}${isSpatial ? ' map-node-spatial' : ''}`}
            data-state={state}
            data-game={
              isStarbrook
                ? 'starbrook'
                : isCalc
                  ? 'calc-workshop'
                  : isSpatial
                    ? 'spatial-hill'
                    : undefined
            }
            aria-current={state === 'current' ? 'step' : undefined}
            onClick={() => onNode(m)}
          >
            <span className="node-icon" style={{ background: d.color }}>
              {isStarbrook ? (
                <Gamepad2 size={25} />
              ) : isCalc ? (
                <Wrench size={24} />
              ) : isSpatial ? (
                <Compass size={25} />
              ) : (
                <Icon size={25} />
              )}
              {state === 'done' && (
                <i>
                  <Check size={12} />
                </i>
              )}
              {isGameNode && state !== 'done' && (
                <em className="node-game-dot" aria-hidden="true">
                  游
                </em>
              )}
            </span>
            <strong>{d.place}</strong>
            <small className={isGameNode ? `map-node-game-tag${isCalc ? ' map-node-game-tag-calc' : isSpatial ? ' map-node-game-tag-spatial' : ''}` : undefined}>
              {subLabel}
            </small>
          </button>
        );
      })}
    </div>
  );
}
