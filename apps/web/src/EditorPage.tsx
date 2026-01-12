import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Isoflow, allLocales } from 'fossflow';
import { flattenCollections } from '@isoflow/isopacks/dist/utils';
import isoflowIsopack from '@isoflow/isopacks/dist/isoflow';

import { useIconPackManager } from './services/iconPackManager';
import { useDiagram } from './hooks/useDiagram';
import Toolbar from './components/editor/Toolbar';
import SaveDialog from './components/dialogs/SaveDialog';
import LoadDialog from './components/dialogs/LoadDialog';
import ExportDialog from './components/dialogs/ExportDialog';
import { StorageManager } from './StorageManager';
import { DiagramManager } from './components/DiagramManager';

import './App.css';

// Load core isoflow icons (always loaded)
const coreIcons = flattenCollections([isoflowIsopack]);

const EditorPage: React.FC = () => {
    const { readonlyDiagramId } = useParams<{ readonlyDiagramId: string }>();
    const isReadonlyUrl = window.location.pathname.startsWith('/display/') && !!readonlyDiagramId;
    const searchParams = new URLSearchParams(window.location.search);
    const isExportMode = searchParams.get('export') === 'true';

    // Hooks
    const iconPackManager = useIconPackManager(coreIcons);
    const diagram = useDiagram({
        coreIcons,
        iconPackManager,
        isReadonlyUrl,
        readonlyDiagramId
    });

    const editorMode = isExportMode
        ? 'NON_INTERACTIVE'
        : isReadonlyUrl
            ? 'EXPLORABLE_READONLY'
            : 'EDITABLE';

    // UI State for Dialogs
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [showLoadDialog, setShowLoadDialog] = useState(false);
    const [showExportDialog, setShowExportDialog] = useState(false);
    const [showStorageManager, setShowStorageManager] = useState(false);
    const [showDiagramManager, setShowDiagramManager] = useState(false);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (diagram.currentDiagram && diagram.hasUnsavedChanges) {
                    diagram.saveDiagram();
                } else {
                    setShowSaveDialog(true);
                }
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
                e.preventDefault();
                setShowLoadDialog(true);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [diagram, diagram.currentDiagram, diagram.hasUnsavedChanges]);

    // Warn before closing if there are unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (diagram.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = 'Vous avez des modifications non enregistrées. Êtes-vous sûr de vouloir partir ?';
                return e.returnValue;
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [diagram.hasUnsavedChanges]);

    return (
        <div className="App">

            <div className="fossflow-container">
                <Isoflow
                    key={diagram.fossflowKey}
                    initialData={diagram.diagramData}
                    onModelUpdated={diagram.handleModelUpdated}
                    editorMode={editorMode as any}
                    locale={allLocales['fr-FR']}
                    onNew={diagram.newDiagram}
                    onSave={() => setShowSaveDialog(true)}
                    onQuickSave={diagram.saveDiagram}
                    onLoad={() => setShowLoadDialog(true)}
                    onExport={() => setShowExportDialog(true)}
                    onServerStorage={() => setShowDiagramManager(true)}
                    isModified={diagram.hasUnsavedChanges}
                    diagramName={diagram.diagramName}
                    iconPackManager={{
                        lazyLoadingEnabled: iconPackManager.lazyLoadingEnabled,
                        onToggleLazyLoading: iconPackManager.toggleLazyLoading,
                        packInfo: Object.values(iconPackManager.packInfo),
                        enabledPacks: iconPackManager.enabledPacks,
                        onTogglePack: (packName: string, enabled: boolean) => {
                            iconPackManager.togglePack(packName as any, enabled);
                        }
                    }}
                />
            </div>

            {showSaveDialog && (
                <SaveDialog
                    diagramName={diagram.diagramName}
                    setDiagramName={diagram.setDiagramName}
                    onSave={() => {
                        diagram.saveDiagram();
                        setShowSaveDialog(false);
                    }}
                    onClose={() => setShowSaveDialog(false)}
                />
            )}

            {showLoadDialog && (
                <LoadDialog
                    diagrams={diagram.diagrams}
                    onLoad={(d) => {
                        diagram.loadDiagram(d);
                        setShowLoadDialog(false);
                    }}
                    onDelete={diagram.deleteDiagram}
                    onClose={() => setShowLoadDialog(false)}
                />
            )}

            {showExportDialog && (
                <ExportDialog
                    onExport={() => {
                        diagram.exportDiagram();
                        setShowExportDialog(false);
                    }}
                    onClose={() => setShowExportDialog(false)}
                />
            )}

            {showStorageManager && (
                <StorageManager onClose={() => setShowStorageManager(false)} />
            )}

            {showDiagramManager && (
                <DiagramManager
                    onLoadDiagram={(id, data) => {
                        diagram.handleDiagramManagerLoad(id, data);
                        setShowDiagramManager(false);
                    }}
                    currentDiagramId={diagram.currentDiagram?.id}
                    currentDiagramData={diagram.currentModel || diagram.diagramData}
                    onClose={() => setShowDiagramManager(false)}
                />
            )}
        </div>
    );
};

export default EditorPage;