import React, { useCallback } from 'react';
import { Stack } from '@mui/material';
import {
  PanToolOutlined as PanToolIcon,
  NearMeOutlined as NearMeIcon,
  AddOutlined as AddIcon,
  EastOutlined as ConnectorIcon,
  CropSquareOutlined as CropSquareIcon,
  Title as TitleIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  NoteAddOutlined as NoteAddIcon,
  FolderOpenOutlined as FolderOpenIcon,
  SaveOutlined as SaveIcon,
  FlashOnOutlined as QuickSaveIcon,
  HighlightAltOutlined as LassoIcon,
  GestureOutlined as FreehandLassoIcon,
  CloudQueueOutlined as CloudIcon,
  FileUploadOutlined as ExportIcon,
  PublicOutlined as WorldIcon,
  ViewInArOutlined as CubeIcon
} from '@mui/icons-material';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { IconButton } from 'src/components/IconButton/IconButton';
import { UiElement } from 'src/components/UiElement/UiElement';
import { useScene } from 'src/hooks/useScene';
import { useHistory } from 'src/hooks/useHistory';
import { TEXTBOX_DEFAULTS } from 'src/config';
import { generateId, findNearestUnoccupiedTile } from 'src/utils';
import { HOTKEY_PROFILES } from 'src/config/hotkeys';
import { VIEW_ITEM_DEFAULTS } from 'src/config';
import { useModelStore } from 'src/stores/modelStore';

export const ToolMenu = () => {
  const { createTextBox } = useScene();
  const { undo, redo, canUndo, canRedo } = useHistory();
  const mode = useUiStateStore((state) => {
    return state.mode;
  });
  const uiStateStoreActions = useUiStateStore((state) => {
    return state.actions;
  });
  const mousePosition = useUiStateStore((state) => {
    return state.mouse.position.tile;
  });
  const hotkeyProfile = useUiStateStore((state) => {
    return state.hotkeyProfile;
  });
  const appActions = useUiStateStore((state) => {
    return state.appActions;
  });
  const itemControls = useUiStateStore((state) => {
    return state.itemControls;
  });
  const modelIcons = useModelStore((state) => state.icons);
  const scene = useScene();

  const hotkeys = HOTKEY_PROFILES[hotkeyProfile];

  const handleUndo = useCallback(() => {
    undo();
  }, [undo]);

  const handleRedo = useCallback(() => {
    redo();
  }, [redo]);

  const createTextBoxProxy = useCallback(() => {
    const textBoxId = generateId();

    scene.createTextBox({
      ...TEXTBOX_DEFAULTS,
      id: textBoxId,
      tile: mousePosition
    });

    uiStateStoreActions.setMode({
      type: 'TEXTBOX',
      showCursor: false,
      id: textBoxId
    });
  }, [uiStateStoreActions, scene, mousePosition]);

  const handleAddNode = useCallback(() => {
    if (modelIcons.length > 0) {
      const modelItemId = generateId();
      const firstIcon = modelIcons[0];
      const targetTile = findNearestUnoccupiedTile(mousePosition, scene) || mousePosition;

      scene.placeIcon({
        modelItem: {
          id: modelItemId,
          name: 'Nouvelle node',
          icon: firstIcon.id
        },
        viewItem: {
          ...VIEW_ITEM_DEFAULTS,
          id: modelItemId,
          tile: targetTile
        }
      });
    }
  }, [modelIcons, mousePosition, scene]);

  return (
    <Stack direction="row" spacing={2} alignItems="center">
      {/* Group 1: File Actions */}
      <UiElement>
        <Stack direction="row" spacing={0.5}>
          <IconButton
            name="Nouveau diagramme"
            Icon={<NoteAddIcon />}
            onClick={() => appActions?.onNew?.()}
          />
          <IconButton
            name="Charger un diagramme"
            Icon={<FolderOpenIcon />}
            onClick={() => appActions?.onLoad?.()}
          />
          <IconButton
            name="Enregistrer (Session)"
            Icon={<SaveIcon />}
            onClick={() => appActions?.onSave?.()}
          />
          <IconButton
            name="Enregistrement rapide"
            Icon={<QuickSaveIcon />}
            onClick={() => appActions?.onQuickSave?.()}
            isActive={appActions?.isModified}
          />
        </Stack>
      </UiElement>

      {/* Group 2: History */}
      <UiElement>
        <Stack direction="row" spacing={0.5}>
          <IconButton
            name="Annuler (Ctrl+Z)"
            Icon={<UndoIcon />}
            onClick={handleUndo}
            disabled={!canUndo}
          />
          <IconButton
            name="Rétablir (Ctrl+Y)"
            Icon={<RedoIcon />}
            onClick={handleRedo}
            disabled={!canRedo}
          />
        </Stack>
      </UiElement>

      {/* Group 3: Interaction Modes */}
      <UiElement>
        <Stack direction="row" spacing={0.5}>
          <IconButton
            name={`Sélectionner${hotkeys.select ? ` (${hotkeys.select.toUpperCase()})` : ''}`}
            Icon={<NearMeIcon />}
            onClick={() => {
              uiStateStoreActions.setMode({
                type: 'CURSOR',
                showCursor: true,
                mousedownItem: null
              });
            }}
            isActive={mode.type === 'CURSOR' || mode.type === 'DRAG_ITEMS'}
          />
          <IconButton
            name={`Panoramique${hotkeys.pan ? ` (${hotkeys.pan.toUpperCase()})` : ''}`}
            Icon={<PanToolIcon />}
            onClick={() => {
              uiStateStoreActions.setMode({
                type: 'PAN',
                showCursor: false
              });

              uiStateStoreActions.setItemControls(null);
            }}
            isActive={mode.type === 'PAN'}
          />
          <IconButton
            name={`Sélection lasso${hotkeys.lasso ? ` (${hotkeys.lasso.toUpperCase()})` : ''}`}
            Icon={<LassoIcon />}
            onClick={() => {
              uiStateStoreActions.setMode({
                type: 'LASSO',
                showCursor: true,
                selection: null,
                isDragging: false
              });
            }}
            isActive={mode.type === 'LASSO'}
          />
          <IconButton
            name={`Lasso libre${hotkeys.freehandLasso ? ` (${hotkeys.freehandLasso.toUpperCase()})` : ''}`}
            Icon={<FreehandLassoIcon />}
            onClick={() => {
              uiStateStoreActions.setMode({
                type: 'FREEHAND_LASSO',
                showCursor: true,
                path: [],
                selection: null,
                isDragging: false
              });
            }}
            isActive={mode.type === 'FREEHAND_LASSO'}
          />
        </Stack>
      </UiElement>

      {/* Group 4: Element Creation */}
      <UiElement>
        <Stack direction="row" spacing={0.5}>
          <IconButton
            name="Ajouter une node"
            Icon={<CubeIcon />}
            onClick={handleAddNode}
          />
          <IconButton
            name={`Ajouter une icône${hotkeys.addItem ? ` (${hotkeys.addItem.toUpperCase()})` : ''}`}
            Icon={<AddIcon />}
            onClick={() => {
              uiStateStoreActions.setItemControls({
                type: 'ADD_ITEM'
              });
              uiStateStoreActions.setMode({
                type: 'PLACE_ICON',
                showCursor: true,
                id: null
              });
            }}
            isActive={mode.type === 'PLACE_ICON' || (mode.type === 'CURSOR' && itemControls?.type === 'ADD_ITEM')}
          />
          <IconButton
            name={`Rectangle${hotkeys.rectangle ? ` (${hotkeys.rectangle.toUpperCase()})` : ''}`}
            Icon={<CropSquareIcon />}
            onClick={() => {
              uiStateStoreActions.setMode({
                type: 'RECTANGLE.DRAW',
                showCursor: true,
                id: null
              });
            }}
            isActive={mode.type === 'RECTANGLE.DRAW'}
          />
          <IconButton
            name={`Connecteur${hotkeys.connector ? ` (${hotkeys.connector.toUpperCase()})` : ''}`}
            Icon={<ConnectorIcon />}
            onClick={() => {
              uiStateStoreActions.setMode({
                type: 'CONNECTOR',
                id: null,
                showCursor: true
              });
            }}
            isActive={mode.type === 'CONNECTOR'}
          />
          <IconButton
            name={`Texte${hotkeys.text ? ` (${hotkeys.text.toUpperCase()})` : ''}`}
            Icon={<TitleIcon />}
            onClick={createTextBoxProxy}
            isActive={mode.type === 'TEXTBOX'}
          />
        </Stack>
      </UiElement>

      {/* Group 5: Share & Cloud */}
      <UiElement>
        <Stack direction="row" spacing={0.5}>
          <IconButton
            name="Stockage Serveur"
            Icon={<WorldIcon />}
            onClick={() => appActions?.onServerStorage?.()}
          />
          <IconButton
            name="Partager / Exporter"
            Icon={<ExportIcon />}
            onClick={() => appActions?.onExport?.()}
          />
        </Stack>
      </UiElement>
    </Stack>
  );
};
