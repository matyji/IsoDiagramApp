import React, { memo } from 'react';
import { Box } from '@mui/material';
import chroma from 'chroma-js';
import { useScene } from 'src/hooks/useScene';
import { IsoTileArea } from 'src/components/IsoTileArea/IsoTileArea';
import { getColorVariant, getTilePosition } from 'src/utils';
import { useColor } from 'src/hooks/useColor';
import { PROJECTED_TILE_SIZE } from 'src/config';

type Props = ReturnType<typeof useScene>['rectangles'][0];

export const Rectangle = memo(({ from, to, color: colorId, customColor, height = 0 }: Props) => {
  const predefinedColor = useColor(colorId);

  // Use custom color if provided, otherwise use predefined color
  const color = customColor
    ? { value: customColor }
    : predefinedColor;

  if (!color) {
    return null;
  }

  // Normalize range for consistent geometry calculation
  const x_min = Math.min(from.x, to.x);
  const x_max = Math.max(from.x, to.x);
  const y_min = Math.min(from.y, to.y);
  const y_max = Math.max(from.y, to.y);

  if (height <= 0) {
    const transparentFill = chroma(color.value).alpha(0.7).css();
    return (
      <IsoTileArea
        from={{ x: x_min, y: y_min }}
        to={{ x: x_max, y: y_max }}
        fill={transparentFill}
        cornerRadius={22}
        stroke={{
          color: getColorVariant(color.value, 'dark', { grade: 2, alpha: 1 }),
          width: 1
        }}
      />
    );
  }

  // Force actual opacity for 3D version to satisfy the volume perception
  const baseColor = chroma(color.value).alpha(1).css();

  const halfW = PROJECTED_TILE_SIZE.width / 2;
  const halfH = PROJECTED_TILE_SIZE.height / 2;

  // Corner points of the area on the floor (isometric grid)
  const P_near = getTilePosition({ tile: { x: x_min, y: y_min } });
  P_near.y += halfH;

  const P_far = getTilePosition({ tile: { x: x_max, y: y_max } });
  P_far.y -= halfH;

  const P_right = getTilePosition({ tile: { x: x_max, y: y_min } });
  P_right.x += halfW;

  const P_left = getTilePosition({ tile: { x: x_min, y: y_max } });
  P_left.x -= halfW;

  // Elevated coordinates for the Top face (displaced vertically by height)
  const T_near = { x: P_near.x, y: P_near.y - height };
  const T_far = { x: P_far.x, y: P_far.y - height };
  const T_right = { x: P_right.x, y: P_right.y - height };
  const T_left = { x: P_left.x, y: P_left.y - height };

  const sideColorRight = getColorVariant(baseColor, 'dark', { grade: 0.5, alpha: 1 });
  const sideColorLeft = getColorVariant(baseColor, 'dark', { grade: 1.2, alpha: 1 });
  const strokeColor = getColorVariant(baseColor, 'dark', { grade: 2, alpha: 1 });
  // Ghost edges for better volume perception
  const hiddenStrokeColor = getColorVariant(baseColor, 'dark', { grade: 0.8, alpha: 0.3 });

  return (
    <Box sx={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' }}>
      <svg
        style={{ position: 'absolute', overflow: 'visible', pointerEvents: 'none' }}
      >
        {/* Hidden internal edges (Back edges) */}
        <polyline
          points={`${P_far.x},${P_far.y} ${P_right.x},${P_right.y}`}
          stroke={hiddenStrokeColor}
          strokeWidth="1"
          strokeDasharray="4 2"
          fill="none"
        />
        <polyline
          points={`${P_far.x},${P_far.y} ${P_left.x},${P_left.y}`}
          stroke={hiddenStrokeColor}
          strokeWidth="1"
          strokeDasharray="4 2"
          fill="none"
        />
        <polyline
          points={`${P_far.x},${P_far.y} ${T_far.x},${T_far.y}`}
          stroke={hiddenStrokeColor}
          strokeWidth="1"
          strokeDasharray="4 2"
          fill="none"
        />

        {/* Left Side Face */}
        <polygon
          points={`${P_near.x},${P_near.y} ${P_left.x},${P_left.y} ${T_left.x},${T_left.y} ${T_near.x},${T_near.y}`}
          fill={sideColorLeft}
          stroke={strokeColor}
          strokeWidth="1.2"
          strokeLinejoin="round"
          pointerEvents="auto"
        />
        {/* Right Side Face */}
        <polygon
          points={`${P_near.x},${P_near.y} ${P_right.x},${P_right.y} ${T_right.x},${T_right.y} ${T_near.x},${T_near.y}`}
          fill={sideColorRight}
          stroke={strokeColor}
          strokeWidth="1.2"
          strokeLinejoin="round"
          pointerEvents="auto"
        />
        {/* Top Face */}
        <polygon
          points={`${T_near.x},${T_near.y} ${T_right.x},${T_right.y} ${T_far.x},${T_far.y} ${T_left.x},${T_left.y}`}
          fill={baseColor}
          stroke={strokeColor}
          strokeWidth="1.2"
          strokeLinejoin="round"
          pointerEvents="auto"
        />
      </svg>
    </Box>
  );
});
