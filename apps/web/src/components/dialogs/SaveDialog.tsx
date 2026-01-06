import React from 'react';

interface SaveDialogProps {
    diagramName: string;
    setDiagramName: (name: string) => void;
    onSave: () => void;
    onClose: () => void;
}

const SaveDialog: React.FC<SaveDialogProps> = ({
    diagramName,
    setDiagramName,
    onSave,
    onClose
}) => {
    return (
        <div className="dialog-overlay">
            <div className="dialog">
                <h2>Enregistrer le diagramme (Session actuelle uniquement)</h2>
                <div
                    style={{
                        backgroundColor: '#fff3cd',
                        border: '1px solid #ffeeba',
                        padding: '15px',
                        borderRadius: '4px',
                        marginBottom: '20px'
                    }}
                >
                    <strong>⚠️ Important:</strong>{' '}
                    Cet enregistrement est temporaire et sera perdu lors de la fermeture du navigateur.
                    <br />
                    <span>
                        Utilisez <strong>Exporter un fichier</strong> pour enregistrer votre travail de manière permanente.
                    </span>
                </div>
                <input
                    type="text"
                    placeholder="Entrez le nom du diagramme"
                    value={diagramName}
                    onChange={(e) => setDiagramName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onSave()}
                    autoFocus
                />
                <div className="dialog-buttons">
                    <button onClick={onSave}>Enregistrer</button>
                    <button onClick={onClose}>Annuler</button>
                </div>
            </div>
        </div>
    );
};

export default SaveDialog;
