import React from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import { Section } from './Section';

interface Props {
  title: string;
}

export const Header = ({ title }: Props) => {
  return (
    <Section sx={{ py: 2, borderBottom: '1px solid #f1f5f9' }}>
      <Typography
        variant="caption"
        sx={{
          color: '#64748b',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}
      >
        {title}
      </Typography>
    </Section>
  );
};
