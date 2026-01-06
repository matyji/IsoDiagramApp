import React from 'react';
import { Card, SxProps } from '@mui/material';

interface Props {
  children: React.ReactNode;
  sx?: SxProps;
  style?: React.CSSProperties;
}

export const UiElement = ({ children, sx, style }: Props) => {
  return (
    <Card
      sx={{
        borderRadius: 4,
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        border: 'none',
        p: 0.5,
        ...sx
      }}
      style={style}
    >
      {children}
    </Card>
  );
};
