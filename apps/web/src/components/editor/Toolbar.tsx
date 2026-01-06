import React from 'react';
import { SavedDiagram } from '../../types';

interface ToolbarProps {
    isReadonlyUrl: boolean;
    serverStorageAvailable: boolean;
    diagramName: string;
    currentDiagram: SavedDiagram | null;
    hasUnsavedChanges: boolean;
    onNewDiagram: () => void;
    onSaveDialog: () => void;
    onLoadDialog: () => void;
    onExportDialog: () => void;
    onDiagramManager: () => void;
    onQuickSave: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
    isReadonlyUrl,
    serverStorageAvailable,
    diagramName,
    currentDiagram,
    hasUnsavedChanges,
    onNewDiagram,
    onSaveDialog,
    onLoadDialog,
    onExportDialog,
    onDiagramManager,
    onQuickSave
}) => {
    return (
        <div className="toolbar">
            {!isReadonlyUrl && (
                <>
                    <button onClick={onNewDiagram}>Nouveau diagramme</button>
                    {serverStorageAvailable && (
                        <button
                            onClick={onDiagramManager}
                            style={{ backgroundColor: '#2196F3', color: 'white' }}
                        >
                            🌐 Stockage sur serveur
                        </button>
                    )}
                    <button onClick={onSaveDialog}>Enregistrer (Session uniquement)</button>
                    <button onClick={onLoadDialog}>Charger (Session uniquement)</button>
                    <button
                        onClick={onExportDialog}
                        style={{ backgroundColor: '#007bff' }}
                    >
                        💾 Exporter un fichier
                    </button>
                    <button
                        onClick={onQuickSave}
                        disabled={!currentDiagram || !hasUnsavedChanges}
                        style={{
                            backgroundColor: currentDiagram && hasUnsavedChanges ? '#ffc107' : '#6c757d',
                            opacity: currentDiagram && hasUnsavedChanges ? 1 : 0.5,
                            cursor: currentDiagram && hasUnsavedChanges ? 'pointer' : 'not-allowed'
                        }}
                        title="Enregistrement rapide (Session)"
                    >
                        Enregistrement rapide (Session)
                    </button>
                </>
            )}

            {isReadonlyUrl && (
                <div
                    style={{
                        color: 'black',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        border: '2px solid #000000'
                    }}
                >
                    Mode lecture seule
                </div>
            )}

            <span className="current-diagram">
                {isReadonlyUrl ? (
                    <span>
                        Actuel: {diagramName}
                    </span>
                ) : (
                    <>
                        {currentDiagram
                            ? `Actuel: ${currentDiagram.name}`
                            : diagramName || 'Diagramme sans titre'}
                        {hasUnsavedChanges && (
                            <span style={{ color: '#ff9800', marginLeft: '10px' }}>
                                • Modifié
                            </span>
                        )}
                        <span style={{ fontSize: '12px', color: '#666', marginLeft: '10px' }}>
                            (Stockage de session uniquement - exportez pour enregistrer définitivement)
                        </span>
                    </>
                )}
            </span>
        </div>
    );
};

export default Toolbar;
