import React, { useState } from 'react';
import { Divider, Stack, Typography, Button } from '@mui/material';
import {
  ExpandMore as ChevronDownIcon,
  ExpandLess as ChevronUpIcon
} from '@mui/icons-material';
import { Icon as IconI } from 'src/types';
import { Section } from 'src/components/ItemControls/components/Section';
import { IconGrid } from './IconGrid';

interface Props {
  id?: string;
  icons: IconI[];
  selectedIconId?: string;
  onClick?: (icon: IconI) => void;
  onMouseDown?: (icon: IconI) => void;
  isExpanded: boolean;
}

export const IconCollection = ({
  id,
  icons,
  selectedIconId,
  onClick,
  onMouseDown,
  isExpanded: _isExpanded
}: Props) => {
  const [isExpanded, setIsExpanded] = useState(_isExpanded);

  return (
    <Section sx={{ py: 0 }}>
      <Button
        variant="text"
        fullWidth
        onClick={() => {
          return setIsExpanded(!isExpanded);
        }}
        sx={{
          py: 1,
          px: 1,
          justifyContent: 'flex-start',
          '&:hover': { bgcolor: '#f8fafc' }
        }}
      >
        <Stack
          sx={{ width: '100%' }}
          direction="row"
          spacing={2}
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography
            variant="caption"
            sx={{
              color: '#64748b',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            {id || 'Icons'}
          </Typography>
          {isExpanded ? (
            <ChevronUpIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
          ) : (
            <ChevronDownIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
          )}
        </Stack>
      </Button>
      <Divider sx={{ mb: 1.5, opacity: 0.5 }} />

      {isExpanded && (
        <IconGrid
          icons={icons}
          selectedIconId={selectedIconId}
          onMouseDown={onMouseDown}
          onClick={onClick}
        />
      )}
    </Section>
  );
};
