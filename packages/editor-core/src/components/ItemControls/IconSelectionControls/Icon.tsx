import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { Button, Typography } from '@mui/material';
import { Icon as IconI } from 'src/types';

const SIZE = 48;

interface Props {
  icon: IconI;
  isSelected?: boolean;
  onClick?: () => void;
  onMouseDown?: () => void;
  onDoubleClick?: () => void;
}

export const Icon = ({ icon, isSelected = false, onClick, onMouseDown, onDoubleClick }: Props) => {
  return (
    <Button
      variant="text"
      onClick={onClick}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      sx={{
        userSelect: 'none',
        minWidth: 'auto',
        p: 0,
        width: 50,
        height: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 1.5,
        border: isSelected ? '2px solid #3b82f6' : '1px solid #f1f5f9',
        bgcolor: 'white',
        '&:hover': {
          bgcolor: '#f8fafc',
          borderColor: isSelected ? '#3b82f6' : '#cbd5e1'
        },
        transition: 'all 0.2s ease-in-out'
      }}
    >
      <Box sx={{ width: SIZE, height: SIZE, p: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box
          component="img"
          draggable={false}
          src={icon.url}
          alt={`Icon ${icon.name}`}
          sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </Box>
    </Button>
  );
};
