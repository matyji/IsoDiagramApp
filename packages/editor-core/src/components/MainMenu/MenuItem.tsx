import React, { ReactNode } from 'react';
import { MenuItem as MuiMenuItem, ListItemIcon, Typography } from '@mui/material';

export interface Props {
  onClick?: () => void;
  Icon?: ReactNode;
  children: string | ReactNode;
  disabled?: boolean;
}

export const MenuItem = ({
  onClick,
  Icon,
  children,
  disabled = false
}: Props) => {
  return (
    <MuiMenuItem
      onClick={onClick}
      disabled={disabled}
      sx={{
        mx: 1,
        my: 0.25,
        borderRadius: 2,
        py: 1,
        px: 1.5,
        '&:hover': {
          bgcolor: '#f1f5f9',
        },
        '&.Mui-disabled': {
          opacity: 0.5
        }
      }}
    >
      {Icon && (
        <ListItemIcon
          sx={{
            minWidth: '32px !important',
            color: '#64748b',
            '& svg': {
              fontSize: 20
            }
          }}
        >
          {Icon}
        </ListItemIcon>
      )}
      <Typography
        variant="body2"
        sx={{
          fontWeight: 500,
          color: '#334155',
          fontSize: '0.875rem'
        }}
      >
        {children}
      </Typography>
    </MuiMenuItem>
  );
};
