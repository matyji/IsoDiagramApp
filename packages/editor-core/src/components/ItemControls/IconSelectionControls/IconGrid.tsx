import React from 'react';
import { Icon as IconI } from 'src/types';
import { Grid, Box } from '@mui/material';
import { Icon } from './Icon';

interface Props {
  icons: IconI[];
  selectedIconId?: string;
  onMouseDown?: (icon: IconI) => void;
  onClick?: (icon: IconI) => void;
  onDoubleClick?: (icon: IconI) => void;
  hoveredIndex?: number;
  onHover?: (index: number) => void;
}

export const IconGrid = ({ icons, selectedIconId, onMouseDown, onClick, onDoubleClick, hoveredIndex, onHover }: Props) => {
  return (
    <Grid container spacing={1} sx={{ px: 1 }}>
      {icons.map((icon, index) => {
        return (
          <Grid item xs={3} key={icon.id} sx={{ display: 'flex', justifyContent: 'center' }} onMouseEnter={() => onHover?.(index)}>
            <Icon
              icon={icon}
              isSelected={selectedIconId === icon.id}
              onClick={() => {
                onClick?.(icon);
              }}
              onMouseDown={() => {
                onMouseDown?.(icon);
              }}
              onDoubleClick={() => {
                onDoubleClick?.(icon);
              }}
            />
          </Grid>
        );
      })}
    </Grid>
  );
};
