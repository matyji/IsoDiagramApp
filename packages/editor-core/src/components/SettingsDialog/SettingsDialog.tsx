import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Tabs,
  Tab,
  Box
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { HotkeySettings } from '../HotkeySettings/HotkeySettings';
import { PanSettings } from '../PanSettings/PanSettings';
import { ZoomSettings } from '../ZoomSettings/ZoomSettings';
import { LabelSettings } from '../LabelSettings/LabelSettings';
import { ConnectorSettings } from '../ConnectorSettings/ConnectorSettings';
import { IconPackSettings } from '../IconPackSettings/IconPackSettings';
import { useTranslation } from 'src/stores/localeStore';

export interface SettingsDialogProps {
  iconPackManager?: {
    lazyLoadingEnabled: boolean;
    onToggleLazyLoading: (enabled: boolean) => void;
    packInfo: Array<{
      name: string;
      displayName: string;
      loaded: boolean;
      loading: boolean;
      error: string | null;
      iconCount: number;
    }>;
    enabledPacks: string[];
    onTogglePack: (packName: string, enabled: boolean) => void;
  };
}

export const SettingsDialog = ({ iconPackManager }: SettingsDialogProps) => {
  const dialog = useUiStateStore((state) => state.dialog);
  const setDialog = useUiStateStore((state) => state.actions.setDialog);
  const [tabValue, setTabValue] = useState(0);
  const { t } = useTranslation();

  const isOpen = dialog === 'SETTINGS';

  const handleClose = () => {
    setDialog(null);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {t('settings.title') || 'Settings'}
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{
            color: '#94a3b8',
            bgcolor: '#f8fafc',
            '&:hover': {
              bgcolor: '#f1f5f9',
              color: '#64748b'
            },
            width: 32,
            height: 32,
            transition: 'all 0.2s'
          }}
        >
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{
          bgcolor: '#f8fafc',
          borderRadius: 3,
          p: 0.5,
          mb: 3,
          display: 'inline-flex'
        }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            sx={{
              '& .MuiTabs-indicator': { display: 'none' },
              '& .MuiTab-root': {
                borderRadius: 2.5,
                '&.Mui-selected': {
                  bgcolor: 'white',
                  boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
                  color: '#2563eb'
                }
              }
            }}
          >
            <Tab label={t('settings.hotkeys.title')} />
            <Tab label={t('settings.pan.title') || 'Pan'} />
            <Tab label="Zoom" />
            <Tab label="Labels" />
            <Tab label={t('settings.connector.title')} />
            {iconPackManager && <Tab label={t('settings.iconPacks.title')} />}
          </Tabs>
        </Box>

        <Box>
          {tabValue === 0 && <HotkeySettings />}
          {tabValue === 1 && <PanSettings />}
          {tabValue === 2 && <ZoomSettings />}
          {tabValue === 3 && <LabelSettings />}
          {tabValue === 4 && <ConnectorSettings />}
          {tabValue === 5 && iconPackManager && (
            <IconPackSettings
              lazyLoadingEnabled={iconPackManager.lazyLoadingEnabled}
              onToggleLazyLoading={iconPackManager.onToggleLazyLoading}
              packInfo={iconPackManager.packInfo}
              enabledPacks={iconPackManager.enabledPacks}
              onTogglePack={iconPackManager.onTogglePack}
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={handleClose}
          variant="text"
          sx={{ color: '#64748b' }}
        >
          {t('common.cancel') || 'Cancel'}
        </Button>
        <Button
          onClick={handleClose}
          sx={{ px: 4 }}
        >
          {t('common.done') || 'Done'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};