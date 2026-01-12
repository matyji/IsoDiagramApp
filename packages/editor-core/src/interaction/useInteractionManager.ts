import { useCallback, useEffect, useRef } from 'react';
import { useModelStore, useModelStoreApi } from 'src/stores/modelStore';
import { useUiStateStore, useUiStateStoreApi } from 'src/stores/uiStateStore';
import { ModeActions, State, SlimMouseEvent } from 'src/types';
import { DialogTypeEnum } from 'src/types/ui';
import { getMouse, getItemAtTile, generateId, incrementZoom, decrementZoom } from 'src/utils';
import { useResizeObserver } from 'src/hooks/useResizeObserver';
import { useScene } from 'src/hooks/useScene';
import { useHistory } from 'src/hooks/useHistory';
import { HOTKEY_PROFILES } from 'src/config/hotkeys';
import { TEXTBOX_DEFAULTS } from 'src/config';
import { Cursor } from './modes/Cursor';
import { DragItems } from './modes/DragItems';
import { DrawRectangle } from './modes/Rectangle/DrawRectangle';
import { TransformRectangle } from './modes/Rectangle/TransformRectangle';
import { Connector } from './modes/Connector';
import { Pan } from './modes/Pan';
import { PlaceIcon } from './modes/PlaceIcon';
import { TextBox } from './modes/TextBox';
import { Lasso } from './modes/Lasso';
import { FreehandLasso } from './modes/FreehandLasso';
import { usePanHandlers } from './usePanHandlers';

const modes: { [k in string]: ModeActions } = {
  CURSOR: Cursor,
  DRAG_ITEMS: DragItems,
  'RECTANGLE.DRAW': DrawRectangle,
  'RECTANGLE.TRANSFORM': TransformRectangle,
  CONNECTOR: Connector,
  PAN: Pan,
  PLACE_ICON: PlaceIcon,
  TEXTBOX: TextBox,
  LASSO: Lasso,
  FREEHAND_LASSO: FreehandLasso
};

const getModeFunction = (mode: ModeActions, e: SlimMouseEvent) => {
  switch (e.type) {
    case 'mousemove':
      return mode.mousemove;
    case 'mousedown':
      return mode.mousedown;
    case 'mouseup':
      return mode.mouseup;
    default:
      return null;
  }
};

export const useInteractionManager = () => {
  const rendererRef = useRef<HTMLElement>();
  const reducerTypeRef = useRef<string>();
  const uiStateApi = useUiStateStoreApi();
  const modelApi = useModelStoreApi();

  const hotkeyProfile = useUiStateStore((state) => state.hotkeyProfile);
  const editorMode = useUiStateStore((state) => state.editorMode);
  const modeType = useUiStateStore((state) => state.mode.type);
  const rendererEl = useUiStateStore((state) => state.rendererEl);
  const zoomSettings = useUiStateStore((state) => state.zoomSettings);
  const itemControls = useUiStateStore((state) => state.itemControls);
  const connectorInteractionMode = useUiStateStore((state) => state.connectorInteractionMode);

  const scene = useScene();
  const { size: rendererSize } = useResizeObserver(rendererEl);
  const { undo, redo, canUndo, canRedo } = useHistory();
  const { createTextBox, deleteConnector } = scene;
  const { handleMouseDown: handlePanMouseDown, handleMouseUp: handlePanMouseUp } = usePanHandlers();

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const currentUiState = uiStateApi.getState();

      // ESC key handling - should work even in input fields
      if (e.key === 'Escape') {
        e.preventDefault();

        // Priority 1: Close ItemControls (node menus) if open
        if (currentUiState.itemControls) {
          currentUiState.actions.setItemControls(null);
          return;
        }

        // Priority 2: Cancel in-progress connector
        if (currentUiState.mode.type === 'CONNECTOR') {
          const connectorMode = currentUiState.mode;

          // Check if connection is in progress
          const isConnectionInProgress =
            (currentUiState.connectorInteractionMode === 'click' && connectorMode.isConnecting) ||
            (currentUiState.connectorInteractionMode === 'drag' && connectorMode.id !== null);

          if (isConnectionInProgress && connectorMode.id) {
            // Delete the temporary connector
            deleteConnector(connectorMode.id);

            // Reset connector mode to initial state
            currentUiState.actions.setMode({
              type: 'CONNECTOR',
              showCursor: true,
              id: null,
              startAnchor: undefined,
              isConnecting: false
            });
          }
        }

        return;
      }

      // Don't handle shortcuts when typing in input fields or interacting with UI elements
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.getAttribute('role') === 'slider' ||
        target.closest('[role="slider"]') ||
        target.closest('.ql-editor') // Quill editor
      ) {
        return;
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) {
          undo();
        }
      }

      if (
        isCtrlOrCmd &&
        (e.key.toLowerCase() === 'y' ||
          (e.key.toLowerCase() === 'z' && e.shiftKey))
      ) {
        e.preventDefault();
        if (canRedo) {
          redo();
        }
      }

      // Help dialog shortcut
      if (e.key === 'F1') {
        e.preventDefault();
        currentUiState.actions.setDialog(DialogTypeEnum.HELP);
      }

      // Tool hotkeys
      const hotkeyMapping = HOTKEY_PROFILES[currentUiState.hotkeyProfile];
      const key = e.key.toLowerCase();

      // Quick icon selection for selected node (when ItemControls is an ItemReference with type 'ITEM')
      if (key === 'i' && currentUiState.itemControls && 'id' in currentUiState.itemControls && currentUiState.itemControls.type === 'ITEM') {
        e.preventDefault();
        // Trigger icon change mode
        const event = new CustomEvent('quickIconChange');
        window.dispatchEvent(event);
      }

      // Check if key matches any hotkey
      if (hotkeyMapping.select && key === hotkeyMapping.select) {
        e.preventDefault();
        currentUiState.actions.setMode({
          type: 'CURSOR',
          showCursor: true,
          mousedownItem: null
        });
      } else if (hotkeyMapping.pan && key === hotkeyMapping.pan) {
        e.preventDefault();
        currentUiState.actions.setMode({
          type: 'PAN',
          showCursor: false
        });
        currentUiState.actions.setItemControls(null);
      } else if (hotkeyMapping.addItem && key === hotkeyMapping.addItem) {
        e.preventDefault();
        currentUiState.actions.setItemControls({
          type: 'ADD_ITEM'
        });
        currentUiState.actions.setMode({
          type: 'PLACE_ICON',
          showCursor: true,
          id: null
        });
      } else if (hotkeyMapping.rectangle && key === hotkeyMapping.rectangle) {
        e.preventDefault();
        currentUiState.actions.setMode({
          type: 'RECTANGLE.DRAW',
          showCursor: true,
          id: null
        });
      } else if (hotkeyMapping.connector && key === hotkeyMapping.connector) {
        e.preventDefault();
        currentUiState.actions.setMode({
          type: 'CONNECTOR',
          id: null,
          showCursor: true
        });
      } else if (hotkeyMapping.text && key === hotkeyMapping.text) {
        e.preventDefault();
        const textBoxId = generateId();
        createTextBox({
          ...TEXTBOX_DEFAULTS,
          id: textBoxId,
          tile: currentUiState.mouse.position.tile
        });
        currentUiState.actions.setMode({
          type: 'TEXTBOX',
          showCursor: false,
          id: textBoxId
        });
      } else if (hotkeyMapping.lasso && key === hotkeyMapping.lasso) {
        e.preventDefault();
        currentUiState.actions.setMode({
          type: 'LASSO',
          showCursor: true,
          selection: null,
          isDragging: false
        });
      } else if (hotkeyMapping.freehandLasso && key === hotkeyMapping.freehandLasso) {
        e.preventDefault();
        currentUiState.actions.setMode({
          type: 'FREEHAND_LASSO',
          showCursor: true,
          path: [],
          selection: null,
          isDragging: false
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      return window.removeEventListener('keydown', handleKeyDown);
    };
  }, [undo, redo, canUndo, canRedo, deleteConnector, createTextBox, uiStateApi]);

  const onMouseEvent = useCallback(
    (e: SlimMouseEvent) => {
      if (!rendererRef.current) return;

      const currentUiState = uiStateApi.getState();
      const currentModel = modelApi.getState();

      // Check pan handlers first
      if (e.type === 'mousedown' && handlePanMouseDown(e)) {
        return;
      }
      if (e.type === 'mouseup' && handlePanMouseUp(e)) {
        return;
      }

      const isRendererInteraction =
        rendererRef.current === e.target ||
        rendererRef.current?.contains(e.target as Node);

      if (e.type === 'mousedown' && !isRendererInteraction) {
        return;
      }

      const mode = modes[currentUiState.mode.type];
      const modeFunction = getModeFunction(mode, e);

      if (!modeFunction) return;

      const nextMouse = getMouse({
        interactiveElement: rendererRef.current,
        zoom: currentUiState.zoom,
        scroll: currentUiState.scroll,
        lastMouse: currentUiState.mouse,
        mouseEvent: e,
        rendererSize
      });

      currentUiState.actions.setMouse(nextMouse);

      const baseState: State = {
        model: currentModel,
        scene,
        uiState: currentUiState,
        rendererRef: rendererRef.current,
        rendererSize,
        isRendererInteraction
      };

      if (reducerTypeRef.current !== currentUiState.mode.type) {
        const prevReducer = reducerTypeRef.current
          ? modes[reducerTypeRef.current]
          : null;

        if (prevReducer && prevReducer.exit) {
          prevReducer.exit(baseState);
        }

        if (mode.entry) {
          mode.entry(baseState);
        }
      }

      modeFunction(baseState);
      reducerTypeRef.current = currentUiState.mode.type;
    },
    [uiStateApi, modelApi, scene, rendererSize, handlePanMouseDown, handlePanMouseUp]
  );

  const onContextMenu = useCallback(
    (e: SlimMouseEvent) => {
      e.preventDefault();

      const currentUiState = uiStateApi.getState();

      // Don't show context menu if right-click pan is enabled
      if (currentUiState.panSettings.rightClickPan) {
        return;
      }

      const itemAtTile = getItemAtTile({
        tile: currentUiState.mouse.position.tile,
        scene
      });

      if (itemAtTile) {
        currentUiState.actions.setContextMenu({
          type: 'ITEM',
          item: itemAtTile,
          tile: currentUiState.mouse.position.tile
        });
      } else {
        currentUiState.actions.setContextMenu({
          type: 'EMPTY',
          tile: currentUiState.mouse.position.tile
        });
      }
    },
    [uiStateApi, scene]
  );

  useEffect(() => {
    const currentUiState = uiStateApi.getState();
    if (currentUiState.mode.type === 'INTERACTIONS_DISABLED') return;

    const el = window;

    const onTouchStart = (e: TouchEvent) => {
      onMouseEvent({
        ...e,
        clientX: Math.floor(e.touches[0].clientX),
        clientY: Math.floor(e.touches[0].clientY),
        type: 'mousedown',
        button: 0
      } as unknown as SlimMouseEvent);
    };

    const onTouchMove = (e: TouchEvent) => {
      onMouseEvent({
        ...e,
        clientX: Math.floor(e.touches[0].clientX),
        clientY: Math.floor(e.touches[0].clientY),
        type: 'mousemove',
        button: 0
      } as unknown as SlimMouseEvent);
    };

    const onTouchEnd = (e: TouchEvent) => {
      onMouseEvent({
        ...e,
        clientX: 0,
        clientY: 0,
        type: 'mouseup',
        button: 0
      } as unknown as SlimMouseEvent);
    };

    const onScroll = (e: WheelEvent) => {
      const state = uiStateApi.getState();
      const zoomToCursor = state.zoomSettings.zoomToCursor;
      const oldZoom = state.zoom;

      // Calculate new zoom level
      let newZoom: number;
      if (e.deltaY > 0) {
        newZoom = decrementZoom(oldZoom);
      } else {
        newZoom = incrementZoom(oldZoom);
      }

      // If zoom didn't change (at min/max), no need to adjust scroll
      if (newZoom === oldZoom) {
        return;
      }

      if (zoomToCursor && rendererRef.current && rendererSize) {
        // Get mouse position relative to the renderer viewport
        const rect = rendererRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculate mouse position relative to viewport center
        const mouseRelativeToCenterX = mouseX - rendererSize.width / 2;
        const mouseRelativeToCenterY = mouseY - rendererSize.height / 2;

        // The point under the cursor in world space (before zoom)
        const worldX = (mouseRelativeToCenterX - state.scroll.position.x) / oldZoom;
        const worldY = (mouseRelativeToCenterY - state.scroll.position.y) / oldZoom;

        // After zooming, to keep the same world point under the cursor:
        const newScrollX = mouseRelativeToCenterX - worldX * newZoom;
        const newScrollY = mouseRelativeToCenterY - worldY * newZoom;

        // Apply zoom and adjusted scroll together
        state.actions.setZoom(newZoom);
        state.actions.setScroll({
          position: {
            x: newScrollX,
            y: newScrollY
          },
          offset: state.scroll.offset
        });
      } else {
        // Original behavior: zoom to center
        state.actions.setZoom(newZoom);
      }
    };

    el.addEventListener('mousemove', onMouseEvent);
    el.addEventListener('mousedown', onMouseEvent);
    el.addEventListener('mouseup', onMouseEvent);
    el.addEventListener('contextmenu', onContextMenu);
    el.addEventListener('touchstart', onTouchStart);
    el.addEventListener('touchmove', onTouchMove);
    el.addEventListener('touchend', onTouchEnd);
    currentUiState.rendererEl?.addEventListener('wheel', onScroll, { passive: true });

    return () => {
      el.removeEventListener('mousemove', onMouseEvent);
      el.removeEventListener('mousedown', onMouseEvent);
      el.removeEventListener('mouseup', onMouseEvent);
      el.removeEventListener('contextmenu', onContextMenu);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      currentUiState.rendererEl?.removeEventListener('wheel', onScroll);
    };
  }, [
    onMouseEvent,
    onContextMenu,
    uiStateApi,
    rendererSize
  ]);

  const setInteractionsElement = useCallback((element: HTMLElement) => {
    rendererRef.current = element;
  }, []);

  return {
    setInteractionsElement
  };
};
