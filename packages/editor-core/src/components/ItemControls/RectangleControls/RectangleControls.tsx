import React, { useState } from 'react';
import { Box, IconButton as MUIIconButton, FormControlLabel, Switch, Typography, Stack, Slider } from '@mui/material';
import { useRectangle } from 'src/hooks/useRectangle';
import { ColorSelector } from 'src/components/ColorSelector/ColorSelector';
import { ColorPicker } from 'src/components/ColorSelector/ColorPicker';
import { CustomColorInput } from 'src/components/ColorSelector/CustomColorInput';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import { Close as CloseIcon } from '@mui/icons-material';
import { ControlsContainer } from '../components/ControlsContainer';
import { Section } from '../components/Section';
import { DeleteButton } from '../components/DeleteButton';

interface Props {
  id: string;
}

export const RectangleControls = ({ id }: Props) => {
  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });
  const rectangle = useRectangle(id);
  const { updateRectangle, deleteRectangle } = useScene();
  const [useCustomColor, setUseCustomColor] = useState(!!rectangle?.customColor);

  // If rectangle doesn't exist, return null
  if (!rectangle) {
    return null;
  }

  return (
    <ControlsContainer>
      <Box
        sx={{
          bgcolor: 'white',
          position: 'relative',
          pt: 3,
          pb: 1,
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

        <Stack alignItems="center" spacing={1}>
          <Typography
            variant="caption"
            sx={{
              color: '#94a3b8',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}
          >
            Rectangle
          </Typography>
        </Stack>
      </Box>

      <Section title="Color">
        <FormControlLabel
          control={
            <Switch
              checked={useCustomColor}
              onChange={(e) => {
                setUseCustomColor(e.target.checked);
                if (!e.target.checked) {
                  updateRectangle(rectangle.id, { customColor: '' });
                }
              }}
            />
          }
          label="Use Custom Color"
          sx={{ mb: 2 }}
        />
        {useCustomColor ? (
          <CustomColorInput
            value={rectangle.customColor || '#000000'}
            onChange={(color) => {
              updateRectangle(rectangle.id, { customColor: color });
            }}
          />
        ) : (
          <ColorSelector
            onChange={(color) => {
              updateRectangle(rectangle.id, { color, customColor: '' });
            }}
            activeColor={rectangle.color}
          />
        )}
      </Section>
      <Section title="Format 3D">
        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
          Hauteur (épaisseur)
        </Typography>
        <Box sx={{ px: 1 }}>
          <Slider
            value={rectangle.height ?? 0}
            min={0}
            max={300}
            step={5}
            size="small"
            onChange={(_, value) => {
              updateRectangle(rectangle.id, { height: value as number });
            }}
            valueLabelDisplay="auto"
          />
        </Box>
      </Section>
      <Section sx={{ pb: 4 }}>
        <Box>
          <DeleteButton
            onClick={() => {
              uiStateActions.setItemControls(null);
              deleteRectangle(rectangle.id);
            }}
          />
        </Box>
      </Section>
    </ControlsContainer>
  );
};
