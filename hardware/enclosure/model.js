import modeling from '@jscad/modeling';
import { dimensions as d } from './dimensions.js';

const { booleans, extrusions, primitives, transforms } = modeling;
const { subtract, union } = booleans;
const { extrudeLinear } = extrusions;
const { cuboid, cylinder, roundedRectangle } = primitives;
const { translate } = transforms;

const rounded = (size, radius, z) => {
  const safeRadius = Math.min(radius, size[0] / 2 - 0.01, size[1] / 2 - 0.01);
  const profile = roundedRectangle({
    size: [size[0], size[1]],
    roundRadius: safeRadius,
    segments: 48,
  });
  return translate(
    [0, 0, z - size[2] / 2],
    extrudeLinear({ height: size[2] }, profile),
  );
};

export function makeBase() {
  const innerLength = d.shellLength - 2 * d.wall;
  const innerWidth = d.shellWidth - 2 * d.wall;
  const cavityHeight = d.baseHeight - d.floor + 0.2;

  const body = rounded(
    [d.shellLength, d.shellWidth, d.baseHeight],
    d.cornerRadius,
    d.baseHeight / 2,
  );
  const cavity = rounded(
    [innerLength, innerWidth, cavityHeight],
    Math.max(1, d.cornerRadius - d.wall),
    d.floor + cavityHeight / 2 + 0.1,
  );

  const usbWindow = translate(
    [d.shellLength / 2, 0, d.usbWindowBottom + d.usbWindowHeight / 2],
    cuboid({ size: [d.wall * 3, d.usbWindowWidth, d.usbWindowHeight] }),
  );

  const lugCenterX = -d.shellLength / 2 - d.lanyardLugLength / 2 + 2;
  const lug = rounded(
    [d.lanyardLugLength, d.lanyardLugWidth, d.lanyardLugHeight],
    3,
    d.lanyardLugHeight / 2,
  );
  const movedLug = translate([lugCenterX, 0, 0], lug);
  const lanyardHole = translate(
    [lugCenterX - 1, 0, -0.5],
    cylinder({ height: d.lanyardLugHeight + 1, radius: d.lanyardHoleDiameter / 2, segments: 48 }),
  );

  const railLength = Math.min(d.boardLength - 6, innerLength - 10);
  const railOffsetY = d.boardWidth / 2 + d.boardClearance / 2;
  const rail = cuboid({ size: [railLength, 2.2, 2.2] });
  const rails = union(
    translate([0, railOffsetY, d.floor + 1.1], rail),
    translate([0, -railOffsetY, d.floor + 1.1], rail),
  );

  return union(subtract(union(body, movedLug), cavity, usbWindow, lanyardHole), rails);
}

export function makeLid() {
  const innerLength = d.shellLength - 2 * d.wall;
  const innerWidth = d.shellWidth - 2 * d.wall;
  const lipOuterLength = innerLength - 2 * d.fitClearance;
  const lipOuterWidth = innerWidth - 2 * d.fitClearance;
  const lipInnerLength = lipOuterLength - 2 * d.lidLipWall;
  const lipInnerWidth = lipOuterWidth - 2 * d.lidLipWall;

  const top = rounded(
    [d.shellLength, d.shellWidth, d.lidTopThickness],
    d.cornerRadius,
    d.lidLipHeight + d.lidTopThickness / 2,
  );
  const lipOuter = rounded(
    [lipOuterLength, lipOuterWidth, d.lidLipHeight],
    Math.max(1, d.cornerRadius - d.wall - d.fitClearance),
    d.lidLipHeight / 2,
  );
  const lipInner = rounded(
    [lipInnerLength, lipInnerWidth, d.lidLipHeight + 0.2],
    Math.max(1, d.cornerRadius - d.wall - d.fitClearance - d.lidLipWall),
    d.lidLipHeight / 2 - 0.1,
  );
  const lipRing = subtract(lipOuter, lipInner);

  const pocketZ = d.lidLipHeight + d.fsrPocketDepth / 2 - 0.01;
  const fsrPocket = translate(
    [0, 0, pocketZ],
    cylinder({ height: d.fsrPocketDepth + 0.02, radius: d.fsrPocketDiameter / 2, segments: 64 }),
  );
  const wireChannel = translate(
    [0, d.shellWidth / 4, pocketZ],
    cuboid({ size: [4, d.shellWidth / 2, d.fsrPocketDepth + 0.02] }),
  );

  const pressurePad = rounded(
    [d.pressurePadLength, d.pressurePadWidth, d.pressurePadHeight],
    6,
    d.lidLipHeight + d.lidTopThickness + d.pressurePadHeight / 2,
  );

  return union(subtract(union(top, lipRing), fsrPocket, wireChannel), pressurePad);
}

export function makeFitGauge() {
  const outerLength = 32;
  const innerLength = outerLength - 2 * d.wall;
  const base = subtract(
    rounded([outerLength, d.shellWidth, 8], 5, 4),
    rounded([innerLength, d.shellWidth - 2 * d.wall, 7], 3, 5),
  );
  const lid = translate(
    [38, 0, 0],
    subtract(
      rounded([outerLength, d.shellWidth, 2], 5, d.lidLipHeight + 1),
      cuboid({ size: [1, 1, 1] }),
    ),
  );
  return union(base, lid);
}
