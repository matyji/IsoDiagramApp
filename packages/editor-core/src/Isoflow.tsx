import React, { useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { Box } from '@mui/material';
import { theme } from 'src/styles/theme';
import { IsoflowProps } from 'src/types';
import { setWindowCursor, modelFromModelStore, CoordsUtils, getFitToViewParams, getItemByIdOrThrow } from 'src/utils';
import { useModelStore, ModelProvider } from 'src/stores/modelStore';
import { SceneProvider } from 'src/stores/sceneStore';
import { LocaleProvider } from 'src/stores/localeStore';
import { GlobalStyles } from 'src/styles/GlobalStyles';
import { Renderer } from 'src/components/Renderer/Renderer';
import { UiOverlay } from 'src/components/UiOverlay/UiOverlay';
import { UiStateProvider, useUiStateStore } from 'src/stores/uiStateStore';
import { INITIAL_DATA, MAIN_MENU_OPTIONS } from 'src/config';
import { useInitialDataManager } from 'src/hooks/useInitialDataManager';
import frFR from 'src/i18n/fr-FR';

const App = (props: IsoflowProps) => {
  const {
    initialData,
    mainMenuOptions = MAIN_MENU_OPTIONS,
    width = '100%',
    height = '100%',
    onModelUpdated,
    enableDebugTools = false,
    editorMode = 'EDITABLE',
    renderer,
    locale = frFR,
    iconPackManager,
  } = props;
  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });
  const initialDataManager = useInitialDataManager();
  const model = useModelStore((state) => {
    return modelFromModelStore(state);
  });

  const { load } = initialDataManager;

  useEffect(() => {
    load({ ...INITIAL_DATA, ...initialData });
  }, [initialData, load]);

  useEffect(() => {
    uiStateActions.setEditorMode(editorMode);
    uiStateActions.setMainMenuOptions(mainMenuOptions);
  }, [editorMode, uiStateActions, mainMenuOptions]);

  useEffect(() => {
    return () => {
      setWindowCursor('default');
    };
  }, []);

  useEffect(() => {
    if (!initialDataManager.isReady || !onModelUpdated) return;

    onModelUpdated(model);
  }, [model, initialDataManager.isReady, onModelUpdated]);

  useEffect(() => {
    uiStateActions.setEnableDebugTools(enableDebugTools);
  }, [enableDebugTools, uiStateActions]);

  useEffect(() => {
    if (renderer?.expandLabels !== undefined) {
      uiStateActions.setExpandLabels(renderer.expandLabels);
    }
  }, [renderer?.expandLabels, uiStateActions]);

  useEffect(() => {
    uiStateActions.setIconPackManager(iconPackManager || null);
  }, [iconPackManager, uiStateActions]);

  // Handle app actions
  const appActions = React.useMemo(() => ({
    onNew: props.onNew,
    onSave: props.onSave,
    onQuickSave: props.onQuickSave,
    onLoad: props.onLoad,
    onExport: props.onExport,
    onSettings: props.onSettings,
    onServerStorage: props.onServerStorage,
    isModified: props.isModified,
    diagramName: props.diagramName
  }), [props.onNew, props.onSave, props.onQuickSave, props.onLoad, props.onExport, props.onSettings, props.onServerStorage, props.isModified, props.diagramName]);

  useEffect(() => {
    uiStateActions.setAppActions(appActions);
  }, [appActions, uiStateActions]);

  const rendererEl = useUiStateStore((state) => state.rendererEl);
  const viewId = useUiStateStore((state) => state.view);
  const views = useModelStore((state) => state.views);
  const hasFitToViewRef = React.useRef(false);

  // Reset the ref when not ready or when the view changes
  useEffect(() => {
    if (!initialDataManager.isReady) {
      hasFitToViewRef.current = false;
    }
  }, [initialDataManager.isReady, viewId]);

  useEffect(() => {
    if (!initialDataManager.isReady || !rendererEl || !initialData?.fitToView || !views || views.length === 0) return;

    // In editable mode, only fit once per view change/load to avoid jumping while adding elements
    if (editorMode !== 'NON_INTERACTIVE' && hasFitToViewRef.current) return;

    const rendererSize = rendererEl.getBoundingClientRect();
    const width = rendererSize.width;
    const height = rendererSize.height;

    if (width > 0 && height > 0) {
      const view = getItemByIdOrThrow(
        views,
        viewId ?? views[0].id
      );

      const { zoom, scroll } = getFitToViewParams(view.value, { width, height });

      uiStateActions.setScroll({
        position: scroll,
        offset: CoordsUtils.zero()
      });

      uiStateActions.setZoom(zoom);
      hasFitToViewRef.current = true;
      console.log(`[Isoflow] fitToView applied: zoom=${zoom}, scroll=${JSON.stringify(scroll)}`);
    } else {
      console.warn('[Isoflow] rendererEl has 0 size, skipping fitToView');
    }
  }, [initialDataManager.isReady, rendererEl, initialData?.fitToView, viewId, views, uiStateActions, editorMode]);

  if (!initialDataManager.isReady) return null;

  return (
    <>
      <GlobalStyles />
      <Box
        data-is-ready={initialDataManager.isReady}
        data-editor-mode={editorMode}
        sx={{
          width,
          height,
          position: 'relative',
          overflow: 'hidden',
          transform: 'translateZ(0)'
        }}
      >
        <Renderer {...renderer} />
        <UiOverlay />
      </Box>
    </>
  );
};

export const Isoflow = (props: IsoflowProps) => {
  return (
    <ThemeProvider theme={theme}>
      <LocaleProvider locale={props.locale || frFR}>
        <ModelProvider>
          <SceneProvider>
            <UiStateProvider>
              <App {...props} />
            </UiStateProvider>
          </SceneProvider>
        </ModelProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
};

const useIsoflow = () => {
  const rendererEl = useUiStateStore((state) => {
    return state.rendererEl;
  });

  const ModelActions = useModelStore((state) => {
    return state.actions;
  });

  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });

  return {
    Model: ModelActions,
    uiState: uiStateActions,
    rendererEl
  };
};

export { useIsoflow };
export * from 'src/standaloneExports';
export default Isoflow;
