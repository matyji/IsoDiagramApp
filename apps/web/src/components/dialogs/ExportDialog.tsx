import React from 'react';

interface ExportDialogProps {
    onExport: () => void;
    onClose: () => void;
}

const ExportDialog: React.FC<ExportDialogProps> = ({
    onExport,
    onClose
}) => {
    return (
        <div className="dialog-overlay">
            <div className="dialog">
                <h2>Exporter le diagramme</h2>
                <div
                    style={{
                        backgroundColor: '#d4edda',
                        border: '1px solid #c3e6cb',
                        padding: '15px',
                        borderRadius: '8px',
                        marginBottom: '20px'
                    }}
                >
                    <p style={{ margin: '0 0 10px 0' }}>
                        <strong>✅ Recommandé:</strong>{' '}
                        C'est la meilleure façon d'enregistrer votre travail de manière permanente.
                    </p>
                    <p style={{ margin: 0, fontSize: '14px', color: '#155724' }}>
                        Les fichiers JSON exportés peuvent être importés ultérieurement ou partagés avec d'autres.
                    </p>
                </div>
                <div className="dialog-buttons">
                    <button onClick={onExport}>Télécharger JSON</button>
                    <button onClick={onClose}>Annuler</button>
                </div>
            </div>
        </div>
    );
};

export default ExportDialog;
