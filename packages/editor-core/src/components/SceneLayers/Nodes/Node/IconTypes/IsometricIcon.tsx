import React, { useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import { PROJECTED_TILE_SIZE } from 'src/config';
import { useResizeObserver } from 'src/hooks/useResizeObserver';

interface Props {
  url: string;
  scale?: number;
  isImported?: boolean;
  onImageLoaded?: () => void;
}

export const IsometricIcon = ({ url, scale = 1, isImported, onImageLoaded }: Props) => {
  const ref = useRef();
  const { size, observe, disconnect } = useResizeObserver();

  useEffect(() => {
    if (!ref.current) return;

    observe(ref.current);

    return disconnect;
  }, [observe, disconnect]);

  return (
    <Box
      ref={ref}
      component="img"
      onLoad={onImageLoaded}
      src={url}
      sx={{
        position: 'absolute',
        // Imported icons are often square and look huge if they take 80% of tile width.
        // Base icons are wide (ratio ~1.6), so 80% width is fine.
        // For square icons, 55% of width is more comparable to base icons.
        width: PROJECTED_TILE_SIZE.width * (isImported ? 0.55 : 0.8) * scale,
        // Aligns the bottom of the image to the bottom tip of the tile diamond.
        // For imported icons, we lift them by half a tile height to center them on the diamond,
        // because base icons have built-in padding in their SVGs to achieve this.
        // For imported icons (assumed square/centered), we want the CENTER of the image to be at the center of the tile.
        // The natural origin is bottom-center (from top: -size.height, left: -size.width/2).
        // So for imported icons, we just need to shift it down by half its height to place its center at the tile center.
        // Wait, standard behavior aligns bottom. To center it, we lift it by half its height? 
        // No, `top: -size.height` places the image bottom at y=0.
        // We want the image center at y=0 (middle of tile).
        // So we need to push it down by height/2 from that top position.
        // top = -size.height + size.height/2 = -size.height / 2.

        // Let's stick to the previous heuristic but make it scale-aware.
        // The previous fixed offset (PROJECTED_TILE_SIZE.height / 2) was wrong when scaling.
        // We want the visual bottom of the content to be near the tile center.
        // For square icons, simply centering them vertically on the tile center (0,0) is usually best.
        // Since top: -size.height puts the bottom at 0, top: -size.height/2 puts the center at 0.
        top: isImported ? -size.height / 2 : -size.height,
        left: -size.width / 2,
        pointerEvents: 'none'
      }}
    />
  );
};
