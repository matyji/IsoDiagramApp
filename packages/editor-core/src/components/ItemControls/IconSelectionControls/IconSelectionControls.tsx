import React, { useCallback, useRef, useState } from 'react';
import { Stack, Alert, IconButton as MUIIconButton, Box, Button, FormControlLabel, Checkbox, Typography, Slider, TextField } from '@mui/material';
import { ControlsContainer } from 'src/components/ItemControls/components/ControlsContainer';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useModelStore } from 'src/stores/modelStore';
import { Icon } from 'src/types';
import { Section } from 'src/components/ItemControls/components/Section';
import { Searchbox } from 'src/components/ItemControls/IconSelectionControls/Searchbox';
import { useIconFiltering } from 'src/hooks/useIconFiltering';
import { useIconCategories } from 'src/hooks/useIconCategories';
import { Close as CloseIcon, FileUpload as FileUploadIcon } from '@mui/icons-material';
import { Icons } from './Icons';
import { IconGrid } from './IconGrid';
import { generateId } from 'src/utils';

export const IconSelectionControls = () => {
  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });
  const mode = useUiStateStore((state) => {
    return state.mode;
  });
  const iconCategoriesState = useUiStateStore((state) => state.iconCategoriesState);
  const modelActions = useModelStore((state) => state.actions);
  const currentIcons = useModelStore((state) => state.icons);
  const { setFilter, filteredIcons, filter } = useIconFiltering();
  const { iconCategories } = useIconCategories();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [treatAsIsometric, setTreatAsIsometric] = useState(true);
  const [iconScale, setIconScale] = useState(100);
  const [showAlert, setShowAlert] = useState(() => {
    // Check localStorage to see if user has dismissed the alert
    return localStorage.getItem('fossflow-show-drag-hint') !== 'false';
  });
  const [customImportName, setCustomImportName] = useState('');


  const onMouseDown = useCallback(
    (icon: Icon) => {
      if (mode.type !== 'PLACE_ICON') return;

      uiStateActions.setMode({
        type: 'PLACE_ICON',
        showCursor: true,
        id: icon.id
      });
    },
    [mode, uiStateActions]
  );

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const dismissAlert = useCallback(() => {
    setShowAlert(false);
    localStorage.setItem('fossflow-show-drag-hint', 'false');
  }, []);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newIcons: Icon[] = [];
    const existingNames = new Set(currentIcons.map(icon => icon.name.toLowerCase()));

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Check if file is an image
      if (!file.type.startsWith('image/')) {
        console.warn(`Skipping non-image file: ${file.name}`);
        continue;
      }

      // Generate unique name
      let baseName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
      let finalName = customImportName || baseName;
      let deduplicatedName = finalName;
      let counter = 1;

      while (existingNames.has(deduplicatedName.toLowerCase())) {
        deduplicatedName = `${finalName}_${counter}`;
        counter++;
      }

      existingNames.add(deduplicatedName.toLowerCase());

      // Upload to server if possible
      let iconUrl = '';
      let result: any = null;

      try {
        const formData = new FormData();
        // Append fields BEFORE file for multer req.body access
        formData.append('name', deduplicatedName);
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          result = await response.json();
          iconUrl = result.url;
        } else {
          throw new Error('Upload failed');
        }
      } catch (err) {
        console.warn('Server upload failed, falling back to Base64:', err);
        // Fallback to Base64 if server is not available
        iconUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      newIcons.push({
        id: result?.filename ? result.filename : `base64-${Date.now()}-${i}`,
        name: deduplicatedName,
        url: iconUrl,
        collection: 'imported',
        isIsometric: treatAsIsometric
      });
    }

    if (newIcons.length > 0) {
      // Add new icons to the model
      const updatedIcons = [...currentIcons, ...newIcons];
      modelActions.set({ icons: updatedIcons });

      // Update icon categories to include imported collection
      const hasImported = iconCategoriesState.some(cat => cat.id === 'imported');
      if (!hasImported) {
        uiStateActions.setIconCategoriesState([
          ...iconCategoriesState,
          { id: 'imported', isExpanded: true }
        ]);
      }
    }

    // Reset input and custom name
    event.target.value = '';
    setCustomImportName('');
  }, [currentIcons, modelActions, iconCategoriesState, uiStateActions, treatAsIsometric, customImportName]);

  return (
    <ControlsContainer
      header={
        <Section
          sx={{
            top: 0,
            pt: 6,
            pb: 3,
            position: 'relative',
            paddingTop: '32px'
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
              padding: 0,
              background: 'none'
            }}
            size="small"
          >
            <CloseIcon />
          </MUIIconButton>
          <Stack spacing={2}>
            <Box sx={{ marginTop: '8px' }}>
              <Searchbox value={filter} onChange={setFilter} />
            </Box>
          </Stack>
        </Section>
      }
    >
      {filteredIcons && (
        <Section>
          <IconGrid icons={filteredIcons} onMouseDown={onMouseDown} />
        </Section>
      )}
      {!filteredIcons && (
        <Icons iconCategories={iconCategories} onMouseDown={onMouseDown} />
      )}

      <Section>
        <Box sx={{
          border: '1px solid #e0e0e0',
          borderRadius: 1,
          p: 1.5,
          backgroundColor: '#f5f5f5'
        }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
            Import Icon
          </Typography>

          <TextField
            fullWidth
            size="small"
            label="Nom de l'icône"
            value={customImportName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomImportName(e.target.value)}
            placeholder="Ex: Serveur Web"
            sx={{ mb: 1.5, backgroundColor: 'white' }}
          />

          <Button
            variant="contained"
            startIcon={<FileUploadIcon />}
            onClick={handleImportClick}
            fullWidth
            sx={{ mb: 1 }}
          >
            Sélectionner Image
          </Button>
          <FormControlLabel
            control={
              <Checkbox
                checked={treatAsIsometric}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTreatAsIsometric(e.target.checked)}
                size="small"
              />
            }
            label={
              <Typography variant="body2">
                Treat as isometric (3D view)
              </Typography>
            }
            sx={{ mt: 1, ml: 0 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Uncheck for flat icons (logos, UI elements)
          </Typography>
        </Box>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

        {showAlert && (
          <Alert
            severity="info"
            onClose={dismissAlert}
            sx={{ cursor: 'pointer', mt: 1 }}
          >
            You can drag and drop any item below onto the canvas.
          </Alert>
        )}
      </Section>
    </ControlsContainer>
  );
};
