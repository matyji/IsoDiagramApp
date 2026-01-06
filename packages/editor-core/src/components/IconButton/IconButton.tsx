import React, { useMemo } from 'react';
import { Button, Box, useTheme } from '@mui/material';
import Tooltip, { TooltipProps } from '@mui/material/Tooltip';

interface Props {
  name: string;
  Icon: React.ReactNode;
  isActive?: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  tooltipPosition?: TooltipProps['placement'];
  disabled?: boolean;
  size?: 'small' | 'medium';
}

export const IconButton = ({
  name,
  Icon,
  onClick,
  isActive = false,
  disabled = false,
  tooltipPosition = 'bottom',
  size = 'medium'
}: Props) => {
  const theme = useTheme();
  const iconColor = useMemo(() => {
    if (isActive) {
      return 'white';
    }

    if (disabled) {
      return 'grey.400';
    }

    return 'grey.600';
  }, [disabled, isActive]);

  return (
    <Tooltip
      title={name}
      placement={tooltipPosition}
      enterDelay={1000}
      enterNextDelay={1000}
      arrow
    >
      <Button
        variant="text"
        onClick={onClick}
        disabled={disabled}
        sx={{
          borderRadius: 2,
          height: size === 'small' ? 40 : 48,
          width: size === 'small' ? 40 : 48,
          maxWidth: '100%',
          minWidth: 'auto',
          bgcolor: isActive ? '#2563eb' : 'transparent',
          '&:hover': {
            bgcolor: isActive ? '#1d4ed8' : 'grey.100'
          },
          p: 0,
          m: size === 'small' ? 0.25 : 0.5,
          transition: 'all 0.2s ease-in-out'
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            svg: {
              color: iconColor,
              fontSize: size === 'small' ? 20 : 22
            }
          }}
        >
          {Icon}
        </Box>
      </Button>
    </Tooltip>
  );
};
