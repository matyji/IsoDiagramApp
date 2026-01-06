import React from 'react';
import { Box, SxProps, Typography, Stack } from '@mui/material';

interface Props {
  children: React.ReactNode;
  title?: string;
  valueDisplay?: string;
  sx?: SxProps;
}

export const Section = ({ children, sx, title, valueDisplay }: Props) => {
  return (
    <Box
      sx={{
        pt: 3,
        px: 3,
        ...sx
      }}
    >
      <Stack>
        {title && (
          <Stack direction="row" justifyContent="space-between" alignItems="center" pb={1}>
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
            {valueDisplay && (
              <Box
                sx={{
                  bgcolor: '#f1f5f9',
                  px: 1,
                  py: 0.25,
                  borderRadius: 1,
                  color: '#64748b',
                  fontSize: '10px',
                  fontWeight: 600
                }}
              >
                {valueDisplay}
              </Box>
            )}
          </Stack>
        )}
        {children}
      </Stack>
    </Box>
  );
};
