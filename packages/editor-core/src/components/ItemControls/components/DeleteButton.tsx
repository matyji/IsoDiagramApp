import React from 'react';
import { DeleteOutlined as DeleteIcon } from '@mui/icons-material';
import { Button } from '@mui/material';

interface Props {
  onClick: () => void;
}

export const DeleteButton = ({ onClick }: Props) => {
  return (
    <Button
      fullWidth
      sx={{
        bgcolor: '#fff1f2',
        color: '#e11d48',
        borderRadius: 2,
        py: 1.5,
        fontWeight: 700,
        fontSize: '0.75rem',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        '&:hover': {
          bgcolor: '#ffe4e6'
        },
        boxShadow: 'none',
        border: 'none'
      }}
      startIcon={<DeleteIcon sx={{ fontSize: '18px !important' }} />}
      onClick={onClick}
    >
      Delete Element
    </Button>
  );
};
