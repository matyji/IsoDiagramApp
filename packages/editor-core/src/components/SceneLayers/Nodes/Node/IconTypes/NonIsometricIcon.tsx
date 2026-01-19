import React from 'react';
import { Box } from '@mui/material';
import { Icon } from 'src/types';
import { PROJECTED_TILE_SIZE } from 'src/config';
import { getIsoProjectionCss } from 'src/utils';

interface Props {
  icon: Icon;
  scale?: number;
}

export const NonIsometricIcon = ({ icon, scale }: Props) => {
  const finalScale = scale ?? icon.scale ?? 1;
  return (
    <Box sx={{ pointerEvents: 'none' }}>
      <Box
        sx={{
          position: 'absolute',
          left: -PROJECTED_TILE_SIZE.width / 2,
          top: -PROJECTED_TILE_SIZE.height / 2,
          width: PROJECTED_TILE_SIZE.width,
          height: PROJECTED_TILE_SIZE.height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transformOrigin: 'center center',
          transform: getIsoProjectionCss()
        }}
      >
        <Box
          component="img"
          src={icon.url}
          alt={`icon-${icon.id}`}
          sx={{
            maxWidth: '80%',
            maxHeight: '80%',
            transform: `scale(${finalScale})`
          }}
        />
      </Box>
    </Box>
  );
};
