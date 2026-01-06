import React, { useState, useCallback, useEffect } from 'react';
import { Box, Stack, Button, IconButton as MUIIconButton, Typography } from '@mui/material';
import {
  ChevronRight as ChevronRightIcon,
  ChevronLeft as ChevronLeftIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useIconCategories } from 'src/hooks/useIconCategories';
import { useIcon } from 'src/hooks/useIcon';
import { useScene } from 'src/hooks/useScene';
import { useViewItem } from 'src/hooks/useViewItem';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useModelItem } from 'src/hooks/useModelItem';
import { ControlsContainer } from '../components/ControlsContainer';
import { Icons } from '../IconSelectionControls/Icons';
import { NodeSettings } from './NodeSettings/NodeSettings';
import { Section } from '../components/Section';
import { QuickIconSelector } from './QuickIconSelector';

interface Props {
  id: string;
}

const ModeOptions = {
  SETTINGS: 'SETTINGS',
  CHANGE_ICON: 'CHANGE_ICON'
} as const;

type Mode = keyof typeof ModeOptions;

export const NodeControls = ({ id }: Props) => {
  const [mode, setMode] = useState<Mode>('SETTINGS');
  const { updateModelItem, updateViewItem, deleteViewItem } = useScene();
  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });
  const viewItem = useViewItem(id);
  const modelItem = useModelItem(id);
  const { iconCategories } = useIconCategories();
  const { icon } = useIcon(modelItem?.icon || '');

  const onSwitchMode = useCallback((newMode: Mode) => {
    setMode(newMode);
  }, []);

  // Listen for quick icon change event (triggered by 'i' hotkey)
  useEffect(() => {
    const handleQuickIconChange = () => {
      setMode('CHANGE_ICON');
    };

    window.addEventListener('quickIconChange', handleQuickIconChange);
    return () => {
      window.removeEventListener('quickIconChange', handleQuickIconChange);
    };
  }, []);

  // If items don't exist, return null (component will unmount)
  if (!viewItem || !modelItem) {
    return null;
  }

  return (
    <ControlsContainer>
      <Box
        sx={{
          bgcolor: 'white',
          position: 'relative',
          pt: 4,
          pb: 2,
          borderBottom: '1px solid #f1f5f9'
        }}
      >
        {/* Close button */}
        <MUIIconButton
          aria-label="Close"
          onClick={() => {
            return uiStateActions.setItemControls(null);
          }}
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 2,
            color: '#cbd5e1',
            '&:hover': {
              color: '#94a3b8'
            }
          }}
          size="small"
        >
          <CloseIcon sx={{ fontSize: 20 }} />
        </MUIIconButton>

        <Stack alignItems="center" spacing={2}>
          <Box
            sx={{
              width: 80,
              height: 80,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 3,
              border: '1px solid #f1f5f9',
              bgcolor: 'white',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)'
            }}
          >
            <Box
              component="img"
              src={icon.url}
              sx={{ width: 48, height: 48, objectFit: 'contain' }}
            />
          </Box>
          <Typography
            variant="caption"
            sx={{
              color: '#94a3b8',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}
          >
            Node
          </Typography>
        </Stack>

        <Section sx={{ mt: 1, px: 3, pt: 0 }}>
          <Stack direction="row" justifyContent="center">
            {mode === 'SETTINGS' && (
              <Button
                size="small"
                onClick={() => {
                  onSwitchMode('CHANGE_ICON');
                }}
                variant="text"
                sx={{
                  color: '#2563eb',
                  fontWeight: 600,
                  fontSize: '0.75rem'
                }}
              >
                Change Icon
              </Button>
            )}
            {mode === 'CHANGE_ICON' && (
              <Button
                size="small"
                startIcon={<ChevronLeftIcon />}
                onClick={() => {
                  onSwitchMode('SETTINGS');
                }}
                variant="text"
                sx={{
                  color: '#2563eb',
                  fontWeight: 600,
                  fontSize: '0.75rem'
                }}
              >
                Back to Settings
              </Button>
            )}
          </Stack>
        </Section>
      </Box>
      {mode === 'SETTINGS' && (
        <NodeSettings
          key={viewItem.id}
          node={viewItem}
          onModelItemUpdated={(updates) => {
            updateModelItem(viewItem.id, updates);
          }}
          onViewItemUpdated={(updates) => {
            updateViewItem(viewItem.id, updates);
          }}
          onDeleted={() => {
            uiStateActions.setItemControls(null);
            deleteViewItem(viewItem.id);
          }}
        />
      )}
      {mode === 'CHANGE_ICON' && (
        <QuickIconSelector
          currentIconId={modelItem.icon}
          onIconSelected={(_icon) => {
            updateModelItem(viewItem.id, { icon: _icon.id });
          }}
          onClose={() => {
            onSwitchMode('SETTINGS');
          }}
        />
      )}
    </ControlsContainer>
  );
};
