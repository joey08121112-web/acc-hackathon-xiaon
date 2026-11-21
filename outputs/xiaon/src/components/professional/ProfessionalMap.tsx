/** 专业模式的五维地图：复用探索地图的形象，按测评进度依次点亮；五站全部融合星溪世界互动探索游戏：
 * 理解花园（星溪镇）、逻辑小桥（断桥真伪录）、计算工坊（符号炼金台）、生活集市（星溪策算司）、空间山丘（星象风车台）。 */
import { Check, Compass, Gamepad2, SearchCheck, Store, Wrench } from 'lucide-react';
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
  logicDone = false,
  calcDone = false,
  marketDone = false,
  spatialDone = false,
}: {
  stateOf: (m: MapModule) => MapNodeState;
  onNode: (m: MapModule) => void;
  starbrookDone?: boolean;
  logicDone?: boolean;
  calcDone?: boolean;
  marketDone?: boolean;
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
        const isLogic = m === '逻辑';
        const isCalc = m === '计算';
        const isMarket = m === '建模';
        const isSpatial = m === '空间想象';
        const isGameNode = isStarbrook || isLogic || isCalc || isMarket || isSpatial;

        const subLabel = isStarbrook
          ? starbrookDone || state === 'done'
            ? '星溪镇 · 重游'
            : '星溪镇 · 启程'
          : isLogic
            ? logicDone || state === 'done'
              ? '断桥真伪录 · 重探'
              : '断桥真伪录 · 探索'
            : isCalc
              ? calcDone || state === 'done'
                ? '符号炼金台 · 重校'
                : '符号炼金台 · 探索'
              : isMarket
                ? marketDone || state === 'done'
                  ? '星溪策算司 · 重算'
                  : '星溪策算司 · 探索'
                : isSpatial
                  ? spatialDone || state === 'done'
                    ? '星象风车台 · 重测'
                    : '星象风车台 · 探索'
                  : labels[state];

        const nodeClass = [
          'map-node',
          `node-${i}`,
          isStarbrook ? 'map-node-starbrook' : '',
          isLogic ? 'map-node-logic' : '',
          isCalc ? 'map-node-calc' : '',
          isMarket ? 'map-node-market' : '',
          isSpatial ? 'map-node-spatial' : '',
        ]
          .filter(Boolean)
          .join(' ');

        const tagClass = isGameNode
          ? [
              'map-node-game-tag',
              isLogic ? 'map-node-game-tag-logic' : '',
              isCalc ? 'map-node-game-tag-calc' : '',
              isMarket ? 'map-node-game-tag-market' : '',
              isSpatial ? 'map-node-game-tag-spatial' : '',
            ]
              .filter(Boolean)
              .join(' ')
          : undefined;

        const gameKey = isStarbrook
          ? 'starbrook'
          : isLogic
            ? 'logic-bridge'
            : isCalc
              ? 'calc-workshop'
              : isMarket
                ? 'market-model'
                : isSpatial
                  ? 'spatial-hill'
                  : undefined;

        return (
          <button
            key={m}
            className={nodeClass}
            data-state={state}
            data-game={gameKey}
            aria-current={state === 'current' ? 'step' : undefined}
            onClick={() => onNode(m)}
          >
            <span className="node-icon" style={{ background: d.color }}>
              {isStarbrook ? (
                <Gamepad2 size={25} />
              ) : isLogic ? (
                <SearchCheck size={24} />
              ) : isCalc ? (
                <Wrench size={24} />
              ) : isMarket ? (
                <Store size={24} />
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
            <small className={tagClass}>{subLabel}</small>
          </button>
        );
      })}
    </div>
  );
}
