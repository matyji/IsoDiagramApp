import React from 'react';
import { ProjectionOrientationEnum } from 'src/types';
import {
  Box,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Slider,
  IconButton as MUIIconButton,
  Typography,
  Stack
} from '@mui/material';
import {
  TextRotationNone as TextRotationNoneIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useTextBox } from 'src/hooks/useTextBox';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { getIsoProjectionCss } from 'src/utils';
import { useScene } from 'src/hooks/useScene';
import { ControlsContainer } from '../components/ControlsContainer';
import { Section } from '../components/Section';
import { DeleteButton } from '../components/DeleteButton';

interface Props {
  id: string;
}

export const TextBoxControls = ({ id }: Props) => {
  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });
  const textBox = useTextBox(id);
  const { updateTextBox, deleteTextBox } = useScene();

  // If textBox doesn't exist, return null
  if (!textBox) {
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
            Textbox
          </Typography>
        </Stack>
      </Box>

      <Section title="Enter text">
        <TextField
          value={textBox.content}
          onChange={(e) => {
            updateTextBox(textBox.id, { content: e.target.value as string });
          }}
          fullWidth
          size="small"
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              bgcolor: '#f8fafc',
              '& fieldset': {
                borderColor: '#e2e8f0',
              },
              '&:hover fieldset': {
                borderColor: '#cbd5e1',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#2563eb',
                borderWidth: '1px',
              },
            },
            '& .MuiInputBase-input': {
              fontSize: '0.875rem',
              py: 1.5
            }
          }}
        />
      </Section>
      <Section title="Text size" valueDisplay={`${Math.round(textBox.fontSize * 100)}%`}>
        <Slider
          step={0.1}
          min={0.3}
          max={1.5}
          value={textBox.fontSize}
          onChange={(e, newSize) => {
            updateTextBox(textBox.id, { fontSize: newSize as number });
          }}
          sx={{
            color: '#3b82f6',
            height: 4,
            '& .MuiSlider-thumb': {
              width: 14,
              height: 14,
              transition: '0.3s cubic-bezier(.47,1.64,.41,.8)',
            },
            '& .MuiSlider-rail': {
              opacity: 0.1,
              bgcolor: '#3b82f6',
            },
          }}
        />
      </Section>
      <Section title="Alignment">
        <ToggleButtonGroup
          value={textBox.orientation}
          exclusive
          onChange={(e, orientation) => {
            if (textBox.orientation === orientation || orientation === null)
              return;

            updateTextBox(textBox.id, { orientation });
          }}
          size="small"
          sx={{
            width: '100%',
            '& .MuiToggleButton-root': {
              flex: 1,
              borderRadius: 2,
              border: '1px solid #f1f5f9',
              '&.Mui-selected': {
                bgcolor: '#eff6ff',
                color: '#2563eb',
                borderColor: '#bfdbfe'
              }
            }
          }}
        >
          <ToggleButton value={ProjectionOrientationEnum.X}>
            <TextRotationNoneIcon sx={{ transform: getIsoProjectionCss() }} />
          </ToggleButton>
          <ToggleButton value={ProjectionOrientationEnum.Y}>
            <TextRotationNoneIcon
              sx={{
                transform: `scale(-1, 1) ${getIsoProjectionCss()} scale(-1, 1)`
              }}
            />
          </ToggleButton>
        </ToggleButtonGroup>
      </Section>
      <Section sx={{ pb: 4 }}>
        <Box>
          <DeleteButton
            onClick={() => {
              uiStateActions.setItemControls(null);
              deleteTextBox(textBox.id);
            }}
          />
        </Box>
      </Section>
    </ControlsContainer>
  );
};
