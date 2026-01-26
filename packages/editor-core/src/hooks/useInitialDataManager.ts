import { useCallback, useState, useRef } from 'react';
import { InitialData, IconCollectionState } from 'src/types';
import { INITIAL_DATA, INITIAL_SCENE_STATE } from 'src/config';
import {
  getFitToViewParams,
  CoordsUtils,
  categoriseIcons,
  generateId,
  getItemByIdOrThrow
} from 'src/utils';
import * as reducers from 'src/stores/reducers';
import { useModelStore } from 'src/stores/modelStore';
import { useView } from 'src/hooks/useView';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { modelSchema } from 'src/schemas/model';

export const useInitialDataManager = (onLoadError?: (error: any) => void) => {
  const [isReady, setIsReady] = useState(false);
  const prevInitialData = useRef<InitialData>();
  const model = useModelStore((state) => {
    return state;
  });
  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });
  const rendererEl = useUiStateStore((state) => {
    return state.rendererEl;
  });
  const editorMode = useUiStateStore((state) => {
    return state.editorMode;
  });
  const { changeView } = useView();

  const load = useCallback(
    (_initialData: InitialData) => {
      if (!_initialData || prevInitialData.current === _initialData) return;

      // Deep comparison to prevent unnecessary reloads when data hasn't actually changed
      // Skip this check for NON_INTERACTIVE mode (used by export) to ensure proper initialization
      if (prevInitialData.current && editorMode !== 'NON_INTERACTIVE') {
        const prevConnectors = JSON.stringify(prevInitialData.current.views?.[0]?.connectors || []);
        const newConnectors = JSON.stringify(_initialData.views?.[0]?.connectors || []);
        const prevItems = JSON.stringify(prevInitialData.current.items || []);
        const newItems = JSON.stringify(_initialData.items || []);
        const prevIcons = JSON.stringify(prevInitialData.current.icons || []);
        const newIcons = JSON.stringify(_initialData.icons || []);
        const prevColors = JSON.stringify(prevInitialData.current.colors || []);
        const newColors = JSON.stringify(_initialData.colors || []);

        if (prevConnectors === newConnectors && prevItems === newItems &&
          prevIcons === newIcons && prevColors === newColors) {
          // Data hasn't actually changed, skip reload
          return;
        }
      }

      setIsReady(false);

      const validationResult = modelSchema.safeParse(_initialData);

      if (!validationResult.success) {
        if (onLoadError) {
          onLoadError(validationResult.error);
        }
        // Prevent infinite loops if INITIAL_DATA itself fails (should not happen but safety first)
        const isDefaultData = _initialData.title === INITIAL_DATA.title && _initialData.items.length === 0;

        if (isDefaultData) {
          console.error('CRITICAL: Default data failed validation!');
          return;
        }

        const errorMessages = validationResult.error.errors
          .slice(0, 3)
          .map((e) => `• ${e.path.join('.') || 'root'}: ${e.message}`)
          .join('\n');

        console.error('Model validation errors:', validationResult.error.errors);

        window.alert(
          `Erreur au chargement du modèle :\n${errorMessages}${validationResult.error.errors.length > 3 ? '\n... (et d\'autres)' : ''
          }\n\nLe diagramme va être réinitialisé pour éviter un plantage.`
        );

        // Reset to initial data to prevent app crash
        // We do this immediately to stop the current's load progress
        clear();
        return;
      }

      // Clean up invalid connector references before loading
      const initialData = { ..._initialData };
      initialData.views = initialData.views.map(view => {
        if (!view.connectors) return view;

        const validConnectors = view.connectors.filter(connector => {
          // Check if all anchors reference existing items
          const hasValidAnchors = connector.anchors.every(anchor => {
            if (anchor.ref.item) {
              // Check if the referenced item exists in the view
              return view.items.some(item => item.id === anchor.ref.item);
            }
            return true; // Allow anchors that reference other anchors
          });

          if (!hasValidAnchors) {
            console.warn(`Removing connector ${connector.id} due to invalid item references`);
          }

          return hasValidAnchors;
        });

        return { ...view, connectors: validConnectors };
      });

      if (initialData.views.length === 0) {
        const updates = reducers.view({
          action: 'CREATE_VIEW',
          payload: {},
          ctx: {
            state: { model: initialData, scene: INITIAL_SCENE_STATE },
            viewId: generateId()
          }
        });

        Object.assign(initialData, updates.model);
      }

      prevInitialData.current = initialData;
      model.actions.set(initialData);

      const view = getItemByIdOrThrow(
        initialData.views,
        initialData.view ?? initialData.views[0].id
      );

      changeView(view.value.id, initialData);


      const categoriesState: IconCollectionState[] = categoriseIcons(
        initialData.icons
      ).map((collection) => {
        return {
          id: collection.name,
          isExpanded: false
        };
      });

      uiStateActions.setIconCategoriesState(categoriesState);

      setIsReady(true);
    },
    [changeView, model.actions, rendererEl, uiStateActions, editorMode]
  );

  const clear = useCallback(() => {
    load({ ...INITIAL_DATA, icons: model.icons, colors: model.colors });
    uiStateActions.resetUiState();
  }, [load, model.icons, model.colors, uiStateActions]);

  return {
    load,
    clear,
    isReady
  };
};
